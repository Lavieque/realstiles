import {
  collection, addDoc, updateDoc, doc,
  query, where, orderBy, limit, getDocs, getDoc, serverTimestamp,
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
  cliente_nome?: string;
  cliente_email: string;
  itens: ItemEncomenda[];
  total: number;
  morada_entrega: string;
  cidade_entrega: string;
  telefone_contacto: string;
  notas: string;
  notas_admin: string;
  estado: EstadoEncomenda;
  pagamento_metodo?: 'mpesa' | 'emola' | 'cartao';
  pagamento_estado?: string;
  notif_canal?: 'email' | 'whatsapp';
  historico_estados?: HistoricoEstado[];
  criado_em?: unknown;
  actualizado_em?: unknown;
}

export async function criarEncomendaPendente({
  itens, morada, cidade, telefone, notas = '', guestEmail = '', pagamento_metodo,
}: {
  itens: ItemEncomenda[];
  morada: string;
  cidade: string;
  telefone: string;
  notas?: string;
  guestEmail?: string;
  pagamento_metodo: 'mpesa' | 'emola' | 'cartao';
}): Promise<string> {
  const user = auth.currentUser;
  const emailFinal = user?.email || guestEmail || '';
  if (!user && !emailFinal) throw new Error('Email necessário');

  const total = itens.reduce((s, i) => s + i.preco * i.quantidade, 0);

  let clienteNome = user?.displayName || '';
  let notifCanal: 'email' | 'whatsapp' = emailFinal ? 'email' : 'whatsapp';
  if (user) {
    try {
      const perfilSnap = await getDoc(doc(db, 'clientes', user.uid));
      const perfil = perfilSnap.data();
      const canal = perfil?.notif_canal;
      if (canal === 'whatsapp' || canal === 'email') notifCanal = canal;
      clienteNome = perfil?.nome || user.displayName || '';
    } catch { /* mantém default */ }
  }

  const ref = await addDoc(collection(db, 'encomendas'), {
    cliente_id: user?.uid || 'guest',
    cliente_nome: clienteNome || undefined,
    cliente_email: emailFinal,
    guest: !user,
    itens, total,
    morada_entrega: morada,
    cidade_entrega: cidade,
    telefone_contacto: telefone,
    notas, notas_admin: '',
    estado: 'pendente',
    pagamento_metodo,
    pagamento_estado: 'pendente',
    notif_canal: notifCanal,
    criado_em: serverTimestamp(),
  });

  return ref.id;
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
  const emailFinal = user?.email || guestEmail || '';
  // Guests sem email não podem encomendar; utilizadores autenticados (incluindo WhatsApp) podem
  if (!user && !emailFinal) throw new Error('Email necessário');

  const total = itens.reduce((s, i) => s + i.preco * i.quantidade, 0);

  // Determina canal de notificação e telefone do perfil do utilizador
  let notifCanal: 'email' | 'whatsapp' = emailFinal ? 'email' : 'whatsapp';
  let telefoneNotif = telefone;
  let clienteNome = user?.displayName || '';
  if (user) {
    try {
      const perfilSnap = await getDoc(doc(db, 'clientes', user.uid));
      const perfil = perfilSnap.data();
      const canal = perfil?.notif_canal;
      if (canal === 'whatsapp' || canal === 'email') notifCanal = canal;
      if (notifCanal === 'whatsapp' && user.uid.startsWith('wa_')) {
        telefoneNotif = user.uid.replace('wa_', '');
      } else if (perfil?.telefone) {
        telefoneNotif = perfil.telefone;
      }
      clienteNome = perfil?.nome || user.displayName || '';
    } catch { /* mantém o default */ }
  }

  const ref = await addDoc(collection(db, 'encomendas'), {
    cliente_id: user?.uid || 'guest',
    cliente_nome: clienteNome || undefined,
    cliente_email: emailFinal,
    guest: !user,
    itens, total,
    morada_entrega: morada,
    cidade_entrega: cidade,
    telefone_contacto: telefone,
    notas, notas_admin: '',
    estado: 'pendente',
    notif_canal: notifCanal,
    criado_em: serverTimestamp(),
  });

  // Notificação ao cliente pelo canal registado
  if (notifCanal === 'whatsapp') {
    try {
      const telLimpo = telefoneNotif.replace(/\D/g, '');
      if (telLimpo) {
        const ref8 = ref.id.substring(0, 8).toUpperCase();
        const mensagem = `✅ *Encomenda #${ref8} recebida!*\n\nTotal: *${total.toFixed(2)} MZN*\nEntrega: ${morada}\n\nAcompanha o estado em realstiles.co.mz/encomendas`;
        await fetch('/api/notify/messages/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ telefone: telLimpo, mensagem }),
        });
      }
    } catch (e) { console.warn('WhatsApp não enviado:', e); }
  } else if (emailFinal) {
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
    } catch (e) { console.warn('Email não enviado:', e); }
  }

  // Admin recebe sempre email, independentemente do canal do cliente
  if (notifCanal === 'whatsapp') {
    try {
      await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'confirmacao_encomenda',
          encomenda_id: ref.id,
          cliente_email: '',
          itens, total, morada,
        }),
      });
    } catch (e) { console.warn('Email admin não enviado:', e); }
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

export async function getTodasEncomendas(estado: EstadoEncomenda | null = null, max = 500): Promise<Encomenda[]> {
  const filters = [orderBy('criado_em', 'desc'), limit(max)] as Parameters<typeof query>[1][];
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
    pendente: 'Pendente',
    confirmada: 'Confirmada',
    enviada: 'Enviada',
    entregue: 'Entregue',
    cancelada: 'Cancelada',
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
