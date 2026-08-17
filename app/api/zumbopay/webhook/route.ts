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
  const sourceId = data.source_id as string | undefined;
  const referencia = (data.reference ?? data.id) as string | undefined;

  // Tenta encontrar o encomenda_id: primeiro pelo source_uuid guardado no pagamento,
  // depois pelo reference, e por último trata o source_id directamente como encomenda_id
  let encomendaId: string | undefined;

  if (sourceId) {
    const q = await adminDb.collection('pagamentos')
      .where('source_uuid', '==', sourceId)
      .limit(1)
      .get();
    if (!q.empty) encomendaId = q.docs[0].data().encomenda_id;
  }
  if (!encomendaId && referencia) {
    const q = await adminDb.collection('pagamentos')
      .where('referencia_zumbopay', '==', referencia)
      .limit(1)
      .get();
    if (!q.empty) encomendaId = q.docs[0].data().encomenda_id;
  }
  if (!encomendaId) encomendaId = sourceId;

  if (!encomendaId) return NextResponse.json({ ok: true });

  const encRef = adminDb.collection('encomendas').doc(encomendaId);
  const encSnap = await encRef.get();
  if (!encSnap.exists || encSnap.data()?.estado === 'confirmada') {
    return NextResponse.json({ ok: true });
  }

  // Encontrar o registo de pagamento pelo source_uuid ou referência
  let pagamentoId: string | null = null;
  if (sourceId) {
    const q = await adminDb.collection('pagamentos').where('source_uuid', '==', sourceId).limit(1).get();
    if (!q.empty) pagamentoId = q.docs[0].id;
  }
  if (!pagamentoId && referencia) {
    const q = await adminDb.collection('pagamentos').where('referencia_zumbopay', '==', referencia).limit(1).get();
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
