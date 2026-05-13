// ── scrape-product.js ──
const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));

const HEADERS_BROWSER = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'pt-PT,pt;q=0.9,en;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };

  try {
    const { url } = JSON.parse(event.body);
    if (!url) return { statusCode: 400, headers, body: JSON.stringify({ error: 'URL em falta' }) };

    const fonte = detectarFonte(url);
    const resultado = await scrapeUrl(url, fonte);
    return { statusCode: 200, headers, body: JSON.stringify({ ...resultado, fonte_url: url, fonte_site: fonte }) };
  } catch (err) {
    console.error('Scrape error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Não foi possível extrair o produto. Tenta preencher manualmente.' }) };
  }
};

function detectarFonte(url) {
  if (url.includes('temu.com')) return 'temu';
  if (url.includes('shein.com')) return 'shein';
  if (url.includes('aliexpress.com')) return 'aliexpress';
  if (url.includes('shopee.')) return 'shopee';
  if (url.includes('zara.com')) return 'zara';
  if (url.includes('hm.com')) return 'hm';
  return 'outro';
}

async function scrapeUrl(url, fonte) {
  if (fonte === 'zara') return scrapeZara(url);
  if (fonte === 'temu') return scrapeTemu(url);
  if (fonte === 'shein') return scrapeShein(url);

  // Genérico: meta tags + JSON-LD
  const html = await fetchHtml(url);
  const meta = extrairMetaTags(html);
  const jsonLd = extrairJsonLd(html);

  let nome = meta.title, descricao = meta.description, preco = 0, precoOriginal = null;
  let imagens = [meta.image].filter(Boolean), tamanhos = [], cores = [], tags = [];

  if (jsonLd) {
    nome = jsonLd.name || nome;
    descricao = jsonLd.description || descricao;
    preco = parsePreco(jsonLd.offers?.price || jsonLd.offers?.[0]?.price) || extrairPrecoHtml(html);
    precoOriginal = parsePreco(jsonLd.offers?.highPrice || jsonLd.offers?.[0]?.highPrice);
    const jImgs = extrairImagensJsonLd(jsonLd);
    if (jImgs.length) imagens = jImgs;
  } else {
    preco = extrairPrecoHtml(html);
  }

  return resultado(limparNome(nome, fonte), descricao, preco, precoOriginal, imagens, tamanhos, cores, tags);
}

