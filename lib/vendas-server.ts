import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from './firebase-admin';

// Estados em que a venda conta para o contador `vendidos` dos produtos.
const ESTADOS_VENDA = new Set(['confirmada', 'enviada', 'entregue']);

// Alinha o contador `vendidos` dos produtos com o estado da encomenda.
// Idempotente: a flag `vendas_contadas` na encomenda garante que cada
// encomenda soma uma só vez (webhook, polling e admin podem chamar em
// paralelo) e que uma encomenda cancelada depois de contada é revertida.
export async function sincronizarVendas(encomendaId: string): Promise<'contada' | 'revertida' | 'sem_alteracao'> {
  const encRef = adminDb.collection('encomendas').doc(encomendaId);

  return adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(encRef);
    if (!snap.exists) return 'sem_alteracao';

    const enc = snap.data()!;
    const deveContar = ESTADOS_VENDA.has(enc.estado);
    const jaContada = enc.vendas_contadas === true;
    if (deveContar === jaContada) return 'sem_alteracao';

    const sinal = deveContar ? 1 : -1;
    // Soma as quantidades por produto (o mesmo produto pode ter várias variantes)
    const porProduto = new Map<string, number>();
    for (const item of (enc.itens || []) as { produto_id?: string; quantidade?: number }[]) {
      const qtd = Number(item.quantidade);
      if (!item.produto_id || !Number.isInteger(qtd) || qtd < 1) continue;
      porProduto.set(item.produto_id, (porProduto.get(item.produto_id) || 0) + qtd);
    }

    // Leituras antes de escritas (regra das transacções do Firestore)
    const refs = [...porProduto.keys()].map(id => adminDb.collection('produtos').doc(id));
    const produtos = await Promise.all(refs.map(r => tx.get(r)));

    produtos.forEach((p, i) => {
      if (!p.exists) return;
      const atual = Number(p.data()?.vendidos) || 0;
      const delta = sinal * porProduto.get(refs[i].id)!;
      // Nunca deixa o contador negativo
      tx.update(refs[i], { vendidos: FieldValue.increment(Math.max(delta, -atual)) });
    });
    tx.update(encRef, { vendas_contadas: deveContar });

    return deveContar ? 'contada' : 'revertida';
  });
}
