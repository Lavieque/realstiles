import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const dados = await req.json();
    const ref = await adminDb.collection('produtos').add({
      ...dados,
      activo: dados.activo ?? true,
      destaque: dados.destaque ?? false,
      stock: dados.stock ?? 0,
      imagens: dados.imagens ?? [],
      tamanhos: dados.tamanhos ?? [],
      cores: dados.cores ?? [],
      tags: dados.tags ?? [],
      criado_em: FieldValue.serverTimestamp(),
    });
    return NextResponse.json({ id: ref.id });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
