'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { RefreshCw, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import { apiFetch } from '@/lib/api-fetch';
import { mostrarToast } from '@/components/Toast';
import { INFO_METODO, METODOS_PAGAMENTO } from '@/lib/metodos-pagamento';
import type { MetodoPagamento as Metodo } from '@/lib/metodos-pagamento';
import { confirmar } from '@/components/Confirmar';

type GatewayId = 'zumbopay' | 'clicpay';

interface GatewayInfo {
  id: GatewayId;
  nome: string;
  credenciais: boolean;
  metodos: Record<Metodo, boolean>;
  desativados: Metodo[];
}

interface CarteiraClicpay {
  id: number;
  name?: string;
  environment?: string;
  is_active?: boolean;
  allow_c2b?: boolean;
  currency?: string;
  payment_method?: { name?: string; slug?: string };
  balance?: { available?: string; accumulated?: string };
}

const METODO_LABEL = Object.fromEntries(METODOS_PAGAMENTO.map(m => [m, INFO_METODO[m].nome])) as Record<Metodo, string>;

// Variáveis de ambiente de cada gateway, para o admin saber o que falta
// configurar no servidor (os valores nunca saem do servidor).
const VARIAVEIS: Record<GatewayId, { credenciais: string; metodos: Record<Metodo, string> }> = {
  zumbopay: {
    credenciais: 'ZUMBOPAY_API_KEY + ZUMBOPAY_MERCHANT_ID',
    metodos: { mpesa: 'ZUMBOPAY_WALLET_MPESA', emola: 'ZUMBOPAY_WALLET_EMOLA', mkesh: 'não suportado', cartao: 'ZUMBOPAY_WALLET_CARD' },
  },
  clicpay: {
    credenciais: 'CLICPAY_API_TOKEN',
    metodos: { mpesa: 'CLICPAY_WALLET_MPESA', emola: 'CLICPAY_WALLET_EMOLA', mkesh: 'CLICPAY_WALLET_MKESH', cartao: 'CLICPAY_WALLET_CARD' },
  },
};

// Linha de um método: configurado no servidor? + interruptor ligado/desligado
function LinhaMetodo({ texto, configurado, ligado, dica, aGuardar, onToggle }: {
  texto: string; configurado: boolean; ligado: boolean; dica: string; aGuardar: boolean; onToggle: () => void;
}) {
  const disponivel = configurado && ligado;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: disponivel ? '#1a8c5a' : 'var(--gray-300)' }} />
      <span style={{ flex: 1, color: disponivel ? 'var(--black)' : 'var(--gray-400)' }}>
        {texto}
        {!configurado && <code style={{ fontSize: 10, marginLeft: 6, color: 'var(--gray-400)' }}>{dica}</code>}
      </span>
      <label
        title={configurado ? (ligado ? 'Desligar este método' : 'Ligar este método') : 'Configura a carteira no servidor primeiro'}
        style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: configurado && !aGuardar ? 'pointer' : 'not-allowed', color: 'var(--gray-500)', fontSize: 12 }}
      >
        <input type="checkbox" checked={ligado} disabled={!configurado || aGuardar} onChange={onToggle} />
        {ligado ? 'Ligado' : 'Desligado'}
      </label>
    </div>
  );
}

function Estado({ ok, texto, dica }: { ok: boolean; texto: string; dica?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: ok ? '#1a8c5a' : 'var(--gray-400)' }} title={dica}>
      {ok ? <CheckCircle2 size={14} strokeWidth={1.8} /> : <XCircle size={14} strokeWidth={1.8} />}
      <span>{texto}</span>
      {!ok && dica && <code style={{ fontSize: 10, color: 'var(--gray-400)' }}>{dica}</code>}
    </div>
  );
}

