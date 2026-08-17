import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  const secret = process.env.ZUMBOPAY_WEBHOOK_SECRET;
  if (secret) {
    const sig = req.headers.get('x-zumbopay-signature') || '';
    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    const sigOk = sig.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'));
    if (!sigOk) {
      return NextResponse.json({ error: 'Assinatura inválida' }, { status: 401 });
    }
  }

  let payload: { event?: string; data?: Record<string, unknown> };
  try { payload = JSON.parse(rawBody); } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  if (payload.event !== 'payment.succeeded') {
    return NextResponse.json({ ok: true });
  }

  const data = payload.data ?? {};
  // source_id é o encomenda_id que enviámos em /charges
  // reference é o que enviámos em /payments (título ou referência)
  const encomendaId = (data.source_id ?? data.reference) as string | undefined;
  const referencia = (data.reference ?? data.id) as string | undefined;

  if (!encomendaId) return NextResponse.json({ ok: true });

  const encRef = adminDb.collection('encomendas').doc(encomendaId);
  const encSnap = await encRef.get();
  if (!encSnap.exists || encSnap.data()?.estado === 'confirmada') {
    return NextResponse.json({ ok: true });
  }

  // Encontrar o registo de pagamento pela referência ZumboPay
  let pagamentoId: string | null = null;
  if (referencia) {
    const q = await adminDb.collection('pagamentos')
      .where('referencia_zumbopay', '==', referencia)
      .limit(1)
      .get();
    if (!q.empty) pagamentoId = q.docs[0].id;
  }

  const batch = adminDb.batch();

  batch.update(encRef, {
    estado: 'confirmada',
    pagamento_estado: 'pago',
    pagamento_ref: referencia ?? encomendaId,
    actualizado_em: FieldValue.serverTimestamp(),
  });

  if (pagamentoId) {
    batch.update(adminDb.collection('pagamentos').doc(pagamentoId), {
      estado: 'pago',
      webhook_payload: data,
      actualizado_em: FieldValue.serverTimestamp(),
    });
  }

  await batch.commit();
  return NextResponse.json({ ok: true });
}
