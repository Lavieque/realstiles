export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import { getAdminDb } from '@/lib/firebase-admin';
import { serializar } from '@/lib/serializar';
import CatalogoProdutos from '@/components/CatalogoProdutos';
import HeroSlider from '@/components/HeroSlider';
import AnnouncementBar from '@/components/AnnouncementBar';
import type { Produto } from '@/lib/produtos';

async function getProdutosSSR(opts: { destaque?: boolean; max?: number } = {}): Promise<Produto[]> {
  try {
    const db = getAdminDb();
    if (!db) return [];
    let q = db.collection('produtos').where('activo', '==', true).orderBy('criado_em', 'desc');
    if (opts.destaque !== undefined) q = q.where('destaque', '==', opts.destaque) as typeof q;
    q = q.limit(opts.max || 20) as typeof q;
    const snap = await q.get();
    return snap.docs.map(d => ({ ...serializar<Produto>(d.data()), id: d.id }));
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const [destaques, produtosIniciais] = await Promise.all([
    getProdutosSSR({ destaque: true, max: 12 }),
    getProdutosSSR({ max: 13 }),
  ]);

  const comImagem = destaques.filter(p => p.imagens?.[0]);

  return (
    <>
      {/* HERO */}
      <div className="hero-loja">
        <div className="hero-loja-content">
          <h1>Veste o teu<br/><span>estilo.</span></h1>
          <p>As melhores peças de vestuário, cuidadosamente seleccionadas para ti. Moda acessível e de qualidade.</p>
          <div className="hero-loja-btns">
            <a href="/promocoes" className="btn btn-accent">Ver promoções →</a>
            <a href="/?novo=true" className="btn btn-outline-white">Ver novidades</a>
          </div>
        </div>

        <HeroSlider destaques={comImagem} />
      </div>

      <AnnouncementBar />

      {/* CATÁLOGO */}
      <div className="catalogo-section" id="catalogo">
        <Suspense fallback={<div className="loading"><div className="spinner" /> A carregar...</div>}>
          <CatalogoProdutos inicial={produtosIniciais.slice(0, 12)} />
        </Suspense>
      </div>
    </>
  );
}
