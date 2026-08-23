'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { onAuthChange } from '@/lib/auth';
import { formatarData } from '@/lib/encomendas';
import { getConfig } from '@/lib/config-site';
import { getReclamacoesCliente, normalizarEstado, estadoCor, parseEstadosConfig } from '@/lib/reclamacoes';
import type { Reclamacao } from '@/lib/reclamacoes';
import type { User } from 'firebase/auth';
import { Lock, MessageSquareText } from 'lucide-react';

export default function ReclamacoesClientePage() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [reclamacoes, setReclamacoes] = useState<Reclamacao[]>([]);
  const [estados, setEstados] = useState<string[]>(['Nova', 'Em andamento', 'Resolvida']);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getConfig().then(c => setEstados(parseEstadosConfig(c.reclamacao_estados)));
    const unsub = onAuthChange(async (u) => {
      setUser(u);
      if (!u) { setLoading(false); return; }
      const lista = await getReclamacoesCliente(u.uid);
      setReclamacoes(lista);
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
            <div className="icon"><Lock size={40} strokeWidth={1.5} /></div>
            <h3>Acesso restrito</h3>
            <p>Tens de entrar na tua conta para ver as tuas reclamações.</p>
            <Link href="/conta?redirect=/reclamacoes" className="btn btn-primary" style={{ marginTop: 20 }}>Entrar</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrapper">
      <div className="container" style={{ maxWidth: 760 }}>
        <div className="page-header">
          <h1>As minhas reclamações</h1>
          <p>{reclamacoes.length} reclamaç{reclamacoes.length !== 1 ? 'ões' : 'ão'} no total</p>
        </div>

        {reclamacoes.length === 0 ? (
          <div className="empty-state">
            <div className="icon"><MessageSquareText size={40} strokeWidth={1.5} /></div>
            <h3>Sem reclamações</h3>
            <p>Ainda não submeteste nenhuma reclamação.</p>
            <Link href="/reclamacao" className="btn btn-primary" style={{ marginTop: 20 }}>Nova reclamação</Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {reclamacoes.map(r => {
              const label = normalizarEstado(r.estado);
              const { cor, fundo } = estadoCor(label, estados);
              return (
                <Link
                  key={r.id}
                  href={`/reclamacoes/${r.id}`}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, padding: '16px 20px', background: 'white', borderRadius: 12, border: '1px solid var(--gray-200)', textDecoration: 'none', color: 'inherit' }}
                >
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{r.assunto}</p>
                    <p style={{ fontSize: 12, color: 'var(--gray-400)' }}>{formatarData(r.criado_em)}</p>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20, background: fundo, color: cor, flexShrink: 0 }}>
                    {label}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
