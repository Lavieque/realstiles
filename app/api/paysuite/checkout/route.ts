import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { createContact, createPayment, PaySuiteError } from '@/lib/paysuite';
import { referenciaEncomendaServer } from '@/lib/referencia-server';
import { autenticar, encomendaDoCaller } from '@/lib/permissoes-server';

export async function POST(req: NextRequest) {
  const caller = await autenticar(req);
  if (caller instanceof NextResponse) return caller;

  try {
    const { encomenda_id, customer_name, customer_email, customer_phone } = await req.json();
    if (!encomenda_id) {
      return NextResponse.json({ error: 'Campos obrigatórios em falta' }, { status: 400 });
    }

    // Só se paga uma encomenda própria, e sempre pelo total guardado nela
    const encomenda = await encomendaDoCaller(caller, String(encomenda_id));
    if (!encomenda) return NextResponse.json({ error: 'Encomenda não encontrada' }, { status: 404 });
    const amount = Number(encomenda.total);
    if (!(amount > 0)) return NextResponse.json({ error: 'Total da encomenda inválido' }, { status: 400 });

    const loja = process.env.LOJA_URL || 'https://realstiles.co.mz';
    const ref = await referenciaEncomendaServer(String(encomenda_id));

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
        description: `Encomenda ${ref}`,
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
