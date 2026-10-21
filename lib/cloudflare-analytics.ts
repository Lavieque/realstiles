// Leitura do Cloudflare Web Analytics pela API GraphQL, para o painel
// /admin/visitas. Corre só no servidor: o token da API nunca vai para o browser.
//
// O beacon usa o `site_token` (CF_ANALYTICS_TOKEN), mas a API GraphQL filtra
// pelo `site_tag`, que é outro valor. Vem de CF_SITE_TAG; se não estiver
// definida, procura-se na lista de sites da conta o que tem aquele token.

const API = 'https://api.cloudflare.com/client/v4';
const ENDPOINT = `${API}/graphql`;

let siteTagEmCache: { token: string; tag: string } | null = null;

async function resolverSiteTag(apiToken: string, accountId: string, siteToken: string): Promise<string> {
  const definido = process.env.CF_SITE_TAG;
  if (definido) return definido;
  if (siteTagEmCache?.token === siteToken) return siteTagEmCache.tag;

  const res = await fetch(`${API}/accounts/${accountId}/rum/site_info/list?per_page=100`, {
    headers: { Authorization: `Bearer ${apiToken}` },
    cache: 'no-store',
  });
  const corpo = await res.json().catch(() => null);
  const sites: { site_tag?: string; site_token?: string }[] = Array.isArray(corpo?.result) ? corpo.result : [];
  const tag = sites.find(s => s.site_token === siteToken)?.site_tag;
  if (!tag) {
    throw new ErroCloudflare(
      'Não foi possível descobrir o site_tag do Web Analytics. Define CF_SITE_TAG no servidor '
      + '(o valor de siteTag no URL do site em Cloudflare > Web Analytics).',
      503,
    );
  }
  siteTagEmCache = { token: siteToken, tag };
  return tag;
}

export class ErroCloudflare extends Error {
  constructor(message: string, readonly http = 502) {
    super(message);
  }
}

export interface LinhaVisitas {
  chave: string;
  visitas: number;
  paginas: number;
}

export type Periodo = 'hoje' | 7 | 30;

// Moçambique não tem hora de verão: UTC+2 todo o ano
const DESVIO_LOCAL_MS = 2 * 60 * 60 * 1000;

// Início do período. "Hoje" conta desde a meia-noite local, não UTC.
export function inicioDoPeriodo(periodo: Periodo, agora = new Date()): Date {
  if (periodo === 'hoje') {
    const local = agora.getTime() + DESVIO_LOCAL_MS;
    return new Date(local - (local % (24 * 60 * 60 * 1000)) - DESVIO_LOCAL_MS);
  }
  return new Date(agora.getTime() - periodo * 24 * 60 * 60 * 1000);
}

export interface ResumoVisitas {
  // 'hora' no período "hoje" (chave = hora UTC em ISO), 'dia' nos outros
  granularidade: 'hora' | 'dia';
  visitas: number;
  paginas: number;
  porDia: LinhaVisitas[];
  topPaginas: LinhaVisitas[];
  origens: LinhaVisitas[];
  dispositivos: LinhaVisitas[];
  paises: LinhaVisitas[];
}

interface Grupo {
  count: number;
  sum: { visits: number };
  dimensions?: Record<string, string | null>;
}

function config() {
  const apiToken = process.env.CF_API_TOKEN;
  const accountId = process.env.CF_ACCOUNT_ID;
  const siteToken = process.env.CF_ANALYTICS_TOKEN;
  const em_falta = [
    !apiToken && 'CF_API_TOKEN',
    !accountId && 'CF_ACCOUNT_ID',
    !siteToken && 'CF_ANALYTICS_TOKEN',
  ].filter(Boolean);
  if (em_falta.length) {
    throw new ErroCloudflare(`Variáveis em falta no servidor: ${em_falta.join(', ')}`, 503);
  }
  return { apiToken: apiToken!, accountId: accountId!, siteToken: siteToken! };
}

export async function consultarVisitas(periodo: Periodo): Promise<ResumoVisitas> {
  const { apiToken, accountId, siteToken } = config();
  const siteTag = await resolverSiteTag(apiToken, accountId, siteToken);

  const fim = new Date();
  const inicio = inicioDoPeriodo(periodo, fim);
  const porHora = periodo === 'hoje';
  // Valores todos controlados por nós (ISO e variável de ambiente), mas o
  // siteTag passa por JSON.stringify para não partir a query.
  // `bot: 0` e a exclusão do /admin alinham os números com o painel da
  // Cloudflare ("Exclude bots") e com o que interessa: visitas de clientes.
  const filtro = `{ siteTag: ${JSON.stringify(siteTag)}, bot: 0, requestPath_notlike: "/admin%", datetime_geq: "${inicio.toISOString()}", datetime_leq: "${fim.toISOString()}" }`;
  const campos = 'count sum { visits }';
  const grupo = (alias: string, dimensao: string | null, limite: number, ordem: string) =>
    `${alias}: rumPageloadEventsAdaptiveGroups(limit: ${limite}, filter: ${filtro}, orderBy: [${ordem}]) {
      ${campos}${dimensao ? ` dimensions { ${dimensao} }` : ''}
    }`;

  const query = `query ($conta: String!) {
    viewer {
      accounts(filter: { accountTag: $conta }) {
        ${grupo('totais', null, 1, 'count_DESC')}
        ${porHora ? grupo('porDia', 'datetimeHour', 48, 'datetimeHour_ASC') : grupo('porDia', 'date', 100, 'date_ASC')}
        ${grupo('paginas', 'requestPath', 10, 'count_DESC')}
        ${grupo('origens', 'refererHost', 10, 'count_DESC')}
        ${grupo('dispositivos', 'deviceType', 10, 'count_DESC')}
        ${grupo('paises', 'countryName', 20, 'count_DESC')}
      }
    }
  }`;

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: { conta: accountId } }),
    cache: 'no-store',
  });
  const corpo = await res.json().catch(() => null);

  if (!res.ok || corpo?.errors?.length) {
    const msg = corpo?.errors?.[0]?.message || `HTTP ${res.status}`;
    throw new ErroCloudflare(`Cloudflare: ${msg}`);
  }

  const conta = corpo?.data?.viewer?.accounts?.[0];
  if (!conta) throw new ErroCloudflare('Cloudflare: conta não encontrada (confirma CF_ACCOUNT_ID e as permissões do token)');

  const linhas = (grupos: Grupo[] | undefined, dimensao: string): LinhaVisitas[] =>
    (grupos ?? []).map(g => ({
      chave: g.dimensions?.[dimensao] ?? '',
      visitas: g.sum?.visits ?? 0,
      paginas: g.count ?? 0,
    }));

  const total = (conta.totais as Grupo[] | undefined)?.[0];
  return {
    visitas: total?.sum?.visits ?? 0,
    paginas: total?.count ?? 0,
    granularidade: porHora ? 'hora' : 'dia',
    porDia: linhas(conta.porDia, porHora ? 'datetimeHour' : 'date'),
    topPaginas: linhas(conta.paginas, 'requestPath'),
    origens: linhas(conta.origens, 'refererHost'),
    dispositivos: linhas(conta.dispositivos, 'deviceType'),
    paises: linhas(conta.paises, 'countryName'),
  };
}
