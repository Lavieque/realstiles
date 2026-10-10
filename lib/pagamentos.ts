import { adminDb } from './firebase-admin';
import { FieldValue, type DocumentSnapshot } from 'firebase-admin/firestore';
import { METODOS_PAGAMENTO } from './metodos-pagamento';
import type { MetodoPagamento } from './metodos-pagamento';

export type { MetodoPagamento };

// Camada comum aos gateways de pagamento (ZumboPay e ClicPay). O gateway
// activo no site é escolhido no painel (/admin/pagamentos) e guardado em
// config_pagamentos/gateway — colecção sem regras no Firestore, por isso só
// o Admin SDK (rotas /api) a lê e escreve.

export type Gateway = 'zumbopay' | 'clicpay';

export const GATEWAYS: { id: Gateway; nome: string }[] = [
  { id: 'zumbopay', nome: 'ZumboPay' },
  { id: 'clicpay', nome: 'ClicPay' },
];

export const METODOS: MetodoPagamento[] = METODOS_PAGAMENTO;

const GATEWAY_PADRAO: Gateway = 'zumbopay';
const configRef = () => adminDb.collection('config_pagamentos').doc('gateway');

export function eGateway(valor: unknown): valor is Gateway {
  return GATEWAYS.some(g => g.id === valor);
}

export function eMetodo(valor: unknown): valor is MetodoPagamento {
  return METODOS.includes(valor as MetodoPagamento);
}

// Métodos desligados no admin, por gateway. Um método não listado está
// ligado (desde que configurado no servidor).
export type MetodosDesativados = Record<Gateway, MetodoPagamento[]>;

export interface ConfigPagamentos {
  ativo: Gateway;
  desativados: MetodosDesativados;
}

export async function getConfigPagamentos(): Promise<ConfigPagamentos> {
  const dados = (await configRef().get()).data() ?? {};
  const desativados = {} as MetodosDesativados;
  for (const g of GATEWAYS) {
    const lista = dados.metodos_desativados?.[g.id];
    desativados[g.id] = Array.isArray(lista) ? lista.filter(eMetodo) : [];
  }
  return { ativo: eGateway(dados.ativo) ? dados.ativo : GATEWAY_PADRAO, desativados };
}

export async function getGatewayAtivo(): Promise<Gateway> {
  return (await getConfigPagamentos()).ativo;
}

export async function setGatewayAtivo(gateway: Gateway, uid: string): Promise<void> {
  await configRef().set({
    ativo: gateway,
    actualizado_por: uid,
    actualizado_em: FieldValue.serverTimestamp(),
  }, { merge: true });
}

export async function setMetodoAtivo(gateway: Gateway, metodo: MetodoPagamento, ativo: boolean, uid: string): Promise<void> {
  await configRef().set({
    metodos_desativados: {
      [gateway]: ativo ? FieldValue.arrayRemove(metodo) : FieldValue.arrayUnion(metodo),
    },
    actualizado_por: uid,
    actualizado_em: FieldValue.serverTimestamp(),
  }, { merge: true });
}

// O que está configurado nas variáveis de ambiente de cada gateway. Só
// devolve booleanos — nunca os valores.
export function configuracaoGateway(gateway: Gateway): { credenciais: boolean; metodos: Record<MetodoPagamento, boolean> } {
  if (gateway === 'clicpay') {
    return {
      credenciais: Boolean(process.env.CLICPAY_API_TOKEN),
      metodos: {
        mpesa: Boolean(process.env.CLICPAY_WALLET_MPESA),
        emola: Boolean(process.env.CLICPAY_WALLET_EMOLA),
        mkesh: Boolean(process.env.CLICPAY_WALLET_MKESH),
        cartao: Boolean(process.env.CLICPAY_WALLET_CARD),
      },
    };
  }
  return {
    credenciais: Boolean(process.env.ZUMBOPAY_API_KEY && process.env.ZUMBOPAY_MERCHANT_ID),
    metodos: {
      mpesa: Boolean(process.env.ZUMBOPAY_WALLET_MPESA),
      emola: Boolean(process.env.ZUMBOPAY_WALLET_EMOLA),
      // O ZumboPay não suporta mKesh
      mkesh: false,
      cartao: Boolean(process.env.ZUMBOPAY_WALLET_CARD),
    },
  };
}

// Métodos configurados no servidor (credenciais + carteira).
export function metodosConfigurados(gateway: Gateway): MetodoPagamento[] {
  const cfg = configuracaoGateway(gateway);
  if (!cfg.credenciais) return [];
  return METODOS.filter(m => cfg.metodos[m]);
}

// Métodos que o site oferece: configurados no servidor e ligados no admin.
export function metodosDisponiveis(gateway: Gateway, desativados: MetodosDesativados): MetodoPagamento[] {
  return metodosConfigurados(gateway).filter(m => !desativados[gateway].includes(m));
}

// Gateway de um doc em `pagamentos`. Os criados antes de existir o campo
// `gateway` são todos do ZumboPay (os do PaySuite têm referencia_paysuite).
export function gatewayDoPagamento(p: Record<string, unknown>): Gateway | 'paysuite' {
  if (p.gateway === 'clicpay' || p.gateway === 'zumbopay') return p.gateway;
  if (p.gateway === 'paysuite' || p.referencia_paysuite) return 'paysuite';
  return 'zumbopay';
}

export function referenciaDoPagamento(p: Record<string, unknown>): string | null {
  const ref = gatewayDoPagamento(p) === 'clicpay' ? p.referencia_clicpay : p.referencia_zumbopay;
  return typeof ref === 'string' && ref ? ref : null;
}

// Resultado de iniciar uma cobrança/checkout, independente do gateway.
export type ResultadoPagamento =
  | { ok: true; pagamento_id: string; reference: string; status: 'succeeded' | 'pending' }
  | { ok: true; pagamento_id: string; reference: string; status: 'redirect'; checkout_url: string }
  | { ok: false; http: number; error: string };

export interface PedidoPagamento {
  encomendaId: string;
  amount: number;
  metodo: MetodoPagamento;
  msisdn?: string;
  customerName?: string;
  customerEmail?: string;
}

// Regista na encomenda a referência da última tentativa, visível no admin
// mesmo antes de estar paga.
export async function registarTentativaNaEncomenda(encomendaId: string, gateway: Gateway, reference: string) {
  await adminDb.collection('encomendas').doc(encomendaId).update({
    pagamento_ref: reference,
    pagamento_gateway: gateway,
    actualizado_em: FieldValue.serverTimestamp(),
  });
}

// Marca o pagamento como pago e confirma a encomenda, numa única batch.
// Recusa se o montante recebido não coincidir com o montante guardado.
export async function marcarPagamentoPago(
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
      ...(pagamento.gateway ? { pagamento_gateway: pagamento.gateway } : {}),
      actualizado_em: FieldValue.serverTimestamp(),
    });
  }
  await batch.commit();
  return { ok: true };
}

export async function marcarPagamentoFalhado(pagSnap: DocumentSnapshot, payload: unknown) {
  if (pagSnap.data()?.estado === 'pago') return;
  await pagSnap.ref.update({
    estado: 'falhado',
    webhook_payload: payload,
    actualizado_em: FieldValue.serverTimestamp(),
  });
}
