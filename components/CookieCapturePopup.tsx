'use client';
import { useEffect, useState } from 'react';

interface Props {
  site: string;
  url?: string; // full product URL to open directly
  onClose: () => void;
  onRetry?: () => void;
}

export default function CookieCapturePopup({ site, url, onClose, onRetry }: Props) {
  const [bookmarklet, setBookmarklet] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/tradeflow/bookmarklet')
      .then(r => r.json())
      .then(d => { setBookmarklet(d.bookmarklet || ''); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const siteUrl = url || `https://${site}`;

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
        }}>x</button>

        <div style={{ fontSize: 32, marginBottom: 12 }}>🍪</div>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
          {site} bloqueou o acesso automático
        </h2>
        <p style={{ fontSize: 13, color: 'var(--gray-600)', lineHeight: 1.6, marginBottom: 24 }}>
          Alguns sites (como Shein, Temu, etc.) exigem que estejas com sessão iniciada para aceder
          aos dados do produto. Podes resolver isto guardando os teus cookies do browser com o
          bookmarklet abaixo.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ background: 'var(--gray-50)', borderRadius: 12, padding: '16px 20px', border: '1px solid var(--gray-200)' }}>
            <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
              Passo 1 — Instala o bookmarklet (só precisas fazer uma vez)
            </p>
            <p style={{ fontSize: 12, color: 'var(--gray-500)', marginBottom: 12, lineHeight: 1.5 }}>
              Arrasta o botão abaixo para a barra de favoritos do teu browser. Se a barra
              não estiver visível, ativa-a com <strong>Ctrl+Shift+B</strong>.
            </p>
            {loading ? (
              <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>A carregar...</div>
            ) : bookmarklet ? (
              <a
                href={bookmarklet}
                onClick={e => { e.preventDefault(); alert('Arrasta este botão para a barra de favoritos — não cliques aqui directamente.'); }}
                style={{
                  display: 'inline-block', background: '#4f46e5', color: 'white',
                  fontWeight: 700, fontSize: 13, padding: '8px 16px', borderRadius: 8,
                  textDecoration: 'none', cursor: 'grab',
                }}
              >
                Guardar Cookies TradeFlow
              </a>
            ) : (
              <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>Bookmarklet indisponível. Verifica a configuração do servidor.</div>
            )}
          </div>

          <div style={{ background: 'var(--gray-50)', borderRadius: 12, padding: '16px 20px', border: '1px solid var(--gray-200)' }}>
            <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
              Passo 2 — Abre o site e navega um pouco
            </p>
            <p style={{ fontSize: 12, color: 'var(--gray-500)', marginBottom: 12, lineHeight: 1.5 }}>
              Abre o site, inicia sessão se necessário, e navega até aparecer algum produto.
              Isto garante que os cookies de sessao estao activos.
            </p>
            <a
              href={siteUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-block', background: 'var(--black)', color: 'white',
                fontWeight: 700, fontSize: 13, padding: '8px 16px', borderRadius: 8,
                textDecoration: 'none',
              }}
            >
              Abrir {site} ↗
            </a>
          </div>

          <div style={{ background: 'var(--gray-50)', borderRadius: 12, padding: '16px 20px', border: '1px solid var(--gray-200)' }}>
            <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
              Passo 3 — Clica no bookmarklet
            </p>
            <p style={{ fontSize: 12, color: 'var(--gray-500)', lineHeight: 1.5 }}>
              Com o site aberto (após navegares nele), clica no favorito <strong>Guardar Cookies TradeFlow</strong>
              que instalaste no Passo 1. Deves ver uma mensagem de confirmacao.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 24 }}>
          <button className="btn btn-outline" onClick={onClose}>Cancelar</button>
          {onRetry && (
            <button className="btn btn-primary" onClick={() => { onClose(); onRetry(); }}>
              Ja guardei os cookies — tentar novamente
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
