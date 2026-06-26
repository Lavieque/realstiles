'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { onAuthChange } from '@/lib/auth';
import { getEncomenda, badgeEstadoClass, badgeEstadoLabel, formatarData } from '@/lib/encomendas';
import type { Encomenda, EstadoEncomenda } from '@/lib/encomendas';
import type { User } from 'firebase/auth';

export default function EncomendaPage({ params }: { params: { id: string } }) {
  const searchParams = useSearchParams();
  const confirmada = searchParams.get('confirmada') === '1';
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [encomenda, setEncomenda] = useState<Encomenda | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthChange(async (u) => {
      setUser(u);
      if (!u) { setLoading(false); return; }
      const enc = await getEncomenda(params.id);
      setEncomenda(enc);
      setLoading(false);
    });
    return unsub;
  }, [params.id]);

  if (user === undefined || loading) {
    return <div className="page-wrapper"><div className="container"><div className="loading"><div className="spinner" /> A carregar...</div></div></div>;
  }

  if (!user) {
    return (
      <div className="page-wrapper"><div className="container">
        <div className="empty-state" style={{ paddingTop: 80 }}>
          <div className="icon">🔒</div>
          <h3>Acesso restrito</h3>
          <Link href="/conta" className="btn btn-primary" style={{ marginTop: 20 }}>Entrar</Link>
        </div>
      </div></div>
    );
  }

  if (!encomenda) {
    return (
      <div className="page-wrapper"><div className="container">
        <div className="empty-state" style={{ paddingTop: 80 }}>
          <div className="icon">😕</div>
          <h3>Encomenda não encontrada</h3>
          <Link href="/encomendas" className="btn btn-primary" style={{ marginTop: 20 }}>As minhas encomendas</Link>
        </div>
      </div></div>
    );
  }

  return (
    <div className="page-wrapper">
      <div className="container" style={{ maxWidth: 720 }}>
        {confirmada && (
          <div style={{ background: 'var(--green)', color: 'white', borderRadius: 12, padding: '16px 24px', marginBottom: 24, marginTop: 24, display: 'flex', gap: 12, alignItems: 'center' }}>
            <span style={{ fontSize: 20 }}>✅</span>
            <div>
              <p style={{ fontWeight: 700 }}>Encomenda confirmada!</p>
              <p style={{ fontSize: 14, opacity: 0.9 }}>Receberás um email com os detalhes. Entraremos em contacto em breve.</p>
            </div>
          </div>
        )}

        <div className="page-header">
          <h1>Encomenda #{encomenda.id.substring(0, 8).toUpperCase()}</h1>
          <p>{formatarData(encomenda.criado_em)}</p>
        </div>

        {/* Estado */}
        <div style={{ background: 'white', borderRadius: 16, border: '1px solid var(--gray-200)', padding: 24, marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <p style={{ fontSize: 13, color: 'var(--gray-400)', marginBottom: 4 }}>Estado</p>
              <span className={`badge-estado ${badgeEstadoClass(encomenda.estado as EstadoEncomenda)}`} style={{ fontSize: 14, padding: '6px 14px' }}>
                {badgeEstadoLabel(encomenda.estado as EstadoEncomenda)}
              </span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: 13, color: 'var(--gray-400)', marginBottom: 4 }}>Total</p>
              <p style={{ fontWeight: 700, fontSize: 22 }}>{encomenda.total?.toFixed(2)} MZN</p>
            </div>
          </div>
          {encomenda.notas_admin && (
            <div style={{ marginTop: 16, padding: 14, background: 'var(--gray-100)', borderRadius: 10 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-600)', marginBottom: 4 }}>NOTA DA LOJA</p>
              <p style={{ fontSize: 14 }}>{encomenda.notas_admin}</p>
            </div>
          )}
        </div>

        {/* Itens */}
        <div style={{ background: 'white', borderRadius: 16, border: '1px solid var(--gray-200)', padding: 24, marginBottom: 20 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Produtos</h2>
          {encomenda.itens?.map(item => (
            <div key={item.key} style={{ display: 'flex', gap: 14, paddingBottom: 14, marginBottom: 14, borderBottom: '1px solid var(--gray-100)' }}>
              <Image src={item.imagem || 'https://via.placeholder.com/60x75'} alt={item.nome} width={60} height={75} style={{ objectFit: 'cover', borderRadius: 8 }} />
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 600 }}>{item.nome}</p>
                <p style={{ fontSize: 13, color: 'var(--gray-400)' }}>{item.tamanho && `Tam: ${item.tamanho}`} {item.cor && `· Cor: ${item.cor}`}</p>
                <p style={{ fontSize: 13, color: 'var(--gray-600)' }}>Qtd: {item.quantidade}</p>
              </div>
              <p style={{ fontWeight: 700 }}>{(item.preco * item.quantidade).toFixed(2)} MZN</p>
            </div>
          ))}
        </div>

        {/* Entrega */}
        <div style={{ background: 'white', borderRadius: 16, border: '1px solid var(--gray-200)', padding: 24, marginBottom: 24 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Entrega</h2>
          <p style={{ fontSize: 14, color: 'var(--gray-600)', marginBottom: 6 }}>📍 {encomenda.morada_entrega}, {encomenda.cidade_entrega}</p>
          <p style={{ fontSize: 14, color: 'var(--gray-600)', marginBottom: 6 }}>📞 {encomenda.telefone_contacto}</p>
          {encomenda.notas && <p style={{ fontSize: 14, color: 'var(--gray-600)' }}>📝 {encomenda.notas}</p>}
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <Link href="/encomendas" className="btn btn-outline">← As minhas encomendas</Link>
          <Link href="/" className="btn btn-primary">Continuar a comprar</Link>
        </div>
      </div>
    </div>
  );
}
