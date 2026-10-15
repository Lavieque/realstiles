import { NextRequest, NextResponse } from 'next/server';
import { referenciaEncomendaServer } from '@/lib/referencia-server';
import { adminDb } from '@/lib/firebase-admin';
import { autenticar, encomendaDoCaller } from '@/lib/permissoes-server';
import type { Permissao } from '@/lib/permissoes';
import {
  configEmail, enviarEmails, esc, escMultilinha, estadoLabel,
  gerarEmailBemVindo, gerarEmailConfirmacao, gerarEmailEstado,
  gerarEmailReclamacaoAdmin, gerarEmailReclamacaoCliente,
  gerarEmailReclamacaoResolvida, gerarEmailRespostaReclamacao,
} from '@/lib/email';
import type { Envio, ItemEmail } from '@/lib/email';

// Emails em nome da loja para o cliente: só o staff com a permissão os dispara
const TIPOS_STAFF: Record<string, Permissao> = {
  estado_encomenda: 'encomendas',
  resposta_reclamacao: 'reclamacoes',
  reclamacao_resolvida: 'reclamacoes',
};

export async function POST(req: NextRequest) {
  const caller = await autenticar(req);
  if (caller instanceof NextResponse) return caller;

  try {
    const body = await req.json();
    const { tipo } = body;

    const permStaff = TIPOS_STAFF[tipo];
    if (permStaff && !caller.permissoes.has(permStaff)) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    }
    // Documentos de onde sai o conteúdo dos emails de cliente. O corpo do
    // pedido serve só para dizer QUAL encomenda ou reclamação — os textos, os
    // valores e o destinatário vêm daqui, para o cliente não poder compor um
    // email arbitrário assinado pelo domínio da loja.
    const emailsDoPedido: string[] = [];

    let encomendaDoPedido: Record<string, unknown> | null = null;
    if (tipo === 'confirmacao_encomenda' || tipo === 'cancelamento_cliente') {
      encomendaDoPedido = await encomendaDoCaller(caller, String(body.encomenda_id ?? ''));
      if (!encomendaDoPedido) return NextResponse.json({ error: 'Encomenda não encontrada' }, { status: 403 });
      if (encomendaDoPedido.cliente_email) emailsDoPedido.push(String(encomendaDoPedido.cliente_email));
    }

    const staffReclamacoes = caller.permissoes.has('reclamacoes');
    let reclamacaoDoPedido: Record<string, unknown> | null = null;
    if (tipo === 'reclamacao' || tipo === 'mensagem_reclamacao_cliente') {
      const rec = (await adminDb.collection('reclamacoes').doc(String(body.reclamacao_id ?? '')).get()).data();
      if (!rec || (rec.cliente_id !== caller.uid && !staffReclamacoes)) {
        return NextResponse.json({ error: 'Reclamação não encontrada' }, { status: 403 });
      }
      reclamacaoDoPedido = rec;
      // O email escrito no formulário da reclamação só vale como destinatário
      // quando é a equipa a disparar o envio: o cliente indica-o livremente, e
      // dava-lhe um acuse de recepção enviado para onde quisesse.
      if (staffReclamacoes && rec.email) emailsDoPedido.push(String(rec.email));
    }

    const {
      BREVO_KEY, ADMIN_EMAIL, LOJA_NOME, LOJA_URL,
      FROM_ENCOMENDAS, FROM_RECLAMACOES, FROM_NOREPLY,
      ADMIN_ENCOMENDAS, ADMIN_RECLAMACOES,
    } = configEmail();

    if (!BREVO_KEY) {
      return NextResponse.json({ ok: false, warn: 'BREVO_API_KEY em falta' });
    }

    const envios: Envio[] = [];

    // ── Confirmação de encomenda → cliente + admin ──────────────────────────
    if (tipo === 'confirmacao_encomenda') {
      const enc = encomendaDoPedido!;
      const ref = await referenciaEncomendaServer(String(body.encomenda_id));
      const morada = [enc.morada_entrega, enc.cidade_entrega].filter(Boolean).join(', ');
      const itens = (Array.isArray(enc.itens) ? enc.itens : []) as ItemEmail[];
      const total = Number(enc.total) || 0;
      // Quem recebe notificações por WhatsApp não recebe este email
      const emailCliente = enc.notif_canal === 'whatsapp' ? '' : String(enc.cliente_email || '');

      if (emailCliente) {
        envios.push({
          from: `${LOJA_NOME} <${FROM_ENCOMENDAS}>`,
          to: [emailCliente],
          subject: `✅ Encomenda ${ref} recebida — ${LOJA_NOME}`,
          html: gerarEmailConfirmacao(ref, itens, total, morada, LOJA_NOME, LOJA_URL),
        });
      }
      if (ADMIN_ENCOMENDAS) {
        envios.push({
          from: `${LOJA_NOME} <${FROM_ENCOMENDAS}>`,
          to: [ADMIN_ENCOMENDAS],
          subject: `🛍️ Nova encomenda ${ref}`,
          html: `<div style="font-family:Inter,sans-serif;max-width:500px;margin:0 auto;padding:24px;">
            <h2>Nova encomenda recebida</h2>
            <p><strong>Cliente:</strong> ${esc(enc.cliente_email)}</p>
            <p><strong>Total:</strong> ${total.toFixed(2)} MZN</p>
            <p><strong>Morada:</strong> ${esc(morada)}</p>
            <p style="margin-top:20px;">
              <a href="${LOJA_URL}/admin/encomendas" style="background:#0d1347;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
                Ver no painel admin
              </a>
            </p>
          </div>`,
        });
      }
    }

    // ── Cliente cancelou a encomenda → equipa ─────────────────────────
    // Sem isto o cancelamento só aparece a quem abrir o painel
    if (tipo === 'cancelamento_cliente') {
      const enc = encomendaDoPedido!;
      const ref = await referenciaEncomendaServer(String(body.encomenda_id));
      const total = Number(enc.total) || 0;
      if (ADMIN_ENCOMENDAS) {
        envios.push({
          from: `${LOJA_NOME} <${FROM_ENCOMENDAS}>`,
          to: [ADMIN_ENCOMENDAS],
          subject: `❌ Encomenda ${ref} cancelada pelo cliente`,
          html: `<div style="font-family:Inter,sans-serif;max-width:500px;margin:0 auto;padding:24px;">
            <h2>Encomenda cancelada pelo cliente</h2>
            <p><strong>Cliente:</strong> ${esc(enc.cliente_email)}</p>
            <p><strong>Total:</strong> ${total.toFixed(2)} MZN</p>
            <p style="margin-top:20px;">
              <a href="${LOJA_URL}/admin/encomendas" style="background:#0d1347;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
                Ver no painel admin
              </a>
            </p>
          </div>`,
        });
      }
    }

    // ── Reclamação → admin (notificação) + cliente (acuse de recepção) ───────
    // Os dados vêm do documento da reclamação, não do corpo do pedido
    if (tipo === 'reclamacao') {
      const rec = reclamacaoDoPedido!;
      const reclamacao_id = String(body.reclamacao_id);
      const nome = String(rec.nome ?? '');
      const email = String(rec.email ?? '');
      const telefone = String(rec.telefone ?? '');
      const assunto = String(rec.assunto ?? '');
      const descricao = String(rec.descricao ?? '');
      if (ADMIN_RECLAMACOES) {
        envios.push({
          from: `${LOJA_NOME} <${FROM_RECLAMACOES}>`,
          to: [ADMIN_RECLAMACOES],
          subject: `📣 Nova reclamação: ${assunto}`,
          html: gerarEmailReclamacaoAdmin(nome, email, telefone, assunto, descricao, LOJA_NOME, LOJA_URL),
        });
      }
      // Acuse de recepção: para o email da conta do cliente, ou para o do
      // formulário quando é a equipa a enviar
      const emailAck = staffReclamacoes ? email : (caller.email || '');
      if (emailAck) {
        envios.push({
          from: `${LOJA_NOME} <${FROM_RECLAMACOES}>`,
          to: [emailAck],
          subject: `✅ Reclamação recebida — ${LOJA_NOME}`,
          html: gerarEmailReclamacaoCliente(nome, assunto, reclamacao_id, LOJA_NOME, LOJA_URL),
        });
      }
    }

    // ── Nova mensagem do cliente numa reclamação → admin ────────────────────
    if (tipo === 'mensagem_reclamacao_cliente') {
      const rec = reclamacaoDoPedido!;
      const nome = String(rec.nome ?? '');
      const assunto = String(rec.assunto ?? '');
      // A mensagem é o texto que o cliente acabou de escrever; vai escapada
      const mensagem = String(body.mensagem ?? '').slice(0, 5000);
      if (ADMIN_RECLAMACOES) {
        envios.push({
          from: `${LOJA_NOME} <${FROM_RECLAMACOES}>`,
          to: [ADMIN_RECLAMACOES],
          subject: `💬 Nova mensagem de ${nome} — ${assunto}`,
          html: `<div style="font-family:Inter,sans-serif;max-width:500px;margin:0 auto;padding:24px;">
            <h2>Nova mensagem numa reclamação</h2>
            <p><strong>Cliente:</strong> ${esc(nome)}</p>
            <p><strong>Assunto:</strong> ${esc(assunto)}</p>
            <div style="background:#f8f8f8;border-radius:8px;padding:16px;margin:16px 0;font-size:14px;line-height:1.7;">${escMultilinha(mensagem)}</div>
            <p style="margin-top:20px;">
              <a href="${LOJA_URL}/admin/reclamacoes" style="background:#0d1347;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
                Ver e responder
              </a>
            </p>
          </div>`,
        });
      }
    }

    // ── Mudança de estado da encomenda → cliente ────────────────────────────
    if (tipo === 'estado_encomenda') {
      const { encomenda_id, cliente_email, estado, notas } = body;
      if (cliente_email) {
        const ref = await referenciaEncomendaServer(encomenda_id);
        envios.push({
          from: `${LOJA_NOME} <${FROM_ENCOMENDAS}>`,
          to: [cliente_email],
          subject: `📦 Encomenda ${ref} — ${estadoLabel(estado)}`,
          html: gerarEmailEstado(ref, estado, notas, LOJA_NOME, LOJA_URL),
        });
      }
    }

    // ── Bem-vindo no registo → cliente ──────────────────────────────────────
    if (tipo === 'bem_vindo') {
      const { nome, email } = body;
      if (email) {
        envios.push({
          from: `${LOJA_NOME} <${FROM_NOREPLY}>`,
          to: [email],
          subject: `Bem-vindo à ${LOJA_NOME}! 🎉`,
          html: gerarEmailBemVindo(nome, LOJA_NOME, LOJA_URL),
        });
      }
    }

    // ── Resposta a reclamação (do admin) → cliente ──────────────────────────
    if (tipo === 'resposta_reclamacao') {
      const { cliente_email, assunto, resposta, reclamacao_id } = body;
      if (cliente_email) {
        envios.push({
          from: `${LOJA_NOME} <${FROM_RECLAMACOES}>`,
          to: [cliente_email],
          subject: `Re: ${assunto} — ${LOJA_NOME}`,
          html: gerarEmailRespostaReclamacao(resposta, assunto, reclamacao_id, LOJA_NOME, LOJA_URL),
        });
      }
    }

    // ── Reclamação marcada como resolvida → cliente ─────────────────────────
    if (tipo === 'reclamacao_resolvida') {
      const { cliente_email, assunto, estado, reclamacao_id } = body;
      if (cliente_email) {
        envios.push({
          from: `${LOJA_NOME} <${FROM_RECLAMACOES}>`,
          to: [cliente_email],
          subject: `✅ Reclamação resolvida — ${LOJA_NOME}`,
          html: gerarEmailReclamacaoResolvida(assunto, estado, reclamacao_id, LOJA_NOME, LOJA_URL),
        });
      }
    }

    if (envios.length === 0) {
      return NextResponse.json({ ok: false, warn: `Tipo de email desconhecido: ${tipo}` });
    }

    // Um cliente só pode fazer enviar emails para si próprio ou para o admin
    const staff = caller.permissoes.has('encomendas') || caller.permissoes.has('reclamacoes');
    const caixasAdmin = [FROM_ENCOMENDAS, FROM_RECLAMACOES, ADMIN_EMAIL].filter(Boolean) as string[];
    const permitido = (addr: string) =>
      staff || caixasAdmin.some(a => a.toLowerCase() === addr.toLowerCase())
      || [caller.email, ...emailsDoPedido].some(e => e?.toLowerCase() === addr.toLowerCase());

    const erros = await enviarEmails(envios.filter(e => e.to.every(permitido)));

    return NextResponse.json({ ok: true, ...(erros.length ? { erros } : {}) });
  } catch (err) {
    console.error('send-email error:', err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
