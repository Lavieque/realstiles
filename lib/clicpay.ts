import { adminDb } from './firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { randomUUID } from 'crypto';
import { referenciaEncomendaServer } from './referencia-server';
import { marcarPagamentoPago, marcarPagamentoFalhado, registarTentativaNaEncomenda } from './pagamentos';
import type { PedidoPagamento, ResultadoPagamento } from './pagamentos';

// ClicPay API v2 — https://clicpay.co.mz/api/documentation
// Autenticação por token Bearer (OAuth2 / Laravel Passport). A confirmação
// oficial de um pagamento é a consulta GET /transactions/{ref}/status: o
// webhook é só aceleração e ainda não está documentado, por isso o site
// consulta o estado enquanto o cliente espera (ver /api/pagamentos/estado).

const CP_BASE = `${(process.env.CLICPAY_BASE_URL || 'https://clicpay.co.mz').replace(/\/$/, '')}/api/v2`;

// Limite das cobranças C2B (M-Pesa, e-Mola, mKesh) segundo a documentação.
export const CLICPAY_C2B_MAX = 150000;

export function cpHeaders(extra?: Record<string, string>) {
  return {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Authorization': `Bearer ${process.env.CLICPAY_API_TOKEN || ''}`,
    ...(extra || {}),
  };
}

// O status de /transactions/{ref}/status vem em MAIÚSCULAS; o das respostas
// de iniciação vem em minúsculas ("pending"). Normalizamos sempre.
const ESTADOS_FALHA = new Set(['FAILED', 'CANCELLED', 'REJECTED']);

export function estadoClicpayPago(status: unknown): boolean {
  return typeof status === 'string' && status.toUpperCase() === 'SUCCESSFUL';
}

export function estadoClicpayFalhado(status: unknown): boolean {
  return typeof status === 'string' && ESTADOS_FALHA.has(status.toUpperCase());
}

// Mensagem legível de uma resposta de erro: `message` ou o primeiro erro de
// validação (`errors: { campo: [msg] }`).
function erroClicpay(body: Record<string, unknown>, padrao: string): string {
  if (typeof body.message === 'string' && body.message) return body.message;
  const errors = body.errors as Record<string, unknown> | undefined;
  if (errors && typeof errors === 'object') {
    const primeiro = Object.values(errors)[0];
    if (Array.isArray(primeiro) && typeof primeiro[0] === 'string') return primeiro[0];
  }
  return padrao;
}

// A ClicPay espera o número nacional de 9 dígitos (ex.: 841234567).
function msisdnNacional(msisdn: string): string {
  const digitos = msisdn.replace(/\D/g, '');
  return digitos.length === 12 && digitos.startsWith('258') ? digitos.slice(3) : digitos;
}

// Descrição visível ao pagador: 3–32 caracteres (C2B) / 100 (cartão).
function descricao(ref: string, max: number): string {
  return `Encomenda ${ref}`.slice(0, max);
}

// POST com Idempotency-Key. Num erro de rede não sabemos se a cobrança saiu,
// por isso repetimos uma vez com a MESMA chave (a ClicPay devolve a resposta
// original em vez de cobrar de novo). Num 409 o pedido anterior ainda está a
// correr: esperamos o Retry-After (até 8s) e repetimos com a mesma chave.
async function postIdempotente(url: string, chave: string, payload: unknown) {
  let ultimoErro: unknown;
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: cpHeaders({ 'Idempotency-Key': chave }),
        body: JSON.stringify(payload),
        cache: 'no-store',
      });
      // Lê como texto: num timeout do proxy da ClicPay a resposta é HTML/vazia
      const texto = await res.text().catch(() => '');
      let body: Record<string, unknown> = {};
      try { body = texto ? JSON.parse(texto) : {}; } catch { body = { _texto: texto.slice(0, 500) }; }
      if (res.status === 409 && tentativa === 0) {
        const espera = Math.min(Number(body.retry_after_seconds ?? res.headers.get('retry-after') ?? 3) || 3, 8);
        await new Promise(r => setTimeout(r, espera * 1000));
        continue;
      }
      return { res, body };
    } catch (err) {
      ultimoErro = err;
    }
  }
  throw ultimoErro instanceof Error ? ultimoErro : new Error('Sem resposta da ClicPay');
}

function carteiraC2B(metodo: 'mpesa' | 'emola' | 'mkesh'): string | undefined {
  return {
    mpesa: process.env.CLICPAY_WALLET_MPESA,
    emola: process.env.CLICPAY_WALLET_EMOLA,
    mkesh: process.env.CLICPAY_WALLET_MKESH,
  }[metodo];
}
const NOME_C2B = { mpesa: 'M-Pesa', emola: 'e-Mola', mkesh: 'mKesh' };

