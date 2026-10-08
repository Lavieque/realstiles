import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { confirmarPagamentoPaysuite } from '@/lib/paysuite';
import { autenticar, encomendaDoCaller } from '@/lib/permissoes-server';

export async function GET(req: NextRequest) {
  const caller = await autenticar(req);
  if (caller instanceof NextResponse) return caller;

  const pagamentoId = req.nextUrl.searchParams.get('pagamento_id');
  if (!pagamentoId) {
    return NextResponse.json({ error: 'pagamento_id em falta' }, { status: 400 });
  }

  const snap = await adminDb.collection('pagamentos').doc(pagamentoId).get();
  if (!snap.exists || !(await encomendaDoCaller(caller, String(snap.data()?.encomenda_id ?? '')))) {
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
