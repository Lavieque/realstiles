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

const METHOD_META: Record<string, { label: string; cor: string; fundo: string }> = {
  mpesa: { label: 'M-Pesa',  cor: '#e30613', fundo: '#fff5f5' },
  emola: { label: 'e-Mola',  cor: '#0072bc', fundo: '#f0f6ff' },
  card:  { label: 'Cartão',  cor: '#1a1f71', fundo: '#f4f5ff' },
};

function WalletLogo({ method }: { method?: string }) {
  const fundo = METHOD_META[method ?? '']?.fundo ?? 'var(--gray-100)';
  const style: React.CSSProperties = { width: 48, height: 48, borderRadius: 12, background: fundo, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8 };
  if (method === 'mpesa') return (
    <div style={style}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/img/mpesa.png" alt="M-Pesa" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
    </div>
  );
  if (method === 'emola') return (
    <div style={style}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/img/emola.png" alt="e-Mola" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
    </div>
  );
  if (method === 'card') return (
    <div style={style}>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 58" style={{ width: '100%', height: '100%' }}>
        <rect width="180" height="58" rx="10" fill="#ffffff"/>
        <text x="18" y="37" fontFamily="Arial,sans-serif" fontSize="24" fontWeight="700" fontStyle="italic" fill="#1a1f71">VISA</text>
        <circle cx="120" cy="29" r="17" fill="#eb001b"/>
        <circle cx="141" cy="29" r="17" fill="#f79e1b" fillOpacity="0.92"/>
        <path d="M130.5 15.8a17 17 0 0 1 0 26.4 17 17 0 0 1 0-26.4Z" fill="#ff5f00"/>
      </svg>
    </div>
  );
  return (
    <div style={{ ...style, background: 'var(--gray-100)', fontSize: 22 }}>💳</div>
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
