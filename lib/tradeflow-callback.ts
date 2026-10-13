import crypto from 'crypto';

// Segredo partilhado do callback /api/tradeflow/confirm, que é o que impede
// um pedido anónimo de sobrescrever configuracoes/tradeflow (account_id,
// license_key, store_url).
//
// O TradeFlow não documenta o envio de cabeçalhos próprios no callback, por
// isso o segredo também é aceite no parametro `s` do URL — é esse URL que o
// nosso servidor regista no TradeFlow em /api/tradeflow/conta e /checkout.
// O cabeçalho continua a ser o caminho preferido: um segredo no URL acaba
// nos registos de acesso.

export function segredoCallback(): string {
  return process.env.TRADEFLOW_CALLBACK_SECRET || '';
}

// URL a registar no TradeFlow, já com o segredo. Devolve '' se não houver
// segredo configurado, para quem chama não registar um callback inútil.
export function urlCallback(base: string): string {
  const secret = segredoCallback();
  if (!base || !secret) return '';
  return `${base.replace(/\/$/, '')}/api/tradeflow/confirm?s=${encodeURIComponent(secret)}`;
}

// Comparação em tempo constante, tolerante a comprimentos diferentes
export function segredoValido(recebido: string | null | undefined, esperado: string): boolean {
  if (!recebido || !esperado) return false;
  const a = crypto.createHash('sha256').update(recebido).digest();
  const b = crypto.createHash('sha256').update(esperado).digest();
  return crypto.timingSafeEqual(a, b);
}
