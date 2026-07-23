import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

async function deduzirCreditoTemu() {
  try {
    const tfUrl = process.env.TRADEFLOW_API_URL;
    const tfToken = process.env.TRADEFLOW_ADMIN_TOKEN;
    if (!tfUrl || !tfToken) return;

    const snap = await adminDb.collection('configuracoes').doc('tradeflow').get();
    const accountId = snap.data()?.account_id;
    if (!accountId) return;

    await fetch(`${tfUrl}/admin/accounts/${accountId}/credits/deduct`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-admin-token': tfToken },
      body: JSON.stringify({ amount: 1 }),
    });
  } catch {
    // fire-and-forget — não bloqueia o save do produto
  }
}

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

    if (dados.fonte === 'temu') {
      void deduzirCreditoTemu();
    }

    return NextResponse.json({ id: ref.id });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
