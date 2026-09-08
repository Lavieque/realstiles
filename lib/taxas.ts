export interface Taxa {
  id: string;
  nome: string;
  tipo: 'percentagem' | 'fixo';
  valor: number;
}

// Soma todas as taxas ao preço base — percentagens incidem sobre o preço
// original (não compostas entre si), valores fixos somam-se directamente.
export function aplicarTaxas(precoBase: number, taxas: Taxa[]): number {
  const total = taxas.reduce((soma, t) => {
    if (t.tipo === 'percentagem') return soma + precoBase * (t.valor / 100);
    return soma + t.valor;
  }, precoBase);
  return Math.round(total * 100) / 100;
}

export interface TaxaAplicada {
  nome: string;
  descricao: string;
  valorAplicado: number;
}

// Detalhe de quanto cada taxa individual acrescentou ao preço base
export function detalharTaxas(precoBase: number, taxas: Taxa[]): TaxaAplicada[] {
  return taxas.map(t => ({
    nome: t.nome,
    descricao: t.tipo === 'percentagem' ? `${t.valor}%` : `${t.valor.toFixed(2)} MZN`,
    valorAplicado: t.tipo === 'percentagem' ? precoBase * (t.valor / 100) : t.valor,
  }));
}
