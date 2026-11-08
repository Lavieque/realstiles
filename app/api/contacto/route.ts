import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { consumir, ipDoPedido } from '@/lib/rate-limit';
import { configEmail, enviarEmails, esc, escMultilinha } from '@/lib/email';

// Formulário de contacto da página /ajuda. Anónimo: guarda a mensagem em
// `contactos` (que o cliente não escreve) e avisa por email os dois
// destinatários definidos em config/contactos (admin → Contactos).
export async function POST(req: NextRequest) {
  const limite = await consumir(`contacto:${ipDoPedido(req)}`, { max: 5, janelaMs: 60 * 60 * 1000 });
  if (!limite.ok) {
    return NextResponse.json(
      { error: 'Demasiadas mensagens. Tenta mais tarde.' },
      { status: 429, headers: { 'Retry-After': String(limite.esperarSegundos) } },
    );
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Pedido inválido' }, { status: 400 }); }

  // Feedback anónimo do rodapé: avaliação de 1 a 5 e comentário opcional
  if (body.tipo === 'feedback') {
    const nota = Number(body.nota);
    if (!Number.isInteger(nota) || nota < 1 || nota > 5) return NextResponse.json({ error: 'Escolhe uma avaliação' }, { status: 400 });
    const comentario = String(body.comentario ?? '').trim().slice(0, 2000);
    body = { nome: 'Feedback do site', assunto: 'Feedback do site', telefone: '-', mensagem: `Avaliação: ${nota}/5${comentario ? `

${comentario}` : ''}` };
  }

  const nome = String(body.nome ?? '').trim().slice(0, 120);
  const email = String(body.email ?? '').trim().slice(0, 160);
  const telefone = String(body.telefone ?? '').trim().slice(0, 40);
  const assunto = String(body.assunto ?? '').trim().slice(0, 160);
  const referencia = String(body.referencia ?? '').trim().slice(0, 60);
  const mensagem = String(body.mensagem ?? '').trim().slice(0, 5000);

  if (!nome || !mensagem) return NextResponse.json({ error: 'Indica o nome e a mensagem' }, { status: 400 });
  if (!email && !telefone) return NextResponse.json({ error: 'Indica um email ou telefone para te responder' }, { status: 400 });
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: 'Email inválido' }, { status: 400 });

  const ref = await adminDb.collection('contactos').add({
    nome, email, telefone, assunto, referencia, mensagem,
    lida: false,
    criado_em: FieldValue.serverTimestamp(),
  });

  const destinos = ((await adminDb.collection('config').doc('contactos').get()).data()?.emails || []) as unknown[];
  const para = destinos.map(e => String(e || '').trim()).filter(Boolean);
  if (para.length === 0 && configEmail().ADMIN_EMAIL) para.push(configEmail().ADMIN_EMAIL as string);

  if (para.length > 0) {
    const { LOJA_NOME, LOJA_URL, FROM_NOREPLY } = configEmail();
    // Um envio por destinatário: um endereço inválido não bloqueia o outro
    const erros = await enviarEmails(para.map(to => ({
      from: `${LOJA_NOME} <${FROM_NOREPLY}>`,
      to: [to],
      subject: `✉️ Nova mensagem de contacto${assunto ? `: ${assunto}` : ''}`,
      html: `<div style="font-family:Inter,sans-serif;max-width:500px;margin:0 auto;padding:24px;">
        <h2>Nova mensagem de contacto</h2>
        <p><strong>Nome:</strong> ${esc(nome)}</p>
        ${email ? `<p><strong>Email:</strong> ${esc(email)}</p>` : ''}
        ${telefone ? `<p><strong>Telefone:</strong> ${esc(telefone)}</p>` : ''}
        ${assunto ? `<p><strong>Assunto:</strong> ${esc(assunto)}</p>` : ''}
        ${referencia ? `<p><strong>Referência:</strong> ${esc(referencia)}</p>` : ''}
        <div style="background:#f8f8f8;border-radius:8px;padding:16px;margin:16px 0;font-size:14px;line-height:1.7;">${escMultilinha(mensagem)}</div>
        <p style="margin-top:20px;">
          <a href="${LOJA_URL}/admin/contactos" style="background:#0d1347;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Ver no painel admin</a>
        </p>
      </div>`,
    })));
    if (erros.length) console.error('contacto: emails com erro', erros);
  }

  return NextResponse.json({ ok: true, id: ref.id });
}
