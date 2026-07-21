const _tfSet = () => { try { localStorage.setItem('tradeflow_importer_ts', Date.now().toString()); } catch {} };
_tfSet();
setInterval(_tfSet, 5000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) _tfSet(); });
