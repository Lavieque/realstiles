import { NextResponse } from 'next/server';
import { sincronizarCategoriasAtivas } from '@/lib/produtos';

export async function POST() {
  try {
    await sincronizarCategoriasAtivas();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
