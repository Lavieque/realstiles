const urlInput = document.getElementById('tradeflow_url');
const tokenInput = document.getElementById('capture_token');
const btnSave = document.getElementById('btn-save');
const statusEl = document.getElementById('status');

chrome.storage.local.get(['tradeflow_url', 'capture_token'], (cfg) => {
  if (cfg.tradeflow_url) urlInput.value = cfg.tradeflow_url;
  if (cfg.capture_token) tokenInput.value = cfg.capture_token;
});

btnSave.addEventListener('click', () => {
  const url = urlInput.value.trim().replace(/\/$/, '');
  const token = tokenInput.value.trim();

  if (!url) {
    statusEl.textContent = 'Introduz o URL do TradeFlow.';
    statusEl.className = 'status error';
    return;
  }
  if (!token) {
    statusEl.textContent = 'Introduz o token de captura.';
    statusEl.className = 'status error';
    return;
  }

  chrome.storage.local.set({ tradeflow_url: url, capture_token: token }, () => {
    statusEl.textContent = '✓ Configuração guardada!';
    statusEl.className = 'status success';
    setTimeout(() => { statusEl.className = 'status'; }, 3000);
  });
});
