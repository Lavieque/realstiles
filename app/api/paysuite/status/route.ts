import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { confirmarPagamentoPaysuite } from '@/lib/paysuite';

export async function GET(req: NextRequest) {
  const pagamentoId = req.nextUrl.searchParams.get('pagamento_id');
  if (!pagamentoId) {
    return NextResponse.json({ error: 'pagamento_id em falta' }, { status: 400 });
  }

  const snap = await adminDb.collection('pagamentos').doc(pagamentoId).get();
  if (!snap.exists) {
    return NextResponse.json({ error: 'Pagamento não encontrado' }, { status: 404 });
  }

  await confirmarPagamentoPaysuite(pagamentoId);

  const atualizado = await adminDb.collection('pagamentos').doc(pagamentoId).get();
  const pagamento = atualizado.data()!;

  return NextResponse.json({
    status: pagamento.estado,
    pagamento_id: pagamentoId,
    reference: pagamento.referencia_paysuite,
    checkout_url: pagamento.resposta_inicial?.checkout_url ?? null,
  });
}
