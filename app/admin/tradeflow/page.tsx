'use client';
import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { mostrarToast } from '@/components/Toast';

interface Plano {
  id: string;
  nome: string;
  preco: number;
  tipo?: 'mensal' | 'avulso' | 'wa';
  creditos_mes: number;
  creditos_pack?: number;
  stores_max: number;
  concorrencia: number;
  rate_limit: number;
  fontes: string[];
  activo: boolean;
  whatsapp_incluido?: boolean;
  whatsapp_numeros_max?: number;
}

interface Conta {
  id: string;
  email: string;
  nome: string;
  plano_id: string;
  billing_status: 'trial' | 'active' | 'suspended' | 'cancelled';
  creditos_usados: number;
  creditos_limite: number;
  license_key: string;
  offline?: boolean;
  renovacao_em?: { seconds?: number; _seconds?: number } | null;
  criado_em?: { seconds?: number; _seconds?: number } | null;
}

function fmtData(ts?: { seconds?: number; _seconds?: number } | null) {
  if (!ts) return '—';
  const s = (ts as { _seconds?: number; seconds?: number })._seconds ?? ts.seconds;
  if (!s) return '—';
  return new Date(s * 1000).toLocaleDateString('pt-PT');
}

function diasAte(ts?: { seconds?: number; _seconds?: number } | null): number | null {
  if (!ts) return null;
  const s = (ts as { _seconds?: number; seconds?: number })._seconds ?? ts.seconds;
  if (!s) return null;
  return Math.ceil((s * 1000 - Date.now()) / 86_400_000);
}

const BADGE: Record<string, string> = {
  trial: 'bg-indigo-100 text-indigo-700',
  active: 'bg-green-100 text-green-700',
  suspended: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500',
};
const BADGE_LABEL: Record<string, string> = {
  trial: 'Trial', active: 'Activo', suspended: 'Suspenso', cancelled: 'Cancelado',
};

const FONTE_LABEL: Record<string, string> = {
  shein: 'Shein', temu: 'Temu', zara: 'Zara', hm: 'H&M',
  aliexpress: 'AliExpress', amazon: 'Amazon', aboutyou: 'AboutYou',
  bershka: 'Bershka', pullandbear: 'Pull&Bear', zalando: 'Zalando', shopee: 'Shopee',
};

