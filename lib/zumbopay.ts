import { adminDb } from './firebase-admin';
import { FieldValue, type DocumentSnapshot } from 'firebase-admin/firestore';

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

export function estadoZumboPago(status: unknown): boolean {
  return typeof status === 'string' && ESTADOS_PAGO.has(status.toLowerCase());
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

// Marca o pagamento como pago e confirma a encomenda, numa única batch.
// Recusa se o montante recebido não coincidir com o montante guardado.
export async function marcarPagamentoZumboPago(
  pagSnap: DocumentSnapshot,
  dados: { reference: string; amount?: unknown; payload: unknown },
): Promise<{ ok: boolean; motivo?: string }> {
  const pagamento = pagSnap.data()!;
  if (pagamento.estado === 'pago') return { ok: true };

  const amount = Number(dados.amount);
  if (dados.amount !== undefined && Math.abs(amount - Number(pagamento.montante)) > 0.01) {
    await pagSnap.ref.update({
      estado: 'montante_divergente',
      webhook_payload: dados.payload,
      actualizado_em: FieldValue.serverTimestamp(),
    });
    return { ok: false, motivo: `Montante divergente: recebido ${amount}, esperado ${pagamento.montante}` };
  }

  const encRef = adminDb.collection('encomendas').doc(pagamento.encomenda_id);
  const encSnap = await encRef.get();

  const batch = adminDb.batch();
  batch.update(pagSnap.ref, {
    estado: 'pago',
    webhook_payload: dados.payload,
    actualizado_em: FieldValue.serverTimestamp(),
  });
  if (encSnap.exists) {
    const encEstado = encSnap.data()?.estado;
    batch.update(encRef, {
      // Não recua encomendas que o admin já avançou (enviada/entregue)
      ...(encEstado === 'pendente' || encEstado === 'cancelada' ? { estado: 'confirmada' } : {}),
      pagamento_estado: 'pago',
      pagamento_ref: dados.reference,
      actualizado_em: FieldValue.serverTimestamp(),
    });
  }
  await batch.commit();
  return { ok: true };
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