// ══════════════════════════════════════════
// ZARA — API pública JSON
// URL: https://www.zara.com/pt/pt/nome-p12345678.html?v1=PRODUCTID
// ══════════════════════════════════════════
async function scrapeZara(url) {
  const urlObj = new URL(url);
  // Extrair ID: primeiro tenta param v1, depois o -p seguido de dígitos no path
  let productId = urlObj.searchParams.get('v1');
  if (!productId) {
    const m = urlObj.pathname.match(/-p(\d+)\.html/i);
    if (m) productId = m[1];
  }

  if (!productId) {
    // Fallback: buscar HTML e extrair meta
    const html = await fetchHtml(url);
    const meta = extrairMetaTags(html);
    return resultado(limparNome(meta.title, 'zara'), meta.description, 0, null, [meta.image].filter(Boolean), [], [], []);
  }

  // Detectar locale do URL (ex: /pt/pt/, /es/es/, /en/gb/)
  const localeMatch = urlObj.pathname.match(/^\/([a-z]{2}\/[a-z]{2})\//);
  const locale = localeMatch ? localeMatch[1] : 'pt/pt';

  try {
    const apiUrl = `https://www.zara.com/${locale}/product/${productId}/detail.json`;
    const res = await fetch(apiUrl, { headers: { ...HEADERS_BROWSER, 'Accept': 'application/json' }, timeout: 12000 });
    const data = await res.json();

    const p = data?.product;
    if (!p) throw new Error('Produto não encontrado na API Zara');

    const cores = (p.detail?.colors || []).map(c => c.name).filter(Boolean);
    const tamanhos = (p.detail?.colors?.[0]?.sizes || []).map(s => s.name).filter(Boolean);

    const imagens = [];
    for (const color of (p.detail?.colors || [])) {
      for (const img of (color.xmedia || [])) {
        const src = img.path ? `https://static.zara.net/photos/${img.path}/w/563/${img.name}.jpg?ts=${img.timestamp}` : '';
        if (src) imagens.push(src);
        if (imagens.length >= 5) break;
      }
      if (imagens.length >= 5) break;
    }

    const precoRaw = p.price;
    const precoOrigRaw = p.oldPrice;

    return resultado(
      p.name || '',
      p.description || '',
      precoRaw ? precoRaw / 100 : 0,
      precoOrigRaw ? precoOrigRaw / 100 : null,
      imagens,
      tamanhos,
      cores,
      p.keyWords || []
    );
  } catch (err) {
    console.error('Zara API error:', err.message);
    // Fallback HTML
    const html = await fetchHtml(url);
    const meta = extrairMetaTags(html);
    return resultado(limparNome(meta.title, 'zara'), meta.description, extrairPrecoHtml(html), null, [meta.image].filter(Boolean), [], [], []);
  }
}

// ══════════════════════════════════════════
// SHEIN — dados embebidos em window.gbSsrData / window.SaPageInfo
// ══════════════════════════════════════════
async function scrapeShein(url) {
  const html = await fetchHtml(url);
  const meta = extrairMetaTags(html);

  // Todas as imagens og:image (Shein coloca várias)
  const ogImagens = [...html.matchAll(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/gi)]
    .map(m => m[1]).filter(Boolean).slice(0, 5);

  let nome = limparNome(meta.title, 'shein');
  let descricao = meta.description;
  let preco = 0, precoOriginal = null;
  let tamanhos = [], cores = [], tags = [];
  let imagens = ogImagens.length ? ogImagens : [meta.image].filter(Boolean);

  // Tentar extrair window.gbSsrData
  const ssrPatterns = [
    /window\.gbSsrData\s*=\s*(\{[\s\S]+?\})(?=;\s*(?:window|<\/script>))/,
    /window\.SaPageInfo\s*=\s*(\{[\s\S]+?\})(?=;\s*(?:window|<\/script>))/,
    /window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]+?\})(?=;\s*(?:window|<\/script>))/,
    /"goods_detail"\s*:\s*(\{[\s\S]{100,5000}?\})(?=,\s*")/,
  ];

  for (const pattern of ssrPatterns) {
    const m = html.match(pattern);
    if (!m) continue;
    try {
      const data = JSON.parse(m[1]);
      const info = encontrarSheinProduto(data);
      if (info) {
        nome = info.goods_name || nome;
        descricao = info.goods_desc || descricao;
        preco = parsePreco(info.salePrice?.amount || info.retailPrice?.amount) || preco;
        precoOriginal = parsePreco(info.retailPrice?.amount);
        if (precoOriginal === preco) precoOriginal = null;

        const imgs = info.goods_imgs || info.images || [];
        if (imgs.length) {
          imagens = imgs.map(i => {
            const src = typeof i === 'string' ? i : (i.origin_image || i.thumbnail || i.src || '');
            return src.startsWith('//') ? 'https:' + src : src;
          }).filter(Boolean).slice(0, 5);
        }

        tamanhos = (info.attrSizeList || info.sizeList || []).map(s => s.attr_value_name || s.name || '').filter(Boolean);
        cores = (info.colorList || info.color_list || []).map(c => c.color_name || c.goods_color_image || '').filter(Boolean);
        tags = (info.productTagInfoList || []).map(t => t.tagName || '').filter(Boolean);
        break;
      }
    } catch {}
  }

  // Fallback preço
  if (!preco) preco = extrairPrecoHtml(html);

  return resultado(nome, descricao, preco, precoOriginal, imagens, tamanhos, cores, tags);
}

