import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

const TF_URL = () => process.env.TRADEFLOW_API_URL || '';
const TF_TOKEN = () => process.env.TRADEFLOW_ADMIN_TOKEN || '';

async function ensureStore(accountId: string, storeUrl: string) {
  const tfUrl = TF_URL();
  const tfToken = TF_TOKEN();
  if (!tfUrl || !tfToken || !storeUrl) return;
  try {
    const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL || ''}/api/tradeflow/confirm`;
    const headers = { 'Content-Type': 'application/json', 'x-admin-token': tfToken };
    const storesRes = await fetch(`${tfUrl}/admin/accounts/${accountId}/stores`, { headers });
    if (!storesRes.ok) return;
    const stores: { site_url: string }[] = await storesRes.json();
    const normalised = storeUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const exists = stores.some(s => s.site_url.replace(/^https?:\/\//, '').replace(/\/$/, '') === normalised);
    if (!exists) {
      await fetch(`${tfUrl}/admin/accounts/${accountId}/stores`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ site_url: normalised, site_nome: 'Real Stiles', callback_url: callbackUrl }),
      });
    }
  } catch {
    // não bloquear se falhar
  }
}

export async function POST(req: NextRequest) {
  try {
    const secret = process.env.TRADEFLOW_CALLBACK_SECRET;
    if (secret) {
      const incoming = req.headers.get('x-callback-secret');
      if (incoming !== secret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const { account_id, license_key, plano_id, store_url } = await req.json();
    if (!account_id || !license_key) {
      return NextResponse.json({ error: 'account_id e license_key obrigatórios' }, { status: 400 });
    }

    const cleanUrl = (store_url ?? '').replace(/^https?:\/\//, '').replace(/\/$/, '');

    await adminDb.collection('configuracoes').doc('tradeflow').set({
      account_id,
      license_key,
      store_url: cleanUrl,
      plano_id: plano_id ?? '',
      subscrito_em: new Date().toISOString(),
    });

    // Garante que a store está registada no TradeFlow (necessário para scraping)
    await ensureStore(account_id, cleanUrl);

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