export default function TradeflowPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [conta, setConta] = useState<Conta | null>(null);
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [licenseKeyLocal, setLicenseKeyLocal] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [acaoLoading, setAcaoLoading] = useState('');
  const [keyVisivel, setKeyVisivel] = useState(false);
  const [autoLigando, setAutoLigando] = useState(false);

  const [subForm, setSubForm] = useState({ email: '', nome: 'Real Stiles', plano_id: '', store_url: typeof window !== 'undefined' ? window.location.hostname + (window.location.port ? `:${window.location.port}` : '') : '' });
  const [subOpen, setSubOpen] = useState(false);
  const [subLoading, setSubLoading] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const [ligarForm, setLigarForm] = useState({ license_key: '', store_url: '' });
  const [ligarOpen, setLigarOpen] = useState(false);
  const [ligarLoading, setLigarLoading] = useState(false);

  const [upgradeModal, setUpgradeModal] = useState<{ plano: Plano } | null>(null);
  const sucesso = searchParams.get('sucesso') === '1';

  // Limpar ?sucesso=1 do URL e recarregar conta após pagamento
  useEffect(() => {
    if (sucesso) {
      router.replace('/admin/tradeflow');
      mostrarToast('Pagamento confirmado! A activar o plano...', 'success');
    }
  }, [sucesso]);

  async function carregar() {
    setLoading(true);
    setErro('');
    try {
      const res = await fetch('/api/tradeflow/conta');
      const data = await res.json();
      if (data.error) { setErro(data.error); return; }
      setConta(data.conta);
      setLicenseKeyLocal(data.license_key_local ?? null);
      setPlanos((data.planos as Plano[]).filter(p => p.activo));
    } catch {
      setErro('Não foi possível ligar ao TradeFlow. Verifica TRADEFLOW_API_URL e TRADEFLOW_ADMIN_TOKEN no .env.local.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const linkKey = searchParams.get('link');
    if (linkKey) {
      autoLigar(linkKey);
    } else {
      carregar();
    }
  }, []);

  async function autoLigar(license_key: string) {
    setAutoLigando(true);
    setLoading(true);
    try {
      // Determina store_url a partir do hostname atual
      const store_url = window.location.hostname + (window.location.port ? `:${window.location.port}` : '');
      const res = await fetch('/api/tradeflow/conta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ license_key, store_url }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Erro ao ligar conta');
      mostrarToast('Conta TradeFlow ligada! Já podes importar produtos.', 'success');
      // Limpa o ?link= da URL sem recarregar
      router.replace('/admin/tradeflow');
    } catch (err: unknown) {
      mostrarToast(err instanceof Error ? err.message : 'Erro ao ligar conta automaticamente', 'error');
    } finally {
      setAutoLigando(false);
      carregar();
    }
  }

  async function subscrever(e: React.FormEvent) {
    e.preventDefault();
    if (!subForm.email || !subForm.plano_id) return;
    setSubLoading(true);
    try {
      // 1. Criar conta trial
      const res = await fetch('/api/tradeflow/conta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subForm),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Erro ao criar conta');

      const planoSeleccionado = planos.find(p => p.id === subForm.plano_id);

      // 2. Plano pago → ir para checkout Stripe
      if (planoSeleccionado && planoSeleccionado.preco > 0) {
        const checkoutRes = await fetch('/api/tradeflow/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            account_id: data.conta?.id,
            plano_id: subForm.plano_id,
            success_url: `${window.location.origin}/admin/tradeflow?sucesso=1`,
            cancel_url: `${window.location.origin}/admin/tradeflow`,
          }),
        });
        const checkoutData = await checkoutRes.json();
        if (!checkoutRes.ok || !checkoutData.url) throw new Error(checkoutData.error || 'Erro ao criar checkout');
        window.location.href = checkoutData.url;
        return;
      }

      // Plano gratuito (trial) → continua normalmente
      mostrarToast('Conta criada com sucesso!', 'success');
      setSubOpen(false);
      carregar();
    } catch (err: unknown) {
      mostrarToast(err instanceof Error ? err.message : 'Erro ao subscrever', 'error');
    } finally {
      setSubLoading(false);
    }
  }

  async function ligarConta(e: React.FormEvent) {
    e.preventDefault();
    if (!ligarForm.license_key || !ligarForm.store_url) return;
    setLigarLoading(true);
    try {
      const res = await fetch('/api/tradeflow/conta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ligarForm),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Erro ao ligar conta');
      mostrarToast('Conta ligada com sucesso!', 'success');
      setLigarOpen(false);
      carregar();
    } catch (err: unknown) {
      mostrarToast(err instanceof Error ? err.message : 'Erro ao ligar conta', 'error');
    } finally {
      setLigarLoading(false);
    }
  }

  async function renovar() {
    setAcaoLoading('renovar');
    try {
      const res = await fetch('/api/tradeflow/renovar', { method: 'POST' });
      if (!res.ok) throw new Error((await res.json()).error || 'Erro');
      mostrarToast('Subscrição renovada +1 mês!', 'success');
      carregar();
    } catch (err: unknown) {
      mostrarToast(err instanceof Error ? err.message : 'Erro', 'error');
    } finally {
      setAcaoLoading('');
    }
  }

  async function resetCreditos() {
    setAcaoLoading('reset');
    try {
      const res = await fetch('/api/tradeflow/creditos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao: 'reset' }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Erro');
      mostrarToast('Importações repostas!', 'success');
      carregar();
    } catch (err: unknown) {
      mostrarToast(err instanceof Error ? err.message : 'Erro', 'error');
    } finally {
      setAcaoLoading('');
    }
  }

  function tentarMudarPlano(plano_id: string) {
    const plano = planos.find(p => p.id === plano_id);
    if (!plano) return;
    const precoActual = planos.find(p => p.id === conta?.plano_id)?.preco ?? 0;
    // Upgrade para plano pago — mostrar modal de confirmação
    if (plano.preco > precoActual) {
      setUpgradeModal({ plano });
      return;
    }
    irParaCheckout(plano_id);
  }

  async function irParaCheckout(plano_id: string) {
    setUpgradeModal(null);
    setAcaoLoading(`plano_${plano_id}`);
    try {
      const snap = await fetch('/api/tradeflow/conta').then(r => r.json());
      const accountId = snap.conta?.id;
      if (!accountId) throw new Error('Sem conta');
      const res = await fetch('/api/tradeflow/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: accountId,
          plano_id,
          success_url: `${window.location.origin}/admin/tradeflow?sucesso=1`,
          cancel_url: `${window.location.origin}/admin/tradeflow`,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || 'Erro ao criar checkout');
      window.location.href = data.url;
    } catch (err: unknown) {
      mostrarToast(err instanceof Error ? err.message : 'Erro ao iniciar checkout', 'error');
      setAcaoLoading('');
    }
  }

  async function desligar() {
    if (!confirm('Desligar a conta TradeFlow deste site? A conta continua activa no TradeFlow.')) return;
    await fetch('/api/tradeflow/conta', { method: 'DELETE' });
    mostrarToast('Conta desligada do site', 'success');
    setConta(null);
  }

  function copiarKey() {
    if (!conta?.license_key) return;
    navigator.clipboard.writeText(conta.license_key);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  const planoActual = planos.find(p => p.id === conta?.plano_id);
  const pct = conta ? Math.min(Math.round((conta.creditos_usados / conta.creditos_limite) * 100), 100) : 0;
  const dias = conta ? diasAte(conta.renovacao_em) : null;
  const restantes = conta ? conta.creditos_limite - conta.creditos_usados : 0;

  return (
    <>
      <div className="admin-topbar">
        <h1>TradeFlow</h1>
        {conta && (
          <button className="btn btn-outline btn-sm" onClick={carregar}>↻ Actualizar</button>
        )}
      </div>

      <div className="admin-content">
        {loading && autoLigando ? (
          <div className="loading"><div className="spinner" /> A ligar conta TradeFlow automaticamente...</div>
        ) : loading ? (
          <div className="loading"><div className="spinner" /> A ligar ao TradeFlow...</div>
        ) : erro ? (
          <div style={{ background: '#fff0f0', border: '1px solid #ffc0c0', borderRadius: 12, padding: 24, marginBottom: 20 }}>
            <p style={{ fontWeight: 700, color: 'var(--red)', marginBottom: 8 }}>⚠ Não foi possível ligar ao TradeFlow</p>
            <p style={{ fontSize: 13, color: 'var(--gray-600)', marginBottom: 16 }}>{erro}</p>
            <p style={{ fontSize: 12, color: 'var(--gray-400)' }}>
              Verifica que <code>TRADEFLOW_API_URL</code> e <code>TRADEFLOW_ADMIN_TOKEN</code> estão definidos no <code>.env.local</code> e que o servidor TradeFlow está a correr.
            </p>
          </div>
        ) : conta ? (
          /* ── VISTA: COM CONTA ── */
          <>
            {/* KPIs */}
            <div className="stats-grid" style={{ marginBottom: 20 }}>
              <div className="stat-card">
                <div className="stat-card-label">Estado</div>
                <div style={{ marginTop: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, padding: '4px 12px', borderRadius: 100 }} className={BADGE[conta.billing_status] || 'bg-gray-100 text-gray-600'}>
                    {BADGE_LABEL[conta.billing_status] || conta.billing_status}
                  </span>
                </div>
              </div>
              <div className="stat-card accent">
                <div className="stat-card-label">Plano actual</div>
                <div className="stat-card-value" style={{ fontSize: 22 }}>{planoActual?.nome || conta.plano_id}</div>
                <div className="stat-card-sub">
                  {planoActual?.preco === 0 ? 'Gratuito' : `€${planoActual?.preco}${planoActual?.tipo !== 'avulso' ? '/mês' : ''}`}
                </div>
              </div>
              <div className={`stat-card ${pct > 80 ? 'red' : ''}`}>
                <div className="stat-card-label">Produtos importados</div>
                <div className="stat-card-value" style={{ fontSize: 26 }}>{conta.creditos_usados}</div>
                <div style={{ margin: '8px 0 4px' }}>
                  <div style={{ background: 'rgba(0,0,0,0.08)', borderRadius: 100, height: 6 }}>
                    <div style={{ height: 6, borderRadius: 100, background: pct > 80 ? '#e53e3e' : 'currentColor', width: `${pct}%`, opacity: 0.7 }} />
                  </div>
                </div>
                <div className="stat-card-sub">
                  {pct < 100
                    ? `${restantes} restantes de ${conta.creditos_limite}`
                    : '⚠ Limite atingido'}
                </div>
              </div>
              <div className={`stat-card ${dias !== null && dias <= 7 ? 'red' : ''}`}>
                <div className="stat-card-label">Renova em</div>
                <div className="stat-card-value" style={{ fontSize: 18 }}>{fmtData(conta.renovacao_em)}</div>
                {dias !== null && (
                  <div className="stat-card-sub">
                    {dias < 0 ? '⚠ Expirado' : dias <= 7 ? `⚠ ${dias} dias` : `${dias} dias restantes`}
                  </div>
                )}
              </div>
            </div>

            {/* Resumo do plano */}
            {planoActual && (
              <div style={{ background: 'var(--gray-50)', border: '1px solid var(--gray-200)', borderRadius: 14, padding: '16px 20px', marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'center' }}>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Plano {planoActual.nome}</p>
                  <p style={{ fontSize: 13, color: 'var(--gray-700)' }}>
                    <strong>{(planoActual.tipo === 'avulso' ? (planoActual.creditos_pack ?? 0) : (planoActual.creditos_mes ?? 0)).toLocaleString()}</strong> {planoActual.tipo === 'avulso' ? 'créditos (pack)' : 'créditos/mês'}
                    {planoActual.preco > 0 && planoActual.tipo !== 'avulso' && <> · <strong>€{planoActual.preco}</strong>/mês</>}
                    {planoActual.preco > 0 && planoActual.tipo === 'avulso' && <> · <strong>€{planoActual.preco}</strong> (único)</>}
                  </p>
                </div>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Lojas disponíveis</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {planoActual.fontes.map(f => (
                      <span key={f} style={{ fontSize: 11, fontWeight: 600, background: 'white', border: '1px solid var(--gray-200)', borderRadius: 100, padding: '3px 10px', color: 'var(--gray-700)' }}>
                        {FONTE_LABEL[f] ?? f}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* API Key */}
            {(conta.license_key || licenseKeyLocal) && (
              <div style={{ background: 'var(--black)', borderRadius: 16, padding: '20px 24px', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 2 }}>🔑 License Key</p>
                    <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>Header <code style={{ background: 'rgba(255,255,255,0.1)', padding: '1px 6px', borderRadius: 4 }}>x-license-key</code> nas chamadas ao TradeFlow</p>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => setKeyVisivel(v => !v)}
                      style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.7)', fontSize: 12, padding: '6px 14px', borderRadius: 8, cursor: 'pointer' }}
                    >
                      {keyVisivel ? '🙈 Ocultar' : '👁 Mostrar'}
                    </button>
                    <button
                      onClick={copiarKey}
                      style={{ background: 'var(--accent)', border: 'none', color: 'var(--black)', fontSize: 12, fontWeight: 700, padding: '6px 14px', borderRadius: 8, cursor: 'pointer' }}
                    >
                      {copiado ? '✓ Copiado!' : 'Copiar'}
                    </button>
                  </div>
                </div>
                <code style={{
                  display: 'block', fontSize: 13,
                  color: keyVisivel ? '#a5f3fc' : 'transparent',
                  background: 'rgba(255,255,255,0.06)',
                  padding: '12px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)',
                  wordBreak: 'break-all', lineHeight: 1.7,
                  textShadow: keyVisivel ? 'none' : '0 0 8px rgba(165,243,252,0.5)',
                  userSelect: keyVisivel ? 'text' : 'none',
                  filter: keyVisivel ? 'none' : 'blur(4px)',
                  transition: 'filter 0.2s',
                }}>
                  {conta.license_key || licenseKeyLocal}
                </code>
                {conta.offline && (
                  <p style={{ fontSize: 11, color: 'rgba(255,200,100,0.7)', marginTop: 8 }}>
                    ⚠ TradeFlow offline — a mostrar chave guardada localmente.
                  </p>
                )}
              </div>
            )}

            {/* Mudar plano */}
            <div className="form-card" style={{ marginBottom: 16 }}>
              <h2 style={{ fontSize: 15, marginBottom: 4 }}>Plano</h2>
              <p style={{ fontSize: 13, color: 'var(--gray-400)', marginBottom: 20 }}>Clica num plano para mudar. Os produtos já importados são mantidos.</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
                {planos.map(p => {
                  const activo = conta.plano_id === p.id;
                  const loading = acaoLoading === `plano_${p.id}`;
                  return (
                    <button
                      key={p.id}
                      disabled={activo || !!acaoLoading}
                      onClick={() => tentarMudarPlano(p.id)}
                      style={{
                        background: activo ? 'var(--black)' : 'white',
                        border: `2px solid ${activo ? 'var(--black)' : 'var(--gray-200)'}`,
                        borderRadius: 14, padding: '18px 20px', cursor: activo ? 'default' : 'pointer',
                        textAlign: 'left', transition: 'all 0.15s', opacity: loading ? 0.6 : 1,
                        display: 'flex', flexDirection: 'column', height: '100%',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                        <div>
                          <p style={{ fontSize: 11, fontWeight: 700, color: activo ? 'rgba(255,255,255,0.5)' : 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>{p.id}</p>
                          <p style={{ fontSize: 16, fontWeight: 700, color: activo ? 'white' : 'var(--black)' }}>{p.nome}</p>
                        </div>
                        {activo && (
                          <span style={{ fontSize: 10, fontWeight: 700, background: 'rgba(255,255,255,0.15)', color: 'white', padding: '3px 8px', borderRadius: 100, letterSpacing: '0.06em' }}>ACTUAL</span>
                        )}
                      </div>
                      <p style={{ fontSize: 22, fontWeight: 800, color: activo ? 'white' : 'var(--black)', marginBottom: 2 }}>
                        {p.preco === 0 ? 'Grátis' : `€${p.preco}`}
                        {p.preco > 0 && p.tipo !== 'avulso' && <span style={{ fontSize: 13, fontWeight: 400, color: activo ? 'rgba(255,255,255,0.5)' : 'var(--gray-400)' }}>/mês</span>}
                      </p>
                      {p.tipo !== 'wa' && (
                        <p style={{ fontSize: 13, color: activo ? 'rgba(255,255,255,0.65)' : 'var(--gray-500)', marginBottom: 12 }}>
                          {(p.tipo === 'avulso' ? (p.creditos_pack ?? 0) : p.creditos_mes).toLocaleString()} {p.tipo === 'avulso' ? 'créditos (pack)' : 'créditos/mês'}
                        </p>
                      )}
                      {p.tipo === 'wa' && (
                        <p style={{ fontSize: 13, color: activo ? 'rgba(255,255,255,0.65)' : 'var(--gray-500)', marginBottom: 12 }}>
                          Notificações WhatsApp · {p.whatsapp_numeros_max ?? 1} número{(p.whatsapp_numeros_max ?? 1) > 1 ? 's' : ''}
                        </p>
                      )}
                      {/* Fontes e badges — empurrados para o fundo */}
                      <div style={{ marginTop: 'auto' }}>
                        {p.tipo !== 'wa' && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: p.whatsapp_incluido ? 8 : 0 }}>
                            {p.fontes.map(f => (
                              <span key={f} style={{
                                fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 100,
                                background: activo ? 'rgba(255,255,255,0.12)' : 'var(--gray-100)',
                                color: activo ? 'rgba(255,255,255,0.8)' : 'var(--gray-600)',
                              }}>
                                {FONTE_LABEL[f] ?? f}
                              </span>
                            ))}
                          </div>
                        )}
                        {p.tipo !== 'wa' && p.whatsapp_incluido && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, background: activo ? 'rgba(37,211,102,0.2)' : '#dcfce7', color: activo ? '#86efac' : '#15803d', padding: '3px 8px', borderRadius: 100 }}>
                            ✓ WhatsApp incluído
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Acções */}
            <div className="form-card">
              <h2 style={{ fontSize: 15, marginBottom: 16 }}>Acções</h2>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button className="btn btn-primary btn-sm" onClick={renovar} disabled={acaoLoading === 'renovar'}>
                  {acaoLoading === 'renovar' ? 'A renovar...' : '↻ Renovar +1 mês'}
                </button>
                <button className="btn btn-outline btn-sm" onClick={resetCreditos} disabled={acaoLoading === 'reset'}>
                  {acaoLoading === 'reset' ? 'A repor...' : '⟳ Repor importações'}
                </button>
                <button
                  className="btn btn-outline btn-sm"
                  style={{ marginLeft: 'auto', color: 'var(--red)', borderColor: 'var(--red)' }}
                  onClick={desligar}
                >
                  Desligar conta
                </button>
              </div>
            </div>
          </>
        ) : (
          /* ── VISTA: SEM CONTA ── */
          <>
            <div style={{ background: 'var(--black)', color: 'white', borderRadius: 16, padding: '36px 40px', marginBottom: 28, position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 80% 50%, rgba(99,102,241,0.25) 0%, transparent 60%)', pointerEvents: 'none' }} />
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{ display: 'inline-block', background: 'rgba(99,102,241,0.2)', color: '#a5b4fc', fontSize: 12, fontWeight: 700, padding: '4px 14px', borderRadius: 100, marginBottom: 16, letterSpacing: '0.08em', border: '1px solid rgba(99,102,241,0.3)' }}>TRADEFLOW</div>
                <h2 style={{ fontSize: 'clamp(1.4rem,3vw,2rem)', fontWeight: 700, marginBottom: 12 }}>
                  Importação automática de produtos
                </h2>
                <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.65)', maxWidth: 560, lineHeight: 1.7 }}>
                  Importa produtos da Shein, Temu, Zara, H&M e mais — directamente para o teu catálogo, com preços e imagens incluídos.
                </p>
              </div>
            </div>

            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Escolhe um plano</h2>
            <p style={{ fontSize: 13, color: 'var(--gray-400)', marginBottom: 24 }}>Cada produto importado conta para o teu limite mensal. Renova automaticamente.</p>

            {planos.length === 0 ? (
              <div className="empty-state">
                <p style={{ fontSize: 14, color: 'var(--gray-400)' }}>Sem planos disponíveis. Verifica a ligação ao TradeFlow.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16, marginBottom: 28 }}>
                {planos.map(p => (
                  <div
                    key={p.id}
                    style={{
                      background: 'white', border: `2px solid ${subForm.plano_id === p.id ? 'var(--black)' : 'var(--gray-200)'}`,
                      borderRadius: 16, padding: '24px 22px', cursor: 'pointer', transition: 'all 0.2s', position: 'relative',
                    }}
                    onClick={() => { setSubForm(f => ({ ...f, plano_id: p.id })); setSubOpen(true); }}
                  >
                    {p.preco === 0 && (
                      <span style={{ position: 'absolute', top: 14, right: 14, background: 'var(--accent-light)', color: 'var(--accent-dark)', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 100, letterSpacing: '0.06em' }}>GRÁTIS</span>
                    )}
                    <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{p.id}</p>
                    <p style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
                      {p.preco === 0 ? 'Grátis' : `€${p.preco}`}
                      {p.preco > 0 && p.tipo !== 'avulso' && <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--gray-400)' }}>/mês</span>}
                    </p>
                    {p.tipo !== 'wa' && <>
                      <p style={{ fontSize: 24, fontWeight: 800, marginBottom: 2 }}>{(p.tipo === 'avulso' ? (p.creditos_pack ?? 0) : p.creditos_mes).toLocaleString()}</p>
                      <p style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 16 }}>{p.tipo === 'avulso' ? 'créditos (pack)' : 'créditos por mês'}</p>
                      <div style={{ borderTop: '1px solid var(--gray-100)', paddingTop: 14, marginBottom: 16 }}>
                        <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Lojas incluídas</p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {p.fontes.map(f => (
                            <span key={f} style={{ fontSize: 10, fontWeight: 600, background: 'var(--gray-100)', borderRadius: 100, padding: '3px 8px', color: 'var(--gray-700)' }}>
                              {FONTE_LABEL[f] ?? f}
                            </span>
                          ))}
                        </div>
                      </div>
                    </>}
                    {p.tipo === 'wa' && (
                      <p style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 16 }}>
                        Notificações WhatsApp · {p.whatsapp_numeros_max ?? 1} número{(p.whatsapp_numeros_max ?? 1) > 1 ? 's' : ''}
                      </p>
                    )}
                    {p.tipo !== 'wa' && p.whatsapp_incluido && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 12, fontSize: 10, fontWeight: 700, background: '#dcfce7', color: '#15803d', padding: '3px 8px', borderRadius: 100 }}>
                        ✓ WhatsApp incluído · {p.whatsapp_numeros_max ?? 1} número{(p.whatsapp_numeros_max ?? 1) > 1 ? 's' : ''}
                      </span>
                    )}
                    <button className="btn btn-primary btn-full btn-sm" style={{ pointerEvents: 'none' }}>
                      Subscrever →
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Link para ligar conta existente */}
            <div style={{ borderTop: '1px solid var(--gray-100)', paddingTop: 24, marginTop: 4 }}>
              <p style={{ fontSize: 13, color: 'var(--gray-400)', marginBottom: 12 }}>
                Já tens uma conta TradeFlow? Liga-a a este site com a tua license key.
              </p>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => setLigarOpen(true)}
              >
                🔑 Ligar conta existente
              </button>
            </div>

            {subOpen && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
                <div style={{ background: 'white', borderRadius: 20, padding: 36, maxWidth: 440, width: '100%', boxShadow: '0 24px 60px rgba(0,0,0,0.2)' }}>
                  <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
                    Plano {planos.find(p => p.id === subForm.plano_id)?.nome}
                  </h3>
                  <p style={{ fontSize: 13, color: 'var(--gray-400)', marginBottom: 24 }}>
                    Uma conta TradeFlow será criada e ligada a este site.
                  </p>
                  <form onSubmit={subscrever}>
                    <div className="form-group">
                      <label>Nome do site / empresa</label>
                      <input required value={subForm.nome} onChange={e => setSubForm(f => ({ ...f, nome: e.target.value }))} placeholder="Real Stiles" />
                    </div>
                    <div className="form-group">
                      <label>Email de contacto</label>
                      <input type="email" required value={subForm.email} onChange={e => setSubForm(f => ({ ...f, email: e.target.value }))} placeholder="admin@realstiles.com" />
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <button type="button" className="btn btn-outline btn-full" onClick={() => setSubOpen(false)}>Cancelar</button>
                      <button type="submit" className="btn btn-primary btn-full" disabled={subLoading}>
                        {subLoading ? 'A criar conta...' : 'Confirmar subscrição'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {ligarOpen && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
                <div style={{ background: 'white', borderRadius: 20, padding: 36, maxWidth: 440, width: '100%', boxShadow: '0 24px 60px rgba(0,0,0,0.2)' }}>
                  <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Ligar conta existente</h3>
                  <p style={{ fontSize: 13, color: 'var(--gray-400)', marginBottom: 24 }}>
                    Introduz a license key que recebeste por email ao criar a conta no TradeFlow.
                  </p>
                  <form onSubmit={ligarConta}>
                    <div className="form-group">
                      <label>License Key</label>
                      <input
                        required
                        value={ligarForm.license_key}
                        onChange={e => setLigarForm(f => ({ ...f, license_key: e.target.value.trim() }))}
                        placeholder="tf_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                        style={{ fontFamily: 'monospace', fontSize: 13 }}
                      />
                    </div>
                    <div className="form-group">
                      <label>URL do site</label>
                      <input
                        required
                        value={ligarForm.store_url}
                        onChange={e => setLigarForm(f => ({ ...f, store_url: e.target.value.trim() }))}
                        placeholder="realstiles.com"
                      />
                      <p style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 4 }}>Sem https:// nem barra final (ex: realstiles.com)</p>
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <button type="button" className="btn btn-outline btn-full" onClick={() => setLigarOpen(false)}>Cancelar</button>
                      <button type="submit" className="btn btn-primary btn-full" disabled={ligarLoading}>
                        {ligarLoading ? 'A ligar...' : 'Ligar conta'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal de confirmação de upgrade pago */}
      {upgradeModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: 'white', borderRadius: 16, padding: 32, maxWidth: 420, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ fontSize: 36, marginBottom: 12, textAlign: 'center' }}>💳</div>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, textAlign: 'center' }}>Upgrade para {upgradeModal.plano.nome}</h2>
            <p style={{ fontSize: 13, color: 'var(--gray-500)', textAlign: 'center', marginBottom: 20, lineHeight: 1.6 }}>
              Este plano custa <strong style={{ color: 'var(--black)' }}>
                €{upgradeModal.plano.preco}{upgradeModal.plano.tipo !== 'avulso' ? '/mês' : ' (único)'}
              </strong>. O pagamento tem de ser processado antes de activar o plano.
            </p>
            <p style={{ fontSize: 13, color: 'var(--gray-500)', textAlign: 'center', marginBottom: 20, lineHeight: 1.6 }}>
              Serás redirecionado para o checkout seguro do Stripe para inserir os dados de pagamento.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-outline btn-full" onClick={() => setUpgradeModal(null)}>Cancelar</button>
              <button
                className="btn btn-primary btn-full"
                onClick={() => irParaCheckout(upgradeModal.plano.id)}
                disabled={!!acaoLoading}
              >
                {acaoLoading ? 'A redirecionar...' : 'Ir para o checkout →'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