function encontrarSheinProduto(obj, depth = 0) {
  if (depth > 6 || !obj || typeof obj !== 'object') return null;
  if (obj.goods_name && (obj.goods_imgs || obj.salePrice)) return obj;
  if (obj.detail && obj.detail.goods_name) return obj.detail;
  for (const key of Object.keys(obj)) {
    if (Array.isArray(obj[key])) continue;
    const found = encontrarSheinProduto(obj[key], depth + 1);
    if (found) return found;
  }
  return null;
}

// ══════════════════════════════════════════
// TEMU — API interna + fallback HTML
// ══════════════════════════════════════════
async function scrapeTemu(url) {
  // Extrair goods_id do URL
  const urlObj = new URL(url);
  const goodsId = urlObj.searchParams.get('goods_id')
    || url.match(/goods[_-]id[=\/](\d+)/i)?.[1]
    || url.match(/-(\d{12,})/)?.[1];

  if (goodsId) {
    try {
      // API interna da Temu
      const apiUrl = `https://www.temu.com/api/poppy/v1/goods/detail?goods_id=${goodsId}&refer_page_name=goods&refer_page_id=10032`;
      const res = await fetch(apiUrl, {
        headers: {
          ...HEADERS_BROWSER,
          'Accept': 'application/json, text/plain, */*',
          'Referer': 'https://www.temu.com/',
        },
        timeout: 12000
      });
      if (res.ok) {
        const data = await res.json();
        const p = data?.result?.goods_detail || data?.result?.product || data?.result;
        if (p?.goods_name) {
          const imagens = (p.goods_gallery_videos || p.goods_imgs || p.images || [])
            .filter(i => !i.type || i.type !== 'video')
            .map(i => typeof i === 'string' ? i : (i.goods_image_url || i.url || ''))
            .filter(Boolean).slice(0, 5);

          const tamanhos = (p.sku_list || [])
            .flatMap(s => s.specs || [])
            .filter(s => /^(XS|S|M|L|XL|XXL|XXXL|\d{2,3}(cm)?)$/i.test(s.spec_name || ''))
            .map(s => s.spec_name)
            .filter((v, i, a) => a.indexOf(v) === i);

          const precoRaw = p.price_info?.sale_price ?? p.sale_price ?? p.price;
          const precoOrigRaw = p.price_info?.original_price ?? p.original_price;

          return resultado(
            p.goods_name,
            p.goods_desc || '',
            parseTemuPreco(precoRaw),
            parseTemuPreco(precoOrigRaw) || null,
            imagens,
            tamanhos,
            [],
            (p.label_list || []).map(l => l.label_name || '').filter(Boolean)
          );
        }
      }
    } catch (err) {
      console.error('Temu API error:', err.message);
    }
  }

  // Fallback: HTML + __NEXT_DATA__
  const html = await fetchHtml(url);
  const meta = extrairMetaTags(html);
  const nextData = extrairNextData(html);
  let preco = 0, precoOriginal = null, imagens = [], tamanhos = [], cores = [], tags = [];

  if (nextData) {
    const p = encontrarProdutoTemu(nextData);
    if (p) {
      preco = parseTemuPreco(p.price_info?.sale_price || p.sale_price || p.price);
      precoOriginal = parseTemuPreco(p.price_info?.original_price || p.original_price) || null;
      imagens = (p.goods_imgs || p.images || []).map(i => typeof i === 'string' ? i : (i.url || '')).filter(Boolean).slice(0, 5);
      tamanhos = (p.sku_list || []).map(s => s.size || s.name || '').filter(s => /^(XS|S|M|L|XL|XXL|\d{2,3})$/i.test(s)).filter((v, i, a) => a.indexOf(v) === i);
      cores = (p.color_list || []).map(c => c.color_name || '').filter(Boolean);
      tags = (p.label_list || []).map(t => t.label_name || '').filter(Boolean);
    }
  }

  if (!imagens.length && meta.image) imagens = [meta.image];
  if (!preco) preco = extrairPrecoHtml(html);

  return resultado(limparNome(meta.title, 'temu'), meta.description, preco, precoOriginal, imagens, tamanhos, cores, tags);
}

