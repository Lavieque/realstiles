import Link from 'next/link';
import { InfoHero } from '@/components/InfoPagina';
import { ABAS_POLITICAS } from '@/lib/politicas';
import type { Documento, IdDocumento } from '@/lib/politicas';

// Layout comum aos documentos legais: cabeçalho, separadores e corpo.
// O texto vem de lib/politicas (por defeito) ou da administração.
export default function PoliticaLayout({ doc, data }: { doc: Documento; data: string }) {
  const href = (id: IdDocumento) => (id === 'termos' ? '/termos' : `/politicas?tab=${id}`);

  return (
    <>
      <InfoHero eyebrow="Informação, sem complicações" titulo="Comprar com " destaque="clareza." sub="Condições organizadas para decidir, receber e pedir apoio.">
        <nav className="pol-abas" aria-label="Documentos" style={{ marginTop: 0 }}>
          {ABAS_POLITICAS.slice(0, 1).map(a => (
            <Link key={a.id} href={href(a.id)} className={`pol-aba${doc.id === a.id ? ' activo' : ''}`}>{a.aba}</Link>
          ))}
          <Link href="/entregas" className="pol-aba">Entregas</Link>
          {ABAS_POLITICAS.slice(1).map(a => (
            <Link key={a.id} href={href(a.id)} className={`pol-aba${doc.id === a.id ? ' activo' : ''}`}>{a.aba}</Link>
          ))}
        </nav>
      </InfoHero>
      <div className="pol-corpo">
        <p className="pol-nota">{data}</p>
        <h2 style={{ marginTop: 18 }}>{doc.titulo}</h2>
        {doc.seccoes.map((s, i) => (
          <section key={i}>
            {s.t && <h3>{s.t}</h3>}
            {s.c && <p>{s.c}</p>}
          </section>
        ))}
        <p className="pol-nota" style={{ marginTop: 32 }}>
          Precisas de esclarecer uma condição? <Link href="/ajuda" style={{ color: 'var(--black)', fontWeight: 600 }}>Fala com a equipa</Link>.
        </p>
      </div>
    </>
  );
}
