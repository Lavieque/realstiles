import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

const TF_URL = () => process.env.TRADEFLOW_API_URL || 'http://localhost:3000';
const TF_TOKEN = () => process.env.TRADEFLOW_ADMIN_TOKEN || '';

async function tfFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${TF_URL()}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-admin-token': TF_TOKEN(),
      ...(options.headers as Record<string, string>),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`TradeFlow ${res.status}: ${text}`);
  }
  return res.json();
}

async function getStored(): Promise<{ account_id: string; license_key: string; store_url?: string; plano_id?: string } | null> {
  try {
    const snap = await adminDb.collection('configuracoes').doc('tradeflow').get();
    if (!snap.exists) return null;
    const d = snap.data();
    return d?.license_key ? { account_id: d.account_id, license_key: d.license_key, store_url: d.store_url, plano_id: d.plano_id } : null;
  } catch {
    return null;
  }
}

// GET /api/tradeflow/conta — devolve { conta, planos, license_key_local }
export async function GET() {
  try {
    const [stored, planos] = await Promise.all([
      getStored(),
      tfFetch('/admin/plans').catch(() => []),
    ]);

    if (!stored) {
      return NextResponse.json({ conta: null, planos, license_key_local: null });
    }

    // Tenta buscar dados frescos do TradeFlow; usa fallback se offline
    let conta: Record<string, unknown> | null = null;
    try {
      conta = await tfFetch(`/admin/accounts/${stored.account_id}`);
    } catch {
      // TradeFlow offline — devolve dados mínimos com license_key do Firestore
      conta = { id: stored.account_id, plano_id: stored.plano_id, offline: true };
    }

    // Garante que a license_key está sempre presente (pode vir do TradeFlow ou do Firestore)
    if (conta && !conta.license_key) {
      conta.license_key = stored.license_key;
    }

    return NextResponse.json({ conta, planos, license_key_local: stored.license_key });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

async function ensureStore(accountId: string, storeUrl: string) {
  try {
    const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL || ''}/api/tradeflow/confirm`;
    const stores: { id: string; site_url: string }[] = await tfFetch(`/admin/accounts/${accountId}/stores`);
    const exists = stores.some(s => s.site_url === storeUrl);
    if (!exists) {
      await tfFetch(`/admin/accounts/${accountId}/stores`, {
        method: 'POST',
        body: JSON.stringify({ site_url: storeUrl, site_nome: 'Real Stiles', callback_url: callbackUrl }),
      });
    }
  } catch {
    // Não bloquear se falhar — a store pode já existir ou ser criada manualmente
  }
}

// POST /api/tradeflow/conta — subscrever plano ou ligar conta existente
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Ligar conta existente pela license_key
    if (body.license_key && body.store_url) {
      const { license_key, store_url } = body;
      const cleanUrl = store_url.replace(/^https?:\/\//, '').replace(/\/$/, '');
      // Valida a license_key junto ao TradeFlow
      const accounts: { id: string; license_key: string; plano_id: string }[] = await tfFetch('/admin/accounts');
      const account = accounts.find(a => a.license_key === license_key);
      if (!account) {
        return NextResponse.json({ error: 'License key inválida ou não encontrada.' }, { status: 404 });
      }
      // Garante que a store está registada no TradeFlow
      await ensureStore(account.id, cleanUrl);
      await adminDb.collection('configuracoes').doc('tradeflow').set({
        account_id: account.id,
        license_key,
        store_url: cleanUrl,
        plano_id: account.plano_id,
        ligado_em: new Date().toISOString(),
      });
      return NextResponse.json({ ok: true, account_id: account.id });
    }

    // Criar nova conta
    const { email, nome, plano_id, store_url } = body;
    if (!email || !nome || !plano_id || !store_url) {
      return NextResponse.json({ error: 'email, nome, plano_id e store_url são obrigatórios' }, { status: 400 });
    }
    const cleanUrl = store_url.replace(/^https?:\/\//, '').replace(/\/$/, '');

    const result = await tfFetch('/admin/accounts', {
      method: 'POST',
      body: JSON.stringify({ email, nome, plano_id }),
    });

    // Regista a store no TradeFlow
    await ensureStore(result.id, cleanUrl);

    await adminDb.collection('configuracoes').doc('tradeflow').set({
      account_id: result.id,
      license_key: result.license_key,
      store_url: cleanUrl,
      plano_id,
      subscrito_em: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE /api/tradeflow/conta — desligar conta do site (não cancela no TradeFlow)
export async function DELETE() {
  try {
    await adminDb.collection('configuracoes').doc('tradeflow').delete();
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
