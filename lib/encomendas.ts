import {
  collection, addDoc, updateDoc, doc,
  query, where, orderBy, getDocs, getDoc, serverTimestamp,
} from 'firebase/firestore';
import { db, auth } from './firebase';

export type EstadoEncomenda = 'pendente' | 'confirmada' | 'enviada' | 'entregue' | 'cancelada';

export interface ItemEncomenda {
  key: string;
  produto_id: string;
  nome: string;
  preco: number;
  imagem: string;
  tamanho: string;
  cor: string;
  quantidade: number;
}

export interface HistoricoEstado {
  estado: EstadoEncomenda;
  data: unknown;
}

export interface Encomenda {
  id: string;
  cliente_id: string;
  cliente_email: string;
  itens: ItemEncomenda[];
  total: number;
  morada_entrega: string;
  cidade_entrega: string;
  telefone_contacto: string;
  notas: string;
  notas_admin: string;
  estado: EstadoEncomenda;
  historico_estados?: HistoricoEstado[];
  criado_em?: unknown;
  actualizado_em?: unknown;
}

export async function criarEncomenda({
  itens, morada, cidade, telefone, notas = '', guestEmail = '',
}: {
  itens: ItemEncomenda[];
  morada: string;
  cidade: string;
  telefone: string;
  notas?: string;
  guestEmail?: string;
}): Promise<string> {
  const user = auth.currentUser;
  const emailFinal = user?.email || guestEmail;
  if (!emailFinal) throw new Error('Email necessário');

  const total = itens.reduce((s, i) => s + i.preco * i.quantidade, 0);

  const ref = await addDoc(collection(db, 'encomendas'), {
    cliente_id: user?.uid || 'guest',
    cliente_email: emailFinal,
    guest: !user,
    itens, total,
    morada_entrega: morada,
    cidade_entrega: cidade,
    telefone_contacto: telefone,
    notas, notas_admin: '',
    estado: 'pendente',
    criado_em: serverTimestamp(),
  });

  try {
    await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tipo: 'confirmacao_encomenda',
        encomenda_id: ref.id,
        cliente_email: emailFinal,
        itens, total, morada,
      }),
    });
  } catch (e) {
    console.warn('Email não enviado:', e);
  }

  return ref.id;
}

export async function getEncomendasCliente(clienteId: string): Promise<Encomenda[]> {
  const q = query(
    collection(db, 'encomendas'),
    where('cliente_id', '==', clienteId),
    orderBy('criado_em', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Encomenda));
}

export async function getTodasEncomendas(estado: EstadoEncomenda | null = null): Promise<Encomenda[]> {
  const filters = [orderBy('criado_em', 'desc')] as Parameters<typeof query>[1][];
  if (estado) filters.unshift(where('estado', '==', estado));
  const snap = await getDocs(query(collection(db, 'encomendas'), ...filters));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Encomenda));
}

export async function getEncomenda(id: string): Promise<Encomenda | null> {
  const snap = await getDoc(doc(db, 'encomendas', id));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Encomenda) : null;
}

export async function actualizarEstado(
  id: string,
  estado: EstadoEncomenda,
  notasAdmin: string | null = null
): Promise<void> {
  const dados: Record<string, unknown> = { estado, actualizado_em: serverTimestamp() };
  if (notasAdmin !== null) dados.notas_admin = notasAdmin;
  await updateDoc(doc(db, 'encomendas', id), dados);
}

export async function cancelarEncomenda(id: string): Promise<void> {
  await updateDoc(doc(db, 'encomendas', id), {
    estado: 'cancelada',
    actualizado_em: serverTimestamp(),
  });
}

export function badgeEstadoClass(estado: EstadoEncomenda): string {
  const map: Record<EstadoEncomenda, string> = {
    pendente: 'badge-pendente',
    confirmada: 'badge-confirmada',
    enviada: 'badge-enviada',
    entregue: 'badge-entregue',
    cancelada: 'badge-cancelada',
  };
  return map[estado] || '';
}

export function badgeEstadoLabel(estado: EstadoEncomenda): string {
  const map: Record<EstadoEncomenda, string> = {
    pendente: '⏳ Pendente',
    confirmada: '✅ Confirmada',
    enviada: '🚚 Enviada',
    entregue: '📦 Entregue',
    cancelada: '❌ Cancelada',
  };
  return map[estado] || estado;
}

export function formatarData(timestamp: unknown): string {
  if (!timestamp) return '—';
  const d = (timestamp as { toDate?: () => Date }).toDate
    ? (timestamp as { toDate: () => Date }).toDate()
    : new Date(timestamp as string);
  return d.toLocaleDateString('pt-MZ', { day: '2-digit', month: 'short', year: 'numeric' });
}