export default function PagamentosPage() {
  const [ativo, setAtivo] = useState<GatewayId | null>(null);
  const [gateways, setGateways] = useState<GatewayInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [aGuardar, setAGuardar] = useState<GatewayId | null>(null);
  const [aGuardarMetodo, setAGuardarMetodo] = useState<string | null>(null);
  const [erro, setErro] = useState('');
  const [carteiras, setCarteiras] = useState<CarteiraClicpay[] | null>(null);
  const [erroCarteiras, setErroCarteiras] = useState('');

  const carregar = async () => {
    setLoading(true);
    setErro('');
    try {
      const res = await apiFetch('/api/admin/gateway');
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Erro ao carregar gateways');
      setAtivo(body.ativo);
      setGateways(body.gateways);
      const clicpay = (body.gateways as GatewayInfo[]).find(g => g.id === 'clicpay');
      if (clicpay?.credenciais) carregarCarteiras();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  const carregarCarteiras = async () => {
    setErroCarteiras('');
    try {
      const res = await apiFetch('/api/clicpay/wallets');
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Erro ao carregar carteiras');
      setCarteiras(Array.isArray(body.data) ? body.data : []);
    } catch (e) {
      setCarteiras(null);
      setErroCarteiras(e instanceof Error ? e.message : 'Erro desconhecido');
    }
  };

  const activar = async (id: GatewayId) => {
    const nome = gateways.find(g => g.id === id)?.nome ?? id;
    if (!(await confirmar({ titulo: `Activar ${nome}?`, mensagem: `Os novos pagamentos do site passam a ser feitos por ${nome}. Os pagamentos já iniciados continuam a ser confirmados no gateway onde foram feitos.`, confirmar: `Activar ${nome}` }))) return;
    setAGuardar(id);
    try {
      const res = await apiFetch('/api/admin/gateway', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gateway: id }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Erro ao activar gateway');
      setAtivo(body.ativo);
      setGateways(body.gateways);
      mostrarToast(`${nome} activado`, 'success');
    } catch (e) {
      mostrarToast(e instanceof Error ? e.message : 'Erro ao activar gateway', 'error');
    } finally {
      setAGuardar(null);
    }
  };

  const alternarMetodo = async (g: GatewayInfo, metodo: Metodo) => {
    const ligar = g.desativados.includes(metodo);
    if (!ligar && ativo === g.id) {
      const restantes = (Object.keys(METODO_LABEL) as Metodo[])
        .filter(m => m !== metodo && g.credenciais && g.metodos[m] && !g.desativados.includes(m));
      const aviso = restantes.length === 0
        ? 'É o último método activo: o site deixa de aceitar pagamentos online.'
        : 'Deixa de aparecer no checkout do site.';
      if (!(await confirmar({ titulo: `Desligar ${METODO_LABEL[metodo]}?`, mensagem: aviso, confirmar: 'Desligar', perigo: restantes.length === 0 }))) return;
    }
    setAGuardarMetodo(`${g.id}:${metodo}`);
    try {
      const res = await apiFetch('/api/admin/gateway', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gateway: g.id, metodo, ativo: ligar }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Erro ao guardar');
      setAtivo(body.ativo);
      setGateways(body.gateways);
      mostrarToast(`${METODO_LABEL[metodo]} ${ligar ? 'ligado' : 'desligado'} no ${g.nome}`, 'success');
    } catch (e) {
      mostrarToast(e instanceof Error ? e.message : 'Erro ao guardar', 'error');
    } finally {
      setAGuardarMetodo(null);
    }
  };

  useEffect(() => { carregar(); }, []);

  return (
    <div className="admin-page">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <h2 style={{ margin: 0 }}>Gateway de pagamento</h2>
        <button className="btn btn-outline btn-sm" onClick={carregar} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          Atualizar
        </button>
      </div>
      <p style={{ color: 'var(--gray-500)', fontSize: 14, marginBottom: 24 }}>
        Escolhe o gateway usado nos pagamentos online do site e, em cada um, que métodos (M-Pesa, e-Mola, mKesh, cartão)
        ficam disponíveis no checkout. Os pagamentos já iniciados continuam a ser confirmados pelo gateway onde foram feitos.
      </p>

      {erro && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 16, background: '#fff0f0', borderRadius: 10, marginBottom: 20, color: 'var(--red)' }}>
          <AlertCircle size={18} />
          <span>{erro}</span>
        </div>
      )}

      {loading && !gateways.length && (
        <p style={{ color: 'var(--gray-400)', textAlign: 'center', padding: 40 }}>A carregar...</p>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16, marginBottom: 32 }}>
        {gateways.map(g => {
          const eAtivo = ativo === g.id;
          const vars = VARIAVEIS[g.id];
          const algumMetodo = g.credenciais
            && (Object.keys(METODO_LABEL) as Metodo[]).some(m => g.metodos[m] && !g.desativados.includes(m));
          return (
            <div key={g.id} style={{
              background: 'white', borderRadius: 16, padding: 20,
              border: eAtivo ? '2px solid var(--black)' : '1.5px solid var(--gray-200)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ fontWeight: 800, fontSize: 18 }}>{g.nome}</div>
                <span style={{
                  fontSize: 11, padding: '3px 9px', borderRadius: 20, fontWeight: 700,
                  background: eAtivo ? '#e6f9f0' : 'var(--gray-100)',
                  color: eAtivo ? '#1a8c5a' : 'var(--gray-500)',
                }}>
                  {eAtivo ? 'Activo no site' : 'Inactivo'}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 18 }}>
                <Estado ok={g.credenciais} texto="Credenciais" dica={vars.credenciais} />
                {(Object.keys(METODO_LABEL) as Metodo[]).map(m => (
                  <LinhaMetodo
                    key={m}
                    texto={METODO_LABEL[m]}
                    configurado={g.credenciais && g.metodos[m]}
                    ligado={!g.desativados.includes(m)}
                    dica={vars.metodos[m]}
                    aGuardar={aGuardarMetodo !== null}
                    onToggle={() => alternarMetodo(g, m)}
                  />
                ))}
              </div>

              {eAtivo ? (
                <button className="btn btn-outline btn-full btn-sm" disabled>Em uso</button>
              ) : (
                <button
                  className="btn btn-primary btn-full btn-sm"
                  onClick={() => activar(g.id)}
                  disabled={!algumMetodo || aGuardar !== null}
                  title={algumMetodo ? undefined : 'Liga pelo menos um método configurado primeiro'}
                >
                  {aGuardar === g.id ? 'A activar…' : `Activar ${g.nome}`}
                </button>
              )}

              {g.id === 'zumbopay' && (
                <Link href="/admin/zumbopay" style={{ display: 'block', textAlign: 'center', fontSize: 12, marginTop: 10, color: 'var(--gray-500)' }}>
                  Ver wallets ZumboPay
                </Link>
              )}
            </div>
          );
        })}
      </div>

      {gateways.find(g => g.id === 'clicpay')?.credenciais && (
        <div>
          <h3 style={{ fontSize: 16, marginBottom: 4 }}>Carteiras ClicPay</h3>
          <p style={{ color: 'var(--gray-500)', fontSize: 13, marginBottom: 12 }}>
            Usa o ID de cada carteira nas variáveis CLICPAY_WALLET_MPESA, CLICPAY_WALLET_EMOLA, CLICPAY_WALLET_MKESH e CLICPAY_WALLET_CARD.
          </p>
          {erroCarteiras && <p style={{ color: 'var(--red)', fontSize: 13 }}>{erroCarteiras}</p>}
          {carteiras && carteiras.length === 0 && <p style={{ color: 'var(--gray-400)', fontSize: 13 }}>Nenhuma carteira encontrada.</p>}
          {carteiras && carteiras.length > 0 && (
            <div style={{ background: 'white', borderRadius: 12, border: '1px solid var(--gray-200)', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: 'var(--gray-500)' }}>
                    <th style={{ padding: '10px 14px' }}>ID</th>
                    <th style={{ padding: '10px 14px' }}>Nome</th>
                    <th style={{ padding: '10px 14px' }}>Método</th>
                    <th style={{ padding: '10px 14px' }}>Ambiente</th>
                    <th style={{ padding: '10px 14px' }}>Estado</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right' }}>Disponível</th>
                  </tr>
                </thead>
                <tbody>
                  {carteiras.map(c => (
                    <tr key={c.id} style={{ borderTop: '1px solid var(--gray-100)' }}>
                      <td style={{ padding: '10px 14px' }}><code>{c.id}</code></td>
                      <td style={{ padding: '10px 14px' }}>{c.name ?? '—'}</td>
                      <td style={{ padding: '10px 14px' }}>{c.payment_method?.name ?? c.payment_method?.slug ?? '—'}</td>
                      <td style={{ padding: '10px 14px' }}>{c.environment ?? '—'}</td>
                      <td style={{ padding: '10px 14px' }}>{c.is_active === false ? 'Inactiva' : 'Activa'}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600 }}>
                        {c.balance?.available !== undefined ? `${Number(c.balance.available).toFixed(2)} ${c.currency ?? 'MZN'}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
