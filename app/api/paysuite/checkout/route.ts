import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { createContact, createPayment, PaySuiteError } from '@/lib/paysuite';

export async function POST(req: NextRequest) {
  try {
    const { encomenda_id, amount, customer_name, customer_email, customer_phone } = await req.json();
    if (!encomenda_id || !amount) {
      return NextResponse.json({ error: 'Campos obrigatórios em falta' }, { status: 400 });
    }

    const loja = process.env.LOJA_URL || 'https://realstiles.co.mz';
    const codCurto = String(encomenda_id).substring(0, 8).toUpperCase();

    const pagRef = await adminDb.collection('pagamentos').add({
      encomenda_id,
      gateway: 'paysuite',
      metodo: 'paysuite',
      montante: amount,
      estado: 'pendente',
      referencia_paysuite: null,
      contact_id_paysuite: null,
      payload_enviado: null,
      resposta_inicial: null,
      webhook_payload: null,
      criado_em: FieldValue.serverTimestamp(),
      actualizado_em: FieldValue.serverTimestamp(),
    });

    try {
      // TODO: se o PaySuite passar a ser o gateway principal, substituir por
      // um getOrCreateContact (procurar por email antes de criar) para evitar
      // acumular contactos órfãos por cada tentativa de checkout.
      const contact = await createContact({
        name: customer_name || 'Cliente',
        email: customer_email || '',
        phone: customer_phone || '',
      });

      const payloadEnviado = {
        amount,
        reference: pagRef.id,
        description: `Encomenda #${codCurto}`,
        return_url: `${loja}/encomenda/${encomenda_id}?confirmada=1`,
        webhook_url: `${loja}/api/paysuite/webhook`,
        contact_id: contact.id,
      };

      const payment = await createPayment(payloadEnviado);

      await pagRef.update({
        referencia_paysuite: payment.id,
        contact_id_paysuite: contact.id,
        payload_enviado: payloadEnviado,
        resposta_inicial: payment,
        actualizado_em: FieldValue.serverTimestamp(),
      });

      return NextResponse.json({
        pagamento_id: pagRef.id,
        reference: payment.id,
        status: 'redirect',
        checkout_url: payment.checkout_url,
      });
    } catch (err) {
      const status = err instanceof PaySuiteError ? err.status : 500;
      const message = err instanceof PaySuiteError ? err.message : (err instanceof Error ? err.message : String(err));
      await pagRef.update({
        estado: 'falhado',
        resposta_inicial: err instanceof PaySuiteError ? err.raw : null,
        actualizado_em: FieldValue.serverTimestamp(),
      });
      return NextResponse.json({ error: message }, { status });
    }
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
