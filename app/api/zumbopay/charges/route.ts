import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

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
    const { encomenda_id, amount, msisdn, metodo } = await req.json();
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

    const payloadEnviado = {
      wallet_id: walletId,
      amount,
      currency: 'MZN',
      msisdn: msisdnFull,
      source_id: encomenda_id,
      description: `Encomenda #${encomenda_id.substring(0, 8).toUpperCase()} — Real Stiles`,
    };

    // Cria registo de pagamento antes de chamar a API
    const pagRef = await adminDb.collection('pagamentos').add({
      encomenda_id,
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

    const data = await res.json();

    if (!res.ok) {
      // Regista falha imediata
      await pagRef.update({
        estado: 'falhado',
        resposta_inicial: data,
        actualizado_em: FieldValue.serverTimestamp(),
      });
      return NextResponse.json(
        { error: data.error?.message || 'Erro ao iniciar pagamento' },
        { status: res.status },
      );
    }

    const referencia = data.data?.reference ?? data.reference ?? data.id ?? '';
    const zpStatus: string = data.data?.status ?? data.status ?? '';
    const succeeded = res.status === 200 && (zpStatus === 'success' || zpStatus === 'succeeded');

    await pagRef.update({
      referencia_zumbopay: referencia,
      resposta_inicial: data,
      ...(succeeded ? { estado: 'pago' } : {}),
      actualizado_em: FieldValue.serverTimestamp(),
    });

    // 200 síncrono — confirma encomenda imediatamente sem polling
    if (succeeded) {
      await adminDb.collection('encomendas').doc(encomenda_id).update({
        estado: 'confirmada',
        pagamento_estado: 'pago',
        pagamento_ref: referencia,
        actualizado_em: FieldValue.serverTimestamp(),
      });
      return NextResponse.json({ pagamento_id: pagRef.id, reference: referencia, status: 'succeeded' });
    }

    // 202 — STK push enviado, aguardar confirmação via polling/webhook
    return NextResponse.json({ pagamento_id: pagRef.id, reference: referencia, status: 'pending' });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
