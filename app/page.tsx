export const dynamic = 'force-dynamic';

import { FieldPath } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import { gerarSeedAleatoria } from '@/lib/aleatorio';
import { serializar } from '@/lib/serializar';
import ProdutoCard from '@/components/ProdutoCard';
import HeroFoto from '@/components/HeroFoto';
import Link from 'next/link';
import { ShieldCheck, ArrowRight, ChevronRight, Truck, MessageCircle } from 'lucide-react';
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

async function getCategoriasTopoSSR(): Promise<{ nome: string; slug: string }[]> {
  try {
    const db = getAdminDb();
    if (!db) return [];
    const snap = await db.collection('config').doc('loja').get();
    const lista: unknown[] = snap.data()?.categorias || [];
    return lista
      .filter((c): c is { nome: string; slug: string } => typeof c === 'object' && c !== null && 'slug' in c)
      .map(c => ({ nome: c.nome, slug: c.slug }));
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const categoriasTopo = await getCategoriasTopoSSR();
  const seed = gerarSeedAleatoria();
  const [destaques, produtosIniciais, config] = await Promise.all([
    getProdutosSSR({ destaque: true, max: 12 }),
    getProdutosAleatoriosSSR(seed, 12),
    getConfigSSR(),
  ]);

  const comImagem = destaques.filter(p => p.imagens?.[0]);

  // "Frase um. Frase dois." → segunda frase em dourado
  const [linha1, ...resto] = config.hero_titulo.split(/(?<=\.)\s+/);
  const linha2 = resto.join(' ');

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
            <div className="home-hero-botoes">
              <a href="#catalogo" className="btn-escuro">{config.hero_btn} <ArrowRight size={16} strokeWidth={1.75} /></a>
              <Link href="/entregas" className="btn-claro">Como funciona <ChevronRight size={14} strokeWidth={1.75} /></Link>
            </div>
            <div className="home-hero-garantia">
              <span><ShieldCheck size={18} strokeWidth={1.5} /></span>
              <div>Escolhes tu. Tratamos nós.<br /><small>Preços em MZN · Apoio em Chimoio</small></div>
            </div>
          </div>

          {comImagem.length > 0 && <HeroFoto destaques={comImagem} rotulo={`${config.empresa_nome} / Seleção 2026`} />}
        </div>
      </section>

      {/* ANÚNCIOS / BENEFÍCIOS */}
      <AnnouncementBar />

      {/* ENTREGAS + PORQUÊ + EQUIPA */}
      <section className="home-faixa">
        <ul className="home-faixa-inner">
          <li><Link href="/entregas"><Truck size={22} strokeWidth={1.5} /><span><strong>Como chega até ti?</strong><small>Ver entregas e preços</small></span><ChevronRight size={16} /></Link></li>
          <li><Link href="/porque-escolher"><ShieldCheck size={22} strokeWidth={1.5} /><span><strong>Porquê escolher</strong><small>a Real Stiles?</small></span><ChevronRight size={16} /></Link></li>
          <li><Link href="/ajuda"><MessageCircle size={22} strokeWidth={1.5} /><span><strong>Uma equipa próxima</strong><small>Apoio em cada etapa da compra</small></span><ChevronRight size={16} /></Link></li>
        </ul>
      </section>

      {/* CATÁLOGO */}
      <section className="home-secao" id="catalogo">
        <div className="home-secao-inner">
          <div className="home-cabecalho">
            <span className="eyebrow">A tua seleção Real Stiles</span>
          </div>
          {categoriasTopo.length > 0 && (
            <nav className="home-cats" aria-label="Categorias">
              <Link href="/" className="activo">Em destaque</Link>
              {categoriasTopo.map(c => <Link key={c.slug} href={`/loja?cat=${c.slug}`}>{c.nome}</Link>)}
            </nav>
          )}
          {produtosIniciais.length > 0 ? (
            <div className="produtos-grid">
              {produtosIniciais.slice(0, 10).map(p => <ProdutoCard key={p.id} produto={p} />)}
            </div>
          ) : (
            <p className="pol-nota">Ainda não há produtos disponíveis.</p>
          )}
          <div style={{ textAlign: 'center', marginTop: 32 }}>
            <Link href="/loja" className="btn-claro">Ver toda a seleção <ArrowRight size={16} strokeWidth={1.75} /></Link>
          </div>
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
