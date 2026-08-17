import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

const ZP_BASE = 'https://zumbopay.com/api/public/v1';

// Chamado pelo cliente em polling para verificar o estado do charge (M-Pesa/e-Mola)
export async function GET(req: NextRequest) {
  const ref = req.nextUrl.searchParams.get('ref');
  const pagamentoId = req.nextUrl.searchParams.get('pagamento_id');
  const encomendaId = req.nextUrl.searchParams.get('encomenda_id');

  if (!ref || !pagamentoId || !encomendaId) {
    return NextResponse.json({ error: 'Parâmetros obrigatórios em falta' }, { status: 400 });
  }

  // Verificar estado diretamente na ZumboPay (não confiar no cliente)
  const res = await fetch(`${ZP_BASE}/charges/${ref}`, {
    headers: {
      'Authorization': `Bearer ${process.env.ZUMBOPAY_API_KEY || ''}`,
      'X-Merchant-Id': process.env.ZUMBOPAY_MERCHANT_ID || '',
    },
  });

  const data = await res.json();
  const status: string = data.status ?? 'unknown';

  if (status === 'succeeded' || status === 'completed') {
    // Atualiza pagamento e encomenda atomicamente
    const pagRef = adminDb.collection('pagamentos').doc(pagamentoId);
    const encRef = adminDb.collection('encomendas').doc(encomendaId);

    const pagSnap = await pagRef.get();
    if (pagSnap.exists && pagSnap.data()?.estado !== 'pago') {
      const batch = adminDb.batch();
      batch.update(pagRef, {
        estado: 'pago',
        resposta_confirmacao: data,
        actualizado_em: FieldValue.serverTimestamp(),
      });
      batch.update(encRef, {
        estado: 'confirmada',
        pagamento_estado: 'pago',
        pagamento_ref: ref,
        actualizado_em: FieldValue.serverTimestamp(),
      });
      await batch.commit();
    }

    return NextResponse.json({ status: 'succeeded' });
  }

  if (status === 'failed' || status === 'cancelled' || status === 'expired') {
    const pagRef = adminDb.collection('pagamentos').doc(pagamentoId);
    const pagSnap = await pagRef.get();
    if (pagSnap.exists && pagSnap.data()?.estado === 'pendente') {
      await pagRef.update({
        estado: status === 'cancelled' ? 'cancelado' : 'falhado',
        resposta_confirmacao: data,
        actualizado_em: FieldValue.serverTimestamp(),
      });
    }
    return NextResponse.json({ status });
  }

  // pending / processing — ainda a aguardar
  return NextResponse.json({ status });
}
