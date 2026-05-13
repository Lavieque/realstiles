// ── scrape-product.js ──
const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };

  try {
    const { url } = JSON.parse(event.body);
    if (!url) return { statusCode: 400, headers, body: JSON.stringify({ error: 'URL em falta' }) };

    const fonte = detectarFonte(url);
    const resultado = await scrapeUrl(url, fonte);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ...resultado, fonte_url: url, fonte_site: fonte })
    };

  } catch (err) {
    console.error('Scrape error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Não foi possível extrair o produto. Tenta preencher manualmente.' })
    };
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
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'pt-PT,pt;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
    },
    redirect: 'follow',
    timeout: 15000
  });

  const html = await res.text();
  const meta = extrairMetaTags(html);
  const jsonLd = extrairJsonLd(html);
  const nextData = extrairNextData(html);

  let nome = '', descricao = '', preco = 0, precoOriginal = null;
  let imagens = [], tamanhos = [], cores = [], tags = [];

  // ── TEMU ──
  if (fonte === 'temu') {
    const temu = extrairTemu(html, nextData);
    nome = temu.nome || meta.title;
    descricao = temu.descricao || meta.description;
    preco = temu.preco || extrairPrecoHtml(html);
    precoOriginal = temu.precoOriginal;
    imagens = temu.imagens.length ? temu.imagens : [meta.image].filter(Boolean);
    tamanhos = temu.tamanhos;
    cores = temu.cores;
    tags = temu.tags;

  // ── JSON-LD (Schema.org Product) ──
  } else if (jsonLd) {
    nome = jsonLd.name || meta.title;
    descricao = jsonLd.description || meta.description;
    preco = parsePreco(jsonLd.offers?.price || jsonLd.offers?.[0]?.price) || extrairPrecoHtml(html);
    precoOriginal = parsePreco(jsonLd.offers?.highPrice || jsonLd.offers?.[0]?.highPrice);
    imagens = extrairImagensJsonLd(jsonLd);
    if (!imagens.length && meta.image) imagens = [meta.image];

  // ── FALLBACK: meta tags + regex ──
  } else {
    nome = meta.title;
    descricao = meta.description;
    preco = extrairPrecoHtml(html);
    imagens = [meta.image].filter(Boolean);
  }

  // Limpar nome (remover sufixos de site)
  nome = limparNome(nome, fonte);

  return {
    nome: nome.substring(0, 120),
    descricao: descricao.substring(0, 500),
    preco: preco || 0,
    preco_original: precoOriginal || null,
    imagens,
    tamanhos,
    cores,
    tags,
    categoria: ''
  };
}

