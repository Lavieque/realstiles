// Nomes das colecções de catálogo. No ambiente Preview da Vercel define-se
// NEXT_PUBLIC_DADOS_PREVIEW=1 e o site passa a ler/escrever uma cópia do
// catálogo (produtos + categorias) sem tocar nos dados de produção.
// É NEXT_PUBLIC_ para ser igual no browser e no servidor.
const PREVIEW = process.env.NEXT_PUBLIC_DADOS_PREVIEW === '1';

export const COL_PRODUTOS = PREVIEW ? 'produtos_preview' : 'produtos';
// Documento da colecção `config` com as categorias e categorias_ativas
export const DOC_LOJA = PREVIEW ? 'loja_preview' : 'loja';
