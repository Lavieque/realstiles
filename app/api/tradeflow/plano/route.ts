import { NextResponse } from 'next/server';

const TF_URL = () => process.env.TRADEFLOW_API_URL || 'http://localhost:3000';
const TF_TOKEN = () => process.env.TRADEFLOW_ADMIN_TOKEN || '';

export async function PUT(request: Request) {
  try {
    const { account_id, plano_id } = await request.json();
    if (!account_id || !plano_id) return NextResponse.json({ error: 'account_id e plano_id são obrigatórios' }, { status: 400 });

    const res = await fetch(`${TF_URL()}/admin/accounts/${account_id}/plan`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-admin-token': TF_TOKEN() },
      body: JSON.stringify({ plano_id }),
    });
    if (!res.ok) throw new Error(`TradeFlow ${res.status}`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
