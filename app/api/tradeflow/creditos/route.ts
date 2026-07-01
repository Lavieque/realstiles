import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

const TF_URL = () => process.env.TRADEFLOW_API_URL || 'http://localhost:3000';
const TF_TOKEN = () => process.env.TRADEFLOW_ADMIN_TOKEN || '';

// POST /api/tradeflow/creditos — reset ou adicionar créditos
export async function POST(req: NextRequest) {
  try {
    const { acao, quantidade } = await req.json(); // acao: 'reset' | 'adicionar'
    const snap = await adminDb.collection('configuracoes').doc('tradeflow').get();
    const accountId = snap.data()?.account_id;
    if (!accountId) return NextResponse.json({ error: 'Sem conta TradeFlow associada' }, { status: 404 });

    const path = acao === 'reset'
      ? `/admin/accounts/${accountId}/reset-credits`
      : `/admin/accounts/${accountId}/credits/add`;

    const body = acao === 'adicionar' ? JSON.stringify({ amount: quantidade }) : JSON.stringify({});

    const res = await fetch(`${TF_URL()}${path}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-admin-token': TF_TOKEN() },
      body,
    });
    if (!res.ok) throw new Error(`TradeFlow ${res.status}`);
    return NextResponse.json(await res.json());
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
