import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { confirmarPagamentoPaysuite } from '@/lib/paysuite';

// O PaySuite não documenta um mecanismo de assinatura para os webhooks, por
// isso nunca confiamos no corpo recebido para mudar de estado — usamo-lo só
// para identificar QUAL pagamento verificar, e confirmamos sempre com um
// GET /payments/:id autenticado directamente ao PaySuite antes de aceitar.
export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  let payload: Record<string, unknown>;
  try { payload = JSON.parse(rawBody); } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const data = (payload.data ?? payload) as Record<string, unknown>;
  // Enviámos reference = id do doc em `pagamentos` ao criar o pagamento no
  // PaySuite, por isso normalmente vem de volta tal e qual no webhook.
  const reference = data.reference as string | undefined;
  const paysuiteId = data.id as string | undefined;

  let pagamentoId: string | null = null;

  if (reference) {
    const snap = await adminDb.collection('pagamentos').doc(reference).get();
    if (snap.exists) pagamentoId = snap.id;
  }
  if (!pagamentoId && paysuiteId) {
    const q = await adminDb.collection('pagamentos').where('referencia_paysuite', '==', paysuiteId).limit(1).get();
    if (!q.empty) pagamentoId = q.docs[0].id;
  }

  if (!pagamentoId) return NextResponse.json({ ok: true });

  await confirmarPagamentoPaysuite(pagamentoId);
  return NextResponse.json({ ok: true });
}
