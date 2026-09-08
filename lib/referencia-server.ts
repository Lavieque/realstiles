import { adminDb } from './firebase-admin';
import { referenciaEncomenda } from './referencia';

// Versão para rotas API (Admin SDK) — só recebem o id da encomenda no
// pedido, por isso é preciso ler o número sequencial do documento antes de
// conseguir montar a referência completa.
export async function referenciaEncomendaServer(encomendaId: string): Promise<string> {
  const snap = await adminDb.collection('encomendas').doc(encomendaId).get();
  const numero_sequencial = snap.exists ? (snap.data()?.numero_sequencial as number | undefined) : undefined;
  return referenciaEncomenda({ id: encomendaId, numero_sequencial });
}
