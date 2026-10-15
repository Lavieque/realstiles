import { NextRequest, NextResponse } from 'next/server';
import { referenciaEncomendaServer } from '@/lib/referencia-server';
import { adminDb } from '@/lib/firebase-admin';
import { autenticar, encomendaDoCaller } from '@/lib/permissoes-server';
import type { Permissao } from '@/lib/permissoes';

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

    const BREVO_KEY         = process.env.BREVO_API_KEY;
    const ADMIN_EMAIL       = process.env.ADMIN_EMAIL;
    const LOJA_NOME         = process.env.LOJA_NOME  || 'Real Stiles';
    const LOJA_URL          = process.env.LOJA_URL   || 'https://realstiles.co.mz';
    const FROM_ENCOMENDAS   = process.env.FROM_EMAIL_ENCOMENDAS  || 'encomendas@realstiles.co.mz';
    const FROM_RECLAMACOES  = process.env.FROM_EMAIL_RECLAMACOES || 'reclamacoes@realstiles.co.mz';
    const FROM_NOREPLY      = process.env.FROM_EMAIL_NOREPLY     || 'noreply@realstiles.co.mz';

    // As notificações internas vão para a caixa do próprio endereço de serviço:
    // encomendas@ e reclamacoes@ são grupos, logo chegam a toda a equipa respetiva
    const ADMIN_ENCOMENDAS  = FROM_ENCOMENDAS;
    const ADMIN_RECLAMACOES = FROM_RECLAMACOES;

    if (!BREVO_KEY) {
      return NextResponse.json({ ok: false, warn: 'BREVO_API_KEY em falta' });
    }

    const envios: { from: string; to: string[]; subject: string; html: string }[] = [];

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

    const resultados = await Promise.allSettled(
      envios.filter(e => e.to.every(permitido)).map(e => {
        const m = e.from.match(/^(.*?)\s*<(.+)>$/);
        const senderName  = m ? m[1].trim() : LOJA_NOME;
        const senderEmail = m ? m[2] : e.from;
        return fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: { 'api-key': BREVO_KEY!, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sender: { name: senderName, email: senderEmail },
            to: e.to.map(addr => ({ email: addr })),
            subject: e.subject,
            htmlContent: e.html,
          }),
        }).then(async r => {
          const b = await r.json();
          if (!r.ok) throw new Error(JSON.stringify(b));
          return b;
        });
      })
    );

    const erros = resultados
      .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      .map(r => r.reason?.message);

    return NextResponse.json({ ok: true, ...(erros.length ? { erros } : {}) });
  } catch (err) {
    console.error('send-email error:', err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

// Todo o valor que venha de um utilizador (nome, morada, assunto, descrição,
// nome de artigo) passa por aqui antes de entrar no HTML do email.
function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Texto de várias linhas: escapado primeiro, só depois com os <br>
function escMultilinha(v: unknown): string {
  return esc(v).replace(/\r?\n/g, '<br>');
}

interface ItemEmail {
  nome?: string;
  tamanho?: string;
  cor?: string;
  preco?: number;
  quantidade?: number;
}

function estadoLabel(estado: string) {
  const labels: Record<string, string> = {
    pendente: 'Pendente', confirmada: 'Confirmada',
    enviada: 'Enviada', entregue: 'Entregue', cancelada: 'Cancelada',
  };
  return labels[estado] || estado;
}

function cabecalho(lojaNome: string) {
  return `<div style="background:#0d1347;padding:24px 32px;border-radius:12px 12px 0 0;text-align:center;">
    <h1 style="color:white;font-size:20px;margin:0;letter-spacing:0.02em;">${lojaNome}</h1>
  </div>`;
}

function rodape(lojaUrl: string, lojaNome: string) {
  return `<div style="padding:20px 32px;text-align:center;border-top:1px solid #eee;margin-top:24px;">
    <p style="font-size:12px;color:#aaa;margin:0;">&copy; ${new Date().getFullYear()} ${lojaNome} · <a href="${lojaUrl}" style="color:#aaa;">${lojaUrl.replace('https://', '')}</a></p>
  </div>`;
}

function wrap(lojaNome: string, lojaUrl: string, inner: string) {
  return `<!DOCTYPE html><html lang="pt"><body style="margin:0;padding:0;background:#f5f5f5;font-family:Inter,Arial,sans-serif;">
  <div style="max-width:560px;margin:32px auto;">
    ${cabecalho(lojaNome)}
    <div style="background:white;padding:32px;border-radius:0 0 12px 12px;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
      ${inner}
      ${rodape(lojaUrl, lojaNome)}
    </div>
  </div>
  </body></html>`;
}

function gerarEmailConfirmacao(
  ref: string,
  itens: ItemEmail[],
  total: number, morada: string, lojaNome: string, lojaUrl: string
) {
  const itensHtml = itens.map(i => `
    <tr>
      <td style="padding:10px 8px;border-bottom:1px solid #eee;">${esc(i.nome)}${i.tamanho ? ` <span style="color:#888;font-size:12px">(${esc(i.tamanho)})</span>` : ''}${i.cor ? ` <span style="color:#888;font-size:12px">· ${esc(i.cor)}</span>` : ''}</td>
      <td style="padding:10px 8px;border-bottom:1px solid #eee;text-align:center;">${Number(i.quantidade) || 0}</td>
      <td style="padding:10px 8px;border-bottom:1px solid #eee;text-align:right;font-weight:600;">${((Number(i.preco) || 0) * (Number(i.quantidade) || 0)).toFixed(2)} MZN</td>
    </tr>`).join('');

  return wrap(lojaNome, lojaUrl, `
    <h2 style="margin-top:0;">✅ Encomenda recebida!</h2>
    <p style="color:#666;font-size:14px;">Referência: <strong>${ref}</strong></p>
    <table style="width:100%;border-collapse:collapse;border:1px solid #eee;">
      <thead><tr style="background:#f8f8f8;">
        <th style="padding:10px 8px;text-align:left;font-size:12px;color:#888;">PRODUTO</th>
        <th style="padding:10px 8px;text-align:center;font-size:12px;color:#888;">QTD</th>
        <th style="padding:10px 8px;text-align:right;font-size:12px;color:#888;">TOTAL</th>
      </tr></thead>
      <tbody>${itensHtml}</tbody>
      <tfoot><tr style="background:#f8f8f8;">
        <td colspan="2" style="padding:12px 8px;font-weight:700;">Total</td>
        <td style="padding:12px 8px;font-weight:700;text-align:right;">${Number(total)?.toFixed(2)} MZN</td>
      </tr></tfoot>
    </table>
    <div style="margin-top:24px;padding:16px;background:#f8f8f8;border-radius:8px;">
      <p style="margin:0 0 4px;font-size:12px;color:#888;">MORADA DE ENTREGA</p>
      <p style="margin:0;font-size:14px;">${esc(morada)}</p>
    </div>
    <div style="margin-top:24px;text-align:center;">
      <a href="${lojaUrl}/encomendas" style="display:inline-block;background:#0d1347;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;">Ver as minhas encomendas</a>
    </div>`);
}

function gerarEmailReclamacaoAdmin(
  nome: string, email: string, telefone: string,
  assunto: string, descricao: string, lojaNome: string, lojaUrl: string
) {
  return wrap(lojaNome, lojaUrl, `
    <h2 style="margin-top:0;color:#c0392b;">📣 Nova reclamação recebida</h2>
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
      <tr><td style="padding:8px 0;font-size:13px;color:#888;width:100px;">Nome</td><td style="padding:8px 0;font-size:14px;font-weight:600;">${esc(nome)}</td></tr>
      <tr><td style="padding:8px 0;font-size:13px;color:#888;">Email</td><td style="padding:8px 0;font-size:14px;">${esc(email)}</td></tr>
      ${telefone ? `<tr><td style="padding:8px 0;font-size:13px;color:#888;">Telefone</td><td style="padding:8px 0;font-size:14px;">${esc(telefone)}</td></tr>` : ''}
      <tr><td style="padding:8px 0;font-size:13px;color:#888;">Assunto</td><td style="padding:8px 0;font-size:14px;font-weight:600;">${esc(assunto)}</td></tr>
    </table>
    <div style="background:#f8f8f8;border-radius:8px;padding:16px;margin-bottom:24px;">
      <p style="margin:0 0 8px;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.05em;">Descrição</p>
      <p style="margin:0;font-size:14px;line-height:1.7;color:#333;">${escMultilinha(descricao)}</p>
    </div>
    <a href="${lojaUrl}/admin/reclamacoes" style="display:inline-block;background:#0d1347;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
      Responder no painel admin
    </a>`);
}

function gerarEmailReclamacaoCliente(nome: string, assunto: string, reclamacaoId: string | undefined, lojaNome: string, lojaUrl: string) {
  return wrap(lojaNome, lojaUrl, `
    <h2 style="margin-top:0;">✅ Reclamação recebida</h2>
    <p style="font-size:15px;">Olá <strong>${esc(nome)}</strong>,</p>
    <p style="font-size:14px;color:#555;line-height:1.7;">
      Recebemos a sua reclamação relativa a <strong>${esc(assunto)}</strong>.<br>
      A nossa equipa irá analisar o caso e responder-lhe no prazo de <strong>3 dias úteis</strong>.
    </p>
    <div style="background:#f0f7f0;border-left:4px solid #27ae60;border-radius:4px;padding:16px;margin:20px 0;">
      <p style="margin:0;font-size:13px;color:#27ae60;font-weight:600;">Referência registada com sucesso.</p>
    </div>
    <p style="font-size:13px;color:#888;margin-bottom:20px;">
      Este email é apenas uma notificação — a resposta e a conversa com a nossa equipa ficam disponíveis na área do cliente.
    </p>
    <div style="text-align:center;">
      <a href="${lojaUrl}${reclamacaoId ? `/reclamacoes/${reclamacaoId}` : '/reclamacoes'}" style="display:inline-block;background:#0d1347;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;">Ver a minha reclamação</a>
    </div>`);
}

function gerarEmailEstado(
  ref: string, estado: string, notas: string | undefined,
  lojaNome: string, lojaUrl: string
) {
  const icones: Record<string, string> = {
    confirmada: '✅', enviada: '🚚', entregue: '🎉', cancelada: '❌', pendente: '⏳',
  };
  const icone = icones[estado] || '📦';
  const mensagens: Record<string, string> = {
    confirmada: 'A tua encomenda foi confirmada e está a ser preparada.',
    enviada: 'A tua encomenda foi enviada e está a caminho!',
    entregue: 'A tua encomenda foi entregue. Esperamos que gostes!',
    cancelada: 'A tua encomenda foi cancelada. Contacta-nos se precisares de ajuda.',
    pendente: 'A tua encomenda está pendente de confirmação.',
  };
  const mensagem = mensagens[estado] || `O estado foi actualizado para ${estadoLabel(estado)}.`;

  return wrap(lojaNome, lojaUrl, `
    <h2 style="margin-top:0;">${icone} Actualização da encomenda</h2>
    <p style="font-size:13px;color:#888;">Referência: <strong>${ref}</strong></p>
    <div style="text-align:center;margin:24px 0;padding:20px;background:#f8f8f8;border-radius:12px;">
      <p style="font-size:32px;margin:0 0 8px;">${icone}</p>
      <p style="font-size:18px;font-weight:700;margin:0 0 4px;">${estadoLabel(estado)}</p>
      <p style="font-size:14px;color:#666;margin:0;">${mensagem}</p>
    </div>
    ${notas ? `<div style="background:#fffbf0;border-left:4px solid #f39c12;border-radius:4px;padding:16px;margin-bottom:20px;">
      <p style="margin:0 0 6px;font-size:12px;color:#f39c12;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;">Nota da loja</p>
      <p style="margin:0;font-size:14px;color:#333;">${escMultilinha(notas)}</p>
    </div>` : ''}
    <div style="text-align:center;">
      <a href="${lojaUrl}/encomendas" style="display:inline-block;background:#0d1347;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;">Ver encomenda</a>
    </div>`);
}

function gerarEmailBemVindo(nome: string, lojaNome: string, lojaUrl: string) {
  return wrap(lojaNome, lojaUrl, `
    <h2 style="margin-top:0;">🎉 Bem-vindo(a) à ${lojaNome}!</h2>
    <p style="font-size:15px;">Olá <strong>${esc(nome || 'Cliente')}</strong>,</p>
    <p style="font-size:14px;color:#555;line-height:1.7;">
      A tua conta foi criada com sucesso. Já podes explorar a nossa coleção e fazer encomendas de forma rápida e segura.
    </p>
    <div style="margin:20px 0;">
      <div style="padding:14px;background:#f8f8f8;border-radius:8px;font-size:13px;margin-bottom:8px;">✅ Entrega em todo Moçambique</div>
      <div style="padding:14px;background:#f8f8f8;border-radius:8px;font-size:13px;margin-bottom:8px;">🔒 Pagamento seguro</div>
      <div style="padding:14px;background:#f8f8f8;border-radius:8px;font-size:13px;">📦 Acompanha as tuas encomendas em tempo real</div>
    </div>
    <div style="text-align:center;margin-top:24px;">
      <a href="${lojaUrl}" style="display:inline-block;background:#0d1347;color:white;padding:14px 36px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">Começar a comprar</a>
    </div>`);
}

function gerarEmailReclamacaoResolvida(assunto: string, estado: string, reclamacaoId: string | undefined, lojaNome: string, lojaUrl: string) {
  return wrap(lojaNome, lojaUrl, `
    <h2 style="margin-top:0;">✅ Reclamação resolvida</h2>
    <p style="font-size:14px;color:#555;line-height:1.7;">
      A sua reclamação relativa a <strong>${esc(assunto)}</strong> foi marcada como <strong>${esc(estado)}</strong> pela nossa equipa.
    </p>
    <div style="background:#f0f7f0;border-left:4px solid #27ae60;border-radius:4px;padding:16px;margin:20px 0;">
      <p style="margin:0;font-size:13px;color:#27ae60;font-weight:600;">Caso considere que o assunto não ficou resolvido, pode consultar a conversa completa na área do cliente.</p>
    </div>
    <div style="text-align:center;">
      <a href="${lojaUrl}${reclamacaoId ? `/reclamacoes/${reclamacaoId}` : '/reclamacoes'}" style="display:inline-block;background:#0d1347;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;">Ver a minha reclamação</a>
    </div>`);
}

function gerarEmailRespostaReclamacao(
  resposta: string, assunto: string, reclamacaoId: string | undefined, lojaNome: string, lojaUrl: string
) {
  return wrap(lojaNome, lojaUrl, `
    <h2 style="margin-top:0;">✉️ Resposta à sua reclamação</h2>
    <p style="font-size:13px;color:#888;margin-bottom:20px;">Assunto: <strong>${esc(assunto)}</strong></p>
    <div style="background:#f8f8f8;border-radius:8px;padding:20px;font-size:14px;line-height:1.8;color:#333;">
      ${escMultilinha(resposta)}
    </div>
    <p style="font-size:13px;color:#888;margin-top:20px;margin-bottom:20px;">
      Para continuar esta conversa, responda na área do cliente — este email não é monitorizado.
    </p>
    <div style="text-align:center;">
      <a href="${lojaUrl}${reclamacaoId ? `/reclamacoes/${reclamacaoId}` : '/reclamacoes'}" style="display:inline-block;background:#0d1347;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;">Responder na área do cliente</a>
    </div>`);
}
