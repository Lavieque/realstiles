import { NextResponse } from 'next/server';
import { sincronizarCategoriasAtivas } from '@/lib/produtos';
import { exigirPermissao } from '@/lib/permissoes-server';

export async function POST(req: Request) {
  const auth = await exigirPermissao(req, 'produtos');
  if (auth instanceof NextResponse) return auth;

  try {
    await sincronizarCategoriasAtivas();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
