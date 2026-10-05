// Catálogo de funcionalidades do painel admin que podem ser atribuídas a uma
// role. Partilhado entre cliente e servidor (sem dependências do Firebase).
// As chaves são gravadas em roles/{id}.permissoes e verificadas também nas
// firestore.rules — se mudares uma chave, actualiza as regras.

export const PERMISSOES = [
  { chave: 'dashboard',    label: 'Dashboard',            descricao: 'Ver o resumo de vendas e estatísticas' },
  { chave: 'encomendas',   label: 'Encomendas',           descricao: 'Ver e gerir encomendas, confirmar pagamentos' },
  { chave: 'produtos',     label: 'Produtos',             descricao: 'Adicionar, editar e apagar artigos, importar via link e gerir categorias' },
  { chave: 'taxas',        label: 'Taxas de importação',  descricao: 'Configurar as taxas aplicadas aos artigos importados' },
  { chave: 'avaliacoes',   label: 'Avaliações',           descricao: 'Aprovar e rejeitar avaliações de clientes' },
  { chave: 'clientes',     label: 'Clientes',             descricao: 'Ver a lista de clientes registados' },
  { chave: 'conteudo',     label: 'Conteúdo do site',     descricao: 'Editar textos do site e a barra de anúncios' },
  { chave: 'reclamacoes',  label: 'Reclamações',          descricao: 'Ver e responder a reclamações' },
  { chave: 'integracoes',  label: 'Integrações',          descricao: 'Gerir TradeFlow e WhatsApp Notify' },
  { chave: 'pagamentos',   label: 'Pagamentos',           descricao: 'Ver a conta ZumboPay' },
  { chave: 'utilizadores', label: 'Roles e utilizadores', descricao: 'Criar roles e atribuí-las a utilizadores (dá controlo sobre os acessos)' },
] as const;

export type Permissao = typeof PERMISSOES[number]['chave'];

export const CHAVES_PERMISSAO: Permissao[] = PERMISSOES.map(p => p.chave);

// Permissão exigida por cada página do admin. A rota mais específica ganha.
const ROTAS: Record<string, Permissao> = {
  '/admin': 'dashboard',
  '/admin/encomendas': 'encomendas',
  '/admin/produtos': 'produtos',
  '/admin/importar': 'produtos',
  '/admin/categorias': 'produtos',
  '/admin/taxas': 'taxas',
  '/admin/comentarios': 'avaliacoes',
  '/admin/clientes': 'clientes',
  '/admin/conteudo': 'conteudo',
  '/admin/banner': 'conteudo',
  '/admin/reclamacoes': 'reclamacoes',
  '/admin/tradeflow': 'integracoes',
  '/admin/whatsapp': 'integracoes',
  '/admin/zumbopay': 'pagamentos',
  '/admin/roles': 'utilizadores',
};

export function permissaoDaRota(path: string): Permissao | null {
  const rota = Object.keys(ROTAS)
    .filter(r => path === r || path.startsWith(r + '/'))
    .sort((a, b) => b.length - a.length)[0];
  return rota ? ROTAS[rota] : null;
}

export function rotasPermitidas(permissoes: ReadonlySet<Permissao>): string[] {
  return Object.entries(ROTAS).filter(([, p]) => permissoes.has(p)).map(([r]) => r);
}

export function filtrarPermissoes(lista: unknown): Permissao[] {
  if (!Array.isArray(lista)) return [];
  return lista.filter((p): p is Permissao => CHAVES_PERMISSAO.includes(p as Permissao));
}
