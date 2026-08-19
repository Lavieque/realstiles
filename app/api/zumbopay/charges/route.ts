import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { randomUUID } from 'crypto';

const ZP_BASE = 'https://zumbopay.com/api/public/v1';

function zpHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.ZUMBOPAY_API_KEY || ''}`,
    'X-Merchant-Id': process.env.ZUMBOPAY_MERCHANT_ID || '',
  };
}

export async function POST(req: NextRequest) {
  try {
    const { encomenda_id, amount, msisdn, metodo, customer_name } = await req.json();
    if (!encomenda_id || !amount || !msisdn || !metodo) {
      return NextResponse.json({ error: 'Campos obrigatórios em falta' }, { status: 400 });
    }

    const walletId = metodo === 'mpesa'
      ? process.env.ZUMBOPAY_WALLET_MPESA
      : process.env.ZUMBOPAY_WALLET_EMOLA;

    if (!walletId) {
      return NextResponse.json({ error: `Wallet ${metodo} não configurada` }, { status: 503 });
    }

    const msisdnClean = msisdn.replace(/\D/g, '');
    const msisdnFull = msisdnClean.startsWith('258') ? msisdnClean : '258' + msisdnClean;

    // ZumboPay exige UUID válido em source_id; guardamos o mapeamento no pagamento
    const sourceUuid = randomUUID();

    const payloadEnviado = {
      wallet_id: walletId,
      amount,
      msisdn: msisdnFull,
      customer_name: customer_name || 'Cliente',
      source_id: sourceUuid,
    };

    const pagRef = await adminDb.collection('pagamentos').add({
      encomenda_id,
      source_uuid: sourceUuid,
      metodo,
      montante: amount,
      estado: 'pendente',
      referencia_zumbopay: null,
      payload_enviado: payloadEnviado,
      resposta_inicial: null,
      webhook_payload: null,
      criado_em: FieldValue.serverTimestamp(),
      actualizado_em: FieldValue.serverTimestamp(),
    });

    const res = await fetch(`${ZP_BASE}/charges`, {
      method: 'POST',
      headers: zpHeaders(),
      body: JSON.stringify(payloadEnviado),
    });

    const body = await res.json();
    // Resposta vem dentro de body.data
    const zpData = body.data ?? body;

    if (!res.ok) {
      await pagRef.update({
        estado: 'falhado',
        resposta_inicial: body,
        actualizado_em: FieldValue.serverTimestamp(),
      });
      return NextResponse.json(
        { error: body.error?.message || 'Erro ao iniciar pagamento' },
        { status: res.status },
      );
    }

    const referencia: string = zpData.reference ?? '';
    const zpStatus: string = zpData.status ?? '';
    const checkoutUrl: string = zpData.checkout_url ?? '';
    const succeeded = res.status === 200 && zpStatus === 'success';

    await pagRef.update({
      referencia_zumbopay: referencia,
      canal_zumbopay: zpData.channel ?? metodo,
      resposta_inicial: body,
      ...(succeeded ? { estado: 'pago' } : {}),
      actualizado_em: FieldValue.serverTimestamp(),
    });

    // 200 síncrono — confirmação imediata
    if (succeeded) {
      await adminDb.collection('encomendas').doc(encomenda_id).update({
        estado: 'confirmada',
        pagamento_estado: 'pago',
        pagamento_ref: referencia,
        actualizado_em: FieldValue.serverTimestamp(),
      });
      return NextResponse.json({ pagamento_id: pagRef.id, reference: referencia, status: 'succeeded' });
    }

    // ZumboPay devolveu checkout_url (e-Mola e outros que não fazem STK directo)
    if (checkoutUrl) {
      return NextResponse.json({ pagamento_id: pagRef.id, reference: referencia, status: 'redirect', checkout_url: checkoutUrl });
    }

    // STK push enviado — aguardar webhook via Firestore onSnapshot
    return NextResponse.json({ pagamento_id: pagRef.id, reference: referencia, status: 'pending' });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
