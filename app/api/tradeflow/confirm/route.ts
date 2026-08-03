import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

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
    await adminDb.collection('configuracoes').doc('tradeflow').set({
      account_id,
      license_key,
      store_url: store_url ?? '',
      plano_id: plano_id ?? '',
      subscrito_em: new Date().toISOString(),
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
