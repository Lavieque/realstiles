'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { MessageSquare, Check, X, Star } from 'lucide-react';
import { getComentariosPendentes, aprovarComentario, rejeitarComentario } from '@/lib/comentarios';
import type { ComentarioProduto } from '@/lib/comentarios';
import { getProduto } from '@/lib/produtos';
import { formatarData } from '@/lib/encomendas';
import { mostrarToast } from '@/components/Toast';

interface Linha extends ComentarioProduto {
  produto_nome: string;
}

function Estrelas({ valor }: { valor: number }) {
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} size={14} strokeWidth={1.5} fill={i <= valor ? '#f5b301' : 'none'} color={i <= valor ? '#f5b301' : 'var(--gray-300)'} />
      ))}
    </div>
  );
}

export default function AdminComentariosPage() {
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [loading, setLoading] = useState(true);
  const [aProcessar, setAProcessar] = useState<string | null>(null);

  const carregar = async () => {
    setLoading(true);
    try {
      const pendentes = await getComentariosPendentes();
      const comNome = await Promise.all(pendentes.map(async c => {
        const p = await getProduto(c.produto_id).catch(() => null);
        return { ...c, produto_nome: p?.nome || 'Produto removido' };
      }));
      setLinhas(comNome);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { carregar(); }, []);

  const aprovar = async (c: Linha) => {
    setAProcessar(c.id);
    try {
      await aprovarComentario(c.produto_id, c.cliente_id);
      setLinhas(ls => ls.filter(l => l.id !== c.id));
      mostrarToast('Avaliação aprovada', 'success');
    } catch {
      mostrarToast('Erro ao aprovar', 'error');
    } finally {
      setAProcessar(null);
    }
  };

  const rejeitar = async (c: Linha) => {
    if (!confirm('Rejeitar e apagar esta avaliação?')) return;
    setAProcessar(c.id);
    try {
      await rejeitarComentario(c.produto_id, c.cliente_id);
      setLinhas(ls => ls.filter(l => l.id !== c.id));
      mostrarToast('Avaliação rejeitada', 'success');
    } catch {
      mostrarToast('Erro ao rejeitar', 'error');
    } finally {
      setAProcessar(null);
    }
  };

  return (
    <>
      <div className="admin-topbar">
        <h1>Avaliações pendentes</h1>
      </div>
      <div className="admin-content">
        {loading ? (
          <div className="loading"><div className="spinner" /></div>
        ) : linhas.length === 0 ? (
          <div className="empty-state" style={{ paddingTop: 60 }}>
            <div className="icon"><MessageSquare size={40} strokeWidth={1.5} /></div>
            <h3>Sem avaliações por aprovar</h3>
            <p>Novas avaliações de clientes aparecem aqui antes de ficarem visíveis na loja.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 760 }}>
            {linhas.map(c => (
              <div key={c.id} className="form-card" style={{ margin: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div>
                    <Link href={`/produto/${c.produto_id}`} target="_blank" style={{ fontWeight: 600, fontSize: 14, color: 'var(--black)' }}>
                      {c.produto_nome}
                    </Link>
                    <p style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 2 }}>
                      {c.cliente_nome} · {formatarData(c.criado_em)}
                    </p>
                  </div>
                  <Estrelas valor={c.estrelas} />
                </div>
                {c.texto && <p style={{ fontSize: 14, color: 'var(--gray-700)', lineHeight: 1.6, marginBottom: 14 }}>{c.texto}</p>}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary btn-sm" onClick={() => aprovar(c)} disabled={aProcessar === c.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Check size={14} strokeWidth={2} /> Aprovar
                  </button>
                  <button className="btn btn-outline btn-sm" onClick={() => rejeitar(c)} disabled={aProcessar === c.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <X size={14} strokeWidth={2} /> Rejeitar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
