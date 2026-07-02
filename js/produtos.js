// ── PRODUTOS.JS ──
import { db } from './firebase.js';
import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  getDoc, getDocs, query, where, orderBy, limit,
  serverTimestamp, startAfter
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const COL = 'produtos';

// ── LISTAR PRODUTOS ──
export async function getProdutos({ categoria = null, activo = true, destaque = null, max = 20, ultimo = null } = {}) {
  const needsClientFilter = categoria || destaque !== null || activo === null;
  const fetchLimit = needsClientFilter ? Math.min(max * 10, 500) : max;

  const filters = [orderBy('criado_em', 'desc'), limit(fetchLimit)];
  if (activo !== null) filters.unshift(where('activo', '==', activo));
  if (ultimo && !needsClientFilter) filters.push(startAfter(ultimo));
  const snap = await getDocs(query(collection(db, COL), ...filters));

  let results = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  if (activo !== null && needsClientFilter) results = results.filter(p => p.activo === activo);
  if (categoria) results = results.filter(p => p.categoria === categoria);
  if (destaque !== null) results = results.filter(p => p.destaque === destaque);
  return results.slice(0, max);
}

// ── OBTER PRODUTO ──
export async function getProduto(id) {
  const snap = await getDoc(doc(db, COL, id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// ── CRIAR PRODUTO ──
export async function criarProduto(dados) {
  const ref = await addDoc(collection(db, COL), {
    ...dados,
    activo: dados.activo ?? true,
    destaque: dados.destaque ?? false,
    stock: dados.stock ?? 0,
    imagens: dados.imagens ?? [],
    tamanhos: dados.tamanhos ?? [],
    cores: dados.cores ?? [],
    tags: dados.tags ?? [],
    criado_em: serverTimestamp()
  });
  return ref.id;
}

// ── ACTUALIZAR PRODUTO ──
export async function actualizarProduto(id, dados) {
  await updateDoc(doc(db, COL, id), {
    ...dados,
    actualizado_em: serverTimestamp()
  });
}

// ── APAGAR PRODUTO ──
export async function apagarProduto(id) {
  await deleteDoc(doc(db, COL, id));
}

// ── PESQUISAR (client-side simples) ──
export async function pesquisarProdutos(termo) {
  const todos = await getProdutos({ max: 200 });
  const t = termo.toLowerCase();
  return todos.filter(p =>
    p.nome?.toLowerCase().includes(t) ||
    p.descricao?.toLowerCase().includes(t) ||
    p.categoria?.toLowerCase().includes(t) ||
    p.tags?.some(tag => tag.toLowerCase().includes(t))
  );
}

// ── CATEGORIAS ──
export async function getCategorias() {
  const snap = await getDoc(doc(db, 'config', 'loja'));
  return snap.exists() ? (snap.data().categorias || []) : ['camisas', 'calças', 'vestidos', 'casacos', 'sapatos', 'acessórios'];
}

// ── DECREMENTAR STOCK ──
export async function decrementarStock(id, quantidade = 1) {
  const produto = await getProduto(id);
  if (!produto) return;
  const novoStock = Math.max(0, (produto.stock || 0) - quantidade);
  await actualizarProduto(id, { stock: novoStock });
}

// ── RENDER CARD ──
export function renderCard(produto, opts = {}) {
  const { showActions = true } = opts;
  const preco = Number(produto.preco || 0).toFixed(2);
  const precoOrig = produto.preco_original ? `<span class="preco-original">${Number(produto.preco_original).toFixed(2)} MZN</span>` : '';
  const badge = produto.destaque ? '<span class="produto-card-badge">Destaque</span>' : '';
  const saleBadge = produto.preco_original && produto.preco_original > produto.preco
    ? '<span class="produto-card-badge sale">Sale</span>' : '';
  const img = produto.imagens?.[0] || 'https://via.placeholder.com/300x400?text=Sem+Imagem';

  return `
    <div class="produto-card" onclick="window.location.href='produto.html?id=${produto.id}'">
      <div class="produto-card-img">
        <img src="${img}" alt="${produto.nome}" loading="lazy"/>
        ${badge}${saleBadge}
      </div>
      <div class="produto-card-body">
        <p class="produto-card-nome">${produto.nome}</p>
        <div class="produto-card-preco">
          <span class="preco-atual">${preco} MZN</span>
          ${precoOrig}
        </div>
        ${showActions ? `
        <div class="produto-card-actions">
          <button class="btn btn-primary btn-sm" style="flex:1;"
            ${produto.stock === 0 ? 'disabled style="flex:1;opacity:0.4;cursor:not-allowed;"' : ''}
            onclick="event.stopPropagation(); adicionarAoCarrinho('${produto.id}')">
            ${produto.stock === 0 ? 'Sem stock' : '+ Carrinho'}
          </button>
        </div>` : ''}
      </div>
    </div>
  `;
}