// M-Pesa / e-Mola / mKesh: POST /wallets/{id}/c2b/{mpesa|emola|mkesh}
// (pedido de confirmação com PIN no telemóvel do cliente).
export async function iniciarCobrancaClicpay(pedido: PedidoPagamento): Promise<ResultadoPagamento> {
  const { encomendaId, amount, metodo } = pedido;
  if (metodo === 'cartao') return { ok: false, http: 400, error: 'Método inválido' };

  const walletId = carteiraC2B(metodo);
  if (!walletId) return { ok: false, http: 503, error: `Carteira ${NOME_C2B[metodo]} não configurada` };

  if (amount > CLICPAY_C2B_MAX) {
    return {
      ok: false, http: 400,
      error: `O ${NOME_C2B[metodo]} aceita no máximo ${CLICPAY_C2B_MAX.toLocaleString('pt-PT')} MZN por pagamento. Usa o cartão.`,
    };
  }

  const msisdn = msisdnNacional(pedido.msisdn || '');
  if (!/^8\d{8}$/.test(msisdn)) return { ok: false, http: 400, error: 'Número de telefone inválido' };

  const ref = await referenciaEncomendaServer(encomendaId);
  const idempotencyKey = randomUUID();
  const payloadEnviado = {
    msisdn,
    amount,
    reference_description: descricao(ref, 32),
    internal_notes: `Encomenda ${encomendaId}`,
  };

  const pagRef = await adminDb.collection('pagamentos').add({
    encomenda_id: encomendaId,
    gateway: 'clicpay',
    idempotency_key: idempotencyKey,
    metodo,
    montante: amount,
    estado: 'pendente',
    referencia_clicpay: null,
    payload_enviado: { ...payloadEnviado, wallet_id: walletId },
    resposta_inicial: null,
    webhook_payload: null,
    criado_em: FieldValue.serverTimestamp(),
    actualizado_em: FieldValue.serverTimestamp(),
  });

  let res: Response;
  let body: Record<string, unknown>;
  try {
    ({ res, body } = await postIdempotente(
      `${CP_BASE}/wallets/${encodeURIComponent(walletId)}/c2b/${metodo}`,
      idempotencyKey,
      payloadEnviado,
    ));
  } catch (err) {
    // Sem resposta: a cobrança pode ter seguido. Fica pendente e a consulta
    // de estado procura-a no histórico da carteira (ver verificar-pagamentos).
    await pagRef.update({
      desfecho_desconhecido: true,
      resposta_inicial: { erro_rede: err instanceof Error ? err.message : String(err) },
      actualizado_em: FieldValue.serverTimestamp(),
    });
    return { ok: true, pagamento_id: pagRef.id, reference: '', status: 'pending' };
  }

  const referencia = typeof body.clicpay_reference === 'string' ? body.clicpay_reference : '';

  // A ClicPay só responde a /c2b depois de o cliente introduzir o PIN (ou de
  // o operador desistir). Uma resposta 5xx/vazia sem referência é quase
  // sempre o proxy deles a cortar a ligação ao fim de ~60s, com a cobrança
  // ainda a correr — não é uma recusa. Fica pendente, como no erro de rede.
  const semDesfecho = !res.ok && !referencia && (res.status >= 500 || !Object.keys(body).length || '_texto' in body);
  if (semDesfecho) {
    await pagRef.update({
      desfecho_desconhecido: true,
      resposta_inicial: { http_status: res.status, ...body },
      actualizado_em: FieldValue.serverTimestamp(),
    });
    return { ok: true, pagamento_id: pagRef.id, reference: '', status: 'pending' };
  }

  if (!res.ok) {
    await pagRef.update({
      estado: 'falhado',
      referencia_clicpay: referencia || null,
      resposta_inicial: { http_status: res.status, ...body },
      actualizado_em: FieldValue.serverTimestamp(),
    });
    return { ok: false, http: res.status, error: erroClicpay(body, 'Erro ao iniciar pagamento') };
  }

  await pagRef.update({
    referencia_clicpay: referencia || null,
    resposta_inicial: body,
    actualizado_em: FieldValue.serverTimestamp(),
  });

  if (estadoClicpayPago(body.status)) {
    await marcarPagamentoPago(await pagRef.get(), { reference: referencia, payload: body });
    return { ok: true, pagamento_id: pagRef.id, reference: referencia, status: 'succeeded' };
  }
  if (estadoClicpayFalhado(body.status)) {
    await marcarPagamentoFalhado(await pagRef.get(), body);
    return { ok: false, http: 402, error: erroClicpay(body, 'Pagamento recusado') };
  }

  if (referencia) await registarTentativaNaEncomenda(encomendaId, 'clicpay', referencia);
  return { ok: true, pagamento_id: pagRef.id, reference: referencia, status: 'pending' };
}

