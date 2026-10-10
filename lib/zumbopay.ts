import { adminDb } from './firebase-admin';
import { FieldValue, type DocumentSnapshot } from 'firebase-admin/firestore';
import { randomUUID } from 'crypto';
import { referenciaEncomendaServer } from './referencia-server';
import { marcarPagamentoPago, registarTentativaNaEncomenda } from './pagamentos';
import type { PedidoPagamento, ResultadoPagamento } from './pagamentos';

export const ZP_BASE = 'https://zumbopay.com/api/public/v1';

export function zpHeaders(extra?: Record<string, string>) {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.ZUMBOPAY_API_KEY || ''}`,
    'X-Merchant-Id': process.env.ZUMBOPAY_MERCHANT_ID || '',
    ...(extra || {}),
  };
}

// Estados que o ZumboPay usa para um pagamento concluído. A documentação
// pública só mostra "success" (/charges síncrono) e "succeeded" (webhook);
// os restantes cobrem a consulta GET /payments/:ref de um link já pago.
const ESTADOS_PAGO = new Set(['success', 'succeeded', 'paid', 'completed']);
const ESTADOS_FALHA = new Set(['failed', 'cancelled', 'canceled', 'expired', 'rejected']);

export function estadoZumboPago(status: unknown): boolean {
  return typeof status === 'string' && ESTADOS_PAGO.has(status.toLowerCase());
}

export function estadoZumboFalhado(status: unknown): boolean {
  return typeof status === 'string' && ESTADOS_FALHA.has(status.toLowerCase());
}

// Localiza o doc em `pagamentos` a partir dos identificadores que o ZumboPay
// devolve: primeiro a `reference` (ZP_…) que guardámos na criação, depois o
// `source_id` (UUID que enviámos em /charges).
export async function encontrarPagamentoZumbo(
  reference?: string | null,
  sourceId?: string | null,
): Promise<DocumentSnapshot | null> {
  if (reference) {
    const q = await adminDb.collection('pagamentos').where('referencia_zumbopay', '==', reference).limit(1).get();
    if (!q.empty) return q.docs[0];
  }
  if (sourceId) {
    const q = await adminDb.collection('pagamentos').where('source_uuid', '==', sourceId).limit(1).get();
    if (!q.empty) return q.docs[0];
  }
  return null;
}

// Consulta o estado real de um pagamento no ZumboPay (GET /payments/:ref).
export async function consultarPagamentoZumbo(reference: string): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }> {
  const res = await fetch(`${ZP_BASE}/payments/${encodeURIComponent(reference)}`, {
    method: 'GET',
    headers: zpHeaders(),
    cache: 'no-store',
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

// M-Pesa / e-Mola: POST /charges (STK push no telemóvel do cliente).
export async function iniciarCobrancaZumbo(pedido: PedidoPagamento): Promise<ResultadoPagamento> {
  const { encomendaId, amount, metodo } = pedido;
  const walletId = metodo === 'mpesa'
    ? process.env.ZUMBOPAY_WALLET_MPESA
    : process.env.ZUMBOPAY_WALLET_EMOLA;
  if (!walletId) return { ok: false, http: 503, error: `Wallet ${metodo} não configurada` };

  const msisdnClean = (pedido.msisdn || '').replace(/\D/g, '');
  const msisdnFull = msisdnClean.startsWith('258') ? msisdnClean : '258' + msisdnClean;

  // ZumboPay exige UUID válido em source_id; guardamos o mapeamento no pagamento
  const sourceUuid = randomUUID();

  const payloadEnviado = {
    wallet_id: walletId,
    amount,
    msisdn: msisdnFull,
    customer_name: pedido.customerName || 'Cliente',
    source_id: sourceUuid,
  };

  const pagRef = await adminDb.collection('pagamentos').add({
    encomenda_id: encomendaId,
    gateway: 'zumbopay',
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
    headers: zpHeaders({ 'Idempotency-Key': sourceUuid }),
    body: JSON.stringify(payloadEnviado),
  });

  const body = await res.json().catch(() => ({}));
  // Resposta vem dentro de body.data
  const zpData = body.data ?? body;

  if (!res.ok) {
    await pagRef.update({
      estado: 'falhado',
      resposta_inicial: body,
      actualizado_em: FieldValue.serverTimestamp(),
    });
    return { ok: false, http: res.status, error: body.error?.message || 'Erro ao iniciar pagamento' };
  }

  const referencia: string = zpData.reference ?? '';
  const checkoutUrl: string = zpData.checkout_url ?? '';
  const succeeded = res.status === 200 && zpData.status === 'success';

  await pagRef.update({
    referencia_zumbopay: referencia,
    canal_zumbopay: zpData.channel ?? metodo,
    resposta_inicial: body,
    actualizado_em: FieldValue.serverTimestamp(),
  });

  // 200 síncrono — confirmação imediata
  if (succeeded) {
    await marcarPagamentoPago(await pagRef.get(), { reference: referencia, payload: zpData });
    return { ok: true, pagamento_id: pagRef.id, reference: referencia, status: 'succeeded' };
  }

  if (referencia) await registarTentativaNaEncomenda(encomendaId, 'zumbopay', referencia);

  // ZumboPay devolveu checkout_url (e-Mola e outros que não fazem STK directo)
  if (checkoutUrl) {
    return { ok: true, pagamento_id: pagRef.id, reference: referencia, status: 'redirect', checkout_url: checkoutUrl };
  }

  // STK push enviado — confirmação chega pelo webhook ou pela consulta de estado
  return { ok: true, pagamento_id: pagRef.id, reference: referencia, status: 'pending' };
}

// Cartão: POST /payments cria um link de pagamento com checkout alojado.
export async function criarCheckoutZumbo(pedido: PedidoPagamento): Promise<ResultadoPagamento> {
  const { encomendaId, amount } = pedido;
  const walletId = process.env.ZUMBOPAY_WALLET_CARD;
  if (!walletId) return { ok: false, http: 503, error: 'Wallet cartão não configurada' };

  const ref = await referenciaEncomendaServer(encomendaId);
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
    encomenda_id: encomendaId,
    gateway: 'zumbopay',
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

  const body = await res.json().catch(() => ({}));
  const zpData = body.data ?? body;

  if (!res.ok || !zpData.checkout_url) {
    await pagRef.update({
      estado: 'falhado',
      resposta_inicial: body,
      actualizado_em: FieldValue.serverTimestamp(),
    });
    return { ok: false, http: res.ok ? 502 : res.status, error: body.error?.message || 'Erro ao criar checkout' };
  }

  await pagRef.update({
    referencia_zumbopay: zpData.reference ?? null,
    resposta_inicial: body,
    actualizado_em: FieldValue.serverTimestamp(),
  });
  if (zpData.reference) await registarTentativaNaEncomenda(encomendaId, 'zumbopay', zpData.reference);

  return { ok: true, pagamento_id: pagRef.id, reference: zpData.reference ?? '', status: 'redirect', checkout_url: zpData.checkout_url };
}
