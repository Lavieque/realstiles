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

    const codCurto = encomenda_id.substring(0, 8).toUpperCase();
    const payloadEnviado = {
      title: `Encomenda #${codCurto}`,
      amount,
      currency: 'MZN',
      channels: ['card'],
      wallet_id: walletId,
      max_uses: 1,
    };

    const pagRef = await adminDb.collection('pagamentos').add({
      encomenda_id,
      metodo: 'cartao',
      montante: amount,
      estado: 'pendente',
      referencia_zumbopay: null,
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

    const body = await res.json();
    const zpData = body.data ?? body;

    if (!res.ok) {
      await pagRef.update({
        estado: 'falhado',
        resposta_inicial: body,
        actualizado_em: FieldValue.serverTimestamp(),
      });
      return NextResponse.json(
        { error: body.error?.message || 'Erro ao criar checkout' },
        { status: res.status },
      );
    }

    await pagRef.update({
      referencia_zumbopay: zpData.reference ?? null,
      resposta_inicial: body,
      actualizado_em: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      checkout_url: zpData.checkout_url,
      pagamento_id: pagRef.id,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
