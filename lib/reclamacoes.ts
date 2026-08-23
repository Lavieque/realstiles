import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from './firebase';

export interface Reclamacao {
  id: string;
  nome: string;
  email: string;
  telefone?: string;
  assunto: string;
  descricao: string;
  notif_canal?: 'email' | 'whatsapp';
  criado_em?: unknown;
  respondida?: boolean;
  estado?: string;
  cliente_id?: string | null;
}

export interface MensagemReclamacao {
  id: string;
  autor: 'cliente' | 'admin';
  autor_nome: string;
  texto: string;
  criado_em?: unknown;
}

const LEGADO: Record<string, string> = {
  nova: 'Nova',
  em_andamento: 'Em andamento',
  resolvida: 'Resolvida',
};

// Estados antigos foram gravados como slugs (nova/em_andamento/resolvida) antes de o admin
// poder editar a lista livremente; converte-os para o rótulo equivalente para exibição.
export function normalizarEstado(estado?: string): string {
  if (!estado) return 'Nova';
  return LEGADO[estado] ?? estado;
}

const PALETA = [
  { cor: '#c0392b', fundo: '#fdecea' },
  { cor: '#b8860b', fundo: '#fff8e1' },
  { cor: '#1a8c5a', fundo: '#e6f9f0' },
  { cor: '#2c5aa0', fundo: '#eaf1fb' },
  { cor: '#6c3fa0', fundo: '#f3ecfa' },
];

export function estadoCor(estado: string, lista: string[]): { cor: string; fundo: string } {
  const i = lista.findIndex(l => l.toLowerCase() === estado.toLowerCase());
  return PALETA[i >= 0 ? i % PALETA.length : 0];
}

export function parseEstadosConfig(texto: string): string[] {
  return texto.split(',').map(s => s.trim()).filter(Boolean);
}

// Detecta estados de encerramento (Resolvida, Finalizada, Fechada, ...) por nome,
// já que a lista de estados é livremente editável pelo admin e não tem uma chave fixa.
export function estadoEncerrado(estado?: string): boolean {
  const l = normalizarEstado(estado).toLowerCase();
  return /resolv|final|fech/.test(l);
}

export async function getReclamacoesCliente(uid: string): Promise<Reclamacao[]> {
  const q = query(
    collection(db, 'reclamacoes'),
    where('cliente_id', '==', uid),
    orderBy('criado_em', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Reclamacao));
}
