import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const tfUrl = process.env.TRADEFLOW_API_URL;
  if (!tfUrl) return NextResponse.json({ error: 'TradeFlow não configurado' }, { status: 503 });

  const body = await req.json();
  const { adminDb } = await import('@/lib/firebase-admin');
  const snap = await adminDb.collection('configuracoes').doc('tradeflow').get();
  const stored = snap.data();
  if (!stored?.license_key) return NextResponse.json({ error: 'Sem licença TradeFlow' }, { status: 403 });

  const r = await fetch(`${tfUrl}/cookies/session/capture`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-license-key': stored.license_key, 'x-store-url': stored.store_url },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  console.log('[session/capture] TradeFlow status:', r.status, 'body:', text.slice(0, 500));
  let data: any;
  try { data = JSON.parse(text); } catch { data = { error: text }; }
  return NextResponse.json(data, { status: r.status });
}