// ── EXTRACTOR TEMU ──
function extrairTemu(html, nextData) {
  const result = { nome: '', descricao: '', preco: 0, precoOriginal: null, imagens: [], tamanhos: [], cores: [], tags: [] };

  try {
    // Temu injeta dados no __NEXT_DATA__ ou em window.__STORE_DATA__
    let data = nextData;

    // Tentar também o padrão window.rawData ou similar
    if (!data) {
      const rawMatch = html.match(/window\.__(?:rawData|STORE_DATA|pageData)[^=]*=\s*(\{.+?\})(?=;\s*(?:window|<\/script>))/s);
      if (rawMatch) {
        try { data = JSON.parse(rawMatch[1]); } catch {}
      }
    }

    if (data) {
      // Procurar recursivamente pelo objeto de produto
      const produto = encontrarProdutoTemu(data);
      if (produto) {
        result.nome = produto.goods_name || produto.title || produto.name || '';
        result.descricao = produto.goods_desc || produto.description || '';

        // Preço (Temu usa centavos em alguns campos)
        const precoRaw = produto.price_info?.sale_price || produto.sale_price || produto.price;
        const precoOrigRaw = produto.price_info?.original_price || produto.original_price || produto.market_price;
        if (precoRaw) result.preco = parseTemuPreco(precoRaw);
        if (precoOrigRaw) result.precoOriginal = parseTemuPreco(precoOrigRaw);

        // Imagens
        const imgs = produto.goods_imgs || produto.images || produto.img_list || [];
        result.imagens = imgs
          .map(i => typeof i === 'string' ? i : (i.url || i.src || i.img_url || ''))
          .filter(Boolean)
          .slice(0, 5);

        // Tamanhos
        const skus = produto.sku_list || produto.skus || produto.size_list || [];
        result.tamanhos = skus
          .map(s => s.size || s.name || s.sku_name || '')
          .filter(s => s && /^(XS|S|M|L|XL|XXL|XXXL|\d{2,3})$/i.test(s))
          .filter((v, i, a) => a.indexOf(v) === i);

        // Cores
        result.cores = (produto.color_list || produto.colors || [])
          .map(c => c.color_name || c.name || '')
          .filter(Boolean)
          .slice(0, 10);

        // Tags
        result.tags = (produto.tags || produto.label_list || [])
          .map(t => t.label_name || t.name || (typeof t === 'string' ? t : ''))
          .filter(Boolean)
          .slice(0, 10);
      }
    }
  } catch (e) {
    console.error('Temu parse error:', e.message);
  }

  // Fallback: imagem da meta og:image
  if (!result.imagens.length) {
    const imgMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
    if (imgMatch) result.imagens = [imgMatch[1]];
  }

  // Fallback preço via regex no HTML
  if (!result.preco) result.preco = extrairPrecoHtml(html);

  return result;
}

function encontrarProdutoTemu(obj, depth = 0) {
  if (depth > 8 || !obj || typeof obj !== 'object') return null;
  // Sinais de que este objeto é o produto
  if (obj.goods_name || (obj.goods_id && obj.sale_price)) return obj;
  if (obj.goods_detail) return obj.goods_detail;
  if (obj.productInfo) return obj.productInfo;
  if (obj.product) return obj.product;
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
  // Temu às vezes usa centavos (ex: 1999 = 19.99)
  return n > 1000 ? n / 100 : n;
}

// ── JSON-LD ──
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

// ── NEXT DATA ──
function extrairNextData(html) {
  const match = html.match(/<script id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!match) return null;
  try { return JSON.parse(match[1]); } catch { return null; }
}

// ── META TAGS OG ──
function extrairMetaTags(html) {
  const get = (property) => {
    const patterns = [
      new RegExp(`<meta[^>]*property=["']og:${property}["'][^>]*content=["']([^"']+)["']`, 'i'),
      new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:${property}["']`, 'i'),
      new RegExp(`<meta[^>]*name=["']${property}["'][^>]*content=["']([^"']+)["']`, 'i'),
    ];
    for (const p of patterns) {
      const m = html.match(p);
      if (m) return decodeHTMLEntities(m[1]);
    }
    return '';
  };

  let title = get('title');
  if (!title) {
    const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (m) title = decodeHTMLEntities(m[1]);
  }

  return {
    title: title?.substring(0, 120) || '',
    description: get('description')?.substring(0, 500) || '',
    image: get('image') || ''
  };
}

// ── PREÇO via regex no HTML ──
function extrairPrecoHtml(html) {
  const patterns = [
    /"price":\s*"?([\d.]+)"?/i,
    /"currentPrice":\s*"?([\d.]+)"?/i,
    /"sale_price":\s*"?([\d.]+)"?/i,
    /data-price="([\d.]+)"/i,
    /"offers"[^{]*"price":\s*"?([\d.]+)"?/i,
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m) {
      const val = parseFloat(m[1].replace(',', '.'));
      if (!isNaN(val) && val > 0 && val < 100000) return val;
    }
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
  // Remove sufixos comuns de título de página
  return nome
    .replace(/\s*[|\-–—]\s*(Temu|Shein|AliExpress|Shopee|Zara|H&M).*/i, '')
    .replace(/\s*-\s*Compra online.*$/i, '')
    .trim();
}

function decodeHTMLEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}
