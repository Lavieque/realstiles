import { NextRequest, NextResponse } from 'next/server';

const TF_URL = () => process.env.TRADEFLOW_API_URL || 'http://localhost:3000';
const TF_TOKEN = () => process.env.TRADEFLOW_ADMIN_TOKEN || '';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log('[checkout] body recebido:', JSON.stringify(body));
    const { account_id, plano_id, success_url, cancel_url } = body;
    if (!account_id || !plano_id) {
      console.log('[checkout] ERRO — account_id:', account_id, 'plano_id:', plano_id);
      return NextResponse.json({ error: 'account_id e plano_id obrigatórios' }, { status: 400 });
    }

    const res = await fetch(`${TF_URL()}/stripe/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-token': TF_TOKEN() },
      body: JSON.stringify({ account_id, plano_id, success_url, cancel_url }),
    });

    const data = await res.json();
    if (!res.ok) return NextResponse.json({ error: data.message || data.error || 'Erro' }, { status: res.status });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
