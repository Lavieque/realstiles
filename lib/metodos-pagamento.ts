// Métodos de pagamento online, partilhados entre o checkout, a página da
// encomenda e o admin (sem dependências de servidor).

export type MetodoPagamento = 'mpesa' | 'emola' | 'mkesh' | 'cartao';

export const METODOS_PAGAMENTO: MetodoPagamento[] = ['mpesa', 'emola', 'mkesh', 'cartao'];

export interface InfoMetodo {
  nome: string;
  // Texto curto no mosaico de escolha (prefixos de rede ou bandeiras)
  sub: string;
  // Cor da marca, usada no destaque do mosaico e no popup de espera
  cor: string;
  fundo: string;
  // Pagamento por telemóvel (pedido de PIN) ou checkout de cartão
  movel: boolean;
}

export const INFO_METODO: Record<MetodoPagamento, InfoMetodo> = {
  mpesa:  { nome: 'M-Pesa', sub: '84 / 85', cor: '#e30613', fundo: '#fff4f4', movel: true },
  emola:  { nome: 'e-Mola', sub: '86 / 87', cor: '#f47920', fundo: '#fff7f0', movel: true },
  mkesh:  { nome: 'mKesh',  sub: '82 / 83', cor: '#00866b', fundo: '#fffbe0', movel: true },
  cartao: { nome: 'Cartão', sub: 'Visa / Mastercard', cor: '#1a1f71', fundo: '#f4f5ff', movel: false },
};

export function nomeMetodo(metodo?: string | null): string {
  if (!metodo) return '—';
  if (metodo === 'paysuite') return 'PaySuite';
  return INFO_METODO[metodo as MetodoPagamento]?.nome ?? metodo;
}
