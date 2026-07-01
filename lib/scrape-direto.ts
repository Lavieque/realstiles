const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const HEADERS_BROWSER: HeadersInit = {
  'User-Agent': UA,
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'pt-PT,pt;q=0.9,en;q=0.8',
};

export interface Variante {
  tamanho?: string;
  cor?: string;
  stock: number;
}

export interface ResultadoScrape {
  nome: string;
  descricao?: string;
  preco: number;
  preco_original?: number;
  moeda: string;
  imagens: string[];
  variantes: Variante[];
  tamanhos: string[];
  cores: string[];
  tags: string[];
  categoria?: string;
}

export function detectarFonte(url: string): string {
  try {
    const h = new URL(url).hostname.replace(/^www\./, '');
    if (h.includes('shein.')) return 'shein';
    if (h.includes('temu.com')) return 'temu';
    if (h.includes('zara.com')) return 'zara';
    if (h.includes('hm.com')) return 'hm';
    if (h.includes('zalando.')) return 'zalando';
    if (h.includes('amazon.')) return 'amazon';
    if (h.includes('aliexpress.com')) return 'aliexpress';
    if (h.includes('shopee.')) return 'shopee';
    if (h.includes('pullandbear.com')) return 'pullandbear';
    if (h.includes('bershka.com')) return 'bershka';
    if (h.includes('aboutyou.com')) return 'aboutyou';
  } catch { /* URL inválido */ }
  return 'outro';
}

export async function scrapeDireto(url: string): Promise<ResultadoScrape> {
  const fonte = detectarFonte(url);
  if (fonte === 'zara') return scrapeZara(url);
  if (fonte === 'shein') return scrapeShein(url);
  if (fonte === 'temu') return scrapeTemu(url);
  return scrapeGenerico(url);
}

// ── ZARA ──────────────────────────────────────────────────────────────────────

