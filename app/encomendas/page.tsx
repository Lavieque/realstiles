'use client';
import { useState, useEffect, useMemo } from 'react';
import Image from '@/components/CloudImage';
import Link from 'next/link';
import { onAuthChange } from '@/lib/auth';
import { getEncomendasCliente, badgeEstadoClass, badgeEstadoLabel, formatarData, referenciaEncomenda } from '@/lib/encomendas';
import type { Encomenda, EstadoEncomenda } from '@/lib/encomendas';
import type { User } from 'firebase/auth';
import { Lock, Package, MessageCircle } from 'lucide-react';

const ESTADOS = ['', 'pendente', 'confirmada', 'enviada', 'entregue', 'cancelada'];
const ESTADO_LABEL: Record<string, string> = {
  '': 'Todas', pendente: 'Pendentes', confirmada: 'Confirmadas',
  enviada: 'Enviadas', entregue: 'Entregues', cancelada: 'Canceladas',
};
const PAGE_SIZE = 8;

export default function EncomendasPage() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [encomendas, setEncomendas] = useState<Encomenda[]>([]);
  const [filtro, setFiltro] = useState('');
  const [ordem, setOrdem] = useState<'data_desc' | 'data_asc' | 'valor_desc' | 'valor_asc'>('data_desc');
  const [pagina, setPagina] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthChange(async (u) => {
      setUser(u);
      if (!u) { setLoading(false); return; }
      const enc = await getEncomendasCliente(u.uid);
      setEncomendas(enc);
      setLoading(false);
    });
    return unsub;
  }, []);

  const contadores = useMemo(() => {
    const c: Record<string, number> = { '': encomendas.length };
    encomendas.forEach(e => { c[e.estado] = (c[e.estado] || 0) + 1; });
    return c;
  }, [encomendas]);

  const filtradas = useMemo(() => {
    let lista = filtro ? encomendas.filter(e => e.estado === filtro) : encomendas;
    lista = [...lista].sort((a, b) => {
      const toMs = (v: unknown) => {
        if (!v) return 0;
        if (typeof (v as any).toMillis === 'function') return (v as any).toMillis();
        return new Date(v as string).getTime();
      };
      switch (ordem) {
        case 'data_asc':  return toMs(a.criado_em) - toMs(b.criado_em);
        case 'valor_desc': return (b.total || 0) - (a.total || 0);
        case 'valor_asc':  return (a.total || 0) - (b.total || 0);
        default:           return toMs(b.criado_em) - toMs(a.criado_em);
      }
    });
    return lista;
  }, [encomendas, filtro, ordem]);

  const totalPaginas = Math.ceil(filtradas.length / PAGE_SIZE);
  const visiveis = filtradas.slice(0, pagina * PAGE_SIZE);
  const temMais = pagina < totalPaginas;

  const mudarFiltro = (f: string) => { setFiltro(f); setPagina(1); };

  if (user === undefined || loading) {
    return <div className="page-wrapper"><div className="container"><div className="loading"><div className="spinner" /> A carregar...</div></div></div>;
  }

  if (!user) {
    return (
      <div className="page-wrapper">
        <div className="container">
          <div className="empty-state" style={{ paddingTop: 80 }}>
            <div className="icon"><Lock size={40} strokeWidth={1.5} /></div>
            <h3>Acesso restrito</h3>
            <p>Tens de entrar na tua conta para ver as encomendas.</p>
            <Link href="/conta?redirect=/encomendas" className="btn btn-primary" style={{ marginTop: 20 }}>Entrar</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrapper">
      <div className="container">
        <div className="page-header">
          <h1>As minhas encomendas</h1>
          <p>{encomendas.length} encomenda{encomendas.length !== 1 ? 's' : ''} no total</p>
        </div>

        {/* Filtros com contadores */}
        <div className="enc-filtros-wrap">
          <div className="filtros-estado">
            {ESTADOS.map(e => (
              <button
                key={e}
                className={`filtro-estado-btn${filtro === e ? ' active' : ''}`}
                onClick={() => mudarFiltro(e)}
              >
                {ESTADO_LABEL[e]}
                {(contadores[e] || 0) > 0 && (
                  <span className="filtro-estado-count">{contadores[e]}</span>
                )}
              </button>
            ))}
          </div>

          {/* Ordenação */}
          <select
            className="enc-ordem-select"
            value={ordem}
            onChange={e => setOrdem(e.target.value as typeof ordem)}
          >
            <option value="data_desc">Mais recentes</option>
            <option value="data_asc">Mais antigas</option>
            <option value="valor_desc">Maior valor</option>
            <option value="valor_asc">Menor valor</option>
          </select>
        </div>

        {visiveis.length === 0 ? (
          <div className="empty-state">
            <div className="icon"><Package size={40} strokeWidth={1.5} /></div>
            <h3>{filtro ? 'Sem encomendas nesta categoria' : 'Sem encomendas'}</h3>
            <p>{filtro ? 'Tenta outro filtro.' : 'Ainda não fizeste nenhuma encomenda.'}</p>
            <Link href="/" className="btn btn-primary" style={{ marginTop: 20 }}>Ver produtos</Link>
          </div>
        ) : (
          <>
            <div className="enc-lista">{visiveis.map(enc => (
                <div key={enc.id} className="enc-row">
                  {/* Miniaturas */}
                  <div className="enc-row-imgs">
                    {enc.itens?.slice(0, 3).map((item, i) => (
                      <Image
                        key={i}
                        src={item.imagem || '/placeholder.svg'}
                        alt={item.nome}
                        width={44} height={56}
                        style={{ objectFit: 'cover', borderRadius: 6, flexShrink: 0 }}
                      />
                    ))}
                    {(enc.itens?.length || 0) > 3 && (
                      <div className="enc-row-mais">+{enc.itens!.length - 3}</div>
                    )}
                  </div>

                  {/* Info principal */}
                  <div className="enc-row-info">
                    <div className="enc-row-top">
                      <code className="enc-row-ref">{referenciaEncomenda(enc)}</code>
                      <span className="enc-row-data">{formatarData(enc.criado_em)}</span>
                    </div>
                    <div className="enc-row-artigos">
                      {enc.itens?.map(i => i.nome).join(', ').substring(0, 60) || '—'}
                      {(enc.itens?.map(i => i.nome).join(', ').length || 0) > 60 ? '…' : ''}
                    </div>
                    {enc.notas_admin && (
                      <div className="enc-row-nota" style={{ display: 'flex', alignItems: 'center', gap: 4 }}><MessageCircle size={13} strokeWidth={1.5} /> {enc.notas_admin}</div>
                    )}
                  </div>

                  {/* Estado + total + acção */}
                  <div className="enc-row-direita">
                    <span className={`badge-estado ${badgeEstadoClass(enc.estado as EstadoEncomenda)}`}>
                      {badgeEstadoLabel(enc.estado as EstadoEncomenda)}
                    </span>
                    <strong className="enc-row-total">{enc.total?.toFixed(2)} MZN</strong>
                    <Link href={`/encomenda/${enc.id}`} className="btn btn-outline btn-sm">Ver →</Link>
                  </div>
                </div>
              ))}
            </div>

            {temMais && (
              <div style={{ textAlign: 'center', marginTop: 24 }}>
                <button className="btn btn-outline" onClick={() => setPagina(p => p + 1)}>
                  Ver mais ({filtradas.length - visiveis.length} restantes)
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
