'use client';
import { useEffect, useState, useCallback } from 'react';
import { mostrarToast } from '@/components/Toast';

type Status = {
  status: 'ligado' | 'desligado' | 'aguarda_qr';
  qr: string | null;
  numero: string | null;
  mensagens_hoje: number;
};

type Mensagem = {
  telefone: string;
  mensagem: string;
  tipo: string;
  status: string;
  enviado_em: string;
};

const STORAGE_KEY = 'wn_aderido';

function IconWhatsApp() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
      <circle cx="24" cy="24" r="24" fill="#25D366" />
      <path d="M34.5 13.4C32.1 11 28.9 9.5 25.5 9.5C18.3 9.5 12.5 15.3 12.5 22.5C12.5 24.9 13.1 27.2 14.3 29.2L12.3 36.5L19.8 34.5C21.7 35.6 23.6 36.2 25.5 36.2C32.7 36.2 38.5 30.4 38.5 23.2C38.5 19.8 37.1 16.6 34.5 13.4ZM25.5 33.9C23.8 33.9 22.1 33.4 20.6 32.5L20.2 32.3L15.8 33.5L17 29.2L16.8 28.8C15.8 27.2 15.2 25.4 15.2 23.5C15.2 17.9 19.9 13.2 25.5 13.2C28.2 13.2 30.7 14.3 32.6 16.2C34.5 18.1 35.6 20.6 35.6 23.3C35.8 28.9 31.1 33.9 25.5 33.9ZM31.1 25.9C30.8 25.7 29.3 25 29 24.8C28.7 24.7 28.5 24.6 28.3 24.9C28.1 25.2 27.5 25.8 27.4 26C27.2 26.2 27.1 26.2 26.8 26.1C26.5 25.9 25.5 25.6 24.3 24.5C23.4 23.7 22.8 22.7 22.6 22.4C22.4 22.1 22.6 21.9 22.8 21.7C22.9 21.6 23.1 21.4 23.3 21.2C23.5 21 23.5 20.9 23.6 20.7C23.7 20.5 23.6 20.3 23.5 20.1C23.4 19.9 22.8 18.4 22.5 17.8C22.2 17.1 21.9 17.2 21.7 17.2H21.2C21 17.2 20.7 17.3 20.4 17.6C20.1 17.9 19.4 18.6 19.4 20.1C19.4 21.6 20.5 23.1 20.6 23.3C20.8 23.5 22.8 26.6 25.8 27.9C26.5 28.2 27.1 28.4 27.5 28.5C28.2 28.7 28.9 28.7 29.4 28.6C30 28.5 31.2 27.9 31.5 27.2C31.8 26.5 31.8 26 31.7 25.9C31.6 25.9 31.4 25.9 31.1 25.9Z" fill="white" />
    </svg>
  );
}

