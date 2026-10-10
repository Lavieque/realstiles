'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { RefreshCw, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import { apiFetch } from '@/lib/api-fetch';
import { mostrarToast } from '@/components/Toast';
import { INFO_METODO, METODOS_PAGAMENTO } from '@/lib/metodos-pagamento';
import type { MetodoPagamento as Metodo } from '@/lib/metodos-pagamento';
import { confirmar } from '@/components/Confirmar';
import MetodoPagamentoLogo from '@/components/MetodoPagamentoLogo';

type GatewayId = 'zumbopay' | 'clicpay';

interface GatewayInfo {
  id: GatewayId;
  nome: string;
  credenciais: boolean;
  metodos: Record<Metodo, boolean>;
}

interface MetodoInfo {
  gateway: GatewayId;
  ativo: boolean;
  disponivel: boolean;
  gateways: { id: GatewayId; configurado: boolean }[];
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
const NOME_GATEWAY: Record<GatewayId, string> = { zumbopay: 'ZumboPay', clicpay: 'ClicPay' };

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

function Estado({ ok, texto, dica }: { ok: boolean; texto: string; dica?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: ok ? '#1a8c5a' : 'var(--gray-400)' }} title={dica}>
      {ok ? <CheckCircle2 size={14} strokeWidth={1.8} /> : <XCircle size={14} strokeWidth={1.8} />}
      <span>{texto}</span>
      {!ok && dica && <code style={{ fontSize: 10, color: 'var(--gray-400)' }}>{dica}</code>}
    </div>
  );
}

// Porque é que um método não aparece no site
function motivoIndisponivel(info: MetodoInfo): string {
  if (!info.ativo) return 'Desligado';
  const g = info.gateways.find(x => x.id === info.gateway);
  if (!g?.configurado) return `Sem carteira no ${NOME_GATEWAY[info.gateway]}`;
  return 'Indisponível';
}

