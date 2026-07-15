export const dynamic = 'force-dynamic';

import { cache } from 'react';
import { getAdminDb } from '@/lib/firebase-admin';
import { serializar } from '@/lib/serializar';
import ProdutoDetalhe from './ProdutoDetalhe';
import type { Produto } from '@/lib/produtos';
import type { Metadata } from 'next';

const getProduto = cache(async (id: string): Promise<Produto | null> => {
  try {
    const db = getAdminDb();
    if (!db) return null;
    const snap = await db.collection('produtos').doc(id).get();
    if (!snap.exists) return null;
    return { ...serializar<Produto>(snap.data()!), id: snap.id };
  } catch {
    return null;
  }
}

});

async function getProdutosRelacionados(produto: Produto): Promise<Produto[]> {
  try {
    const db = getAdminDb();
    if (!db) return [];

    // 1.ª tentativa: mesma categoria
    const snapCat = await db.collection('produtos')
      .where('activo', '==', true)
      .where('categoria', '==', produto.categoria || '')
      .limit(5)
      .get();
    const daCat = snapCat.docs
      .filter(d => d.id !== produto.id)
      .slice(0, 4)
      .map(d => ({ ...serializar<Produto>(d.data()), id: d.id }));

    if (daCat.length >= 4) return daCat;

    // 2.ª tentativa: completar com outros produtos (excluindo já obtidos + o actual)
    const excluir = new Set([produto.id, ...daCat.map(p => p.id)]);
    const snapResto = await db.collection('produtos')
      .where('activo', '==', true)
      .limit(4 - daCat.length + excluir.size)
      .get();
    const extras = snapResto.docs
      .filter(d => !excluir.has(d.id))
      .slice(0, 4 - daCat.length)
      .map(d => ({ ...serializar<Produto>(d.data()), id: d.id }));

    return [...daCat, ...extras];
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  try {
    const produto = await getProduto(params.id);
    if (!produto) return { title: 'Produto não encontrado — Real Stiles' };
    return {
      title: `${produto.nome} — Real Stiles`,
      description: produto.descricao || `${produto.nome} por ${produto.preco?.toFixed(2)} MZN`,
      openGraph: { images: produto.imagens?.[0] ? [produto.imagens[0]] : [] },
    };
  } catch {
    return { title: 'Real Stiles' };
  }
}

export default async function ProdutoPage({ params }: { params: { id: string } }) {
  const produto = await getProduto(params.id);
  // Se Admin SDK não estiver configurado, passa null — ProdutoDetalhe carrega via client SDK
  const relacionados = produto ? await getProdutosRelacionados(produto) : [];
  return <ProdutoDetalhe id={params.id} produto={produto} relacionados={relacionados} />;
}