export default function WhatsAppAdmin() {
  const [aderido, setAderido] = useState(false);
  const [statusData, setStatusData] = useState<Status | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [aAccionar, setAAccionar] = useState(false);
  const [temWhatsappTF, setTemWhatsappTF] = useState<boolean | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    fetch('/api/tradeflow/conta').then(r => r.json()).then(d => {
      setTemWhatsappTF(d.conta?.whatsapp_ativo === true);
    }).catch(() => setTemWhatsappTF(false));
  }, []);

  const comprarAddon = async () => {
    setPortalLoading(true);
    try {
      const snap = await fetch('/api/tradeflow/conta').then(r => r.json());
      const accountId = snap.conta?.id;
      if (!accountId) throw new Error('Sem conta TradeFlow');
      const res = await fetch('/api/tradeflow/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: accountId,
          plano_id: 'whatsapp',
          success_url: `${window.location.origin}/admin/whatsapp?sucesso=1`,
          cancel_url: `${window.location.origin}/admin/whatsapp`,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || 'Erro');
      window.location.href = data.url;
    } catch (err: unknown) {
      mostrarToast(err instanceof Error ? err.message : 'Erro ao iniciar checkout', 'error');
      setPortalLoading(false);
    }
  };

  useEffect(() => {
    setAderido(localStorage.getItem(STORAGE_KEY) === '1');
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/notify/status');
      if (!res.ok) return;
      const data = await res.json();
      setStatusData(data);
    } catch {}
  }, []);

  const fetchMensagens = useCallback(async () => {
    try {
      const res = await fetch('/api/notify/messages');
      if (!res.ok) return;
      const data = await res.json();
      setMensagens(data.mensagens || []);
      setTotal(data.total || 0);
    } catch {}
  }, []);

  useEffect(() => {
    if (!aderido) { setLoading(false); return; }
    Promise.all([fetchStatus(), fetchMensagens()]).finally(() => setLoading(false));
  }, [aderido, fetchStatus, fetchMensagens]);

  useEffect(() => {
    if (!statusData) return;
    if (statusData.status === 'ligado') return;
    const t = setInterval(fetchStatus, 2000);
    return () => clearInterval(t);
  }, [statusData?.status, fetchStatus]);

  const aderir = async () => {
    localStorage.setItem(STORAGE_KEY, '1');
    setAderido(true);
    setLoading(true);
    await fetch('/api/config/notify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ whatsapp_login: true }) }).catch(() => {});
    Promise.all([fetchStatus(), fetchMensagens()]).finally(() => setLoading(false));
  };

  const cancelarServico = async () => {
    if (!confirm('Tens a certeza que queres cancelar o serviço WhatsApp? O login por WhatsApp ficará desactivado para os clientes.')) return;
    localStorage.removeItem(STORAGE_KEY);
    await fetch('/api/config/notify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ whatsapp_login: false }) }).catch(() => {});
    setAderido(false);
    setStatusData(null);
  };

  const conectar = async () => {
    setAAccionar(true);
    try {
      const res = await fetch('/api/notify/connect', { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        mostrarToast('A gerar QR code...', 'info');
        fetchStatus();
      } else {
        mostrarToast(data.erro || 'Erro ao conectar', 'error');
      }
    } catch {
      mostrarToast('Erro ao conectar à API', 'error');
    } finally {
      setAAccionar(false);
    }
  };

  const desconectar = async () => {
    if (!confirm('Tens a certeza que queres desligar o WhatsApp?')) return;
    try {
      const res = await fetch('/api/notify/disconnect', { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        mostrarToast('Sessão terminada', 'success');
        fetchStatus();
      }
    } catch {
      mostrarToast('Erro ao desligar', 'error');
    }
  };

  // Ecrã de boas-vindas (não aderiu ainda)
  if (!aderido) {
    return (
      <div className="admin-page">
        <div className="wn-onboarding">
          <div className="wn-onboarding-icon"><IconWhatsApp /></div>
          <h1 className="wn-onboarding-title">WhatsApp Notify</h1>
          <p className="wn-onboarding-desc">
            Envia notificações de encomendas, códigos OTP e mensagens personalizadas
            diretamente pelo WhatsApp para os teus clientes.
          </p>
          <div className="wn-features">
            <div className="wn-feature">
              <span className="wn-feature-icon">🔐</span>
              <div>
                <strong>Autenticação OTP</strong>
                <p>Login por código enviado via WhatsApp</p>
              </div>
            </div>
            <div className="wn-feature">
              <span className="wn-feature-icon">📦</span>
              <div>
                <strong>Notificações de encomendas</strong>
                <p>Atualizações de estado em tempo real</p>
              </div>
            </div>
            <div className="wn-feature">
              <span className="wn-feature-icon">📱</span>
              <div>
                <strong>Um número, tudo incluído</strong>
                <p>Usa o teu número pessoal ou de empresa</p>
              </div>
            </div>
          </div>
          {temWhatsappTF === false && (
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: '14px 18px', marginBottom: 16, textAlign: 'left' }}>
              <p style={{ fontWeight: 700, color: '#92400e', marginBottom: 4, fontSize: 14 }}>⚠ O teu plano não inclui WhatsApp</p>
              <p style={{ fontSize: 13, color: '#78350f', marginBottom: 12 }}>Adiciona o WhatsApp Add-on por €3.50/mês para activar este serviço.</p>
              <button className="btn btn-primary btn-sm" onClick={comprarAddon} disabled={portalLoading}>
                {portalLoading ? 'A redirecionar...' : '💳 Comprar WhatsApp Add-on — €3.50/mês'}
              </button>
            </div>
          )}
          <button className="btn btn-primary wn-onboarding-btn" onClick={aderir} disabled={temWhatsappTF === false}>
            Aderir ao serviço
          </button>
          <p className="wn-onboarding-note">
            Após aderir, precisarás de ligar o teu WhatsApp lendo um QR code.
          </p>
        </div>
      </div>
    );
  }

  if (loading) return <div className="loading"><div className="spinner" /> A carregar...</div>;

  const s = statusData;
  const isLigado = s?.status === 'ligado';
  const isAguarda = s?.status === 'aguarda_qr';

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <IconWhatsApp />
          <div>
            <h1>WhatsApp Notify</h1>
            <p className="admin-page-sub">Gere a ligação e acompanha as mensagens enviadas</p>
          </div>
        </div>
      </div>

      <div className="wn-grid" style={{ marginTop: 24 }}>
        {/* Estado */}
        <div className="card">
          <h3 style={{ marginBottom: 20 }}>Estado da ligação</h3>

          <div className={`wn-status-card ${isLigado ? 'ligado' : isAguarda ? 'aguarda' : 'desligado'}`}>
            <div className="wn-status-indicator">
              <span className={`wn-dot ${isLigado ? 'ligado' : isAguarda ? 'aguarda' : 'desligado'}`} />
              <span className="wn-status-label">
                {isLigado ? 'Ligado' : isAguarda ? 'Aguarda leitura do QR' : 'Desligado'}
              </span>
            </div>
            {s?.numero && (
              <p className="wn-numero">+{s.numero}</p>
            )}
          </div>

          <div style={{ marginTop: 20, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {!isLigado && !isAguarda && (
              <button className="btn btn-primary" onClick={conectar} disabled={aAccionar}>
                {aAccionar ? 'A ligar...' : '▶ Ligar WhatsApp'}
              </button>
            )}
            {isLigado && (
              <button className="btn btn-outline" onClick={desconectar}>Desligar</button>
            )}
            {isAguarda && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--gray-500)', fontSize: 13 }}>
                <div className="spinner" style={{ width: 16, height: 16 }} />
                A aguardar leitura do QR...
              </div>
            )}
          </div>
        </div>

        {/* Estatísticas */}
        <div className="card">
          <h3 style={{ marginBottom: 20 }}>Actividade</h3>
          <div className="wn-stats">
            <div className="wn-stat">
              <span className="wn-stat-num">{s?.mensagens_hoje ?? 0}</span>
              <span className="wn-stat-label">Hoje</span>
            </div>
            <div className="wn-stat">
              <span className="wn-stat-num">{total}</span>
              <span className="wn-stat-label">Total enviadas</span>
            </div>
          </div>
          {!isLigado && (
            <p style={{ fontSize: 13, color: 'var(--gray-400)', marginTop: 16 }}>
              Liga o WhatsApp para começar a enviar mensagens.
            </p>
          )}
        </div>
      </div>

      {/* QR Code */}
      {isAguarda && (
        <div className="card wn-qr-card" style={{ marginTop: 24 }}>
          <div className="wn-qr-inner">
            <div>
              <h3>Lê o QR code com o WhatsApp</h3>
              <ol className="wn-qr-steps">
                <li>Abre o WhatsApp no teu telemóvel</li>
                <li>Vai a <strong>Aparelhos ligados</strong></li>
                <li>Toca em <strong>Ligar aparelho</strong></li>
                <li>Aponta a câmara para o QR code</li>
              </ol>
            </div>
            <div className="wn-qr-img-wrap">
              {s?.qr
                ? <img src={s.qr} alt="QR Code WhatsApp" className="wn-qr-img" />
                : <div className="wn-qr-placeholder"><div className="spinner" /></div>
              }
              <p className="wn-qr-timer">⏳ A actualizar automaticamente...</p>
            </div>
          </div>
        </div>
      )}

      {/* Histórico */}
      <div className="card" style={{ marginTop: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3>Histórico de mensagens</h3>
          <button className="btn btn-outline btn-sm" onClick={fetchMensagens}>↻ Actualizar</button>
        </div>
        {mensagens.length === 0 ? (
          <p style={{ color: 'var(--gray-400)', textAlign: 'center', padding: '32px 0' }}>
            Nenhuma mensagem enviada ainda
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Telefone</th>
                  <th>Mensagem</th>
                  <th>Tipo</th>
                  <th>Estado</th>
                  <th>Data</th>
                </tr>
              </thead>
              <tbody>
                {mensagens.map((m, i) => (
                  <tr key={i}>
                    <td>{m.telefone}</td>
                    <td style={{ maxWidth: 300, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.mensagem}</td>
                    <td><span className="badge-estado">{m.tipo}</span></td>
                    <td><span className={`badge-estado badge-${m.status === 'enviado' ? 'confirmada' : 'pendente'}`}>{m.status}</span></td>
                    <td style={{ whiteSpace: 'nowrap', fontSize: 13 }}>{new Date(m.enviado_em).toLocaleString('pt-PT')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Cancelar serviço */}
      <div style={{ marginTop: 32, padding: '20px 24px', background: '#fff5f5', border: '1px solid #fecaca', borderRadius: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
          <div>
            <p style={{ fontWeight: 600, fontSize: 14, color: 'var(--red)', marginBottom: 4 }}>Cancelar serviço WhatsApp</p>
            <p style={{ fontSize: 13, color: 'var(--gray-500)' }}>Remove a integração e desactiva o login por WhatsApp para os clientes.</p>
          </div>
          <button className="btn btn-outline btn-sm" style={{ color: 'var(--red)', borderColor: 'var(--red)', whiteSpace: 'nowrap' }} onClick={cancelarServico}>
            Cancelar serviço
          </button>
        </div>
      </div>
    </div>
  );
}
