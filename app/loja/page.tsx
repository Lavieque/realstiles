import { Suspense } from 'react';
import Link from 'next/link';
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
  { chave: 'cinco-estrelas', rotulo: 'Avaliação 5 estrelas', titulo: 'Os mais bem avaliados.', sub: 'Artigos com a melhor opinião de quem comprou.' },
];

export default function LojaPage({ searchParams }: { searchParams: { mode?: string; cat?: string } }) {
  if (searchParams.mode === 'promocoes') redirect('/promocoes');
  const actual = MODOS.find(m => m.chave === searchParams.mode) || MODOS[0];
  const seed = gerarSeedAleatoria();

  return (
    <>
      <header className="loja-topo">
        <div className="loja-topo-inner">
          <nav className="loja-trilho" aria-label="Localização">
            <Link href="/">Início</Link><span aria-hidden="true">›</span><span>Explorar</span>
          </nav>
          <span className="eyebrow">A tua seleção Real Stiles</span>
          <h1 className="display-titulo">{actual.titulo}</h1>
          <p className="loja-sub">{actual.sub}</p>
          <div className="loja-modos">
            {MODOS.map(m => (
              <Link key={m.rotulo} href={m.chave ? `/loja?mode=${m.chave}` : '/loja'} className={`loja-modo${m.chave === actual.chave ? ' activo' : ''}`}>
                {m.rotulo}
              </Link>
            ))}
            <Link href="/promocoes" className="loja-modo">Promoções</Link>
          </div>
        </div>
      </header>
      <div className="loja-corpo">
        <Suspense fallback={<div className="loading"><div className="spinner" /> A carregar...</div>}>
          <CatalogoProdutos inicial={[]} seedInicial={seed} basePath="/loja" modo={actual.chave} ocultarTitulo />
        </Suspense>
      </div>
    </>
  );
}
