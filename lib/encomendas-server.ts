import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from './firebase-admin';
import { getConfigSSR } from './config-site-ssr';
import { precoActual } from './promocao';
import type { FormaEntrega, ItemEncomenda } from './encomendas';
import { METODOS } from './pagamentos';
import { PROVINCIAS, entregaDaEncomenda } from './entregas';
import type { Modalidade, TarifaEntrega, Zona } from './entregas';

// Criação de encomendas no servidor. O cliente envia apenas o que não pode
// ser derivado (que produto, que variante, quantidade, dados de entrega); os
// preços, o subtotal, a taxa de entrega e o total são lidos e calculados aqui
// a partir dos documentos em `produtos` e de `config/site`.
//
// As firestore.rules negam `create` em `encomendas` ao cliente, pelo que este
// é o único caminho para criar uma encomenda.

export const MAX_ITENS = 50;
export const MAX_QUANTIDADE = 99;

export class ErroEncomenda extends Error {
  constructor(message: string, readonly http = 400) {
    super(message);
  }
}

export interface ItemPedido {
  produto_id: string;
  quantidade: number;
  tamanho?: string;
  cor?: string;
}

export interface PedidoEncomenda {
  itens: ItemPedido[];
  morada?: string;
  cidade?: string;
  telefone?: string;
  notas?: string;
  pagamento_metodo: string;
  forma_entrega?: FormaEntrega;
  // Destino para a tarifa de entrega (terminal e domicílio)
  provincia?: string;
  zona?: string;
}

const texto = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);

// Normaliza e valida o que veio do cliente, sem tocar em preços
function lerItens(bruto: unknown): ItemPedido[] {
  if (!Array.isArray(bruto) || bruto.length === 0) {
    throw new ErroEncomenda('Carrinho vazio');
  }
  if (bruto.length > MAX_ITENS) {
    throw new ErroEncomenda(`Máximo de ${MAX_ITENS} artigos por encomenda`);
  }

  return bruto.map((i) => {
    const item = (i ?? {}) as Record<string, unknown>;
    const produto_id = texto(item.produto_id, 128);
    const quantidade = Number(item.quantidade);

    if (!produto_id) throw new ErroEncomenda('Artigo sem produto_id');
    if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > MAX_QUANTIDADE) {
      throw new ErroEncomenda(`Quantidade inválida para o produto ${produto_id}`);
    }

    return {
      produto_id,
      quantidade,
      tamanho: texto(item.tamanho, 60),
      cor: texto(item.cor, 60),
    };
  });
}

// Reconstrói cada linha a partir do documento do produto: o preço cobrado é
// sempre o preço actual no servidor, incluindo o estado da promoção.
async function materializarItens(pedido: ItemPedido[]): Promise<{ itens: ItemEncomenda[]; pesoKg: number }> {
  const ids = Array.from(new Set(pedido.map(i => i.produto_id)));
  const snaps = await adminDb.getAll(...ids.map(id => adminDb.collection('produtos').doc(id)));
  const produtos = new Map(snaps.filter(s => s.exists).map(s => [s.id, s.data()!]));

  const agora = Date.now();
  let pesoKg = 0;
  const itens = pedido.map((i) => {
    const p = produtos.get(i.produto_id);
    if (!p) throw new ErroEncomenda(`Produto ${i.produto_id} não encontrado`, 404);
    if (p.activo === false) throw new ErroEncomenda(`O produto "${p.nome}" já não está disponível`, 409);

    const preco = precoActual({
      preco: Number(p.preco),
      preco_original: Number(p.preco_original) || undefined,
      promocao_inicio: p.promocao_inicio,
      promocao_fim: p.promocao_fim,
    }, agora);

    if (!(preco > 0)) throw new ErroEncomenda(`O produto "${p.nome}" não tem preço válido`, 409);

    pesoKg += Math.max(0, Number(p.peso_kg) || 0) * i.quantidade;

    const imagens = Array.isArray(p.imagens) ? p.imagens : [];
    return {
      key: `${i.produto_id}_${i.tamanho ?? ''}_${i.cor ?? ''}`,
      produto_id: i.produto_id,
      nome: String(p.nome ?? ''),
      preco,
      imagem: typeof imagens[0] === 'string' ? imagens[0] : '',
      tamanho: i.tamanho ?? '',
      cor: i.cor ?? '',
      quantidade: i.quantidade,
      ...(p.url_origem ? { url_origem: String(p.url_origem) } : {}),
    };
  });
  return { itens, pesoKg: Math.round(pesoKg * 1000) / 1000 };
}

export interface DestinoEntrega {
  forma_entrega: FormaEntrega;
  provincia: string;
  zona: Zona;
}

// Normaliza o destino pedido pelo cliente: só valores conhecidos passam
export function lerDestino(bruto: { forma_entrega?: unknown; provincia?: unknown; zona?: unknown }): DestinoEntrega {
  const f = bruto.forma_entrega;
  const forma_entrega: FormaEntrega = f === 'domicilio' || f === 'terminal' ? f : 'recolha';
  const provincia = texto(bruto.provincia, 40);
  if (forma_entrega !== 'recolha' && !(PROVINCIAS as readonly string[]).includes(provincia)) {
    throw new ErroEncomenda('Escolhe a província de entrega');
  }
  const zona: Zona = forma_entrega !== 'domicilio' ? '' : bruto.zona === 'periferia' ? 'periferia' : 'urbana';
  return { forma_entrega, provincia, zona };
}

