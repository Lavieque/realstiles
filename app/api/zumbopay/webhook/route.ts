import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import crypto from 'crypto';
import { encontrarPagamentoZumbo, marcarPagamentoZumboPago, estadoZumboPago } from '@/lib/zumbopay';

// Formato real (Painel → Programadores → Testes & Validação):
// { id, type: "payment.succeeded", created_at, merchant_id,
//   data: { payment_id, reference: "ZP_…", amount, currency, channel, status } }
// Assinatura HMAC-SHA256 do corpo bruto no header X-Zumbo-Signature (a
// documentação menciona x-zumbopay-signature, por isso aceitamos os dois).

function assinaturaValida(rawBody: string, sig: string, secret: string): boolean {
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  if (!/^[0-9a-f]+$/i.test(sig) || sig.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'));
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  const secret = process.env.ZUMBOPAY_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[zumbopay/webhook] ZUMBOPAY_WEBHOOK_SECRET não configurado');
    return NextResponse.json({ error: 'Webhook não configurado' }, { status: 503 });
  }
  const sig = req.headers.get('x-zumbo-signature') || req.headers.get('x-zumbopay-signature') || '';
  if (!assinaturaValida(rawBody, sig, secret)) {
    // Só nomes dos headers (nunca valores) para diagnosticar o header de assinatura real
    console.warn('[zumbopay/webhook] assinatura inválida', {
      headers: Array.from(req.headers.keys()),
      tem_assinatura: Boolean(sig),
    });
    return NextResponse.json({ error: 'Assinatura inválida' }, { status: 401 });
  }

  let payload: { type?: string; event?: string; data?: Record<string, unknown> };
  try { payload = JSON.parse(rawBody); } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const evento = payload.type ?? payload.event;
  const data = payload.data ?? {};
  const reference = (data.reference as string | undefined) ?? null;
  const sourceId = (data.source_id as string | undefined) ?? null;

  if (evento !== 'payment.succeeded' && evento !== 'payment.failed') {
    return NextResponse.json({ ok: true });
  }

  const pagSnap = await encontrarPagamentoZumbo(reference, sourceId);
  if (!pagSnap) {
    console.warn('[zumbopay/webhook] pagamento não encontrado', { evento, reference, sourceId });
    return NextResponse.json({ ok: true });
  }

  if (evento === 'payment.failed') {
    // Não cancela a encomenda: o cliente pode tentar pagar de novo
    if (pagSnap.data()?.estado !== 'pago') {
      await pagSnap.ref.update({
        estado: 'falhado',
        webhook_payload: data,
        actualizado_em: FieldValue.serverTimestamp(),
      });
    }
    return NextResponse.json({ ok: true });
  }

  if (data.status !== undefined && !estadoZumboPago(data.status)) {
    return NextResponse.json({ ok: true });
  }

  const resultado = await marcarPagamentoZumboPago(pagSnap, {
    reference: reference ?? pagSnap.data()?.referencia_zumbopay,
    amount: data.amount,
    payload: data,
  });
  if (!resultado.ok) console.warn('[zumbopay/webhook]', resultado.motivo, { reference });

  return NextResponse.json({ ok: true });
}
