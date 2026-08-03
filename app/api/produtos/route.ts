import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

type AccountInfo = { accountId: string; creditos_usados: number; creditos_limite: number; creditos_extra: number; fontes: string[] };
type AccountResult = { ok: true; info: AccountInfo } | { ok: false; error: string };

async function getTemuAccountInfo(): Promise<AccountResult> {
  const tfUrl = process.env.TRADEFLOW_API_URL;
  const tfToken = process.env.TRADEFLOW_ADMIN_TOKEN;
  if (!tfUrl || !tfToken) return { ok: false, error: 'TradeFlow não configurado neste ambiente.' };

  const snap = await adminDb.collection('configuracoes').doc('tradeflow').get();
  const accountId = snap.data()?.account_id;
  if (!accountId) return { ok: false, error: 'Nenhuma conta TradeFlow ligada. Vai a Admin → TradeFlow para subscrever.' };

  const [accountsRes, plansRes] = await Promise.all([
    fetch(`${tfUrl}/admin/accounts`, { headers: { 'x-admin-token': tfToken } }),
    fetch(`${tfUrl}/admin/plans`, { headers: { 'x-admin-token': tfToken } }),
  ]);
  if (!accountsRes.ok) return { ok: false, error: 'Não foi possível verificar a subscrição TradeFlow. O serviço pode estar em baixo.' };

  const accounts: { id: string; creditos_usados: number; creditos_limite: number; creditos_extra: number; plano_id: string }[] = await accountsRes.json();
  const account = accounts.find(a => a.id === accountId);
  if (!account) return { ok: false, error: 'Conta TradeFlow não encontrada. Verifica a ligação em Admin → TradeFlow.' };

  let fontes: string[] = [];
  if (plansRes.ok) {
    const plans: { id: string; fontes: string[] }[] = await plansRes.json();
    const plan = plans.find(p => p.id === account.plano_id);
    fontes = plan?.fontes ?? [];
  }

  return { ok: true, info: { accountId, creditos_usados: account.creditos_usados, creditos_limite: account.creditos_limite, creditos_extra: account.creditos_extra ?? 0, fontes } };
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
      const result = await getTemuAccountInfo().catch(err => ({
        ok: false as const,
        error: `Erro ao verificar TradeFlow: ${err instanceof Error ? err.message : String(err)}`,
      }));

      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 503 });
      }

      const { info } = result;

      if (info.fontes.length > 0 && !info.fontes.includes('temu')) {
        return NextResponse.json(
          { error: 'O teu plano TradeFlow não inclui a Temu. Vai a Admin → TradeFlow para fazer upgrade.' },
          { status: 403 },
        );
      }

      const creditosDisponiveis = (info.creditos_extra ?? 0) > 0
        ? info.creditos_extra
        : info.creditos_limite;
      if (info.creditos_usados >= creditosDisponiveis) {
        return NextResponse.json(
          { error: 'Créditos insuficientes. Vai a Admin → TradeFlow para fazer upgrade do plano.' },
          { status: 402 },
        );
      }

      temuAccountId = info.accountId;
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
