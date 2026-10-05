import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { exigirPermissao } from '@/lib/permissoes-server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await exigirPermissao(req, 'taxas', 'produtos');
  if (auth instanceof NextResponse) return auth;

  try {
    const snap = await adminDb.collection('config').doc('taxas').get();
    return NextResponse.json(snap.exists ? snap.data() : { itens: [] });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await exigirPermissao(req, 'taxas');
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    await adminDb.collection('config').doc('taxas').set(body);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
