'use client';
import { useEffect, useState } from 'react';
import { Wallet, RefreshCw, AlertCircle } from 'lucide-react';

interface ZumboWallet {
  id: string;
  name?: string;
  type?: string;
  currency?: string;
  balance?: number;
  available_balance?: number;
  status?: string;
  [key: string]: unknown;
}

export default function ZumboPayPage() {
  const [wallets, setWallets] = useState<ZumboWallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');

  const carregar = async () => {
    setLoading(true);
    setErro('');
    try {
      const res = await fetch('/api/zumbopay/wallets');
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Erro ao carregar wallets');
      const lista: ZumboWallet[] = Array.isArray(body) ? body : (body.data ?? []);
      setWallets(lista);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { carregar(); }, []);

  return (
    <div className="admin-page">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h2 style={{ margin: 0 }}>ZumboPay — Wallets</h2>
        <button className="btn btn-outline btn-sm" onClick={carregar} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          Atualizar
        </button>
      </div>

      {erro && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 16, background: 'var(--red-50, #fff0f0)', borderRadius: 10, marginBottom: 20, color: 'var(--red)' }}>
          <AlertCircle size={18} />
          <span>{erro}</span>
        </div>
      )}

      {loading && !wallets.length && (
        <p style={{ color: 'var(--gray-400)', textAlign: 'center', padding: 40 }}>A carregar...</p>
      )}

      {!loading && !erro && wallets.length === 0 && (
        <p style={{ color: 'var(--gray-400)', textAlign: 'center', padding: 40 }}>Nenhuma wallet encontrada.</p>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
        {wallets.map(w => (
          <div key={w.id} style={{ background: 'white', borderRadius: 16, border: '1px solid var(--gray-200)', padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--gray-100)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Wallet size={18} strokeWidth={1.5} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{w.name || w.id}</div>
                {w.type && <div style={{ fontSize: 12, color: 'var(--gray-400)', textTransform: 'capitalize' }}>{w.type}</div>}
              </div>
              {w.status && (
                <span style={{ marginLeft: 'auto', fontSize: 11, padding: '2px 8px', borderRadius: 20, background: w.status === 'active' ? '#e6f9f0' : 'var(--gray-100)', color: w.status === 'active' ? '#1a8c5a' : 'var(--gray-500)', fontWeight: 600 }}>
                  {w.status}
                </span>
              )}
            </div>

            <div style={{ borderTop: '1px solid var(--gray-100)', paddingTop: 14 }}>
              {w.balance !== undefined && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                  <span style={{ color: 'var(--gray-500)' }}>Saldo total</span>
                  <span style={{ fontWeight: 700 }}>{Number(w.balance).toFixed(2)} {w.currency ?? 'MZN'}</span>
                </div>
              )}
              {w.available_balance !== undefined && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: 'var(--gray-500)' }}>Disponível</span>
                  <span style={{ fontWeight: 700, color: '#1a8c5a' }}>{Number(w.available_balance).toFixed(2)} {w.currency ?? 'MZN'}</span>
                </div>
              )}
            </div>

            <div style={{ marginTop: 14, borderTop: '1px solid var(--gray-100)', paddingTop: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--gray-400)', wordBreak: 'break-all' }}>ID: {w.id}</div>
            </div>
          </div>
        ))}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
