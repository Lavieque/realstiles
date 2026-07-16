'use client';
import { useState } from 'react';

interface Props {
  site: string;
  url?: string;
  onClose: () => void;
  onRetry?: () => void;
}

type Step = 'idle' | 'capturing' | 'waiting' | 'saving' | 'done' | 'error';

export default function CookieCapturePopup({ site, url, onClose, onRetry }: Props) {
  const [step, setStep] = useState<Step>('idle');
  const [novncUrl, setNovncUrl] = useState<string>('');
  const [erro, setErro] = useState<string>('');

  const productUrl = url || `https://${site}`;

  const iniciarCaptura = async () => {
    setStep('capturing');
    setErro('');
    try {
      const r = await fetch('/api/tradeflow/session/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: productUrl }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || `Erro ${r.status}`);
      setNovncUrl(data.novncUrl || '');
      setStep('waiting');
    } catch (e: any) {
      setErro(e.message || 'Erro ao iniciar sessão');
      setStep('error');
    }
  };

  const guardarSessao = async () => {
    setStep('saving');
    setErro('');
    try {
      const r = await fetch('/api/tradeflow/session/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: productUrl }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || `Erro ${r.status}`);
      setStep('done');
    } catch (e: any) {
      setErro(e.message || 'Erro ao guardar sessão');
      setStep('error');
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div style={{
        background: 'white', borderRadius: 16, padding: '32px 28px', maxWidth: 520, width: '100%',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)', position: 'relative',
      }}>
        <button onClick={onClose} style={{
          position: 'absolute', top: 16, right: 16, background: 'none', border: 'none',
          fontSize: 20, cursor: 'pointer', color: 'var(--gray-400)',
        }}>×</button>

        <div style={{ fontSize: 32, marginBottom: 12 }}>🔒</div>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
          {site} bloqueou o acesso automático
        </h2>
        <p style={{ fontSize: 13, color: 'var(--gray-600)', lineHeight: 1.6, marginBottom: 24 }}>
          É necessário resolver um CAPTCHA num browser controlado pelo servidor para que a importação funcione.
        </p>

        {/* Passo 1 */}
        <div style={stepBox(step === 'idle' || step === 'capturing')}>
          <p style={stepTitle}>Passo 1 — Abrir browser para CAPTCHA</p>
          <p style={stepDesc}>
            Clica no botão abaixo para o servidor abrir um browser com o produto. Depois abre o VNC para resolveres o CAPTCHA.
          </p>
          {step === 'idle' && (
            <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={iniciarCaptura}>
              Iniciar browser
            </button>
          )}
          {step === 'capturing' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 13, color: 'var(--gray-500)' }}>
              <div className="spinner" style={{ width: 14, height: 14 }} /> A abrir browser...
            </div>
          )}
        </div>

        {/* Passo 2 */}
        {(step === 'waiting' || step === 'saving' || step === 'done') && (
          <div style={stepBox(true)}>
            <p style={stepTitle}>Passo 2 — Resolver o CAPTCHA no VNC</p>
            <p style={stepDesc}>
              Abre o VNC no link abaixo, resolve o CAPTCHA e aguarda o produto carregar completamente.
            </p>
            {novncUrl && (
              <a
                href={novncUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-block', marginTop: 12, background: 'var(--black)', color: 'white',
                  fontWeight: 700, fontSize: 13, padding: '8px 16px', borderRadius: 8, textDecoration: 'none',
                }}
              >
                Abrir VNC ↗
              </a>
            )}
          </div>
        )}

        {/* Passo 3 */}
        {(step === 'waiting' || step === 'saving' || step === 'done') && (
          <div style={stepBox(true)}>
            <p style={stepTitle}>Passo 3 — Guardar sessão</p>
            <p style={stepDesc}>
              Após o produto ter carregado no VNC sem CAPTCHA, clica em Guardar para salvar a sessão.
            </p>
            {step === 'waiting' && (
              <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={guardarSessao}>
                Guardar sessão
              </button>
            )}
            {step === 'saving' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 13, color: 'var(--gray-500)' }}>
                <div className="spinner" style={{ width: 14, height: 14 }} /> A guardar...
              </div>
            )}
            {step === 'done' && (
              <div style={{ marginTop: 12, padding: '10px 14px', background: '#f0fdf4', borderRadius: 8, fontSize: 13, color: '#166534', fontWeight: 600 }}>
                ✓ Sessão guardada com sucesso!
              </div>
            )}
          </div>
        )}

        {/* Erro */}
        {step === 'error' && (
          <div style={{ marginTop: 12, padding: '10px 14px', background: '#fef2f2', borderRadius: 8, fontSize: 13, color: '#991b1b' }}>
            {erro}
            <button onClick={() => setStep('idle')} style={{ display: 'block', marginTop: 8, background: 'none', border: 'none', color: '#991b1b', textDecoration: 'underline', cursor: 'pointer', fontSize: 12, padding: 0 }}>
              Tentar novamente
            </button>
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 24 }}>
          <button className="btn btn-outline" onClick={onClose}>Cancelar</button>
          {step === 'done' && onRetry && (
            <button className="btn btn-primary" onClick={() => { onClose(); onRetry(); }}>
              Importar novamente
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const stepBox = (active: boolean): React.CSSProperties => ({
  background: active ? 'var(--gray-50)' : '#f9f9f9',
  borderRadius: 12,
  padding: '16px 20px',
  border: `1px solid ${active ? 'var(--gray-200)' : '#eee'}`,
  marginBottom: 12,
  opacity: active ? 1 : 0.5,
});

const stepTitle: React.CSSProperties = { fontSize: 13, fontWeight: 700, marginBottom: 6 };
const stepDesc: React.CSSProperties = { fontSize: 12, color: 'var(--gray-500)', lineHeight: 1.5 };