// Taxa de entrega a partir das tarifas de config/entregas, do destino e do
// peso dos artigos. Mesma função para a estimativa do checkout e para a
// encomenda, para o valor mostrado ser o valor cobrado.
export async function taxaDeEntrega(destino: DestinoEntrega, pesoKg: number) {
  const [tarifasSnap, cfg] = await Promise.all([
    adminDb.collection('config').doc('entregas').get(),
    getConfigSSR(),
  ]);
  const tarifas = (tarifasSnap.data()?.itens || []) as TarifaEntrega[];
  return entregaDaEncomenda(
    tarifas,
    { provincia: destino.provincia, modalidade: destino.forma_entrega as Modalidade, zona: destino.zona, pesoKg },
    { taxa: Number(cfg.entrega_domicilio_taxa) || 0, sobConsulta: !!cfg.entrega_domicilio_sob_consulta },
  );
}

// Estimativa para o checkout: não cria nada
export async function estimarEntrega(itensBrutos: unknown, destinoBruto: Parameters<typeof lerDestino>[0]) {
  const { itens, pesoKg } = await materializarItens(lerItens(itensBrutos));
  const destino = lerDestino(destinoBruto);
  const entrega = await taxaDeEntrega(destino, pesoKg);
  const subtotal = itens.reduce((s, i) => s + i.preco * i.quantidade, 0);
  return { subtotal, pesoKg, ...entrega, total: Math.round((subtotal + entrega.taxa) * 100) / 100 };
}

// Número sequencial atribuído atomicamente (contador em
// config/contador_encomendas, agora escrito só pelo Admin SDK) — junto com o
// id do documento forma a referência ENC de lib/referencia.ts.
async function criarComNumeroSequencial(dados: Record<string, unknown>) {
  const novoRef = adminDb.collection('encomendas').doc();
  const contadorRef = adminDb.collection('config').doc('contador_encomendas');

  const numero_sequencial = await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(contadorRef);
    const atual = snap.exists ? Number(snap.data()?.atual) || 0 : 0;
    const proximo = atual + 1;
    tx.set(contadorRef, { atual: proximo }, { merge: true });
    tx.set(novoRef, { ...dados, numero_sequencial: proximo });
    return proximo;
  });

  return { id: novoRef.id, numero_sequencial };
}

export interface EncomendaCriada {
  id: string;
  numero_sequencial: number;
  subtotal: number;
  taxa_entrega: number;
  total: number;
  entrega_sob_consulta: boolean;
}

export async function criarEncomendaServidor(
  caller: { uid: string; email: string | null },
  pedido: PedidoEncomenda,
): Promise<EncomendaCriada> {
  const { itens, pesoKg } = await materializarItens(lerItens(pedido.itens));

  const metodo = texto(pedido.pagamento_metodo, 32);
  if (!METODOS.includes(metodo as never)) {
    throw new ErroEncomenda('Método de pagamento inválido');
  }

  // Taxa de entrega e regime "sob consulta" vêm das tarifas configuradas,
  // nunca do pedido do cliente
  const destino = lerDestino(pedido);
  const { forma_entrega, provincia, zona } = destino;
  const { taxa: taxa_entrega, sobConsulta } = await taxaDeEntrega(destino, pesoKg);

  const subtotal = itens.reduce((s, i) => s + i.preco * i.quantidade, 0);
  const total = Math.round((subtotal + taxa_entrega) * 100) / 100;
  if (!(total > 0)) throw new ErroEncomenda('Total da encomenda inválido');

  const morada = texto(pedido.morada, 300);
  const cidade = texto(pedido.cidade, 120);
  if (forma_entrega === 'domicilio' && !morada) {
    throw new ErroEncomenda('Morada obrigatória para entrega ao domicílio');
  }
  if (forma_entrega !== 'recolha' && !cidade) {
    throw new ErroEncomenda('Indica a cidade ou o distrito');
  }

  const perfil = (await adminDb.collection('clientes').doc(caller.uid).get()).data();
  const canal = perfil?.notif_canal;
  // Só o email do token conta. O campo `email` do perfil é escrito pelo
  // próprio cliente, e serviria para dirigir a confirmação de encomenda a um
  // endereço qualquer, saída pelo domínio da loja.
  const cliente_email = caller.email || '';
  const notif_canal: 'email' | 'whatsapp' =
    canal === 'whatsapp' || canal === 'email' ? canal : (cliente_email ? 'email' : 'whatsapp');

  const criada = await criarComNumeroSequencial({
    cliente_id: caller.uid,
    ...(perfil?.nome ? { cliente_nome: String(perfil.nome) } : {}),
    cliente_email,
    guest: false,
    itens,
    subtotal,
    total,
    forma_entrega,
    taxa_entrega,
    ...(forma_entrega !== 'recolha' ? { provincia_entrega: provincia, peso_kg: pesoKg } : {}),
    ...(forma_entrega === 'domicilio' ? { zona_entrega: zona } : {}),
    ...(sobConsulta ? { entrega_sob_consulta: true } : {}),
    morada_entrega: morada,
    cidade_entrega: cidade,
    telefone_contacto: texto(pedido.telefone, 40),
    notas: texto(pedido.notas, 1000),
    notas_admin: '',
    estado: 'pendente',
    pagamento_metodo: metodo,
    pagamento_estado: 'pendente',
    notif_canal,
    criado_em: FieldValue.serverTimestamp(),
  });

  return {
    ...criada,
    subtotal,
    taxa_entrega,
    total,
    entrega_sob_consulta: sobConsulta,
  };
}
