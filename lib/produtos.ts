import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  getDoc, getDocs, query, where, orderBy, limit,
  serverTimestamp, startAfter, QueryDocumentSnapshot, DocumentData,
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

export interface ProdutosResult {
  produtos: Produto[];
  ultimoDoc: QueryDocumentSnapshot<DocumentData> | null;
}

export async function getProdutos({
  categoria = null,
  categorias = null,
  activo = true,
  destaque = null,
  max = 20,
  ultimoDoc = null,
}: {
  categoria?: string | null;
  categorias?: string[] | null;
  activo?: boolean | null;
  destaque?: boolean | null;
  max?: number;
  ultimoDoc?: QueryDocumentSnapshot<DocumentData> | null;
} = {}): Promise<ProdutosResult> {
  const slugs = categorias ?? (categoria ? [categoria] : null);
  const needsClientFilter = slugs || destaque !== null || activo === null;
  const fetchLimit = needsClientFilter ? Math.min(max * 10, 500) : max;

  const filters: unknown[] = [orderBy('criado_em', 'desc'), limit(fetchLimit)];
  if (activo !== null) filters.unshift(where('activo', '==', activo));
  if (ultimoDoc && !needsClientFilter) filters.push(startAfter(ultimoDoc));

  const snap = await comTimeout(getDocs(query(collection(db, COL), ...(filters as Parameters<typeof query>[1][]))));

  let docs = snap.docs;
  if (activo !== null && needsClientFilter) docs = docs.filter(d => d.data().activo === activo);
  if (slugs) docs = docs.filter(d => d.data().categoria && slugs.includes(d.data().categoria));
  if (destaque !== null) docs = docs.filter(d => d.data().destaque === destaque);
  docs = docs.slice(0, max);

  return {
    produtos: docs.map(d => ({ id: d.id, ...d.data() } as Produto)),
    ultimoDoc: docs.length > 0 ? docs[docs.length - 1] : null,
  };
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
  const { produtos: todos } = await getProdutos({ max: 300 });
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

export interface CategoriaConfig {
  nome: string;
  slug: string;
  subcategorias: { nome: string; slug: string; subcategorias?: { nome: string; slug: string }[] }[];
}

let lojaConfigCache: { data: (string | CategoriaConfig)[]; ts: number } | null = null;

async function getLojaConfig(): Promise<(string | CategoriaConfig)[]> {
  if (lojaConfigCache && Date.now() - lojaConfigCache.ts < 5 * 60 * 1000) return lojaConfigCache.data;
  const snap = await getDoc(doc(db, 'config', 'loja'));
  const data: (string | CategoriaConfig)[] = snap.exists() ? snap.data().categorias || [] : [];
  lojaConfigCache = { data, ts: Date.now() };
  return data;
}

export async function getCategorias(): Promise<string[]> {
  const raw = await getLojaConfig();
  if (!raw.length) return ['camisas', 'calças', 'vestidos', 'casacos', 'sapatos', 'acessórios'];
  const all = raw.flatMap(c => {
    if (typeof c === 'string') return [c];
    return [c.slug, ...c.subcategorias.flatMap(s => [s.slug, ...(s.subcategorias || []).map(ss => ss.slug)])];
  });
  return Array.from(new Set(all));
}

export async function getCategoriasConfig(): Promise<CategoriaConfig[]> {
  const raw = await getLojaConfig();
  return raw.filter((c): c is CategoriaConfig => typeof c === 'object');
}

export async function decrementarStock(id: string, quantidade = 1): Promise<void> {
  const produto = await getProduto(id);
  if (!produto) return;
  const novoStock = Math.max(0, (produto.stock || 0) - quantidade);
  await actualizarProduto(id, { stock: novoStock });
}
