import { adminDb } from './firebase-admin';
import { gatewayDoPagamento, referenciaDoPagamento, marcarPagamentoPago, marcarPagamentoFalhado } from './pagamentos';
import { consultarPagamentoZumbo, estadoZumboPago, estadoZumboFalhado } from './zumbopay';
import { consultarPagamentoClicpay, estadoClicpayPago, estadoClicpayFalhado } from './clicpay';

export interface TentativaVerificada {
  reference: string;
  gateway: string;
  metodo?: string;
  estado_local: string;
  estado_gateway: string | null;
}

// Consulta no gateway cada tentativa de pagamento da encomenda e confirma-a
// se alguma estiver paga. `apenasPendentes` limita às 3 tentativas mais
// recentes e só consulta as pendentes (consulta automática enquanto o
// cliente espera);
// sem ele re-consulta tudo o que não está pago (verificação manual no admin).
export async function verificarPagamentosEncomenda(
  encomendaId: string,
  { apenasPendentes = false }: { apenasPendentes?: boolean } = {},
): Promise<{ pago: boolean; estado: 'pago' | 'pendente' | 'falhado' | 'sem_tentativas'; tentativas: TentativaVerificada[] }> {
  const snap = await adminDb.collection('pagamentos').where('encomenda_id', '==', encomendaId).get();
  let docs = snap.docs
    .filter(d => gatewayDoPagamento(d.data()) !== 'paysuite' && referenciaDoPagamento(d.data()))
    .sort((a, b) => (b.data().criado_em?.toMillis?.() ?? 0) - (a.data().criado_em?.toMillis?.() ?? 0));
  if (apenasPendentes) docs = docs.slice(0, 3);

  const tentativas: TentativaVerificada[] = [];
  let pago = false;

  for (const pagSnap of docs) {
    const p = pagSnap.data();
    const gateway = gatewayDoPagamento(p) as 'zumbopay' | 'clicpay';
    const reference = referenciaDoPagamento(p)!;

    if (p.estado === 'pago') {
      pago = true;
      tentativas.push({ reference, gateway, metodo: p.metodo, estado_local: 'pago', estado_gateway: null });
      continue;
    }
    if (apenasPendentes && p.estado !== 'pendente') {
      tentativas.push({ reference, gateway, metodo: p.metodo, estado_local: p.estado, estado_gateway: null });
      continue;
    }

    let estadoLocal = p.estado as string;
    let estadoGateway: string;
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
        }
      }
    } catch (err) {
      estadoGateway = `erro: ${err instanceof Error ? err.message : String(err)}`;
    }

    if (estadoLocal === 'pago') pago = true;
    tentativas.push({ reference, gateway, metodo: p.metodo, estado_local: estadoLocal, estado_gateway: estadoGateway });
  }

  // Estado da tentativa mais recente, para o cliente saber se continua à espera
  const ultima = tentativas[0];
  const estado = pago ? 'pago'
    : !ultima ? 'sem_tentativas'
    : ultima.estado_local === 'pendente' ? 'pendente'
    : 'falhado';

  return { pago, estado, tentativas };
}
