import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

async function getTemuAccountInfo(): Promise<{
  accountId: string;
  creditos_usados: number;
  creditos_limite: number;
  fontes: string[];
} | null> {
  try {
    const tfUrl = process.env.TRADEFLOW_API_URL;
    const tfToken = process.env.TRADEFLOW_ADMIN_TOKEN;
    if (!tfUrl || !tfToken) return null;

    const snap = await adminDb.collection('configuracoes').doc('tradeflow').get();
    const accountId = snap.data()?.account_id;
    if (!accountId) return null;

    const [accountsRes, plansRes] = await Promise.all([
      fetch(`${tfUrl}/admin/accounts`, { headers: { 'x-admin-token': tfToken } }),
      fetch(`${tfUrl}/admin/plans`, { headers: { 'x-admin-token': tfToken } }),
    ]);
    if (!accountsRes.ok) return null;

    const accounts: { id: string; creditos_usados: number; creditos_limite: number; plano_id: string }[] = await accountsRes.json();
    const account = accounts.find(a => a.id === accountId);
    if (!account) return null;

    let fontes: string[] = [];
    if (plansRes.ok) {
      const plans: { id: string; fontes: string[] }[] = await plansRes.json();
      const plan = plans.find(p => p.id === account.plano_id);
      fontes = plan?.fontes ?? [];
    }

    return { accountId, creditos_usados: account.creditos_usados, creditos_limite: account.creditos_limite, fontes };
  } catch {
    return null;
  }
}

async function deduzirCreditoTemu(accountId: string) {
  try {
    const tfUrl = process.env.TRADEFLOW_API_URL;
    const tfToken = process.env.TRADEFLOW_ADMIN_TOKEN;
    if (!tfUrl || !tfToken) return;

    await fetch(`${tfUrl}/admin/accounts/${accountId}/credits/deduct`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-admin-token': tfToken },
      body: JSON.stringify({ amount: 1 }),
    });
  } catch {
    // fire-and-forget
  }
}

export async function POST(req: NextRequest) {
  try {
    const dados = await req.json();

    let temuAccountId: string | null = null;
    if (dados.fonte === 'temu') {
      const info = await getTemuAccountInfo();
      if (info && info.fontes.length > 0 && !info.fontes.includes('temu')) {
        return NextResponse.json(
          { error: 'O teu plano TradeFlow não inclui a Temu. Vai a Admin → TradeFlow para fazer upgrade.' },
          { status: 403 },
        );
      }
      if (info && info.creditos_usados >= info.creditos_limite) {
        return NextResponse.json(
          { error: 'Créditos insuficientes. Vai a Admin → TradeFlow para fazer upgrade do plano.' },
          { status: 402 },
        );
      }
      temuAccountId = info?.accountId ?? null;
    }

    const ref = await adminDb.collection('produtos').add({
      ...dados,
      activo: dados.activo ?? true,
      destaque: dados.destaque ?? false,
      stock: dados.stock ?? 0,
      imagens: dados.imagens ?? [],
      tamanhos: dados.tamanhos ?? [],
      cores: dados.cores ?? [],
      tags: dados.tags ?? [],
      criado_em: FieldValue.serverTimestamp(),
    });

    if (temuAccountId) void deduzirCreditoTemu(temuAccountId);

    return NextResponse.json({ id: ref.id });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
