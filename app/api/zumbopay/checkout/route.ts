import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { referenciaEncomendaServer } from '@/lib/referencia-server';
import { ZP_BASE, zpHeaders } from '@/lib/zumbopay';

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

    const ref = await referenciaEncomendaServer(encomenda_id);
    // /payments não aceita um identificador nosso: a ligação é feita pela
    // `reference` (ZP_…) devolvida na resposta, guardada em referencia_zumbopay.
    // A referência da encomenda vai em title/description para ser visível no painel.
    const payloadEnviado = {
      title: `Encomenda ${ref}`,
      description: `Realstiles — encomenda ${ref}`,
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
      headers: zpHeaders({ 'Idempotency-Key': pagRef.id }),
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
    // Referência da última tentativa, visível no admin mesmo antes de pago
    if (zpData.reference) {
      await adminDb.collection('encomendas').doc(encomenda_id).update({
        pagamento_ref: zpData.reference,
        actualizado_em: FieldValue.serverTimestamp(),
      });
    }

    return NextResponse.json({
      checkout_url: zpData.checkout_url,
      pagamento_id: pagRef.id,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