async function scrapeZara(url: string): Promise<ResultadoScrape> {
  const urlObj = new URL(url);
  let productId = urlObj.searchParams.get('v1');
  if (!productId) {
    const m = urlObj.pathname.match(/-p(\d+)\.html/i);
    if (m) productId = m[1];
  }

  if (productId) {
    const localeMatch = urlObj.pathname.match(/^\/([a-z]{2}\/[a-z]{2})\//);
    const locale = localeMatch ? localeMatch[1] : 'pt/pt';
    try {
      const res = await fetch(`https://www.zara.com/${locale}/product/${productId}/detail.json`, {
        headers: { ...HEADERS_BROWSER, Accept: 'application/json' },
        signal: AbortSignal.timeout(12_000),
      });
      if (res.ok) {
        const data = await res.json();
        const p = data?.product;
        if (p?.name) {
          const cores = (p.detail?.colors ?? []).map((c: any) => c.name).filter(Boolean);
          const tamanhos = (p.detail?.colors?.[0]?.sizes ?? []).map((s: any) => s.name).filter(Boolean);
          const imagens: string[] = [];
          for (const color of p.detail?.colors ?? []) {
            for (const img of color.xmedia ?? []) {
              if (img.path) imagens.push(`https://static.zara.net/photos/${img.path}/w/750/${img.name}.jpg?ts=${img.timestamp}`);
              if (imagens.length >= 6) break;
            }
            if (imagens.length >= 6) break;
          }
          return resultado(
            p.name,
            p.description,
            p.price ? p.price / 100 : 0,
            p.oldPrice ? p.oldPrice / 100 : undefined,
            imagens, tamanhos, cores,
            p.keyWords ?? [],
          );
        }
      }
    } catch { /* fallback abaixo */ }
  }

  return scrapeGenerico(url);
}

// ── SHEIN ─────────────────────────────────────────────────────────────────────

async function scrapeShein(url: string): Promise<ResultadoScrape> {
  const goodsIdMatch = url.match(/-p-(\d+)(?:-[^.]+)?\.html/);
  const goodsId = goodsIdMatch?.[1];
  const localeMatch = url.match(/https?:\/\/([a-z]{2})\.shein\./);
  const locale = localeMatch?.[1] ?? 'pt';
  const baseUrl = `https://${locale}.shein.com`;

  let nome = '', descricao = '', preco = 0, precoOriginal: number | undefined;
  let imagens: string[] = [], tamanhos: string[] = [], cores: string[] = [], tags: string[] = [];

  if (goodsId) {
    try {
      const apiHeaders: HeadersInit = {
        ...HEADERS_BROWSER,
        Accept: 'application/json, text/plain, */*',
        Referer: url,
        'X-Requested-With': 'XMLHttpRequest',
        'sec-ch-ua': '"Chromium";v="120", "Google Chrome";v="120"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
      };

      const [descRes, attrRes] = await Promise.allSettled([
        fetch(`${baseUrl}/api/productInfo/v3/description?goods_id=${goodsId}&cat_id=0&goods_sn=&goods_color_id=0&mall_code=1&main_sale_attr_id=0&_ver=1.2.0&_lang=${locale}`, { headers: apiHeaders, signal: AbortSignal.timeout(12_000) }),
        fetch(`${baseUrl}/api/productInfo/v3/saleProp?goods_id=${goodsId}&cat_id=0&goods_sn=&goods_color_id=0&mall_code=1&_ver=1.2.0&_lang=${locale}`, { headers: apiHeaders, signal: AbortSignal.timeout(8_000) }),
      ]);

      if (descRes.status === 'fulfilled' && descRes.value.ok) {
        const data = await descRes.value.json();
        const info = data?.info ?? data?.data?.info ?? data?.data;
        if (info?.goods_name) {
          nome = info.goods_name;
          descricao = info.goods_desc ?? '';
          preco = parsePreco(info.salePrice?.amount ?? info.retailPrice?.amount) ?? 0;
          const orig = parsePreco(info.retailPrice?.amount);
          if (orig && orig > preco) precoOriginal = orig;

          imagens = (info.goods_imgs ?? info.images ?? []).map((i: any) => {
            const src = typeof i === 'string' ? i : (i.origin_image ?? i.medium_image ?? i.thumbnail ?? '');
            return src.startsWith('//') ? 'https:' + src : src;
          }).filter(Boolean).slice(0, 8);

          tamanhos = (info.attrSizeList ?? info.sizeAttrList ?? [])
            .map((s: any) => s.attr_value_name ?? s.attr_value ?? s.name ?? '')
            .filter(Boolean);

          cores = (info.colorList ?? info.color_list ?? [])
            .map((c: any) => c.color_name ?? c.goods_color_name ?? '')
            .filter(Boolean);

          tags = (info.productTagInfoList ?? info.tag_list ?? [])
            .map((t: any) => t.tagName ?? t.tag_name ?? '')
            .filter(Boolean);
        }
      }

      if (attrRes.status === 'fulfilled' && attrRes.value.ok) {
        const attrData = await attrRes.value.json();
        const attrs = attrData?.info ?? attrData?.data ?? {};
        if (!tamanhos.length) {
          tamanhos = (attrs.saleAttr ?? attrs.attrSizeList ?? [])
            .flatMap((a: any) => a.attr_value_list ?? [a])
            .map((v: any) => v.attr_value_name ?? v.name ?? '')
            .filter(Boolean);
        }
        if (!cores.length) {
          cores = (attrs.colorList ?? [])
            .map((c: any) => c.color_name ?? c.goods_color_name ?? '')
            .filter(Boolean);
        }
      }
    } catch { /* fallback HTML */ }
  }

  // HTML para imagens e dados em falta
  try {
    const html = await fetchHtml(url);
    const meta = extrairMetaTags(html);

    if (!nome) nome = limparNome(meta.title, 'shein');
    if (!descricao) descricao = meta.description;
    if (!imagens.length) imagens = extrairImagensSheinHtml(html);
    if (!imagens.length && meta.image) imagens = [meta.image];
    if (!tamanhos.length) tamanhos = extrairTamanhosSheinHtml(html);
    if (!cores.length) cores = extrairCoresSheinHtml(html);

    if (!preco) {
      for (const pattern of [
        /window\.gbSsrData\s*=\s*(\{.+?\});?\s*(?:window|<\/script>)/s,
        /window\.SaPageInfo\s*=\s*(\{.+?\});?\s*(?:window|<\/script>)/s,
        /window\.__INITIAL_STATE__\s*=\s*(\{.+?\});?\s*(?:window|<\/script>)/s,
      ]) {
        const m = html.match(pattern);
        if (!m) continue;
        try {
          const ssrInfo = encontrarSheinProduto(JSON.parse(m[1]));
          if (ssrInfo) {
            preco = parsePreco(ssrInfo.salePrice?.amount ?? ssrInfo.retailPrice?.amount) ?? 0;
            if (!tamanhos.length)
              tamanhos = (ssrInfo.attrSizeList ?? ssrInfo.sizeList ?? []).map((s: any) => s.attr_value_name ?? s.name ?? '').filter(Boolean);
            if (!cores.length)
              cores = (ssrInfo.colorList ?? ssrInfo.color_list ?? []).map((c: any) => c.color_name ?? '').filter(Boolean);
            if (!imagens.length) {
              imagens = (ssrInfo.goods_imgs ?? ssrInfo.images ?? []).map((i: any) => {
                const s = typeof i === 'string' ? i : (i.origin_image ?? i.medium_image ?? '');
                return s.startsWith('//') ? 'https:' + s : s;
              }).filter(Boolean).slice(0, 8);
            }
            break;
          }
        } catch { /* continua */ }
      }
    }
    if (!preco) preco = extrairPrecoHtml(html);
  } catch { /* continua sem HTML */ }

  return resultado(nome, descricao, preco, precoOriginal, imagens, tamanhos, cores, tags);
}

// ── TEMU ──────────────────────────────────────────────────────────────────────

async function scrapeTemu(url: string): Promise<ResultadoScrape> {
  const urlObj = new URL(url);
  const goodsId = urlObj.searchParams.get('goods_id')
    ?? url.match(/goods[_-]id[=/](\d+)/i)?.[1]
    ?? url.match(/-(\d{12,})/)?.[1];

  if (goodsId) {
    try {
      const res = await fetch(
        `https://www.temu.com/api/poppy/v1/goods/detail?goods_id=${goodsId}&refer_page_name=goods&refer_page_id=10032`,
        {
          headers: { ...HEADERS_BROWSER, Accept: 'application/json, */*', Referer: 'https://www.temu.com/' },
          signal: AbortSignal.timeout(12_000),
        },
      );
      if (res.ok) {
        const data = await res.json();
        const p = data?.result?.goods_detail ?? data?.result?.product ?? data?.result;
        if (p?.goods_name) {
          const imagens = (p.goods_gallery_videos ?? p.goods_imgs ?? p.images ?? [])
            .filter((i: any) => !i.type || i.type !== 'video')
            .map((i: any) => typeof i === 'string' ? i : (i.goods_image_url ?? i.url ?? ''))
            .filter(Boolean).slice(0, 6);

          const tamanhos = (p.sku_list ?? [])
            .flatMap((s: any) => s.specs ?? [])
            .filter((s: any) => /^(XS|S|M|L|XL|XXL|XXXL|\d{2,3}(cm)?)$/i.test(s.spec_name ?? ''))
            .map((s: any) => s.spec_name)
            .filter((v: string, i: number, a: string[]) => a.indexOf(v) === i);

          const precoRaw = p.price_info?.sale_price ?? p.sale_price ?? p.price;
          const precoOrigRaw = p.price_info?.original_price ?? p.original_price;

          return resultado(
            p.goods_name,
            p.goods_desc ?? '',
            parseTemuPreco(precoRaw),
            parseTemuPreco(precoOrigRaw) || undefined,
            imagens, tamanhos, [],
            (p.label_list ?? []).map((l: any) => l.label_name ?? '').filter(Boolean),
          );
        }
      }
    } catch { /* fallback HTML */ }
  }

  try {
    const html = await fetchHtml(url);
    const meta = extrairMetaTags(html);
    const nextData = extrairNextData(html);
    let preco = 0, precoOriginal: number | undefined;
    let imagens: string[] = [], tamanhos: string[] = [], cores: string[] = [], tags: string[] = [];

    if (nextData) {
      const p = encontrarProdutoTemu(nextData);
      if (p) {
        preco = parseTemuPreco(p.price_info?.sale_price ?? p.sale_price ?? p.price);
        precoOriginal = parseTemuPreco(p.price_info?.original_price ?? p.original_price) || undefined;
        imagens = (p.goods_imgs ?? p.images ?? []).map((i: any) => typeof i === 'string' ? i : (i.url ?? '')).filter(Boolean).slice(0, 6);
        tamanhos = (p.sku_list ?? []).map((s: any) => s.size ?? s.name ?? '').filter((s: string) => /^(XS|S|M|L|XL|XXL|\d{2,3})$/i.test(s)).filter((v: string, i: number, a: string[]) => a.indexOf(v) === i);
        cores = (p.color_list ?? []).map((c: any) => c.color_name ?? '').filter(Boolean);
        tags = (p.label_list ?? []).map((t: any) => t.label_name ?? '').filter(Boolean);
      }
    }

    if (!imagens.length && meta.image) imagens = [meta.image];
    if (!preco) preco = extrairPrecoHtml(html);

    return resultado(limparNome(meta.title, 'temu'), meta.description, preco, precoOriginal, imagens, tamanhos, cores, tags);
  } catch {
    return resultado('', '', 0, undefined, [], [], [], []);
  }
}

// ── GENÉRICO (JSON-LD + meta tags) ────────────────────────────────────────────

async function scrapeGenerico(url: string): Promise<ResultadoScrape> {
  const html = await fetchHtml(url);
  const meta = extrairMetaTags(html);
  const jsonLd = extrairJsonLd(html);

  let nome = meta.title, descricao = meta.description, preco = 0, precoOriginal: number | undefined;
  let imagens = meta.image ? [meta.image] : [], tamanhos: string[] = [], cores: string[] = [], tags: string[] = [];

  if (jsonLd) {
    nome = jsonLd.name ?? nome;
    descricao = jsonLd.description ?? descricao;
    preco = parsePreco(jsonLd.offers?.price ?? jsonLd.offers?.[0]?.price) ?? extrairPrecoHtml(html);
    const orig = parsePreco(jsonLd.offers?.highPrice ?? jsonLd.offers?.[0]?.highPrice);
    if (orig && orig > preco) precoOriginal = orig;
    const imgs = extrairImagensJsonLd(jsonLd);
    if (imgs.length) imagens = imgs;
    if (Array.isArray(jsonLd.color)) cores = jsonLd.color;
    else if (typeof jsonLd.color === 'string') cores = [jsonLd.color];
    if (Array.isArray(jsonLd.size)) tamanhos = jsonLd.size;
    else if (typeof jsonLd.size === 'string') tamanhos = [jsonLd.size];
    tags = (jsonLd.keywords ?? '').toString().split(',').map((t: string) => t.trim()).filter(Boolean);
  } else {
    preco = extrairPrecoHtml(html);
  }

  const fonte = detectarFonte(url);
  return resultado(limparNome(nome, fonte), descricao, preco, precoOriginal, imagens, tamanhos, cores, tags);
}

// ── UTILITÁRIOS ───────────────────────────────────────────────────────────────

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, { headers: HEADERS_BROWSER, redirect: 'follow', signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

function extrairMetaTags(html: string): { title: string; description: string; image: string } {
  const get = (property: string) => {
    for (const pattern of [
      new RegExp(`<meta[^>]*property=["']og:${property}["'][^>]*content=["']([^"']+)["']`, 'i'),
      new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:${property}["']`, 'i'),
      new RegExp(`<meta[^>]*name=["']${property}["'][^>]*content=["']([^"']+)["']`, 'i'),
    ]) {
      const m = html.match(pattern);
      if (m) return decodeEntities(m[1]);
    }
    return '';
  };
  let title = get('title');
  if (!title) { const m = html.match(/<title[^>]*>([^<]+)<\/title>/i); if (m) title = decodeEntities(m[1]); }
  return { title: title.substring(0, 120), description: get('description').substring(0, 500), image: get('image') };
}

function extrairJsonLd(html: string): any {
  const matches = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const m of matches) {
    try {
      const data = JSON.parse(m[1]);
      const obj = Array.isArray(data) ? data.find((d: any) => d['@type'] === 'Product') : data;
      if (obj?.['@type'] === 'Product') return obj;
    } catch { /* continua */ }
  }
  return null;
}

function extrairImagensJsonLd(jsonLd: any): string[] {
  const raw = jsonLd.image;
  if (!raw) return [];
  if (typeof raw === 'string') return [raw];
  if (Array.isArray(raw)) return raw.map((i: any) => typeof i === 'string' ? i : i.url ?? '').filter(Boolean).slice(0, 6);
  return raw.url ? [raw.url] : [];
}

function extrairNextData(html: string): any {
  const m = html.match(/<script id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch { return null; }
}

function extrairPrecoHtml(html: string): number {
  for (const p of [/"price":\s*"?([\d.]+)"?/i, /"currentPrice":\s*"?([\d.]+)"?/i, /"sale_price":\s*"?([\d.]+)"?/i, /data-price="([\d.]+)"/i]) {
    const m = html.match(p);
    if (m) { const v = parseFloat(m[1]); if (!isNaN(v) && v > 0 && v < 100_000) return v; }
  }
  return 0;
}

function extrairImagensSheinHtml(html: string): string[] {
  const vistas = new Set<string>();
  const cropBlocks = [...html.matchAll(/crop-image-container[\s\S]{0,600}?<img([^>]+)>/gi)];
  for (const [, attrs] of cropBlocks) {
    const src = extrairAttrImg(attrs);
    if (src) vistas.add(normalizeSheinImg(src));
  }
  if (!vistas.size) {
    const cdnUrls = [...html.matchAll(/["']((?:https?:)?\/\/img\.ltwebstatic\.com\/[^"'<>\s]+\.(?:jpg|jpeg|webp|png))["']/gi)]
      .map(m => normalizeSheinImg(m[1]))
      .filter(src => !src.includes('/60/') && !src.includes('/80/') && !src.includes('/120/'));
    cdnUrls.forEach(s => vistas.add(s));
  }
  return [...vistas].slice(0, 8);
}

function extrairTamanhosSheinHtml(html: string): string[] {
  const tamanhos: string[] = [], vistos = new Set<string>();
  const re = /<[a-z]+[^>]*class=["'][^"']*product-intro__size-radio[^"']*["'][^>]*>([\s\S]{0,200}?)<\/[a-z]+>/gi;
  for (const [, inner] of html.matchAll(re)) {
    const texto = inner.replace(/<[^>]+>/g, '').trim();
    if (texto && texto.length < 15 && !vistos.has(texto)) { vistos.add(texto); tamanhos.push(texto); }
  }
  return tamanhos;
}

function extrairCoresSheinHtml(html: string): string[] {
  const cores: string[] = [], vistos = new Set<string>();
  const re = /<([a-z]+)([^>]*class=["'][^"']*radio-container__circleImage[^"']*["'][^>]*)>/gi;
  for (const [, , fullAttrs] of html.matchAll(re)) {
    const m = fullAttrs.match(/(?:title|aria-label)=["']([^"']{1,40})["']/i);
    const nome = m?.[1]?.trim();
    if (nome && !vistos.has(nome)) { vistos.add(nome); cores.push(nome); }
  }
  return cores;
}

function extrairAttrImg(attrs: string): string | null {
  for (const attr of ['data-src', 'data-original', 'data-lazy', 'src']) {
    const m = attrs.match(new RegExp(`${attr}=["']([^"']+)["']`, 'i'));
    if (m?.[1] && !m[1].includes('data:') && (m[1].includes('ltwebstatic') || m[1].startsWith('http') || m[1].startsWith('//')))
      return m[1];
  }
  return null;
}

function normalizeSheinImg(src: string): string {
  src = src.startsWith('//') ? 'https:' + src : src;
  return src.replace(/_\d+x\d+\./g, '.').replace(/\/\d{2,3}x\d{2,3}\//g, '/');
}

function encontrarSheinProduto(obj: any, depth = 0): any {
  if (depth > 6 || !obj || typeof obj !== 'object') return null;
  if (obj.goods_name && (obj.goods_imgs || obj.salePrice)) return obj;
  if (obj.detail?.goods_name) return obj.detail;
  for (const key of Object.keys(obj)) {
    if (Array.isArray(obj[key])) continue;
    const found = encontrarSheinProduto(obj[key], depth + 1);
    if (found) return found;
  }
  return null;
}

function encontrarProdutoTemu(obj: any, depth = 0): any {
  if (depth > 8 || !obj || typeof obj !== 'object') return null;
  if (obj.goods_name || (obj.goods_id && obj.sale_price)) return obj;
  if (obj.goods_detail) return obj.goods_detail;
  if (obj.productInfo) return obj.productInfo;
  for (const key of Object.keys(obj)) {
    const found = encontrarProdutoTemu(obj[key], depth + 1);
    if (found) return found;
  }
  return null;
}

function parsePreco(val: any): number | undefined {
  if (!val) return undefined;
  const n = parseFloat(String(val).replace(',', '.'));
  return (!isNaN(n) && n > 0) ? n : undefined;
}

function parseTemuPreco(val: any): number {
  if (!val) return 0;
  const n = parseFloat(String(val).replace(',', '.'));
  if (isNaN(n) || n <= 0) return 0;
  return n > 1000 ? n / 100 : n;
}

function limparNome(nome: string, fonte: string): string {
  if (!nome) return '';
  return nome
    .replace(/\s*[|\-–—]\s*(Temu|Shein|AliExpress|Shopee|Zara|H&M|ZARA|HM).*/i, '')
    .replace(/\s*-\s*Compra online.*$/i, '')
    .trim()
    .substring(0, 120);
}

function decodeEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .trim();
}

function buildVariantes(tamanhos: string[], cores: string[]): Variante[] {
  if (!tamanhos.length && !cores.length) return [];
  if (tamanhos.length && !cores.length) return tamanhos.map(t => ({ tamanho: t, stock: 1 }));
  if (!tamanhos.length && cores.length) return cores.map(c => ({ cor: c, stock: 1 }));
  return tamanhos.flatMap(t => cores.map(c => ({ tamanho: t, cor: c, stock: 1 })));
}

function resultado(
  nome: string, descricao: string | undefined, preco: number, precoOriginal: number | undefined,
  imagens: string[], tamanhos: string[], cores: string[], tags: string[], categoria?: string,
): ResultadoScrape {
  const t = tamanhos.filter(Boolean);
  const c = cores.filter(Boolean);
  return {
    nome: (nome ?? '').substring(0, 120),
    descricao: descricao ? descricao.substring(0, 500) : undefined,
    preco: preco || 0,
    preco_original: precoOriginal && precoOriginal > preco ? precoOriginal : undefined,
    moeda: 'EUR',
    imagens: imagens.filter(Boolean).slice(0, 8),
    variantes: buildVariantes(t, c),
    tamanhos: t,
    cores: c,
    tags: tags.filter(Boolean),
    categoria,
  };
}
