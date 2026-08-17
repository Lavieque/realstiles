'use client';
import { useEffect, useState } from 'react';
import { RefreshCw, AlertCircle } from 'lucide-react';

interface ZumboWallet {
  id: string;
  name?: string;
  method?: string;
  currency?: string;
  balance?: number;
  available_balance?: number;
  wallet_code?: string;
  is_active?: boolean;
  [key: string]: unknown;
}

const METHOD_META: Record<string, { label: string; cor: string; fundo: string; logo: string }> = {
  mpesa: {
    label: 'M-Pesa',
    cor: '#e30613',
    fundo: '#fff0f0',
    logo: `<svg viewBox="0 0 60 24" xmlns="http://www.w3.org/2000/svg" fill="none">
      <text x="0" y="19" font-family="Arial Black,Arial" font-weight="900" font-size="20" fill="#e30613">M</text>
      <text x="18" y="19" font-family="Arial,sans-serif" font-weight="700" font-size="14" fill="#333">-Pesa</text>
    </svg>`,
  },
  emola: {
    label: 'e-Mola',
    cor: '#0072bc',
    fundo: '#f0f6ff',
    logo: `<svg viewBox="0 0 60 24" xmlns="http://www.w3.org/2000/svg" fill="none">
      <text x="0" y="19" font-family="Arial,sans-serif" font-weight="700" font-size="16" fill="#0072bc">e-Mola</text>
    </svg>`,
  },
  card: {
    label: 'Cartão',
    cor: '#6c47ff',
    fundo: '#f4f1ff',
    logo: `<svg viewBox="0 0 60 24" xmlns="http://www.w3.org/2000/svg" fill="none">
      <rect x="0" y="3" width="26" height="18" rx="3" fill="#6c47ff"/>
      <rect x="0" y="8" width="26" height="5" fill="#fff" opacity=".3"/>
      <text x="30" y="19" font-family="Arial,sans-serif" font-weight="700" font-size="13" fill="#6c47ff">Visa</text>
    </svg>`,
  },
};

function WalletLogo({ method }: { method?: string }) {
  const m = METHOD_META[method ?? ''];
  if (!m) return (
    <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--gray-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
      💳
    </div>
  );
  return (
    <div style={{ width: 48, height: 48, borderRadius: 12, background: m.fundo, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8 }}>
      <div dangerouslySetInnerHTML={{ __html: m.logo }} style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center' }} />
    </div>
  );
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 16, background: '#fff0f0', borderRadius: 10, marginBottom: 20, color: 'var(--red)' }}>
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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
        {wallets.map(w => {
          const meta = METHOD_META[w.method ?? ''];
          const ativo = w.is_active !== false;
          return (
            <div key={w.id} style={{ background: 'white', borderRadius: 16, border: `1.5px solid ${meta?.cor ?? 'var(--gray-200)'}22`, padding: 20, position: 'relative', overflow: 'hidden' }}>
              {/* faixa de cor no topo */}
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: meta?.cor ?? 'var(--gray-300)', borderRadius: '16px 16px 0 0' }} />

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, marginTop: 6 }}>
                <WalletLogo method={w.method} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: 16, color: meta?.cor ?? 'var(--black)' }}>
                    {meta?.label ?? w.method ?? 'Wallet'}
                  </div>
                  {w.wallet_code && (
                    <div style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 1 }}>Cód. {w.wallet_code}</div>
                  )}
                </div>
                <span style={{
                  fontSize: 11, padding: '3px 9px', borderRadius: 20, fontWeight: 700,
                  background: ativo ? '#e6f9f0' : 'var(--gray-100)',
                  color: ativo ? '#1a8c5a' : 'var(--gray-500)',
                }}>
                  {ativo ? 'Ativa' : 'Inativa'}
                </span>
              </div>

              <div style={{ borderTop: '1px solid var(--gray-100)', paddingTop: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                  <span style={{ color: 'var(--gray-500)' }}>Saldo total</span>
                  <span style={{ fontWeight: 700 }}>{Number(w.balance ?? 0).toFixed(2)} {w.currency ?? 'MZN'}</span>
                </div>
                {w.available_balance !== undefined && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: 'var(--gray-500)' }}>Disponível</span>
                    <span style={{ fontWeight: 700, color: '#1a8c5a' }}>{Number(w.available_balance).toFixed(2)} {w.currency ?? 'MZN'}</span>
                  </div>
                )}
              </div>

              <div style={{ marginTop: 12, fontSize: 10, color: 'var(--gray-300)', wordBreak: 'break-all' }}>{w.id}</div>
            </div>
          );
        })}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
