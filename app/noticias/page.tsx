export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import Link from 'next/link';
import Image from '@/components/CloudImage';
import { getNoticias } from '@/lib/noticias';
import type { Noticia } from '@/lib/noticias';
import { InfoHero, InfoSecao, InfoGrelha } from '@/components/InfoPagina';

export const metadata: Metadata = {
  title: 'Notícias e imprensa — Real Stiles',
  description: 'Guias, histórias da equipa e a presença da Real Stiles na comunidade.',
};

function Cartao({ n }: { n: Noticia }) {
  return (
    <article className="info-cartao" style={{ padding: 0, overflow: 'hidden' }}>
      {n.imagem && (
        <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 10', background: 'var(--sand)' }}>
          <Image src={n.imagem} alt="" fill style={{ objectFit: 'cover' }} sizes="(max-width: 900px) 100vw, 33vw" />
        </div>
      )}
      <div style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start' }}>
        {(n.categoria || n.data) && <span className="eyebrow" style={{ fontSize: 10 }}>{[n.categoria, n.data].filter(Boolean).join(' · ')}</span>}
        <h3>{n.titulo}</h3>
        {n.resumo && <p>{n.resumo}</p>}
        {n.corpo && <Link className="info-cartao-link" href={`/noticias/${n.id}`}>Ler artigo →</Link>}
        {n.link && <a className="info-cartao-link" href={n.link} target="_blank" rel="noopener noreferrer">Ver publicação →</a>}
      </div>
    </article>
  );
}

export default async function NoticiasPage() {
  const todas = await getNoticias();
  const artigos = todas.filter(n => n.tipo !== 'imprensa');
  const imprensa = todas.filter(n => n.tipo === 'imprensa');

  return (
    <>
      <InfoHero
        eyebrow="Real Stiles · Em comunidade"
        titulo="Notícias e "
        destaque="imprensa local."
        sub="Guias, histórias da equipa e a nossa presença nos meios de comunicação."
      />

      <InfoSecao>
        {artigos.length === 0 ? (
          <div className="empty-state">
            <h3>Em breve</h3>
            <p>Estamos a preparar os primeiros guias e histórias. Volta em breve.</p>
          </div>
        ) : (
          <InfoGrelha colunas={3}>{artigos.map(n => <Cartao key={n.id} n={n} />)}</InfoGrelha>
        )}
      </InfoSecao>

      <InfoSecao tom="sand" eyebrow="A nossa presença na comunidade" titulo="Imprensa " destaque="local." sub="Histórias, entrevistas e referências à Real Stiles nos meios de comunicação de Moçambique.">
        {imprensa.length === 0 ? (
          <p className="pol-nota">Ainda sem referências de imprensa adicionadas. Para contactos de imprensa, <Link href="/ajuda" style={{ color: 'var(--black)', fontWeight: 600 }}>fala com a equipa</Link>.</p>
        ) : (
          <InfoGrelha colunas={3}>{imprensa.map(n => <Cartao key={n.id} n={n} />)}</InfoGrelha>
        )}
      </InfoSecao>
    </>
  );
}
