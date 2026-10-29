export const PROVINCIAS = [
  'Manica', 'Sofala', 'Tete', 'Zambézia', 'Maputo Cidade', 'Maputo Província',
  'Gaza', 'Inhambane', 'Nampula', 'Niassa', 'Cabo Delgado',
] as const;

export type Modalidade = 'recolha' | 'terminal' | 'domicilio';
export type Zona = 'urbana' | 'periferia' | '';

export const MODALIDADES: Record<Modalidade, string> = {
  recolha: 'Recolha na loja',
  terminal: 'Levantamento em terminal',
  domicilio: 'Entrega na morada',
};

export const ZONAS: Record<Exclude<Zona, ''>, string> = {
  urbana: 'Área urbana da cidade',
  periferia: 'Periferia, distrito ou zona rural',
};

export interface TarifaEntrega {
  id: string;
  provincia: string;
  modalidade: Modalidade;
  zona: Zona;
  preco_base: number;
  preco_kg: number;
}

export interface PedidoEntrega {
  provincia: string;
  modalidade: Modalidade;
  zona?: Zona;
  pesoKg?: number;
}

// Procura a tarifa que corresponde ao destino. Domicílio exige zona;
// recolha e terminal ignoram-na. Sem tarifa configurada devolve null
// (o cliente deve pedir orçamento).
export function encontrarTarifa(tarifas: TarifaEntrega[], p: PedidoEntrega): TarifaEntrega | null {
  return tarifas.find(t =>
    t.provincia === p.provincia &&
    t.modalidade === p.modalidade &&
    (p.modalidade !== 'domicilio' || t.zona === (p.zona || 'urbana'))
  ) || null;
}

export function calcularEntrega(tarifas: TarifaEntrega[], p: PedidoEntrega): number | null {
  const t = encontrarTarifa(tarifas, p);
  if (!t) return null;
  const kg = Math.max(0, p.pesoKg || 0);
  return Math.round((t.preco_base + t.preco_kg * kg) * 100) / 100;
}

export function descricaoTarifa(t: TarifaEntrega): string {
  const zona = t.zona ? ` · ${ZONAS[t.zona]}` : '';
  return `${t.provincia} · ${MODALIDADES[t.modalidade]}${zona}`;
}

export interface EntregaCalculada {
  taxa: number;
  // Sem tarifa fixa para o destino: não entra no total, combina-se com o cliente
  sobConsulta: boolean;
}

// Taxa de entrega de uma encomenda. É a única fonte do valor cobrado: corre no
// servidor tanto ao criar a encomenda como na estimativa do checkout.
//
// - recolha: tarifa da província se existir, senão grátis
// - terminal e domicílio: tarifa da província (+ zona no domicílio); sem
//   tarifa fica sob consulta
// - sem nenhuma tarifa configurada em config/entregas, vale o regime antigo
//   (taxa única de domicílio de config/site)
export function entregaDaEncomenda(
  tarifas: TarifaEntrega[],
  p: PedidoEntrega,
  legado: { taxa: number; sobConsulta: boolean },
): EntregaCalculada {
  if (tarifas.length === 0) {
    if (p.modalidade === 'recolha') return { taxa: 0, sobConsulta: false };
    if (p.modalidade === 'terminal') return { taxa: 0, sobConsulta: true };
    return legado.sobConsulta ? { taxa: 0, sobConsulta: true } : { taxa: Math.max(0, legado.taxa), sobConsulta: false };
  }
  const valor = calcularEntrega(tarifas, p);
  if (valor === null) {
    return p.modalidade === 'recolha' ? { taxa: 0, sobConsulta: false } : { taxa: 0, sobConsulta: true };
  }
  return { taxa: valor, sobConsulta: false };
}
