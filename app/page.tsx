export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import { FieldPath } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import { gerarSeedAleatoria } from '@/lib/aleatorio';
import { serializar } from '@/lib/serializar';
import CatalogoProdutos from '@/components/CatalogoProdutos';
import Image from '@/components/CloudImage';
import Link from 'next/link';
import { Sparkles, ShieldCheck, ArrowRight, Truck, MessageCircle } from 'lucide-react';
import AnnouncementBar from '@/components/AnnouncementBar';
import { getConfigSSR } from '@/lib/config-site-ssr';
import type { Produto } from '@/lib/produtos';

async function getProdutosSSR(opts: { destaque?: boolean; max?: number } = {}): Promise<Produto[]> {
  try {
    const db = getAdminDb();
    if (!db) return [];
    // 'activo' + 'destaque' + orderBy exigiria um índice composto que não
    // existe — filtra por destaque sem orderBy e ordena depois em memória.
    const comDestaque = opts.destaque !== undefined;
    let q = db.collection('produtos').where('activo', '==', true);
    if (comDestaque) q = q.where('destaque', '==', opts.destaque) as typeof q;
    if (!comDestaque) q = q.orderBy('criado_em', 'desc') as typeof q;
    q = q.limit(opts.max || 20) as typeof q;
    const snap = await q.get();
    const produtos = snap.docs.map(d => ({ ...serializar<Produto>(d.data()), id: d.id }));
    if (!comDestaque) return produtos;
    // serializar() já converteu criado_em num número (ms) antes de chegar aqui
    return produtos.sort((a, b) => (Number(b.criado_em) || 0) - (Number(a.criado_em) || 0));
  } catch {
    return [];
  }
}

// Mesma lógica de getProdutosAleatorios (lib/produtos) com o Admin SDK:
// a partir da seed por ordem de ID, dando a volta ao início se faltar.
async function getProdutosAleatoriosSSR(seed: string, max: number): Promise<Produto[]> {
  try {
    const db = getAdminDb();
    if (!db) return [];
    const base = db.collection('produtos').where('activo', '==', true).orderBy(FieldPath.documentId());
    const snap = await base.startAt(seed).limit(max).get();
    let docs = snap.docs;
    if (docs.length < max) {
      const volta = await base.endBefore(seed).limit(max - docs.length).get();
      docs = [...docs, ...volta.docs];
    }
    return docs.map(d => ({ ...serializar<Produto>(d.data()), id: d.id }));
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
  const seed = gerarSeedAleatoria();
  const [destaques, produtosIniciais, categorias, config] = await Promise.all([
    getProdutosSSR({ destaque: true, max: 12 }),
    getProdutosAleatoriosSSR(seed, 12),
    getCategoriasSSR(),
    getConfigSSR(),
  ]);

  const comImagem = destaques.filter(p => p.imagens?.[0]);

  // "Frase um. Frase dois." → segunda frase em dourado
  const [linha1, ...resto] = config.hero_titulo.split(/(?<=\.)\s+/);
  const linha2 = resto.join(' ');
  const foto = comImagem[0];
  const cartao = comImagem[1];

  return (
    <>
      {/* HERO */}
      <section className="home-hero">
        <div className="home-hero-inner">
          <div className="home-hero-texto">
            <span className="eyebrow">O teu mundo, o teu estilo</span>
            <h1 className="display-titulo">
              {linha1}
              {linha2 && <em>{linha2}</em>}
            </h1>
            <p>{config.hero_subtitulo}</p>
            <a href="#catalogo" className="btn-escuro">{config.hero_btn} <ArrowRight size={16} strokeWidth={1.75} /></a>
            <div className="home-hero-garantia">
              <span><ShieldCheck size={18} strokeWidth={1.5} /></span>
              Escolhes tu. Tratamos nós.
            </div>
          </div>

          <div className="home-hero-visual">
            <div className="home-hero-foto">
              {foto && <Image src={foto.imagens[0]} alt={foto.nome} fill priority style={{ objectFit: 'cover' }} sizes="(max-width: 860px) 100vw, 50vw" />}
            </div>
            <div className="home-hero-selo" aria-hidden="true">
              <Sparkles size={14} strokeWidth={1.5} />
              <span>Estilo</span><span>Qualidade</span><span>Confiança</span>
            </div>
            {cartao && (
              <Link href={`/produto/${cartao.id}`} className="home-hero-cartao">
                <div className="home-hero-cartao-img">
                  <Image src={cartao.imagens[0]} alt="" fill style={{ objectFit: 'cover' }} sizes="84px" />
                </div>
                <div>
                  <small>Pequenos detalhes</small>
                  <strong>{cartao.nome}</strong>
                  <span>Descobrir <ArrowRight size={13} strokeWidth={1.75} /></span>
                </div>
              </Link>
            )}
            <span className="home-hero-lateral">{config.empresa_nome} / Seleção 2026</span>
          </div>
        </div>
      </section>

      {/* ANÚNCIOS / BENEFÍCIOS */}
      <AnnouncementBar />

      {/* ENTREGAS + PORQUÊ */}
      <section className="home-secao">
        <div className="home-secao-inner home-duo">
          <div className="home-bloco">
            <span className="eyebrow">Entregas</span>
            <h2 className="display-titulo">Como chega <em>até ti?</em></h2>
            <p>Recolha na loja, levantamento em terminal ou entrega na morada. Consulta o custo antes de encomendar.</p>
            <Link href="/entregas" className="btn-claro"><Truck size={16} strokeWidth={1.5} /> Ver entregas e preços</Link>
          </div>
          <div className="home-bloco escuro">
            <span className="eyebrow">Uma equipa próxima</span>
            <h2 className="display-titulo">Porquê escolher <em>a Real Stiles?</em></h2>
            <p>Apoio em cada etapa da compra, da primeira escolha à entrega.</p>
            <Link href="/porque-escolher" className="btn-claro">Saber mais <ArrowRight size={16} strokeWidth={1.75} /></Link>
          </div>
        </div>
      </section>

      {/* CATÁLOGO */}
      <section className="home-secao" id="catalogo">
        <div className="home-secao-inner">
          <div className="home-cabecalho">
            <span className="eyebrow">A tua seleção Real Stiles</span>
          </div>
          <Suspense fallback={<div className="loading"><div className="spinner" /> A carregar...</div>}>
            <CatalogoProdutos inicial={produtosIniciais} seedInicial={seed} categoriasIniciais={categorias} tituloDefault={config.catalogo_titulo} />
          </Suspense>
        </div>
      </section>

      {/* AJUDA */}
      <section className="home-ajuda">
        <div className="home-ajuda-inner">
          <div>
            <h2>Precisas de uma mão?</h2>
            <p>Ajudamos a encontrar o produto certo e a esclarecer as tuas dúvidas.</p>
          </div>
          <a href="https://wa.me/258878753754" target="_blank" rel="noopener noreferrer" className="btn-escuro">
            <MessageCircle size={16} strokeWidth={1.5} /> Falar com a equipa
          </a>
        </div>
      </section>
    </>
  );
}
