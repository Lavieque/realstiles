import {
  collection, updateDoc, doc,
  query, where, orderBy, limit, getDocs, getDoc, serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { referenciaEncomenda } from './referencia';
import { apiFetch } from './api-fetch';

export { referenciaEncomenda } from './referencia';

export type EstadoEncomenda = 'pendente' | 'confirmada' | 'enviada' | 'entregue' | 'cancelada';

export type FormaEntrega = 'recolha' | 'terminal' | 'domicilio';

export const FORMAS_ENTREGA: Record<FormaEntrega, string> = {
  recolha: 'Ponto de recolha',
  terminal: 'Levantamento em terminal',
  domicilio: 'Entrega ao domicílio',
};

export interface ItemEncomenda {
  key: string;
  produto_id: string;
  nome: string;
  preco: number;
  imagem: string;
  tamanho: string;
  cor: string;
  quantidade: number;
  url_origem?: string;
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
  // total = subtotal dos artigos + taxa_entrega
  total: number;
  subtotal?: number;
  forma_entrega?: FormaEntrega;
  // Destino usado para calcular a taxa (tarifas por província, modo e zona)
  provincia_entrega?: string;
  zona_entrega?: string;
  peso_kg?: number;
  taxa_entrega?: number;
  // Entrega ao domicílio com preço a combinar (não incluído no total)
  entrega_sob_consulta?: boolean;
  morada_entrega: string;
  cidade_entrega: string;
  telefone_contacto: string;
  notas: string;
  notas_admin: string;
  estado: EstadoEncomenda;
  pagamento_metodo?: 'mpesa' | 'emola' | 'mkesh' | 'cartao' | 'paysuite';
  pagamento_estado?: string;
  pagamento_ref?: string;
  pagamento_gateway?: 'zumbopay' | 'clicpay';
  notif_canal?: 'email' | 'whatsapp';
  historico_estados?: HistoricoEstado[];
  numero_sequencial?: number;
  criado_em?: unknown;
  actualizado_em?: unknown;
}

// Texto do custo de entrega mostrado nas vistas da encomenda
export function textoTaxaEntrega(e: Pick<Encomenda, 'taxa_entrega' | 'entrega_sob_consulta'>): string {
  if (e.entrega_sob_consulta) return 'Sob consulta';
  return e.taxa_entrega ? `${e.taxa_entrega.toFixed(2)} MZN` : 'Grátis';
}

export interface EncomendaCriada {
  id: string;
  numero_sequencial: number;
  subtotal: number;
  taxa_entrega: number;
  total: number;
  entrega_sob_consulta: boolean;
}

// Cria a encomenda através de /api/encomendas. O cliente envia o que escolheu
// (produto, variante, quantidade e dados de entrega) e o servidor recalcula
// preços, taxa de entrega e total — as firestore.rules negam-lhe o `create`
// em `encomendas`, por isso este é o único caminho.
export async function criarEncomendaPendente({
  itens, morada, cidade, telefone, notas = '', pagamento_metodo,
  forma_entrega = 'domicilio', provincia = '', zona = '',
}: {
  itens: ItemEncomenda[];
  morada: string;
  cidade: string;
  telefone: string;
  notas?: string;
  pagamento_metodo: 'mpesa' | 'emola' | 'mkesh' | 'cartao' | 'paysuite';
  forma_entrega?: FormaEntrega;
  provincia?: string;
  zona?: string;
}): Promise<EncomendaCriada> {
  const res = await apiFetch('/api/encomendas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      itens: itens.map(i => ({
        produto_id: i.produto_id,
        quantidade: i.quantidade,
        tamanho: i.tamanho,
        cor: i.cor,
      })),
      morada, cidade, telefone, notas,
      pagamento_metodo,
      forma_entrega,
      provincia,
      zona,
    }),
  });

  const dados = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(dados?.error || 'Não foi possível criar a encomenda.');
  }
  return dados as EncomendaCriada;
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

// max = null carrega todas (usado pela lista do admin, para a pesquisa cobrir tudo)
export async function getTodasEncomendas(estado: EstadoEncomenda | null = null, max: number | null = 500): Promise<Encomenda[]> {
  const filters = [orderBy('criado_em', 'desc')] as Parameters<typeof query>[1][];
  if (max !== null) filters.push(limit(max));
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
