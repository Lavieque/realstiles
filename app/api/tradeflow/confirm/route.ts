import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { segredoCallback, segredoValido, urlCallback } from '@/lib/tradeflow-callback';

const TF_URL = () => process.env.TRADEFLOW_API_URL || '';
const TF_TOKEN = () => process.env.TRADEFLOW_ADMIN_TOKEN || '';

async function ensureStore(accountId: string, storeUrl: string) {
  const tfUrl = TF_URL();
  const tfToken = TF_TOKEN();
  if (!tfUrl || !tfToken || !storeUrl) return;
  try {
    const callbackUrl = urlCallback(process.env.NEXT_PUBLIC_APP_URL || '');
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
    // Falha fechado: sem segredo configurado a rota não aceita nada. Antes
    // saltava a verificação, o que deixava qualquer pedido anónimo
    // sobrescrever configuracoes/tradeflow (account_id e license_key).
    const secret = segredoCallback();
    if (!secret) {
      console.error('[tradeflow/confirm] TRADEFLOW_CALLBACK_SECRET não configurado');
      return NextResponse.json({ error: 'Callback não configurado' }, { status: 503 });
    }
    const recebido = req.headers.get('x-callback-secret') ?? req.nextUrl.searchParams.get('s');
    if (!segredoValido(recebido, secret)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { account_id, license_key, plano_id, store_url } = await req.json();
    if (!account_id || !license_key) {
      return NextResponse.json({ error: 'account_id e license_key obrigatórios' }, { status: 400 });
    }

    const campo = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);
    const cleanUrl = campo(store_url, 300).replace(/^https?:\/\//, '').replace(/\/$/, '');

    await adminDb.collection('configuracoes').doc('tradeflow').set({
      account_id: campo(account_id, 128),
      license_key: campo(license_key, 256),
      store_url: cleanUrl,
      plano_id: campo(plano_id, 64),
      subscrito_em: new Date().toISOString(),
    }, { merge: true });

    // Garante que a store está registada no TradeFlow (necessário para scraping)
    await ensureStore(account_id, cleanUrl);

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
