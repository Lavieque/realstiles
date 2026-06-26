export const dynamic = 'force-dynamic';

import { getAdminDb } from '@/lib/firebase-admin';
import ProdutoCard from '@/components/ProdutoCard';
import type { Produto } from '@/lib/produtos';

async function getProdutosEmPromocao(): Promise<Produto[]> {
  try {
    const db = getAdminDb();
    if (!db) return [];
    const snap = await db.collection('produtos')
      .where('activo', '==', true)
      .orderBy('criado_em', 'desc')
      .get();
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() } as Produto))
      .filter(p => p.preco_original && p.preco_original > p.preco);
  } catch {
    return [];
  }
}

export const metadata = {
  title: 'Promoções — Real Stiles',
  description: 'Os melhores descontos da loja Real Stiles.',
};

export default async function PromocoesPage() {
  const produtos = await getProdutosEmPromocao();

  return (
    <div className="page-wrapper">
      <div className="container">
        <div className="page-header">
          <h1>Promoções</h1>
          <p>Os melhores descontos, só por tempo limitado</p>
        </div>

        {produtos.length === 0 ? (
          <div className="empty-state">
            <div className="icon">🏷️</div>
            <h3>Sem promoções activas</h3>
            <p>Volta em breve para novas ofertas.</p>
          </div>
        ) : (
          <div className="produtos-grid">
            {produtos.map(p => <ProdutoCard key={p.id} produto={p} />)}
          </div>
        )}
      </div>
    </div>
  );
}
