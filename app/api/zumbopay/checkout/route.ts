import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

const ZP_BASE = 'https://zumbopay.com/api/public/v1';

export async function POST(req: NextRequest) {
  try {
    const { encomenda_id, amount } = await req.json();
    if (!encomenda_id || !amount) {
      return NextResponse.json({ error: 'Campos obrigatórios em falta' }, { status: 400 });
    }

    const walletId = process.env.ZUMBOPAY_WALLET_CARD;
    if (!walletId) {
      return NextResponse.json({ error: 'Wallet cartão não configurada' }, { status: 503 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';

    const payloadEnviado = {
      wallet_id: walletId,
      amount,
      currency: 'MZN',
      reference: encomenda_id,
      description: `Encomenda #${encomenda_id.substring(0, 8).toUpperCase()} — Real Stiles`,
      return_url: `${appUrl}/encomenda/${encomenda_id}?confirmada=1`,
      cancel_url: `${appUrl}/carrinho`,
    };

    const pagRef = await adminDb.collection('pagamentos').add({
      encomenda_id,
      metodo: 'cartao',
      montante: amount,
      estado: 'pendente',
      referencia_zumbopay: encomenda_id,
      payload_enviado: payloadEnviado,
      resposta_inicial: null,
      webhook_payload: null,
      criado_em: FieldValue.serverTimestamp(),
      actualizado_em: FieldValue.serverTimestamp(),
    });

    const res = await fetch(`${ZP_BASE}/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ZUMBOPAY_API_KEY || ''}`,
        'X-Merchant-Id': process.env.ZUMBOPAY_MERCHANT_ID || '',
      },
      body: JSON.stringify(payloadEnviado),
    });

    const data = await res.json();

    if (!res.ok) {
      await pagRef.update({
        estado: 'falhado',
        resposta_inicial: data,
        actualizado_em: FieldValue.serverTimestamp(),
      });
      return NextResponse.json(
        { error: data.error?.message || 'Erro ao criar checkout' },
        { status: res.status },
      );
    }

    await pagRef.update({
      resposta_inicial: data,
      actualizado_em: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ checkout_url: data.checkout_url, pagamento_id: pagRef.id });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
