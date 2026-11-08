export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import Link from 'next/link';
import { getOpinioes } from '@/lib/opinioes';
import Estrelas from '@/components/Estrelas';
import { InfoHero, InfoSecao, InfoGrelha } from '@/components/InfoPagina';

export const metadata: Metadata = {
  title: 'Opiniões dos produtos — Real Stiles',
  description: 'Avaliações de quem já recebeu os seus artigos.',
};

export default async function OpinioesPage() {
  const opinioes = await getOpinioes();
  const media = opinioes.length ? opinioes.reduce((s, o) => s + o.estrelas, 0) / opinioes.length : 0;

  return (
    <>
      <InfoHero
        eyebrow="A tua experiência conta"
        titulo="Opiniões "
        destaque="dos produtos."
        sub="Avaliações de quem já recebeu os seus artigos."
      >
        {opinioes.length > 0 && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, fontSize: 14, color: 'var(--muted)' }}>
            <Estrelas valor={media} tamanho={18} /> {media.toFixed(1)} · {opinioes.length} opinião{opinioes.length !== 1 ? 'ões' : ''}
          </span>
        )}
      </InfoHero>

      <InfoSecao>
        {opinioes.length === 0 ? (
          <div className="empty-state">
            <h3>Ainda sem opiniões</h3>
            <p>As avaliações aparecem aqui depois de os clientes receberem as suas encomendas.</p>
            <Link href="/loja" className="btn-escuro" style={{ marginTop: 24 }}>Explorar a coleção</Link>
          </div>
        ) : (
          <InfoGrelha colunas={3}>
            {opinioes.map(o => (
              <article key={o.id} className="opiniao">
                <div className="opiniao-topo"><strong>{o.cliente_nome}</strong>{o.criado_em > 0 && <span>{new Date(o.criado_em).toLocaleDateString('pt-MZ', { day: '2-digit', month: 'short', year: 'numeric' })}</span>}</div>
                <Estrelas valor={o.estrelas} tamanho={14} />
                {o.texto && <p>{o.texto}</p>}
                <Link href={`/produto/${o.produto_id}`}>{o.produto_nome} →</Link>
              </article>
            ))}
          </InfoGrelha>
        )}
      </InfoSecao>
    </>
  );
}
