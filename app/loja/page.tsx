import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import CatalogoProdutos from '@/components/CatalogoProdutos';
import type { ModoLoja } from '@/components/CatalogoProdutos';
import { gerarSeedAleatoria } from '@/lib/aleatorio';

export const metadata: Metadata = {
  title: 'Explorar produtos — Real Stiles',
  description: 'Moda, eletrónica, beleza e casa. Filtra por categoria, preço, tamanho e cor.',
};

const MODOS: { chave: ModoLoja; rotulo: string; titulo: string; sub: string }[] = [
  { chave: null, rotulo: 'Todos', titulo: 'Encontra o que combina contigo.', sub: 'Moda, eletrónica, beleza e casa, por encomenda.' },
  { chave: 'novidades', rotulo: 'Novidades', titulo: 'As novidades da seleção.', sub: 'Os artigos mais recentes, primeiro.' },
  { chave: 'mais-vendidos', rotulo: 'Mais vendidos', titulo: 'Os mais pedidos.', sub: 'Os artigos que mais clientes encomendaram.' },
  { chave: 'cinco-estrelas', rotulo: 'Avaliação 5 estrelas', titulo: 'Os mais bem avaliados.', sub: 'Artigos com a melhor opinião de quem comprou.' },
];

export default function LojaPage({ searchParams }: { searchParams: { mode?: string; cat?: string } }) {
  if (searchParams.mode === 'promocoes') redirect('/promocoes');
  const actual = MODOS.find(m => m.chave === searchParams.mode) || MODOS[0];
  const seed = gerarSeedAleatoria();
  const topo = {
    eyebrow: 'A tua seleção Real Stiles',
    titulo: actual.titulo,
    sub: actual.sub,
    modos: [
      ...MODOS.map(m => ({ rotulo: m.rotulo, href: m.chave ? `/loja?mode=${m.chave}` : '/loja', activo: m.chave === actual.chave })),
      { rotulo: 'Promoções', href: '/promocoes', activo: false },
    ],
  };

  return (
    <Suspense fallback={<div className="loading"><div className="spinner" /> A carregar...</div>}>
      <CatalogoProdutos inicial={[]} seedInicial={seed} basePath="/loja" modo={actual.chave} ocultarTitulo topo={topo} />
    </Suspense>
  );
}
