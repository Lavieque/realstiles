import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

// POST — extensão envia dados do produto Temu
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, produto } = body;

    if (!token || !produto?.nome) {
      return NextResponse.json({ error: 'token e produto obrigatórios' }, { status: 400 });
    }

    await adminDb.collection('temu_import_pending').doc(token).set({
      produto,
      recebido_em: new Date().toISOString(),
      expira_em: Date.now() + 5 * 60 * 1000, // 5 minutos
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

// GET — página do realstiles faz polling para saber se a extensão já enviou
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (!token) return NextResponse.json({ ready: false });

  try {
    const doc = await adminDb.collection('temu_import_pending').doc(token).get();
    if (!doc.exists) return NextResponse.json({ ready: false });

    const data = doc.data()!;
    if (data.expira_em < Date.now()) {
      await doc.ref.delete();
      return NextResponse.json({ ready: false });
    }

    // Apagar após ler para não reutilizar
    await doc.ref.delete();
    return NextResponse.json({ ready: true, produto: data.produto });
  } catch {
    return NextResponse.json({ ready: false });
  }
}
