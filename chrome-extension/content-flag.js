document.addEventListener('tradeflow_check', () => {
  document.dispatchEvent(new CustomEvent('tradeflow_response', { detail: { installed: true } }));
});
