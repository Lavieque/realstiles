import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from './firebase-admin';
import { getConfigSSR } from './config-site-ssr';
import { precoActual } from './promocao';
import type { FormaEntrega, ItemEncomenda } from './encomendas';
import { METODOS } from './pagamentos';

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
async function materializarItens(pedido: ItemPedido[]): Promise<ItemEncomenda[]> {
  const ids = Array.from(new Set(pedido.map(i => i.produto_id)));
  const snaps = await adminDb.getAll(...ids.map(id => adminDb.collection('produtos').doc(id)));
  const produtos = new Map(snaps.filter(s => s.exists).map(s => [s.id, s.data()!]));

  const agora = Date.now();
  return pedido.map((i) => {
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
  const itens = await materializarItens(lerItens(pedido.itens));

  const metodo = texto(pedido.pagamento_metodo, 32);
  if (!METODOS.includes(metodo as never)) {
    throw new ErroEncomenda('Método de pagamento inválido');
  }

  const forma_entrega: FormaEntrega = pedido.forma_entrega === 'domicilio' ? 'domicilio' : 'recolha';

  // Taxa de entrega e regime "sob consulta" vêm da configuração do site, nunca
  // do pedido do cliente
  const cfg = await getConfigSSR();
  const sobConsulta = forma_entrega === 'domicilio' && !!cfg.entrega_domicilio_sob_consulta;
  const taxa_entrega = forma_entrega === 'domicilio' && !sobConsulta
    ? Math.max(0, Number(cfg.entrega_domicilio_taxa) || 0)
    : 0;

  const subtotal = itens.reduce((s, i) => s + i.preco * i.quantidade, 0);
  const total = Math.round((subtotal + taxa_entrega) * 100) / 100;
  if (!(total > 0)) throw new ErroEncomenda('Total da encomenda inválido');

  const morada = texto(pedido.morada, 300);
  const cidade = texto(pedido.cidade, 120);
  if (forma_entrega === 'domicilio' && !morada) {
    throw new ErroEncomenda('Morada obrigatória para entrega ao domicílio');
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
