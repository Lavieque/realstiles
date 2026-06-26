import { NextRequest, NextResponse } from 'next/server';

const HEADERS_BROWSER = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'pt-PT,pt;q=0.9,en;q=0.8',
};

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (!url) return NextResponse.json({ error: 'URL em falta' }, { status: 400 });

    const html = await fetch(url, { headers: HEADERS_BROWSER }).then(r => r.text());

    const meta = extrairMetaTags(html);
    const jsonLd = extrairJsonLd(html);

    let nome = meta.title || '';
    let descricao = meta.description || '';
    let preco = 0;
    let imagens: string[] = meta.image ? [meta.image] : [];

    if (jsonLd) {
      nome = jsonLd.name || nome;
      descricao = jsonLd.description || descricao;
      preco = parsePreco(jsonLd.offers?.price || jsonLd.offers?.[0]?.price) || extrairPrecoHtml(html);
      const jImgs = extrairImagensJsonLd(jsonLd);
      if (jImgs.length) imagens = jImgs;
    } else {
      preco = extrairPrecoHtml(html);
    }

    return NextResponse.json({ nome, descricao, preco, imagens, url });
  } catch (err) {
    console.error('Scrape error:', err);
    return NextResponse.json({ error: 'Não foi possível extrair o produto.' }, { status: 500 });
  }
}

function extrairMetaTags(html: string) {
  const get = (prop: string) => {
    const m = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i'))
      || html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, 'i'));
    return m?.[1] || '';
  };
  return {
    title: get('og:title') || get('twitter:title') || (html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || '').trim(),
    description: get('og:description') || get('description'),
    image: get('og:image') || get('twitter:image'),
  };
}

function extrairJsonLd(html: string) {
  const m = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!m) return null;
  try {
    const data = JSON.parse(m[1]);
    return Array.isArray(data) ? data.find(d => d['@type'] === 'Product') : data;
  } catch { return null; }
}

function extrairImagensJsonLd(jsonLd: Record<string, unknown>): string[] {
  const imgs = jsonLd.image;
  if (!imgs) return [];
  if (typeof imgs === 'string') return [imgs];
  if (Array.isArray(imgs)) return imgs.map(i => typeof i === 'string' ? i : (i as Record<string, string>).url).filter(Boolean);
  return [];
}

function parsePreco(val: unknown): number {
  if (!val) return 0;
  const n = parseFloat(String(val).replace(/[^\d.,]/g, '').replace(',', '.'));
  return isNaN(n) ? 0 : n;
}

function extrairPrecoHtml(html: string): number {
  const patterns = [
    /itemprop=["']price["'][^>]+content=["']([^"']+)["']/i,
    /class=["'][^"']*price[^"']*["'][^>]*>([\d.,]+)/i,
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m) { const v = parsePreco(m[1]); if (v > 0) return v; }
  }
  return 0;
}
