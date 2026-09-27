// Estado de promoção de um produto, tendo em conta o período opcional
// (promocao_inicio / promocao_fim). Sem dependências do Firebase — usado no
// servidor, no cliente e no carrinho.

// A contagem decrescente só aparece no site quando falta menos que isto
export const LIMITE_CONTAGEM_MS = 48 * 60 * 60 * 1000;

export interface DadosPromocao {
  preco: number;
  preco_original?: number;
  promocao_inicio?: unknown;
  promocao_fim?: unknown;
}

// Aceita ms, Timestamp do Firestore ou string de data
export function paraMs(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') {
    const t = new Date(v).getTime();
    return Number.isNaN(t) ? null : t;
  }
  const ts = v as { toMillis?: () => number; seconds?: number; _seconds?: number };
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  const s = ts.seconds ?? ts._seconds;
  return typeof s === 'number' ? s * 1000 : null;
}

// Conversão para <input type="datetime-local"> (hora local, sem fuso: 'YYYY-MM-DDTHH:mm')
export function msParaInput(v: unknown): string {
  const ms = paraMs(v);
  if (ms === null) return '';
  const d = new Date(ms - new Date(ms).getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
}

export function inputParaMs(v: string): number | null {
  if (!v) return null;
  const ms = new Date(v).getTime();
  return Number.isNaN(ms) ? null : ms;
}

export interface EstadoPromocao {
  activa: boolean;
  // Preço a cobrar agora (fora do período volta ao preço original)
  preco: number;
  precoOriginal: number | null;
  desconto: number;
  inicio: number | null;
  fim: number | null;
  agendada: boolean;
  terminada: boolean;
}

export function estadoPromocao(p: DadosPromocao, agora = Date.now()): EstadoPromocao {
  const preco = Number(p.preco) || 0;
  const original = Number(p.preco_original) || 0;
  const temDesconto = original > 0 && preco > 0 && original > preco;
  const inicio = paraMs(p.promocao_inicio);
  const fim = paraMs(p.promocao_fim);
  const agendada = temDesconto && inicio !== null && agora < inicio;
  const terminada = temDesconto && fim !== null && agora >= fim;
  const activa = temDesconto && !agendada && !terminada;
  return {
    activa,
    preco: temDesconto && !activa ? original : preco,
    precoOriginal: activa ? original : null,
    desconto: activa ? Math.round((1 - preco / original) * 100) : 0,
    inicio,
    fim,
    agendada,
    terminada,
  };
}

export function precoActual(p: DadosPromocao, agora = Date.now()): number {
  return estadoPromocao(p, agora).preco;
}

// "47h 12m", "3h 05m", "12m 30s"
export function formatarTempoRestante(ms: number, comSegundos = false): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (comSegundos) return `${pad(h)}:${pad(m)}:${pad(s)}`;
  if (h > 0) return `${h}h ${pad(m)}m`;
  return `${m}m ${pad(s)}s`;
}
