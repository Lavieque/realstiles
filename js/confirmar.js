// ── CONFIRMAR.JS — modal de confirmação customizado ──

let _resolveConfirm = null;

function injectModal() {
  if (document.getElementById('confirm-modal')) return;

  const css = `
    #confirm-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,0.5);
      z-index: 9998; display: none; align-items: center; justify-content: center;
      padding: 20px;
    }
    #confirm-overlay.open { display: flex; animation: cfFadeIn .15s ease; }
    @keyframes cfFadeIn { from { opacity: 0 } to { opacity: 1 } }
    #confirm-modal {
      background: white; border-radius: 16px; padding: 32px 28px 24px;
      max-width: 420px; width: 100%;
      box-shadow: 0 20px 60px rgba(13,19,71,0.2);
      animation: cfSlideUp .2s ease;
    }
    @keyframes cfSlideUp { from { transform: translateY(16px); opacity: 0 } to { transform: none; opacity: 1 } }
    #confirm-icon { font-size: 36px; margin-bottom: 12px; }
    #confirm-title {
      font-family: 'Playfair Display', serif;
      font-size: 1.2rem; font-weight: 700; margin-bottom: 8px; color: #0d1347;
    }
    #confirm-msg { font-size: 14px; color: #4a4a6a; line-height: 1.6; margin-bottom: 24px; }
    #confirm-actions { display: flex; gap: 10px; justify-content: flex-end; }
  `;

  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  document.body.insertAdjacentHTML('beforeend', `
    <div id="confirm-overlay">
      <div id="confirm-modal" role="dialog" aria-modal="true">
        <div id="confirm-icon">⚠️</div>
        <div id="confirm-title">Tens a certeza?</div>
        <p id="confirm-msg"></p>
        <div id="confirm-actions">
          <button id="confirm-cancel" class="btn btn-outline btn-sm" onclick="window._confirmResp(false)">Cancelar</button>
          <button id="confirm-ok" class="btn btn-danger btn-sm" onclick="window._confirmResp(true)">Confirmar</button>
        </div>
      </div>
    </div>
  `);

  // Fechar com Escape
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && document.getElementById('confirm-overlay').classList.contains('open')) {
      window._confirmResp(false);
    }
  });

  // Fechar ao clicar no overlay (fora do modal)
  document.getElementById('confirm-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) window._confirmResp(false);
  });

  window._confirmResp = (resp) => {
    document.getElementById('confirm-overlay').classList.remove('open');
    if (_resolveConfirm) { _resolveConfirm(resp); _resolveConfirm = null; }
  };
}

export function confirmar(mensagem, { titulo = 'Tens a certeza?', icone = '⚠️', labelOk = 'Confirmar', corOk = 'btn-danger' } = {}) {
  injectModal();

  document.getElementById('confirm-icon').textContent = icone;
  document.getElementById('confirm-title').textContent = titulo;
  document.getElementById('confirm-msg').textContent = mensagem;
  const okBtn = document.getElementById('confirm-ok');
  okBtn.textContent = labelOk;
  okBtn.className = `btn ${corOk} btn-sm`;

  document.getElementById('confirm-overlay').classList.add('open');
  document.getElementById('confirm-cancel').focus();

  return new Promise(resolve => { _resolveConfirm = resolve; });
}
