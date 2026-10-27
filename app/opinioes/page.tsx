export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import Link from 'next/link';
import { getAdminDb } from '@/lib/firebase-admin';
import { serializar } from '@/lib/serializar';
import Estrelas from '@/components/Estrelas';
import { InfoHero, InfoSecao, InfoGrelha } from '@/components/InfoPagina';

export const metadata: Metadata = {
  title: 'Opiniões dos clientes — Real Stiles',
  description: 'Avaliações de quem já recebeu os seus artigos.',
};

interface Opiniao {
  id: string;
  produto_id: string;
  produto_nome: string;
  cliente_nome: string;
  texto: string;
  estrelas: number;
  criado_em: number;
}

// Avaliações aprovadas. Só percorre os produtos que já têm avaliações
// (num_avaliacoes) em vez de depender de uma consulta de grupo de colecções.
async function getOpinioes(): Promise<Opiniao[]> {
  try {
    const db = getAdminDb();
    if (!db) return [];
    const produtos = await db.collection('produtos').where('activo', '==', true).get();
    const comAvaliacoes = produtos.docs.filter(d => Number(d.data().num_avaliacoes) > 0).slice(0, 60);
    const listas = await Promise.all(comAvaliacoes.map(async p => {
      const snap = await p.ref.collection('comentarios').where('estado', '==', 'aprovado').get();
      return snap.docs.map(c => {
        const d = serializar<Record<string, unknown>>(c.data());
        return {
          id: `${p.id}_${c.id}`,
          produto_id: p.id,
          produto_nome: String(p.data().nome || ''),
          cliente_nome: String(d.cliente_nome || 'Cliente'),
          texto: String(d.texto || ''),
          estrelas: Number(d.estrelas) || 0,
          criado_em: Number(d.criado_em) || 0,
        } as Opiniao;
      });
    }));
    return listas.flat().sort((a, b) => b.criado_em - a.criado_em).slice(0, 48);
  } catch (e) {
    console.error('[opinioes]', e);
    return [];
  }
}

export default async function OpinioesPage() {
  const opinioes = await getOpinioes();
  const media = opinioes.length ? opinioes.reduce((s, o) => s + o.estrelas, 0) / opinioes.length : 0;

  return (
    <>
      <InfoHero
        eyebrow="A tua experiência conta"
        titulo="Opiniões "
        destaque="dos clientes."
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
