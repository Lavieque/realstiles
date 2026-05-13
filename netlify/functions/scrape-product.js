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
// SHEIN — API interna + HTML fallback
// URL: https://pt.shein.com/...-p-190526205.html
// ══════════════════════════════════════════
async function scrapeShein(url) {
  // Extrair goods_id e locale do URL
  const goodsIdMatch = url.match(/-p-(\d+)\.html/);
  const goodsId = goodsIdMatch?.[1];
  const localeMatch = url.match(/https?:\/\/([a-z]{2})\.shein\./);
  const locale = localeMatch?.[1] || 'pt';
  const baseUrl = `https://${locale}.shein.com`;

  let nome = '', descricao = '', preco = 0, precoOriginal = null;
  let imagens = [], tamanhos = [], cores = [], tags = [];

  // ── 1. Tentar API interna da Shein ──
  if (goodsId) {
    try {
      const apiHeaders = {
        ...HEADERS_BROWSER,
        'Accept': 'application/json, text/plain, */*',
        'Referer': url,
        'X-Requested-With': 'XMLHttpRequest',
      };

      // API de detalhe do produto
      const apiUrl = `${baseUrl}/api/productInfo/v3/description?goods_id=${goodsId}&cat_id=0&goods_sn=&goods_color_id=0&mall_code=1&main_sale_attr_id=0&_ver=1.2.0&_lang=${locale}`;
      const res = await fetch(apiUrl, { headers: apiHeaders, timeout: 12000 });
      if (res.ok) {
        const data = await res.json();
        const info = data?.info || data?.data?.info || data?.data;
        if (info?.goods_name) {
          nome = info.goods_name;
          descricao = info.goods_desc || '';
          preco = parsePreco(info.salePrice?.amount || info.retailPrice?.amount) || 0;
          precoOriginal = parsePreco(info.retailPrice?.amount);
          if (precoOriginal && precoOriginal <= preco) precoOriginal = null;

          // Imagens via API
          const imgs = info.goods_imgs || info.images || [];
          imagens = imgs.map(i => {
            const src = typeof i === 'string' ? i : (i.origin_image || i.medium_image || i.thumbnail || '');
            return src.startsWith('//') ? 'https:' + src : src;
          }).filter(Boolean).slice(0, 8);

          // Tamanhos via API
          tamanhos = (info.attrSizeList || info.sizeAttrList || [])
            .map(s => s.attr_value_name || s.attr_value || s.name || '')
            .filter(Boolean);

          // Cores via API
          cores = (info.colorList || info.color_list || [])
            .map(c => c.color_name || c.goods_color_name || '')
            .filter(Boolean);

          tags = (info.productTagInfoList || info.tag_list || [])
            .map(t => t.tagName || t.tag_name || '')
            .filter(Boolean);
        }
      }

      // API separada para atributos (tamanhos/cores) se ainda vazia
      if (!tamanhos.length || !cores.length) {
        const attrUrl = `${baseUrl}/api/productInfo/v3/saleProp?goods_id=${goodsId}&cat_id=0&goods_sn=&goods_color_id=0&mall_code=1&_ver=1.2.0&_lang=${locale}`;
        const attrRes = await fetch(attrUrl, { headers: apiHeaders, timeout: 8000 });
        if (attrRes.ok) {
          const attrData = await attrRes.json();
          const attrs = attrData?.info || attrData?.data || {};
          if (!tamanhos.length) {
            tamanhos = (attrs.saleAttr || attrs.attrSizeList || [])
              .flatMap(a => a.attr_value_list || [a])
              .map(v => v.attr_value_name || v.name || '')
              .filter(Boolean);
          }
          if (!cores.length) {
            cores = (attrs.colorList || [])
              .map(c => c.color_name || c.goods_color_name || '')
              .filter(Boolean);
          }
        }
      }
    } catch (err) {
      console.error('Shein API error:', err.message);
    }
  }

  // ── 2. HTML — sempre buscado para imagens e dados em falta ──
  const html = await fetchHtml(url);
  const meta = extrairMetaTags(html);

  if (!nome) nome = limparNome(meta.title, 'shein');
  if (!descricao) descricao = meta.description;

  // Imagens a partir da estrutura HTML da Shein
  if (!imagens.length) {
    imagens = extrairImagensSheinHtml(html);
    if (!imagens.length && meta.image) imagens = [meta.image];
  }

  // Tamanhos e cores: primeiro pelo HTML renderizado (classes conhecidas)
  if (!tamanhos.length) tamanhos = extrairTamanhosSheinHtml(html);
  if (!cores.length) cores = extrairCoresSheinHtml(html);

  // Complementar com JSON embebido (preço + dados em falta)
  if (!preco || !tamanhos.length || !cores.length) {
    const ssrPatterns = [
      /window\.gbSsrData\s*=\s*(\{.+?\});?\s*(?:window|<\/script>)/s,
      /window\.SaPageInfo\s*=\s*(\{.+?\});?\s*(?:window|<\/script>)/s,
      /window\.__INITIAL_STATE__\s*=\s*(\{.+?\});?\s*(?:window|<\/script>)/s,
    ];
    for (const pattern of ssrPatterns) {
      const m = html.match(pattern);
      if (!m) continue;
      try {
        const data = JSON.parse(m[1]);
        const info = encontrarSheinProduto(data);
        if (info) {
          if (!preco) preco = parsePreco(info.salePrice?.amount || info.retailPrice?.amount) || 0;
          if (!tamanhos.length)
            tamanhos = (info.attrSizeList || info.sizeList || []).map(s => s.attr_value_name || s.name || '').filter(Boolean);
          if (!cores.length)
            cores = (info.colorList || info.color_list || []).map(c => c.color_name || '').filter(Boolean);
          if (!imagens.length) {
            const imgs = info.goods_imgs || info.images || [];
            imagens = imgs.map(i => {
              const s = typeof i === 'string' ? i : (i.origin_image || i.medium_image || i.thumbnail || '');
              return s.startsWith('//') ? 'https:' + s : s;
            }).filter(Boolean).slice(0, 8);
          }
          break;
        }
      } catch {}
    }
  }

  if (!preco) preco = extrairPrecoHtml(html);

  return resultado(nome, descricao, preco, precoOriginal, imagens, tamanhos, cores, tags);
}

