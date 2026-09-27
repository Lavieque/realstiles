// Normaliza texto para pesquisa: minúsculas, sem acentos, sem espaços extra.
export function normalizarPesquisa(texto: unknown): string {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

// Verdadeiro se todas as palavras do termo aparecem em algum dos campos
// (ex.: "vestido preto" encontra um produto com "Vestido" no nome e "preto" nas cores).
// Campos que sejam arrays são expandidos; null/undefined são ignorados.
export function correspondePesquisa(termo: string, campos: unknown[]): boolean {
  const palavras = normalizarPesquisa(termo).split(/\s+/).filter(Boolean);
  if (!palavras.length) return true;
  const texto = campos
    .flat(2)
    .filter(c => c !== null && c !== undefined && c !== '')
    .map(normalizarPesquisa)
    .join(' ');
  return palavras.every(p => texto.includes(p));
}
