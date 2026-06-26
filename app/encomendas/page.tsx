'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { onAuthChange } from '@/lib/auth';
import { getEncomendasCliente, badgeEstadoClass, badgeEstadoLabel, formatarData } from '@/lib/encomendas';
import type { Encomenda, EstadoEncomenda } from '@/lib/encomendas';
import type { User } from 'firebase/auth';

export default function EncomendasPage() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [encomendas, setEncomendas] = useState<Encomenda[]>([]);
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

  if (user === undefined || loading) {
    return <div className="page-wrapper"><div className="container"><div className="loading"><div className="spinner" /> A carregar...</div></div></div>;
  }

  if (!user) {
    return (
      <div className="page-wrapper">
        <div className="container">
          <div className="empty-state" style={{ paddingTop: 80 }}>
            <div className="icon">🔒</div>
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
          <p>{encomendas.length} encomenda{encomendas.length !== 1 ? 's' : ''}</p>
        </div>

        {encomendas.length === 0 ? (
          <div className="empty-state">
            <div className="icon">📦</div>
            <h3>Sem encomendas</h3>
            <p>Ainda não fizeste nenhuma encomenda.</p>
            <Link href="/" className="btn btn-primary" style={{ marginTop: 20 }}>Ver produtos</Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {encomendas.map(enc => (
              <Link key={enc.id} href={`/encomenda/${enc.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div style={{ background: 'white', borderRadius: 16, border: '1px solid var(--gray-200)', padding: 24, transition: 'box-shadow 0.2s' }}
                  onMouseEnter={e => (e.currentTarget.style.boxShadow = 'var(--shadow-lg)')}
                  onMouseLeave={e => (e.currentTarget.style.boxShadow = '')}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                      <p style={{ fontWeight: 700, marginBottom: 4 }}>#{enc.id.substring(0, 8).toUpperCase()}</p>
                      <p style={{ fontSize: 13, color: 'var(--gray-400)' }}>{formatarData(enc.criado_em)}</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span className={`badge-estado ${badgeEstadoClass(enc.estado as EstadoEncomenda)}`}>
                        {badgeEstadoLabel(enc.estado as EstadoEncomenda)}
                      </span>
                      <p style={{ fontWeight: 700, fontSize: 18, marginTop: 8 }}>{enc.total?.toFixed(2)} MZN</p>
                    </div>
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--gray-600)', marginTop: 12 }}>
                    {enc.itens?.length} {enc.itens?.length === 1 ? 'produto' : 'produtos'} · {enc.cidade_entrega}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
