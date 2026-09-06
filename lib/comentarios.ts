import {
  collection, collectionGroup, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc,
  query, where, orderBy, serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { getEncomendasCliente } from './encomendas';

export type EstadoComentario = 'pendente' | 'aprovado';

export interface ComentarioProduto {
  id: string;
  produto_id: string;
  cliente_id: string;
  cliente_nome: string;
  texto: string;
  estrelas: number;
  estado: EstadoComentario;
  criado_em?: unknown;
}

function colComentarios(produtoId: string) {
  return collection(db, 'produtos', produtoId, 'comentarios');
}

// Lista pública — só comentários já aprovados pelo admin
export async function getComentariosProduto(produtoId: string): Promise<ComentarioProduto[]> {
  const snap = await getDocs(query(
    colComentarios(produtoId),
    where('estado', '==', 'aprovado'),
    orderBy('criado_em', 'desc'),
  ));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as ComentarioProduto));
}

// Um cliente só pode avaliar um produto que lhe conste numa encomenda já entregue
export async function podeAvaliar(clienteId: string, produtoId: string): Promise<boolean> {
  const encomendas = await getEncomendasCliente(clienteId);
  return encomendas.some(e => e.estado === 'entregue' && e.itens.some(i => i.produto_id === produtoId));
}

// Uma avaliação por cliente por produto — usa o uid como id do documento (upsert).
// Fica sempre pendente de aprovação do admin, mesmo ao editar uma já aprovada.
export async function criarComentario(
  produtoId: string,
  clienteId: string,
  clienteNome: string,
  texto: string,
  estrelas: number,
): Promise<void> {
  await setDoc(doc(colComentarios(produtoId), clienteId), {
    produto_id: produtoId,
    cliente_id: clienteId,
    cliente_nome: clienteNome,
    texto: texto.trim(),
    estrelas,
    estado: 'pendente',
    criado_em: serverTimestamp(),
  });
}

export async function getComentarioCliente(produtoId: string, clienteId: string): Promise<ComentarioProduto | null> {
  const snap = await getDoc(doc(colComentarios(produtoId), clienteId));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as ComentarioProduto) : null;
}

// --- Moderação (admin) ---

export async function getComentariosPendentes(): Promise<ComentarioProduto[]> {
  const snap = await getDocs(query(
    collectionGroup(db, 'comentarios'),
    where('estado', '==', 'pendente'),
    orderBy('criado_em', 'desc'),
  ));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as ComentarioProduto));
}

export async function aprovarComentario(produtoId: string, clienteId: string): Promise<void> {
  await updateDoc(doc(colComentarios(produtoId), clienteId), { estado: 'aprovado' });
  await recalcularAvaliacao(produtoId);
}

export async function rejeitarComentario(produtoId: string, clienteId: string): Promise<void> {
  await deleteDoc(doc(colComentarios(produtoId), clienteId));
}

async function recalcularAvaliacao(produtoId: string): Promise<void> {
  const snap = await getDocs(query(colComentarios(produtoId), where('estado', '==', 'aprovado')));
  const estrelas = snap.docs.map(d => Number(d.data().estrelas) || 0);
  const num_avaliacoes = estrelas.length;
  const avaliacao = num_avaliacoes > 0 ? estrelas.reduce((s, e) => s + e, 0) / num_avaliacoes : 0;
  await updateDoc(doc(db, 'produtos', produtoId), { avaliacao, num_avaliacoes });
}
