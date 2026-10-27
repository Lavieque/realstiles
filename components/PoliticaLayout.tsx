import Link from 'next/link';
import { InfoHero } from '@/components/InfoPagina';

export interface SeccaoPolitica {
  id?: string;
  t: string;
  c: string;
}

// Layout comum às páginas de políticas e termos: cabeçalho, abas e corpo.
// O texto vem da administração (parágrafos separados por linha em branco)
// ou, se estiver vazio, das secções por defeito.
export default function PoliticaLayout({ activo, titulo, data, paragrafos, seccoes }: {
  activo: 'politicas' | 'termos';
  titulo: string;
  data: string;
  paragrafos: string[];
  seccoes: SeccaoPolitica[];
}) {
  return (
    <>
      <InfoHero eyebrow="Informação, sem complicações" titulo={titulo} sub="Condições organizadas para decidir, receber e pedir apoio.">
        <nav className="pol-abas" aria-label="Documentos" style={{ marginTop: 0 }}>
          <Link href="/politicas" className={`pol-aba${activo === 'politicas' ? ' activo' : ''}`}>Políticas da loja</Link>
          <Link href="/termos" className={`pol-aba${activo === 'termos' ? ' activo' : ''}`}>Termos e condições</Link>
          <Link href="/entregas" className="pol-aba">Entregas</Link>
        </nav>
      </InfoHero>
      <div className="pol-corpo">
        <p className="pol-nota">{data}</p>
        {paragrafos.length > 0
          ? paragrafos.map((p, i) => <p key={i} style={{ marginTop: 18 }}>{p}</p>)
          : seccoes.map(s => (
              <section key={s.t} id={s.id}>
                <h2>{s.t}</h2>
                <p>{s.c}</p>
              </section>
            ))}
      </div>
    </>
  );
}
