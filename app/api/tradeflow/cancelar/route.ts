import { NextRequest, NextResponse } from 'next/server';

const TF_URL = () => process.env.TRADEFLOW_API_URL || 'http://localhost:3000';
const TF_TOKEN = () => process.env.TRADEFLOW_ADMIN_TOKEN || '';

export async function POST(req: NextRequest) {
  try {
    const { account_id } = await req.json();
    if (!account_id) return NextResponse.json({ error: 'account_id obrigatório' }, { status: 400 });

    const res = await fetch(`${TF_URL()}/stripe/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-token': TF_TOKEN() },
      body: JSON.stringify({ account_id }),
    });
    const data = await res.json();
    if (!res.ok) return NextResponse.json({ error: data.message || 'Erro' }, { status: res.status });
    return NextResponse.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
