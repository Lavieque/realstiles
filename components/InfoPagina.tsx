import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { ReactNode } from 'react';

// Blocos partilhados pelas páginas informativas (entregas, segurança,
// proteção de compras, empresa, parcerias, porquê escolher…).

export function InfoHero({ eyebrow, titulo, destaque, sub, children }: {
  eyebrow: string;
  titulo: string;
  destaque?: string;
  sub?: string;
  children?: ReactNode;
}) {
  return (
    <header className="info-hero">
      <div className="info-hero-inner">
        <span className="eyebrow">{eyebrow}</span>
        <h1 className="display-titulo">{titulo}{destaque && <em>{destaque}</em>}</h1>
        {sub && <p>{sub}</p>}
        {children && <div className="info-hero-acoes">{children}</div>}
      </div>
    </header>
  );
}

export function InfoSecao({ eyebrow, titulo, destaque, sub, children, tom }: {
  eyebrow?: string;
  titulo?: string;
  destaque?: string;
  sub?: string;
  children: ReactNode;
  tom?: 'sand';
}) {
  return (
    <section className={`info-secao${tom === 'sand' ? ' sand' : ''}`}>
      <div className="info-secao-inner">
        {(eyebrow || titulo) && (
          <div className="info-secao-cab">
            {eyebrow && <span className="eyebrow">{eyebrow}</span>}
            {titulo && <h2 className="display-titulo">{titulo}{destaque && <em>{destaque}</em>}</h2>}
            {sub && <p>{sub}</p>}
          </div>
        )}
        {children}
      </div>
    </section>
  );
}

export function InfoCartao({ icone, titulo, children, href, acao }: {
  icone?: ReactNode;
  titulo: string;
  children: ReactNode;
  href?: string;
  acao?: string;
}) {
  return (
    <article className="info-cartao">
      {icone && <span className="info-cartao-icone">{icone}</span>}
      <h3>{titulo}</h3>
      <p>{children}</p>
      {href && acao && <Link href={href} className="info-cartao-link">{acao} <ArrowRight size={14} strokeWidth={1.75} /></Link>}
    </article>
  );
}

export function InfoGrelha({ children, colunas = 3 }: { children: ReactNode; colunas?: 2 | 3 | 4 }) {
  return <div className={`info-grelha c${colunas}`}>{children}</div>;
}
