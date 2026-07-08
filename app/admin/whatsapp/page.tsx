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

export default function WhatsAppAdmin() {
  const [statusData, setStatusData] = useState<Status | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [aAcionar, setAAccionar] = useState(false);

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
    Promise.all([fetchStatus(), fetchMensagens()]).finally(() => setLoading(false));
  }, [fetchStatus, fetchMensagens]);

  // Polling enquanto aguarda QR ou ligação
  useEffect(() => {
    if (!statusData) return;
    if (statusData.status === 'ligado') return;
    const t = setInterval(fetchStatus, 2000);
    return () => clearInterval(t);
  }, [statusData?.status, fetchStatus]);

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

  if (loading) return <div className="loading"><div className="spinner" /> A carregar...</div>;

  const s = statusData;

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1>WhatsApp Notificações</h1>
        <p className="admin-page-sub">Gere a ligação WhatsApp para envio de mensagens e OTP</p>
      </div>

      {/* Estado */}
      <div className="wn-grid">
        <div className="card">
          <h3 style={{ marginBottom: 16 }}>Estado da ligação</h3>

          <div className="wn-status-row">
            <span className={`wn-dot ${s?.status === 'ligado' ? 'ligado' : s?.status === 'aguarda_qr' ? 'aguarda' : 'desligado'}`} />
            <span className="wn-status-label">
              {s?.status === 'ligado' ? 'Ligado' : s?.status === 'aguarda_qr' ? 'Aguarda leitura do QR' : 'Desligado'}
            </span>
          </div>

          {s?.numero && (
            <p style={{ color: 'var(--gray-600)', fontSize: 14, marginTop: 8 }}>
              Número: <strong>+{s.numero}</strong>
            </p>
          )}

          <div style={{ marginTop: 20, display: 'flex', gap: 10 }}>
            {s?.status === 'desligado' && (
              <button className="btn btn-primary" onClick={conectar} disabled={aAcionar}>
                {aAcionar ? 'A ligar...' : '▶ Ligar WhatsApp'}
              </button>
            )}
            {s?.status === 'ligado' && (
              <button className="btn btn-outline" onClick={desconectar}>Desligar</button>
            )}
            {s?.status === 'aguarda_qr' && (
              <button className="btn btn-outline btn-sm" onClick={fetchStatus}>↻ Actualizar</button>
            )}
          </div>
        </div>

        {/* Estatísticas */}
        <div className="card">
          <h3 style={{ marginBottom: 16 }}>Actividade</h3>
          <div className="wn-stats">
            <div className="wn-stat">
              <span className="wn-stat-num">{s?.mensagens_hoje ?? 0}</span>
              <span className="wn-stat-label">Mensagens hoje</span>
            </div>
            <div className="wn-stat">
              <span className="wn-stat-num">{total}</span>
              <span className="wn-stat-label">Total enviadas</span>
            </div>
          </div>
        </div>
      </div>

      {/* QR Code */}
      {s?.status === 'aguarda_qr' && s.qr && (
        <div className="card" style={{ marginTop: 24, textAlign: 'center', maxWidth: 400 }}>
          <h3 style={{ marginBottom: 8 }}>Lê o QR code com o WhatsApp</h3>
          <p style={{ color: 'var(--gray-500)', fontSize: 13, marginBottom: 16 }}>
            WhatsApp → Aparelhos ligados → Ligar aparelho
          </p>
          <img src={s.qr} alt="QR Code WhatsApp" style={{ width: 260, height: 260, borderRadius: 12 }} />
          <p style={{ marginTop: 12, fontSize: 12, color: 'var(--gray-400)' }}>
            ⏳ A actualizar automaticamente...
          </p>
        </div>
      )}

      {/* Histórico de mensagens */}
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
    </div>
  );
}
