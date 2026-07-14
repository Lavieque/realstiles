import { NextResponse } from 'next/server';

const TF_URL = () => process.env.TRADEFLOW_API_URL || 'http://localhost:3000';
const TF_TOKEN = () => process.env.TRADEFLOW_ADMIN_TOKEN || '';

export async function PUT(request: Request) {
  try {
    const { account_id, plano_id, confirmado_upgrade } = await request.json();
    if (!account_id || !plano_id) return NextResponse.json({ error: 'account_id e plano_id são obrigatórios' }, { status: 400 });

    // Verificar plano actual para detectar upgrade
    const contaRes = await fetch(`${TF_URL()}/admin/accounts/${account_id}`, {
      headers: { 'x-admin-token': TF_TOKEN() },
    });
    if (contaRes.ok) {
      const contaData = await contaRes.json();
      const planosRes = await fetch(`${TF_URL()}/plans`, { headers: { 'x-admin-token': TF_TOKEN() } });
      if (planosRes.ok) {
        const { planos } = await planosRes.json();
        const planoActual = (planos as { id: string; preco: number }[]).find(p => p.id === contaData.conta?.plano_id);
        const planoNovo = (planos as { id: string; preco: number }[]).find(p => p.id === plano_id);
        const precoActual = planoActual?.preco ?? 0;
        const precoNovo = planoNovo?.preco ?? 0;
        if (precoNovo > precoActual && !confirmado_upgrade) {
          return NextResponse.json({ error: 'Upgrade para plano pago requer confirmação explícita.' }, { status: 402 });
        }
      }
    }

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
