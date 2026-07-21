try { localStorage.setItem('tradeflow_importer_ts', Date.now().toString()); } catch {}
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) try { localStorage.setItem('tradeflow_importer_ts', Date.now().toString()); } catch {}
});
