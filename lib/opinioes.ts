import { getAdminDb } from '@/lib/firebase-admin';
import { serializar } from '@/lib/serializar';

export interface Opiniao {
  id: string;
  produto_id: string;
  produto_nome: string;
  cliente_nome: string;
  texto: string;
  estrelas: number;
  criado_em: number;
}

// Avaliações aprovadas. Só percorre os produtos que já têm avaliações
// (num_avaliacoes) em vez de depender de uma consulta de grupo de colecções.
export async function getOpinioes(): Promise<Opiniao[]> {
  try {
    const db = getAdminDb();
    if (!db) return [];
    const produtos = await db.collection('produtos').where('activo', '==', true).get();
    const comAvaliacoes = produtos.docs.filter(d => Number(d.data().num_avaliacoes) > 0).slice(0, 60);
    const listas = await Promise.all(comAvaliacoes.map(async p => {
      const snap = await p.ref.collection('comentarios').where('estado', '==', 'aprovado').get();
      return snap.docs.map(c => {
        const d = serializar<Record<string, unknown>>(c.data());
        return {
          id: `${p.id}_${c.id}`,
          produto_id: p.id,
          produto_nome: String(p.data().nome || ''),
          cliente_nome: String(d.cliente_nome || 'Cliente'),
          texto: String(d.texto || ''),
          estrelas: Number(d.estrelas) || 0,
          criado_em: Number(d.criado_em) || 0,
        } as Opiniao;
      });
    }));
    return listas.flat().sort((a, b) => b.criado_em - a.criado_em).slice(0, 48);
  } catch (e) {
    console.error('[opinioes]', e);
    return [];
  }
}

