import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (!url) return NextResponse.json({ error: 'URL em falta' }, { status: 400 });
    const cleanUrl = (() => { try { const u = new URL(url); return u.origin + u.pathname; } catch { return url; } })();

    const tfUrl = process.env.TRADEFLOW_API_URL;
    if (!tfUrl) {
      return NextResponse.json(
        { error: 'TradeFlow não configurado. Contacta o administrador.' },
        { status: 503 },
      );
    }

    const { adminDb } = await import('@/lib/firebase-admin');
    const snap = await adminDb.collection('configuracoes').doc('tradeflow').get();
    const stored = snap.data();

    if (!stored?.license_key || !stored?.store_url) {
      return NextResponse.json(
        { error: 'Subscrição TradeFlow não encontrada. Vai a Admin → TradeFlow para criar conta.' },
        { status: 503 },
      );
    }

    const tfHeaders = {
      'Content-Type': 'application/json',
      'x-license-key': stored.license_key,
      'x-store-url': stored.store_url,
    };

    // ── TradeFlow (sidecar) ───────────────────────────────────────────────────
    const tfRes = await fetch(`${tfUrl}/scrape`, {
      method: 'POST',
      headers: tfHeaders,
      body: JSON.stringify({ url }),
    });

    const tfData = await tfRes.json();

    if (!tfRes.ok) {
      if (tfRes.status === 429) {
        return NextResponse.json({ ...tfData, upgrade: true }, { status: 429 });
      }
      if (tfRes.status === 402) {
        return NextResponse.json(tfData, { status: 402 });
      }
      return NextResponse.json({ ...tfData, needs_cookies: true }, { status: tfRes.status });
    }

    const jobId = tfData.job_id;
    if (!jobId) {
      return NextResponse.json({ error: 'TradeFlow não devolveu job_id' }, { status: 500 });
    }

    // Polling até o job terminar (máx 60s)
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 2000));
      const pollRes = await fetch(`${tfUrl}/job/${jobId}`, { headers: tfHeaders });
      const pollData = await pollRes.json();

      if (pollData.status === 'done') {
        const r = pollData.resultado;
        return NextResponse.json({
          nome: r.nome,
          preco: r.preco,
          preco_original: r.preco_original,
          descricao: r.descricao,
          imagens: r.imagens ?? [],
          tamanhos: r.tamanhos ?? [],
          cores: r.cores ?? [],
          tags: r.tags ?? [],
          categoria: r.categoria,
          colorImagesMap: r.colorImagesMap ?? null,
          url: cleanUrl,
          tier: 'tradeflow',
          custo: pollData.custo,
        });
      }

      if (pollData.status === 'error' || pollData.status === 'failed') {
        const erro = pollData.erro ?? 'O scraping falhou. Tenta novamente.';
        const needs_cookies = /block|cookie|captcha|access|denied|forbidden|robot|protected|upstream/i.test(erro);
        return NextResponse.json({ error: erro, needs_cookies }, { status: 422 });
      }
    }

    return NextResponse.json({ error: 'Timeout — o scraping demorou demasiado.', needs_cookies: true }, { status: 504 });

  } catch (err) {
    console.error('Scrape error:', err);
    return NextResponse.json({ error: 'Não foi possível extrair o produto desta página. O site pode estar a bloquear o acesso.', needs_cookies: true }, { status: 500 });
  }
}