// Extrai imagens do HTML renderizado pela Shein
// Procura: .thums-picture li .crop-image-container img
// e fallback para qualquer img do CDN ltwebstatic de tamanho adequado
// Extrai tamanhos da classe product-intro__bsSize (spans dentro)
function extrairTamanhosSheinHtml(html) {
  const blockMatch = html.match(/class=["'][^"']*product-intro__bsSize[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|ul|section)>/i);
  if (!blockMatch) return [];
  const spans = [...blockMatch[1].matchAll(/<span[^>]*>([^<]+)<\/span>/gi)]
    .map(m => m[1].trim())
    .filter(s => s && !/^\s*$/.test(s) && s.length < 10);
  return [...new Set(spans)];
}

// Extrai cores da classe product-intro__color (spans dentro)
function extrairCoresSheinHtml(html) {
  const blockMatch = html.match(/class=["'][^"']*product-intro__color[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|ul|section)>/i);
  if (!blockMatch) return [];
  // Tenta primeiro spans com texto (nome da cor)
  const spans = [...blockMatch[1].matchAll(/<span[^>]*>([^<\s][^<]+)<\/span>/gi)]
    .map(m => m[1].trim())
    .filter(s => s && s.length > 0 && s.length < 30);
  if (spans.length) return [...new Set(spans)];
  // Alternativa: atributo title ou aria-label em elementos dentro do bloco
  const titles = [...blockMatch[1].matchAll(/(?:title|aria-label)=["']([^"']+)["']/gi)]
    .map(m => m[1].trim()).filter(Boolean);
  return [...new Set(titles)];
}

function extrairImagensSheinHtml(html) {
  const vistas = new Set();

  // 1. Bloco .thums-picture — extrai src e data-src de imgs dentro de crop-image-container
  const thumsMatch = html.match(/class=["'][^"']*thums-picture[^"']*["'][^>]*>([\s\S]*?)<\/ul>/i);
  if (thumsMatch) {
    const block = thumsMatch[1];
    // Dentro de cada crop-image-container pega o img
    const cropBlocks = [...block.matchAll(/crop-image-container[\s\S]{0,600}?<img([^>]+)>/gi)];
    for (const [, attrs] of cropBlocks) {
      const src = extrairAttrImg(attrs);
      if (src) vistas.add(normalizeSheinImg(src));
    }
  }

  // 2. Qualquer .crop-image-container na página (galeria principal)
  if (!vistas.size) {
    const allCrop = [...html.matchAll(/crop-image-container[\s\S]{0,600}?<img([^>]+)>/gi)];
    for (const [, attrs] of allCrop) {
      const src = extrairAttrImg(attrs);
      if (src) vistas.add(normalizeSheinImg(src));
    }
  }

  // 3. Fallback: CDN ltwebstatic — exclui miniaturas pequenas
  if (!vistas.size) {
    const cdnUrls = [...html.matchAll(/["']((?:https?:)?\/\/img\.ltwebstatic\.com\/[^"'<>\s]+\.(?:jpg|jpeg|webp|png))["']/gi)]
      .map(m => normalizeSheinImg(m[1]))
      .filter(src => !src.includes('/60/') && !src.includes('/80/') && !src.includes('_thumbnail') && !src.includes('/120/'));
    cdnUrls.forEach(s => vistas.add(s));
  }

  return [...vistas].slice(0, 8);
}

function extrairAttrImg(attrs) {
  // Prefere data-src (lazy load), depois src
  for (const attr of ['data-src', 'data-original', 'data-lazy', 'src']) {
    const m = attrs.match(new RegExp(`${attr}=["']([^"']+)["']`, 'i'));
    if (m && m[1] && !m[1].includes('data:') && (m[1].includes('ltwebstatic') || m[1].startsWith('http') || m[1].startsWith('//'))) {
      return m[1];
    }
  }
  return null;
}

function normalizeSheinImg(src) {
  src = src.startsWith('//') ? 'https:' + src : src;
  // Trocar versões pequenas por versão grande (_thumbnail -> nada, _606x_ -> _)
  return src.replace(/_\d+x\d+\./g, '.').replace(/\/\d{2,3}x\d{2,3}\//g, '/');
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
