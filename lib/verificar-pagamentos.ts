import { adminDb } from './firebase-admin';
import { FieldValue, type DocumentData } from 'firebase-admin/firestore';
import { gatewayDoPagamento, referenciaDoPagamento, marcarPagamentoPago, marcarPagamentoFalhado, registarTentativaNaEncomenda } from './pagamentos';
import { consultarPagamentoZumbo, estadoZumboPago, estadoZumboFalhado } from './zumbopay';
import { buscarTransacaoClicpay, consultarPagamentoClicpay, estadoClicpayPago, estadoClicpayFalhado } from './clicpay';

// Cobrança ClicPay por telemóvel cuja resposta não trouxe referência (timeout
// ou erro sem desfecho): ainda pode ser encontrada no histórico da carteira.
function clicpaySemReferencia(p: DocumentData): boolean {
  return gatewayDoPagamento(p) === 'clicpay' && !referenciaDoPagamento(p) && p.metodo !== 'cartao'
    && p.estado !== 'pago' && Boolean(p.payload_enviado?.wallet_id && p.payload_enviado?.reference_description);
}

export interface TentativaVerificada {
  reference: string;
  gateway: string;
  metodo?: string;
  estado_local: string;
  estado_gateway: string | null;
  // Motivo dado pela operadora quando a tentativa falhou (para o cliente)
  mensagem?: string;
}

function mensagemDe(...fontes: unknown[]): string | undefined {
  for (const f of fontes) {
    const o = f as Record<string, unknown> | null | undefined;
    const m = o?.message ?? o?.provider_status_text;
    if (typeof m === 'string' && m.trim()) return m.trim();
  }
  return undefined;
}

// Consulta no gateway cada tentativa de pagamento da encomenda e confirma-a
// se alguma estiver paga. `apenasPendentes` limita às 3 tentativas mais
// recentes e só consulta as pendentes (consulta automática enquanto o
// cliente espera);
// sem ele re-consulta tudo o que não está pago (verificação manual no admin).
export async function verificarPagamentosEncomenda(
  encomendaId: string,
  { apenasPendentes = false }: { apenasPendentes?: boolean } = {},
): Promise<{ pago: boolean; estado: 'pago' | 'pendente' | 'falhado' | 'sem_tentativas'; mensagem?: string; tentativas: TentativaVerificada[] }> {
  const snap = await adminDb.collection('pagamentos').where('encomenda_id', '==', encomendaId).get();
  let docs = snap.docs
    .filter(d => gatewayDoPagamento(d.data()) !== 'paysuite' && (referenciaDoPagamento(d.data()) || clicpaySemReferencia(d.data())))
    .sort((a, b) => (b.data().criado_em?.toMillis?.() ?? 0) - (a.data().criado_em?.toMillis?.() ?? 0));
  if (apenasPendentes) docs = docs.slice(0, 3);

  const tentativas: TentativaVerificada[] = [];
  let pago = false;

  for (const pagSnap of docs) {
    const p = pagSnap.data();
    const gateway = gatewayDoPagamento(p) as 'zumbopay' | 'clicpay';
    let reference = referenciaDoPagamento(p);

    if (!reference) {
      // Só no admin (todas) ou, para o cliente, enquanto está pendente
      if (apenasPendentes && p.estado !== 'pendente') continue;
      const encontrada = await buscarTransacaoClicpay({
        walletId: String(p.payload_enviado.wallet_id),
        descricao: String(p.payload_enviado.reference_description),
        montante: Number(p.montante),
        desde: p.criado_em?.toDate?.() ?? new Date(0),
      }).catch(() => null);
      if (!encontrada) {
        tentativas.push({ reference: '(sem referência)', gateway, metodo: p.metodo, estado_local: p.estado, estado_gateway: 'não encontrada na ClicPay' });
        continue;
      }
      reference = encontrada.reference;
      // Recupera a ligação e volta a considerar a tentativa pendente; o
      // estado real é confirmado já a seguir pela consulta normal.
      await pagSnap.ref.update({
        referencia_clicpay: reference,
        desfecho_desconhecido: false,
        estado: 'pendente',
        actualizado_em: FieldValue.serverTimestamp(),
      });
      await registarTentativaNaEncomenda(String(p.encomenda_id), 'clicpay', reference);
      p.estado = 'pendente';
    }

    if (p.estado === 'pago') {
      pago = true;
      tentativas.push({ reference, gateway, metodo: p.metodo, estado_local: 'pago', estado_gateway: null });
      continue;
    }
    if (apenasPendentes && p.estado !== 'pendente') {
      tentativas.push({
        reference, gateway, metodo: p.metodo, estado_local: p.estado, estado_gateway: null,
        mensagem: p.estado === 'falhado' ? mensagemDe(p.webhook_payload, p.resposta_inicial) : undefined,
      });
      continue;
    }

    let estadoLocal = p.estado as string;
    let estadoGateway: string;
    let mensagem: string | undefined;
    try {
      if (gateway === 'clicpay') {
        const consulta = await consultarPagamentoClicpay(reference);
        const status = consulta.body.status;
        estadoGateway = consulta.ok ? String(status ?? '—') : `erro ${consulta.status}`;
        if (consulta.ok && estadoClicpayPago(status)) {
          // O /status não devolve o montante; o montante foi fixado por nós ao iniciar
          const r = await marcarPagamentoPago(pagSnap, { reference, payload: consulta.body });
          estadoLocal = r.ok ? 'pago' : 'montante_divergente';
        } else if (consulta.ok && estadoClicpayFalhado(status)) {
          await marcarPagamentoFalhado(pagSnap, consulta.body);
          estadoLocal = 'falhado';
          mensagem = mensagemDe(consulta.body);
        }
      } else {
        const consulta = await consultarPagamentoZumbo(reference);
        const zp = (consulta.body.data ?? consulta.body) as Record<string, unknown>;
        estadoGateway = consulta.ok ? String(zp.status ?? '—') : `erro ${consulta.status}`;
        if (consulta.ok && estadoZumboPago(zp.status)) {
          const r = await marcarPagamentoPago(pagSnap, { reference, amount: zp.amount, payload: zp });
          estadoLocal = r.ok ? 'pago' : 'montante_divergente';
        } else if (consulta.ok && estadoZumboFalhado(zp.status)) {
          await marcarPagamentoFalhado(pagSnap, zp);
          estadoLocal = 'falhado';
          mensagem = mensagemDe(zp);
        }
      }
    } catch (err) {
      estadoGateway = `erro: ${err instanceof Error ? err.message : String(err)}`;
    }

    if (estadoLocal === 'pago') pago = true;
    tentativas.push({ reference, gateway, metodo: p.metodo, estado_local: estadoLocal, estado_gateway: estadoGateway, mensagem });
  }

  // Estado da tentativa mais recente, para o cliente saber se continua à espera
  const ultima = tentativas[0];
  const estado = pago ? 'pago'
    : !ultima ? 'sem_tentativas'
    : ultima.estado_local === 'pendente' ? 'pendente'
    : 'falhado';

  return { pago, estado, mensagem: estado === 'falhado' ? ultima?.mensagem : undefined, tentativas };
}
