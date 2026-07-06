import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  getDoc, getDocs, query, where, orderBy, limit,
  serverTimestamp, startAfter,
} from 'firebase/firestore';
import { db } from './firebase';

const COL = 'produtos';

function comTimeout<T>(promise: Promise<T>, ms = 10000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

export interface Produto {
  id: string;
  nome: string;
  descricao?: string;
  preco: number;
  preco_original?: number;
  categoria?: string;
  stock: number;
  imagens: string[];
  tamanhos: string[];
  cores: string[];
  tags: string[];
  destaque: boolean;
  activo: boolean;
  avaliacao?: number;
  num_avaliacoes?: number;
  criado_em?: unknown;
}

export async function getProdutos({
  categoria = null,
  activo = true,
  destaque = null,
  max = 20,
  ultimo = null,
}: {
  categoria?: string | null;
  activo?: boolean | null;
  destaque?: boolean | null;
  max?: number;
  ultimo?: unknown;
} = {}): Promise<Produto[]> {
  const needsClientFilter = categoria || destaque !== null || activo === null;
  const fetchLimit = needsClientFilter ? Math.min(max * 10, 500) : max;

  const filters: unknown[] = [orderBy('criado_em', 'desc'), limit(fetchLimit)];
  if (activo !== null) filters.unshift(where('activo', '==', activo));
  if (ultimo && !needsClientFilter) filters.push(startAfter(ultimo));

  const snap = await comTimeout(getDocs(query(collection(db, COL), ...(filters as Parameters<typeof query>[1][])  )));

  let results: Produto[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as Produto));
  if (activo !== null && needsClientFilter) results = results.filter(p => p.activo === activo);
  if (categoria) results = results.filter(p => p.categoria === categoria);
  if (destaque !== null) results = results.filter(p => p.destaque === destaque);
  return results.slice(0, max);
}

export async function getProduto(id: string): Promise<Produto | null> {
  const snap = await comTimeout(getDoc(doc(db, COL, id)));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Produto) : null;
}

export async function criarProduto(dados: Partial<Produto>): Promise<string> {
  const ref = await addDoc(collection(db, COL), {
    ...dados,
    activo: dados.activo ?? true,
    destaque: dados.destaque ?? false,
    stock: dados.stock ?? 0,
    imagens: dados.imagens ?? [],
    tamanhos: dados.tamanhos ?? [],
    cores: dados.cores ?? [],
    tags: dados.tags ?? [],
    criado_em: serverTimestamp(),
  });
  return ref.id;
}

export async function actualizarProduto(id: string, dados: Partial<Produto>): Promise<void> {
  await updateDoc(doc(db, COL, id), { ...dados, actualizado_em: serverTimestamp() });
}

export async function apagarProduto(id: string): Promise<void> {
  await deleteDoc(doc(db, COL, id));
}

export async function pesquisarProdutos(termo: string, max = 48): Promise<Produto[]> {
  const todos = await getProdutos({ max: 300 });
  const t = termo.toLowerCase();
  return todos
    .filter(p =>
      p.nome?.toLowerCase().includes(t) ||
      p.descricao?.toLowerCase().includes(t) ||
      p.categoria?.toLowerCase().includes(t) ||
      p.tags?.some(tag => tag.toLowerCase().includes(t))
    )
    .slice(0, max);
}

export async function getCategorias(): Promise<string[]> {
  const snap = await getDoc(doc(db, 'config', 'loja'));
  return snap.exists()
    ? (snap.data().categorias || [])
    : ['camisas', 'calças', 'vestidos', 'casacos', 'sapatos', 'acessórios'];
}

export async function decrementarStock(id: string, quantidade = 1): Promise<void> {
  const produto = await getProduto(id);
  if (!produto) return;
  const novoStock = Math.max(0, (produto.stock || 0) - quantidade);
  await actualizarProduto(id, { stock: novoStock });
}
