import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { exigirPermissao } from '@/lib/permissoes-server';
import { PROVINCIAS, MODALIDADES } from '@/lib/entregas';
import type { TarifaEntrega } from '@/lib/entregas';

export const dynamic = 'force-dynamic';

// Público: a calculadora de entregas e o checkout leem as tarifas.
export async function GET() {
  try {
    const snap = await adminDb.collection('config').doc('entregas').get();
    return NextResponse.json(snap.exists ? snap.data() : { itens: [] });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

function valida(t: unknown): t is TarifaEntrega {
  const x = t as TarifaEntrega;
  return !!x && typeof x.id === 'string'
    && (PROVINCIAS as readonly string[]).includes(x.provincia)
    && x.modalidade in MODALIDADES
    && (x.zona === '' || x.zona === 'urbana' || x.zona === 'periferia')
    && Number.isFinite(x.preco_base) && x.preco_base >= 0
    && Number.isFinite(x.preco_kg) && x.preco_kg >= 0;
}

export async function POST(req: NextRequest) {
  const auth = await exigirPermissao(req, 'taxas');
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const itens: unknown[] = Array.isArray(body?.itens) ? body.itens : [];
    if (!itens.every(valida)) {
      return NextResponse.json({ error: 'Tarifas inválidas' }, { status: 400 });
    }
    await adminDb.collection('config').doc('entregas').set({ itens });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
