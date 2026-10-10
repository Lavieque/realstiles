import { doc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import { apiFetch } from './api-fetch';
import { METODOS_PAGAMENTO } from './metodos-pagamento';
import type { MetodoPagamento } from './metodos-pagamento';

// Lado do cliente dos pagamentos online. O gateway (ZumboPay ou ClicPay) é
// escolhido no servidor, por isso aqui só se fala com /api/pagamentos/*.

export type { MetodoPagamento };

export interface RespostaPagamento {
  status: 'succeeded' | 'pending' | 'redirect';
  pagamento_id: string;
  reference: string;
  checkout_url?: string;
}

// Métodos que o gateway activo tem configurados. Em caso de erro devolve
// todos, para não esconder o checkout por uma falha de rede.
export async function getMetodosDisponiveis(): Promise<MetodoPagamento[]> {
  try {
    const res = await fetch('/api/pagamentos/metodos', { cache: 'no-store' });
    const data = await res.json();
    if (res.ok && Array.isArray(data.metodos)) return data.metodos;
  } catch { /* usa o recurso abaixo */ }
  return METODOS_PAGAMENTO;
}

export async function iniciarPagamento(dados: {
  encomendaId: string;
  metodo: MetodoPagamento;
  msisdn?: string;
  customerName?: string;
}): Promise<RespostaPagamento> {
  const res = await apiFetch('/api/pagamentos/iniciar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      encomenda_id: dados.encomendaId,
      metodo: dados.metodo,
      msisdn: dados.msisdn,
      customer_name: dados.customerName,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erro ao iniciar pagamento');
  return data;
}

// Pede ao servidor para consultar o gateway e confirmar a encomenda se o
// pagamento já estiver feito.
export async function consultarEstadoPagamento(encomendaId: string): Promise<{ pago: boolean; estado: string; mensagem?: string } | null> {
  try {
    const res = await apiFetch('/api/pagamentos/estado', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ encomenda_id: encomendaId }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

const INTERVALO_CONSULTA_MS = 10_000;
const TEMPO_MAXIMO_MS = 3 * 60 * 1000;

// Espera a confirmação de um pagamento por telemóvel. Escuta a encomenda no
// Firestore (o webhook ou a consulta confirmam-na) e, como o webhook se pode
// perder, consulta o gateway a cada 10s. Devolve a função para parar.
export function aguardarPagamento(
  encomendaId: string,
  callbacks: { onPago: () => void; onFalhado: (msg: string) => void; onTimeout: () => void },
): () => void {
  let terminado = false;
  const parar = () => {
    terminado = true;
    unsub();
    clearInterval(intervalo);
    clearTimeout(timeout);
  };

  const unsub = onSnapshot(doc(db, 'encomendas', encomendaId), (snap) => {
    const enc = snap.data();
    if (terminado || !enc) return;
    if (enc.estado === 'confirmada' || enc.pagamento_estado === 'pago') {
      parar();
      callbacks.onPago();
    } else if (enc.estado === 'cancelada') {
      parar();
      callbacks.onFalhado('Pagamento cancelado. Tenta novamente.');
    }
  });

  const intervalo = setInterval(async () => {
    const r = await consultarEstadoPagamento(encomendaId);
    if (terminado || !r) return;
    if (r.pago) {
      parar();
      callbacks.onPago();
    } else if (r.estado === 'falhado') {
      parar();
      callbacks.onFalhado(r.mensagem || 'O pagamento não foi concluído. Tenta novamente.');
    }
  }, INTERVALO_CONSULTA_MS);

  const timeout = setTimeout(async () => {
    // Última consulta antes de desistir
    const r = await consultarEstadoPagamento(encomendaId);
    if (terminado) return;
    parar();
    if (r?.pago) callbacks.onPago();
    else callbacks.onTimeout();
  }, TEMPO_MAXIMO_MS);

  return parar;
}
