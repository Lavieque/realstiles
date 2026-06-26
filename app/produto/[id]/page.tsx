export const dynamic = 'force-dynamic';

import { getAdminDb } from '@/lib/firebase-admin';
import ProdutoDetalhe from './ProdutoDetalhe';
import type { Produto } from '@/lib/produtos';
import type { Metadata } from 'next';

async function getProduto(id: string): Promise<Produto | null> {
  try {
    const db = getAdminDb();
    if (!db) return null;
    const snap = await db.collection('produtos').doc(id).get();
    return snap.exists ? ({ id: snap.id, ...snap.data() } as Produto) : null;
  } catch {
    return null;
  }
}

async function getProdutosRelacionados(produto: Produto): Promise<Produto[]> {
  try {
    const db = getAdminDb();
    if (!db) return [];
    const snap = await db.collection('produtos')
      .where('activo', '==', true)
      .where('categoria', '==', produto.categoria || '')
      .limit(5)
      .get();
    return snap.docs
      .filter(d => d.id !== produto.id)
      .slice(0, 4)
      .map(d => ({ id: d.id, ...d.data() } as Produto));
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
  if (!produto) return (
    <div className="page-wrapper">
      <div className="container">
        <div className="empty-state" style={{ paddingTop: 80 }}>
          <div className="icon">😕</div>
          <h3>Produto não encontrado</h3>
          <p>Este produto pode ter sido removido.</p>
          <a href="/" className="btn btn-primary" style={{ marginTop: 20 }}>Voltar à loja</a>
        </div>
      </div>
    </div>
  );

  const relacionados = await getProdutosRelacionados(produto);
  return <ProdutoDetalhe produto={produto} relacionados={relacionados} />;
}
