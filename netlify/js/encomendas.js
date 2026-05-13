// ── ENCOMENDAS.JS ──
import { db, auth } from './firebase.js';
import {
  collection, addDoc, updateDoc, doc,
  query, where, orderBy, getDocs, getDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { limparCarrinho } from './carrinho.js';

// ── CRIAR ENCOMENDA ──
export async function criarEncomenda({ itens, morada, cidade, telefone, notas = '' }) {
  const user = auth.currentUser;
  if (!user) throw new Error('Não autenticado');

  const total = itens.reduce((s, i) => s + (i.preco * i.quantidade), 0);

  const ref = await addDoc(collection(db, 'encomendas'), {
    cliente_id: user.uid,
    cliente_email: user.email,
    itens,
    total,
    morada_entrega: morada,
    cidade_entrega: cidade,
    telefone_contacto: telefone,
    notas,
    notas_admin: '',
    estado: 'pendente',
    criado_em: serverTimestamp()
  });

  // Notificar via Netlify Function (não bloqueia se falhar)
  try {
    await fetch('/.netlify/functions/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tipo: 'confirmacao_encomenda',
        encomenda_id: ref.id,
        cliente_email: user.email,
        itens, total, morada
      })
    });
  } catch (e) { console.warn('Email não enviado:', e); }

  limparCarrinho();
  return ref.id;
}

// ── ENCOMENDAS DO CLIENTE ──
export async function getEncomendasCliente(clienteId) {
  const q = query(
    collection(db, 'encomendas'),
    where('cliente_id', '==', clienteId),
    orderBy('criado_em', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ── TODAS AS ENCOMENDAS (admin) ──
export async function getTodasEncomendas(estado = null) {
  let filters = [orderBy('criado_em', 'desc')];
  if (estado) filters.unshift(where('estado', '==', estado));
  const q = query(collection(db, 'encomendas'), ...filters);
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ── OBTER ENCOMENDA ──
export async function getEncomenda(id) {
  const snap = await getDoc(doc(db, 'encomendas', id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// ── ACTUALIZAR ESTADO ──
export async function actualizarEstado(id, estado, notasAdmin = null) {
  const dados = { estado, actualizado_em: serverTimestamp() };
  if (notasAdmin !== null) dados.notas_admin = notasAdmin;
  await updateDoc(doc(db, 'encomendas', id), dados);
}

// ── BADGE ESTADO HTML ──
export function badgeEstado(estado) {
  const map = {
    pendente: 'badge-pendente',
    confirmada: 'badge-confirmada',
    enviada: 'badge-enviada',
    entregue: 'badge-entregue',
    cancelada: 'badge-cancelada'
  };
  const label = {
    pendente: '⏳ Pendente',
    confirmada: '✅ Confirmada',
    enviada: '🚚 Enviada',
    entregue: '📦 Entregue',
    cancelada: '❌ Cancelada'
  };
  return `<span class="badge-estado ${map[estado] || ''}">${label[estado] || estado}</span>`;
}

// ── FORMATAR DATA ──
export function formatarData(timestamp) {
  if (!timestamp) return '—';
  const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return d.toLocaleDateString('pt-MZ', { day: '2-digit', month: 'short', year: 'numeric' });
}
