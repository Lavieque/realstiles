// ── scrape-product.js ──
// Netlify Function para extrair informação de produtos via URL

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
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'pt-PT,pt;q=0.9,en;q=0.8',
    },
    redirect: 'follow',
    timeout: 10000
  });

  const html = await res.text();

  // Extrair meta tags Open Graph (funciona na maioria dos sites)
  const meta = extrairMetaTags(html);

  // Extrair preço com regex
  const preco = extrairPreco(html, fonte);

  // Extrair imagens adicionais
  const imagens = [meta.image].filter(Boolean);

  return {
    nome: meta.title || '',
    descricao: meta.description || '',
    preco: preco || 0,
    imagens,
    tamanhos: [], // Preenchido manualmente
    cores: [],    // Preenchido manualmente
    categoria: '',
    tags: []
  };
}

function extrairMetaTags(html) {
  const get = (property) => {
    const patterns = [
      new RegExp(`<meta[^>]*property=["']og:${property}["'][^>]*content=["']([^"']+)["']`, 'i'),
      new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:${property}["']`, 'i'),
      new RegExp(`<meta[^>]*name=["']${property}["'][^>]*content=["']([^"']+)["']`, 'i'),
    ];
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match) return decodeHTMLEntities(match[1]);
    }
    return '';
  };

  // Título fallback para <title>
  let title = get('title');
  if (!title) {
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) title = decodeHTMLEntities(titleMatch[1]);
  }

  return {
    title: title?.substring(0, 120) || '',
    description: get('description')?.substring(0, 500) || '',
    image: get('image') || ''
  };
}

function extrairPreco(html, fonte) {
  // Padrões comuns de preço em HTML
  const patterns = [
    /"price":\s*"?([\d.,]+)"?/i,
    /"currentPrice":\s*"?([\d.,]+)"?/i,
    /data-price="([\d.,]+)"/i,
    /class="[^"]*price[^"]*"[^>]*>\s*(?:MZN|MT|USD|\$|€)?\s*([\d.,]+)/i,
    /"offers"[^{]*"price":\s*"?([\d.,]+)"?/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) {
      const valor = parseFloat(match[1].replace(',', '.'));
      if (!isNaN(valor) && valor > 0 && valor < 1000000) return valor;
    }
  }
  return 0;
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