// Cartão: POST /wallets/{id}/card-payment cria uma sessão de checkout
// NetShop. Os dados do cartão são introduzidos na página do NetShop — nunca
// passam por nós.
export async function criarCheckoutClicpay(pedido: PedidoPagamento): Promise<ResultadoPagamento> {
  const { encomendaId, amount } = pedido;
  const walletId = process.env.CLICPAY_WALLET_CARD;
  if (!walletId) return { ok: false, http: 503, error: 'Carteira cartão não configurada' };

  const ref = await referenciaEncomendaServer(encomendaId);
  const loja = process.env.LOJA_URL || 'https://realstiles.co.mz';
  const idempotencyKey = randomUUID();
  const payloadEnviado = {
    amount,
    reference_description: descricao(ref, 100),
    ...(pedido.customerEmail ? { email: pedido.customerEmail } : {}),
    // O cliente volta à lista de encomendas, que consulta o estado desta ao abrir
    callback_url: `${loja}/encomendas?pagamento=${encodeURIComponent(encomendaId)}`,
    from_app: 'Realstiles',
  };

  const pagRef = await adminDb.collection('pagamentos').add({
    encomenda_id: encomendaId,
    gateway: 'clicpay',
    idempotency_key: idempotencyKey,
    metodo: 'cartao',
    montante: amount,
    estado: 'pendente',
    referencia_clicpay: null,
    payload_enviado: { ...payloadEnviado, wallet_id: walletId },
    resposta_inicial: null,
    webhook_payload: null,
    criado_em: FieldValue.serverTimestamp(),
    actualizado_em: FieldValue.serverTimestamp(),
  });

  let res: Response;
  let body: Record<string, unknown>;
  try {
    ({ res, body } = await postIdempotente(
      `${CP_BASE}/wallets/${encodeURIComponent(walletId)}/card-payment`,
      idempotencyKey,
      payloadEnviado,
    ));
  } catch (err) {
    await pagRef.update({
      estado: 'falhado',
      resposta_inicial: { erro_rede: err instanceof Error ? err.message : String(err) },
      actualizado_em: FieldValue.serverTimestamp(),
    });
    return { ok: false, http: 502, error: 'Sem resposta do serviço de pagamento. Tenta novamente.' };
  }

  const referencia = typeof body.clicpay_reference === 'string' ? body.clicpay_reference : '';
  const checkoutUrl = typeof body.checkout_url === 'string' ? body.checkout_url : '';

  if (!res.ok || !checkoutUrl) {
    await pagRef.update({
      estado: 'falhado',
      referencia_clicpay: referencia || null,
      resposta_inicial: body,
      actualizado_em: FieldValue.serverTimestamp(),
    });
    return { ok: false, http: res.ok ? 502 : res.status, error: erroClicpay(body, 'Erro ao criar checkout') };
  }

  await pagRef.update({
    referencia_clicpay: referencia || null,
    resposta_inicial: body,
    actualizado_em: FieldValue.serverTimestamp(),
  });
  if (referencia) await registarTentativaNaEncomenda(encomendaId, 'clicpay', referencia);

  return { ok: true, pagamento_id: pagRef.id, reference: referencia, status: 'redirect', checkout_url: checkoutUrl };
}

// GET /transactions/{ref}/status — fonte de verdade do estado. A ClicPay
// guarda o resultado 15s, por isso não vale a pena consultar mais depressa.
export async function consultarPagamentoClicpay(reference: string): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }> {
  const res = await fetch(`${CP_BASE}/transactions/${encodeURIComponent(reference)}/status`, {
    method: 'GET',
    headers: cpHeaders(),
    cache: 'no-store',
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, status: res.status, body };
}

// Procura no histórico da carteira uma cobrança que iniciámos mas cuja
// resposta não chegou (timeout/erro sem clicpay_reference). Liga-a pela
// descrição (tem a referência da encomenda), pelo montante e pela hora.
export async function buscarTransacaoClicpay(dados: {
  walletId: string;
  descricao: string;
  montante: number;
  desde: Date;
}): Promise<{ reference: string; status: string } | null> {
  const dia = new Date(dados.desde.getTime() - 24 * 3600 * 1000).toISOString().slice(0, 10);
  const qs = new URLSearchParams({
    'filter[date_from]': dia,
    'filter[type]': 'C2B',
    sort: '-created_at',
    paginator: 'offset',
    per_page: '50',
  });
  const res = await fetch(`${CP_BASE}/wallets/${encodeURIComponent(dados.walletId)}/transactions?${qs}`, {
    method: 'GET',
    headers: cpHeaders(),
    cache: 'no-store',
  });
  if (!res.ok) return null;
  const body = (await res.json().catch(() => ({}))) as { data?: Record<string, unknown>[] };
  const limiteInferior = dados.desde.getTime() - 2 * 60 * 1000;
  const t = (body.data ?? []).find(tx =>
    tx.description === dados.descricao
    && Math.abs(Number(tx.amount) - dados.montante) < 0.01
    && new Date(String(tx.created_at ?? tx.initiated_at ?? 0)).getTime() >= limiteInferior
    && typeof tx.clicpay_reference === 'string',
  );
  return t ? { reference: String(t.clicpay_reference), status: String(t.status ?? '') } : null;
}

// Carteiras a que o token tem acesso (painel admin).
export async function listarCarteirasClicpay(): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }> {
  const res = await fetch(`${CP_BASE}/wallets?per_page=100`, {
    method: 'GET',
    headers: cpHeaders(),
    cache: 'no-store',
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, status: res.status, body };
}
