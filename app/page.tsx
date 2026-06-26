export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import Link from 'next/link';
import { getAdminDb } from '@/lib/firebase-admin';
import ProdutoCard from '@/components/ProdutoCard';
import CatalogoProdutos from '@/components/CatalogoProdutos';
import HeroSlider from '@/components/HeroSlider';
import type { Produto } from '@/lib/produtos';

async function getProdutosSSR(opts: { destaque?: boolean; max?: number } = {}): Promise<Produto[]> {
  try {
    const db = getAdminDb();
    if (!db) return [];
    let q = db.collection('produtos').where('activo', '==', true).orderBy('criado_em', 'desc');
    if (opts.destaque !== undefined) q = q.where('destaque', '==', opts.destaque) as typeof q;
    q = q.limit(opts.max || 20) as typeof q;
    const snap = await q.get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Produto));
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
      <section style={{ background: 'var(--black)', color: 'white', minHeight: 'calc(var(--nav-h) + 420px)', display: 'grid', gridTemplateColumns: '1fr 1fr', overflow: 'hidden', position: 'relative' }}>
        <div style={{ padding: 'calc(var(--nav-h) + 60px) 6% 60px', display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
          <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.15em', color: 'var(--accent)', textTransform: 'uppercase', marginBottom: 16 }}>
            Nova Colecção
          </p>
          <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(2rem, 4vw, 3.2rem)', fontWeight: 700, lineHeight: 1.1, marginBottom: 20 }}>
            Veste o teu estilo.
          </h1>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.7)', lineHeight: 1.7, marginBottom: 32, maxWidth: 380 }}>
            As melhores peças de vestuário, cuidadosamente seleccionadas para ti.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Link href="#catalogo" className="btn btn-accent btn-lg">Ver colecção</Link>
            <Link href="/quem-somos" className="btn btn-outline btn-lg" style={{ color: 'white', borderColor: 'rgba(255,255,255,0.3)' }}>Quem somos</Link>
          </div>
        </div>

        {comImagem.length > 0 && (
          <HeroSlider destaques={comImagem} />
        )}
      </section>

      {/* CATÁLOGO */}
      <section id="catalogo" className="page-wrapper">
        <div className="container">
          <div className="page-header">
            <h1>Todos os produtos</h1>
            <p>Encontra o teu estilo entre a nossa colecção</p>
          </div>
          <Suspense fallback={<div className="loading"><div className="spinner" /> A carregar...</div>}>
            <CatalogoProdutos inicial={produtosIniciais.slice(0, 12)} />
          </Suspense>
        </div>
      </section>
    </>
  );
}
