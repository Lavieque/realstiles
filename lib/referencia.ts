// Referência curta e legível de uma encomenda, usada em toda a app (UI,
// emails, notificações): "ENC" + 4 primeiros caracteres do ID do documento
// no Firestore + o número sequencial incremental da encomenda, tudo junto
// (ex: ENCA3F942). Encomendas antigas, criadas antes deste esquema existir
// e sem número sequencial atribuído, usam um formato de recurso
// ("ENC-" + 8 caracteres do ID) para continuarem a ter uma referência válida.
export function referenciaEncomenda(enc: { id: string; numero_sequencial?: number }): string {
  const prefixo = enc.id.substring(0, 4).toUpperCase();
  if (enc.numero_sequencial) return `ENC${prefixo}${enc.numero_sequencial}`;
  return `ENC-${enc.id.substring(0, 8).toUpperCase()}`;
}
