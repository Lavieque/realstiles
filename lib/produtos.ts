import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  getDoc, getDocs, query, where, orderBy, limit, arrayUnion, arrayRemove,
  serverTimestamp, startAfter, QueryDocumentSnapshot, DocumentData,
} from 'firebase/firestore';
import { db } from './firebase';

const COL = 'produtos';
const CONFIG_DOC = doc(db, 'config', 'loja');

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
  em_promocao?: boolean;
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
  emPromocao = null,
  max = 20,
  ultimoDoc = null,
}: {
  categoria?: string | null;
  categorias?: string[] | null;
  activo?: boolean | null;
  destaque?: boolean | null;
  emPromocao?: boolean | null;
  max?: number;
  ultimoDoc?: QueryDocumentSnapshot<DocumentData> | null;
} = {}): Promise<ProdutosResult> {
  const slugs = categorias ?? (categoria ? [categoria] : null);
  const needsClientFilter = !!(slugs) || destaque !== null || activo === null;
  const fetchLimit = needsClientFilter ? Math.min(max * 10, 500) : max;

  const filters: unknown[] = [orderBy('criado_em', 'desc'), limit(fetchLimit)];
  if (activo !== null) filters.unshift(where('activo', '==', activo));
  if (emPromocao !== null) filters.unshift(where('em_promocao', '==', emPromocao));
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

function calcEmPromocao(dados: Partial<Produto>): boolean {
  const p = Number(dados.preco ?? 0);
  const po = Number(dados.preco_original ?? 0);
  return po > 0 && po > p;
}

export async function criarProduto(dados: Partial<Produto>): Promise<string> {
  const em_promocao = calcEmPromocao(dados);
  const categoria = dados.categoria || null;
  const ref = await addDoc(collection(db, COL), {
    ...dados,
    em_promocao,
    activo: dados.activo ?? true,
    destaque: dados.destaque ?? false,
    stock: dados.stock ?? 0,
    imagens: dados.imagens ?? [],
    tamanhos: dados.tamanhos ?? [],
    cores: dados.cores ?? [],
    tags: dados.tags ?? [],
    criado_em: serverTimestamp(),
  });
  if (categoria && (dados.activo ?? true)) {
    await updateDoc(CONFIG_DOC, { categorias_ativas: arrayUnion(categoria) }).catch(() => {});
  }
  return ref.id;
}

export async function actualizarProduto(id: string, dados: Partial<Produto>): Promise<void> {
  const em_promocao = calcEmPromocao(dados);
  await updateDoc(doc(db, COL, id), { ...dados, em_promocao, actualizado_em: serverTimestamp() });
  if (dados.categoria !== undefined || dados.activo !== undefined) {
    await sincronizarCategoriasAtivas();
  }
}

export async function apagarProduto(id: string): Promise<void> {
  const snap = await getDoc(doc(db, COL, id));
  const categoria = snap.exists() ? snap.data().categoria : null;
  await deleteDoc(doc(db, COL, id));
  if (categoria) {
    // Verificar se ainda há outros produtos nessa categoria antes de remover
    const outros = await getDocs(query(
      collection(db, COL),
      where('activo', '==', true),
      where('categoria', '==', categoria),
      limit(1),
    ));
    if (outros.empty) {
      await updateDoc(CONFIG_DOC, { categorias_ativas: arrayRemove(categoria) }).catch(() => {});
    }
  }
}

// Reconstrói a lista de categorias com artigos activos no doc de config
export async function sincronizarCategoriasAtivas(): Promise<void> {
  const snap = await getDocs(query(collection(db, COL), where('activo', '==', true)));
  const cats = new Set<string>();
  snap.docs.forEach(d => { const c = d.data().categoria; if (c) cats.add(c); });
  await updateDoc(CONFIG_DOC, { categorias_ativas: Array.from(cats).sort() }).catch(() => {});
}

// Cache em memória para pesquisa (5 min)
let searchCache: { produtos: Produto[]; ts: number } | null = null;

export async function pesquisarProdutos(termo: string, max = 48): Promise<Produto[]> {
  if (!searchCache || Date.now() - searchCache.ts > 5 * 60 * 1000) {
    const { produtos } = await getProdutos({ max: 300 });
    searchCache = { produtos, ts: Date.now() };
  }
  const t = termo.toLowerCase();
  return searchCache.produtos
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

let lojaConfigCache: { data: (string | CategoriaConfig)[]; categoriasAtivas: string[]; ts: number } | null = null;

async function getLojaConfig() {
  if (lojaConfigCache && Date.now() - lojaConfigCache.ts < 5 * 60 * 1000) return lojaConfigCache;
  const snap = await getDoc(CONFIG_DOC);
  const data: (string | CategoriaConfig)[] = snap.exists() ? snap.data().categorias || [] : [];
  const categoriasAtivas: string[] = snap.exists() ? snap.data().categorias_ativas || [] : [];
  lojaConfigCache = { data, categoriasAtivas, ts: Date.now() };
  return lojaConfigCache;
}

export async function getCategorias(): Promise<string[]> {
  const { data } = await getLojaConfig();
  if (!data.length) return ['camisas', 'calças', 'vestidos', 'casacos', 'sapatos', 'acessórios'];
  const all = data.flatMap(c => {
    if (typeof c === 'string') return [c];
    return [c.slug, ...c.subcategorias.flatMap(s => [s.slug, ...(s.subcategorias || []).map(ss => ss.slug)])];
  });
  return Array.from(new Set(all));
}

// Categorias que têm pelo menos um produto activo (leitura do campo do config doc)
export async function getCategoriasAtivas(): Promise<string[]> {
  const { categoriasAtivas } = await getLojaConfig();
  return categoriasAtivas;
}

export async function getCategoriasConfig(): Promise<CategoriaConfig[]> {
  const { data } = await getLojaConfig();
  return data.filter((c): c is CategoriaConfig => typeof c === 'object');
}

export async function decrementarStock(id: string, quantidade = 1): Promise<void> {
  const produto = await getProduto(id);
  if (!produto) return;
  const novoStock = Math.max(0, (produto.stock || 0) - quantidade);
  await actualizarProduto(id, { stock: novoStock });
}
