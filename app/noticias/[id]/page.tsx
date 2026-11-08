export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Image from '@/components/CloudImage';
import { getNoticias } from '@/lib/noticias';
import { lerConteudo } from '@/lib/politicas';
import { InfoHero, InfoAjuda } from '@/components/InfoPagina';

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const n = (await getNoticias()).find(x => x.id === params.id);
  return n ? { title: `${n.titulo} — Real Stiles`, description: n.resumo } : { title: 'Notícias — Real Stiles' };
}

export default async function NoticiaPage({ params }: { params: { id: string } }) {
  const n = (await getNoticias()).find(x => x.id === params.id);
  if (!n) notFound();

  const seccoes = lerConteudo(n.corpo || '');

  return (
    <>
      <InfoHero eyebrow={[n.categoria || 'Notícias', n.data].filter(Boolean).join(' · ')} titulo={n.titulo}>
        {n.resumo && <p style={{ maxWidth: 640, margin: 0 }}>{n.resumo}</p>}
      </InfoHero>

      <article className="pol-corpo">
        {n.imagem && (
          <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', background: 'var(--sand)', borderRadius: 10, overflow: 'hidden', marginBottom: 24 }}>
            <Image src={n.imagem} alt="" fill priority style={{ objectFit: 'cover' }} sizes="(max-width: 900px) 100vw, 900px" />
          </div>
        )}
        {seccoes.map((s, i) => (
          <section key={i}>
            {s.t && <h3>{s.t}</h3>}
            {s.c && <p style={{ whiteSpace: 'pre-line' }}>{s.c}</p>}
          </section>
        ))}
        {n.link && <p><a className="info-cartao-link" href={n.link} target="_blank" rel="noopener noreferrer">Ver publicação original →</a></p>}
        <p style={{ marginTop: 32 }}>
          <Link href="/noticias" className="info-cartao-link"><ArrowLeft size={14} strokeWidth={1.75} /> Voltar às notícias</Link>
        </p>
      </article>

      <InfoAjuda />
    </>
  );
}