function encontrarProdutoTemu(obj, depth = 0) {
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

function parseTemuPreco(val) {
  if (!val) return 0;
  const n = parseFloat(String(val).replace(',', '.'));
  if (isNaN(n) || n <= 0) return 0;
  return n > 1000 ? n / 100 : n;
}

// ══════════════════════════════════════════
// UTILITÁRIOS COMUNS
// ══════════════════════════════════════════
async function fetchHtml(url) {
  const res = await fetch(url, { headers: HEADERS_BROWSER, redirect: 'follow', timeout: 15000 });
  return res.text();
}

function extrairJsonLd(html) {
  const matches = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const m of matches) {
    try {
      const data = JSON.parse(m[1]);
      const obj = Array.isArray(data) ? data.find(d => d['@type'] === 'Product') : data;
      if (obj?.['@type'] === 'Product') return obj;
    } catch {}
  }
  return null;
}

function extrairImagensJsonLd(jsonLd) {
  const raw = jsonLd.image;
  if (!raw) return [];
  if (typeof raw === 'string') return [raw];
  if (Array.isArray(raw)) return raw.map(i => (typeof i === 'string' ? i : i.url || '')).filter(Boolean).slice(0, 5);
  return raw.url ? [raw.url] : [];
}

function extrairNextData(html) {
  const match = html.match(/<script id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!match) return null;
  try { return JSON.parse(match[1]); } catch { return null; }
}

function extrairMetaTags(html) {
  const get = (property) => {
    for (const pattern of [
      new RegExp(`<meta[^>]*property=["']og:${property}["'][^>]*content=["']([^"']+)["']`, 'i'),
      new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:${property}["']`, 'i'),
      new RegExp(`<meta[^>]*name=["']${property}["'][^>]*content=["']([^"']+)["']`, 'i'),
    ]) {
      const m = html.match(pattern);
      if (m) return decodeHTMLEntities(m[1]);
    }
    return '';
  };
  let title = get('title');
  if (!title) { const m = html.match(/<title[^>]*>([^<]+)<\/title>/i); if (m) title = decodeHTMLEntities(m[1]); }
  return { title: title?.substring(0, 120) || '', description: get('description')?.substring(0, 500) || '', image: get('image') || '' };
}

function extrairPrecoHtml(html) {
  for (const p of [/"price":\s*"?([\d.]+)"?/i, /"currentPrice":\s*"?([\d.]+)"?/i, /"sale_price":\s*"?([\d.]+)"?/i, /data-price="([\d.]+)"/i]) {
    const m = html.match(p);
    if (m) { const v = parseFloat(m[1]); if (!isNaN(v) && v > 0 && v < 100000) return v; }
  }
  return 0;
}

function parsePreco(val) {
  if (!val) return null;
  const n = parseFloat(String(val).replace(',', '.'));
  return (!isNaN(n) && n > 0) ? n : null;
}

function limparNome(nome, fonte) {
  if (!nome) return '';
  return nome.replace(/\s*[|\-–—]\s*(Temu|Shein|AliExpress|Shopee|Zara|H&M|ZARA).*/i, '').replace(/\s*-\s*Compra online.*$/i, '').trim();
}

function decodeHTMLEntities(str) {
  return str.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ').trim();
}

function resultado(nome, descricao, preco, precoOriginal, imagens, tamanhos, cores, tags) {
  return {
    nome: (nome || '').substring(0, 120),
    descricao: (descricao || '').substring(0, 500),
    preco: preco || 0,
    preco_original: precoOriginal || null,
    imagens: imagens || [],
    tamanhos: tamanhos || [],
    cores: cores || [],
    tags: tags || [],
    categoria: ''
  };
}
