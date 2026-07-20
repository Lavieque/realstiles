const realstilesInput = document.getElementById('realstiles_url');
const urlInput = document.getElementById('tradeflow_url');
const tokenInput = document.getElementById('capture_token');
const btnSave = document.getElementById('btn-save');
const statusEl = document.getElementById('status');

chrome.storage.local.get(['realstiles_url', 'tradeflow_url', 'capture_token'], (cfg) => {
  if (cfg.realstiles_url) realstilesInput.value = cfg.realstiles_url;
  if (cfg.tradeflow_url) urlInput.value = cfg.tradeflow_url;
  if (cfg.capture_token) tokenInput.value = cfg.capture_token;
});

btnSave.addEventListener('click', () => {
  const realstilesUrl = realstilesInput.value.trim().replace(/\/$/, '');
  const url = urlInput.value.trim().replace(/\/$/, '');
  const token = tokenInput.value.trim();

  if (!realstilesUrl) {
    statusEl.textContent = 'Introduz o URL do Realstiles.';
    statusEl.className = 'status error';
    return;
  }

  chrome.storage.local.set({ realstiles_url: realstilesUrl, tradeflow_url: url, capture_token: token }, () => {
    statusEl.textContent = '✓ Configuração guardada!';
    statusEl.className = 'status success';
    setTimeout(() => { statusEl.className = 'status'; }, 3000);
  });
});
