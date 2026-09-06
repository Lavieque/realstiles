export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import { getAdminDb } from '@/lib/firebase-admin';
import { serializar } from '@/lib/serializar';
import CatalogoProdutos from '@/components/CatalogoProdutos';
import HeroSlider from '@/components/HeroSlider';
import AnnouncementBar from '@/components/AnnouncementBar';
import { getConfigSSR } from '@/lib/config-site-ssr';
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

async function getCategoriasSSR(): Promise<string[]> {
  try {
    const db = getAdminDb();
    if (!db) return [];
    const snap = await db.collection('config').doc('loja').get();
    return snap.exists ? (snap.data()?.categorias_ativas || []) : [];
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const [destaques, produtosIniciais, categorias, config] = await Promise.all([
    getProdutosSSR({ destaque: true, max: 12 }),
    getProdutosSSR({ max: 13 }),
    getCategoriasSSR(),
    getConfigSSR(),
  ]);

  const comImagem = destaques.filter(p => p.imagens?.[0]);

  return (
    <>
      {/* HERO */}
      <div className="hero-loja">
        <div className="hero-loja-inner">
          <div className="hero-loja-content">
            <h1>{config.hero_titulo}</h1>
            <p>{config.hero_subtitulo}</p>
            <div className="hero-loja-btns">
              <a href="/promocoes" className="btn btn-accent">{config.hero_btn} →</a>
              <a href="/?novo=true" className="btn btn-outline-white">Ver novidades</a>
            </div>
          </div>
          <HeroSlider destaques={comImagem} />
        </div>
      </div>

      {/* ANÚNCIOS / BENEFÍCIOS */}
      <AnnouncementBar />

      {/* CATÁLOGO */}
      <div className="catalogo-section" id="catalogo">
        <Suspense fallback={<div className="loading"><div className="spinner" /> A carregar...</div>}>
          <CatalogoProdutos inicial={produtosIniciais.slice(0, 12)} categoriasIniciais={categorias} tituloDefault={config.catalogo_titulo} />
        </Suspense>
      </div>
    </>
  );
}
