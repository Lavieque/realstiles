import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const snap = await adminDb.collection('config').doc('loja').get();
    const data = snap.exists ? snap.data() : {};
    return NextResponse.json({ categorias: data?.categorias || [] });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { categorias } = await req.json();
    await adminDb.collection('config').doc('loja').set({ categorias }, { merge: true });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
