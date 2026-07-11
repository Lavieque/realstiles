import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

// Categorias actuais do site (fallback se a BD estiver vazia)
const DEFAULTS = [
  { nome: 'Mulher', slug: 'mulher', subcategorias: [
    { nome: 'Vestidos', slug: 'vestidos' },
    { nome: 'Camisas', slug: 'camisas' },
    { nome: 'Calças', slug: 'calças' },
    { nome: 'Casacos', slug: 'casacos' },
    { nome: 'Saias', slug: 'saias' },
    { nome: 'Acessórios', slug: 'acessórios' },
  ]},
  { nome: 'Homem', slug: 'homem', subcategorias: [
    { nome: 'Camisas', slug: 'camisas' },
    { nome: 'Calças', slug: 'calças' },
    { nome: 'Casacos', slug: 'casacos' },
    { nome: 'Sapatos', slug: 'sapatos' },
    { nome: 'Acessórios', slug: 'acessórios' },
  ]},
  { nome: 'Criança', slug: 'crianca', subcategorias: [
    { nome: 'Menina', slug: 'crianca-menina' },
    { nome: 'Menino', slug: 'crianca-menino' },
    { nome: 'Bebé', slug: 'crianca-bebe' },
    { nome: 'Calçado', slug: 'crianca-calcado' },
  ]},
  { nome: 'Desporto', slug: 'desporto', subcategorias: [
    { nome: 'Roupa', slug: 'roupa-desporto' },
    { nome: 'Calçado', slug: 'calcado-desporto' },
    { nome: 'Equipamento', slug: 'equipamento' },
  ]},
  { nome: 'Lar', slug: 'lar', subcategorias: [
    { nome: 'Decoração', slug: 'decoracao' },
    { nome: 'Cama & Banho', slug: 'cama-banho' },
    { nome: 'Cozinha', slug: 'cozinha' },
    { nome: 'Organização', slug: 'organizacao' },
  ]},
];

export async function GET() {
  try {
    const snap = await adminDb.collection('config').doc('loja').get();
    const data = snap.exists ? snap.data() : null;
    const raw = data?.categorias;
    // Se vazio ou formato antigo (strings), devolve defaults
    if (!raw || raw.length === 0 || typeof raw[0] === 'string') {
      return NextResponse.json({ categorias: DEFAULTS, seeded: true });
    }
    return NextResponse.json({ categorias: raw });
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
