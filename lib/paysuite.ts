import { adminDb } from './firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

const PS_BASE = 'https://paysuite.tech/api/v1';

function psHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.PAYSUITE_API_KEY || ''}`,
  };
}

export class PaySuiteError extends Error {
  status: number;
  raw: unknown;
  constructor(status: number, message: string, raw: unknown) {
    super(message);
    this.status = status;
    this.raw = raw;
  }
}

async function psFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${PS_BASE}${path}`, {
    ...init,
    headers: { ...psHeaders(), ...(init?.headers || {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new PaySuiteError(res.status, body?.message || 'Erro ao comunicar com o PaySuite', body);
  }
  return body?.data ?? body;
}

export interface PaySuiteContact {
  id: string;
  name: string;
  email: string;
  phone: string;
  created_at: string;
}

export function createContact(data: { name: string; email: string; phone: string }): Promise<PaySuiteContact> {
  return psFetch('/contacts', { method: 'POST', body: JSON.stringify(data) });
}

export interface PaySuitePayment {
  id: string;
  amount: number;
  reference: string;
  status: string;
  contact_id?: string;
  checkout_url?: string;
  transaction?: { id: number; status: string; transaction_id: string; paid_at: string };
}

export function createPayment(data: {
  amount: number;
  reference: string;
  description: string;
  return_url: string;
  webhook_url: string;
  contact_id: string;
}): Promise<PaySuitePayment> {
  return psFetch('/payments', { method: 'POST', body: JSON.stringify(data) });
}

export function getPayment(id: string): Promise<PaySuitePayment> {
  return psFetch(`/payments/${id}`, { method: 'GET' });
}

// Busca o estado real do pagamento directamente ao PaySuite (nunca confia no
// corpo do webhook, que não tem verificação de assinatura documentada) e
// confirma a encomenda em Firestore se estiver pago. Usado pela rota de
// webhook e pela rota de status/reconciliação manual.
export async function confirmarPagamentoPaysuite(pagamentoId: string): Promise<{ estado: string }> {
  const pagRef = adminDb.collection('pagamentos').doc(pagamentoId);
  const pagSnap = await pagRef.get();
  if (!pagSnap.exists) return { estado: 'nao_encontrado' };

  const pagamento = pagSnap.data()!;
  if (pagamento.estado === 'pago') return { estado: 'pago' };

  const referencia = pagamento.referencia_paysuite;
  if (!referencia) return { estado: pagamento.estado };

  const psData = await getPayment(referencia);
  if (psData.status !== 'paid') return { estado: pagamento.estado };

  const batch = adminDb.batch();
  batch.update(pagRef, {
    estado: 'pago',
    webhook_payload: psData,
    actualizado_em: FieldValue.serverTimestamp(),
  });
  batch.update(adminDb.collection('encomendas').doc(pagamento.encomenda_id), {
    estado: 'confirmada',
    pagamento_estado: 'pago',
    pagamento_ref: referencia,
    actualizado_em: FieldValue.serverTimestamp(),
  });
  await batch.commit();

  return { estado: 'pago' };
}