export default function PagamentosPage() {
  const [metodos, setMetodos] = useState<Record<Metodo, MetodoInfo> | null>(null);
  const [gateways, setGateways] = useState<GatewayInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [aGuardar, setAGuardar] = useState<Metodo | null>(null);
  const [erro, setErro] = useState('');
  const [carteiras, setCarteiras] = useState<CarteiraClicpay[] | null>(null);
  const [erroCarteiras, setErroCarteiras] = useState('');

  const aplicar = (body: { metodos: Record<Metodo, MetodoInfo>; gateways: GatewayInfo[] }) => {
    setMetodos(body.metodos);
    setGateways(body.gateways);
  };

  const carregar = async () => {
    setLoading(true);
    setErro('');
    try {
      const res = await apiFetch('/api/admin/gateway');
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Erro ao carregar gateways');
      aplicar(body);
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

  const guardar = async (metodo: Metodo, alteracao: { gateway?: GatewayId; ativo?: boolean }, sucesso: string) => {
    setAGuardar(metodo);
    try {
      const res = await apiFetch('/api/admin/gateway', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metodo, ...alteracao }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Erro ao guardar');
      aplicar(body);
      mostrarToast(sucesso, 'success');
    } catch (e) {
      mostrarToast(e instanceof Error ? e.message : 'Erro ao guardar', 'error');
    } finally {
      setAGuardar(null);
    }
  };

  const mudarGateway = async (metodo: Metodo, gateway: GatewayId) => {
    if (!metodos || metodos[metodo].gateway === gateway) return;
    const nome = NOME_GATEWAY[gateway];
    if (!(await confirmar({
      titulo: `${METODO_LABEL[metodo]} pelo ${nome}?`,
      mensagem: `Os novos pagamentos com ${METODO_LABEL[metodo]} passam a ser feitos pelo ${nome}. Os pagamentos já iniciados continuam a ser confirmados no gateway onde foram feitos.`,
      confirmar: `Usar ${nome}`,
    }))) return;
    guardar(metodo, { gateway }, `${METODO_LABEL[metodo]} passa a usar o ${nome}`);
  };

  const alternar = async (metodo: Metodo) => {
    if (!metodos) return;
    const ligar = !metodos[metodo].ativo;
    if (!ligar && metodos[metodo].disponivel) {
      const restantes = METODOS_PAGAMENTO.filter(m => m !== metodo && metodos[m].disponivel);
      if (!(await confirmar({
        titulo: `Desligar ${METODO_LABEL[metodo]}?`,
        mensagem: restantes.length === 0
          ? 'É o último método disponível: o site deixa de aceitar pagamentos online.'
          : 'Deixa de aparecer no checkout do site.',
        confirmar: 'Desligar',
        perigo: restantes.length === 0,
      }))) return;
    }
    guardar(metodo, { ativo: ligar }, `${METODO_LABEL[metodo]} ${ligar ? 'ligado' : 'desligado'}`);
  };

  useEffect(() => { carregar(); }, []);

  const nenhumDisponivel = metodos && !METODOS_PAGAMENTO.some(m => metodos[m].disponivel);

  return (
    <div className="admin-page">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <h2 style={{ margin: 0 }}>Pagamentos online</h2>
        <button className="btn btn-outline btn-sm" onClick={carregar} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          Atualizar
        </button>
      </div>
      <p style={{ color: 'var(--gray-500)', fontSize: 14, marginBottom: 24 }}>
        Escolhe o gateway de cada método e se fica disponível no checkout — por exemplo M-Pesa e e-Mola pela ClicPay e
        cartão pelo ZumboPay. Os pagamentos já iniciados continuam a ser confirmados no gateway onde foram feitos.
      </p>

      {erro && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 16, background: '#fff0f0', borderRadius: 10, marginBottom: 20, color: 'var(--red)' }}>
          <AlertCircle size={18} />
          <span>{erro}</span>
        </div>
      )}

      {loading && !metodos && (
        <p style={{ color: 'var(--gray-400)', textAlign: 'center', padding: 40 }}>A carregar...</p>
      )}

      {nenhumDisponivel && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', background: '#fff8e6', border: '1px solid #f7d58a', borderRadius: 10, marginBottom: 16, color: '#7a5200', fontSize: 13 }}>
          <AlertCircle size={16} />
          <span>Nenhum método está disponível: o site não aceita pagamentos online neste momento.</span>
        </div>
      )}

      {metodos && (
        <div style={{ background: 'white', borderRadius: 16, border: '1px solid var(--gray-200)', overflowX: 'auto', marginBottom: 32 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, minWidth: 560 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--gray-500)', fontSize: 12 }}>
                <th style={{ padding: '12px 16px' }}>Método</th>
                <th style={{ padding: '12px 16px' }}>Gateway</th>
                <th style={{ padding: '12px 16px' }}>No site</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Ligado</th>
              </tr>
            </thead>
            <tbody>
              {METODOS_PAGAMENTO.map(m => {
                const info = metodos[m];
                const unico = info.gateways.length === 1;
                return (
                  <tr key={m} style={{ borderTop: '1px solid var(--gray-100)', opacity: aGuardar === m ? 0.6 : 1 }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <MetodoPagamentoLogo metodo={m} altura={28} />
                        <span style={{ fontWeight: 600 }}>{METODO_LABEL[m]}</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {unico ? (
                        <span title="Só este gateway suporta este método">{NOME_GATEWAY[info.gateway]}</span>
                      ) : (
                        <select
                          value={info.gateway}
                          disabled={aGuardar !== null}
                          onChange={e => mudarGateway(m, e.target.value as GatewayId)}
                          style={{ padding: '6px 10px', borderRadius: 8, border: '1.5px solid var(--gray-200)', fontSize: 13, background: 'white' }}
                        >
                          {info.gateways.map(g => (
                            <option key={g.id} value={g.id} disabled={!g.configurado && g.id !== info.gateway}>
                              {NOME_GATEWAY[g.id]}{g.configurado ? '' : ' (sem carteira)'}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600,
                        padding: '3px 10px', borderRadius: 20,
                        background: info.disponivel ? '#e6f9f0' : 'var(--gray-100)',
                        color: info.disponivel ? '#1a8c5a' : 'var(--gray-500)',
                      }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: info.disponivel ? '#1a8c5a' : 'var(--gray-300)' }} />
                        {info.disponivel ? 'Disponível' : motivoIndisponivel(info)}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: aGuardar ? 'not-allowed' : 'pointer', fontSize: 12, color: 'var(--gray-500)' }}>
                        <input type="checkbox" checked={info.ativo} disabled={aGuardar !== null} onChange={() => alternar(m)} />
                        {info.ativo ? 'Ligado' : 'Desligado'}
                      </label>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <h3 style={{ fontSize: 16, marginBottom: 12 }}>Gateways</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16, marginBottom: 32 }}>
        {gateways.map(g => {
          const vars = VARIAVEIS[g.id];
          const usadoPor = metodos ? METODOS_PAGAMENTO.filter(m => metodos[m].gateway === g.id && metodos[m].disponivel) : [];
          return (
            <div key={g.id} style={{ background: 'white', borderRadius: 16, padding: 20, border: '1.5px solid var(--gray-200)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 14 }}>
                <div style={{ fontWeight: 800, fontSize: 18 }}>{g.nome}</div>
                <span style={{
                  fontSize: 11, padding: '3px 9px', borderRadius: 20, fontWeight: 700, textAlign: 'right',
                  background: usadoPor.length ? '#e6f9f0' : 'var(--gray-100)',
                  color: usadoPor.length ? '#1a8c5a' : 'var(--gray-500)',
                }}>
                  {usadoPor.length ? `Em uso: ${usadoPor.map(m => METODO_LABEL[m]).join(', ')}` : 'Sem métodos no site'}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <Estado ok={g.credenciais} texto="Credenciais" dica={vars.credenciais} />
                {METODOS_PAGAMENTO.map(m => (
                  <Estado key={m} ok={g.credenciais && g.metodos[m]} texto={`Carteira ${METODO_LABEL[m]}`} dica={vars.metodos[m]} />
                ))}
              </div>
              {g.id === 'zumbopay' && (
                <Link href="/admin/zumbopay" style={{ display: 'block', textAlign: 'center', fontSize: 12, marginTop: 14, color: 'var(--gray-500)' }}>
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
