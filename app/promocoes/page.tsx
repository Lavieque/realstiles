'use client';
import { useEffect, useState } from 'react';
import ProdutoCard from '@/components/ProdutoCard';
import FiltrosSidebar, { FiltroGrupo, FiltroCategorias, FiltroPreco, dentroDoIntervalo } from '@/components/FiltrosSidebar';
import { getProdutos } from '@/lib/produtos';
import type { Produto } from '@/lib/produtos';
import { estadoPromocao } from '@/lib/promocao';
import { Flame, Tag } from 'lucide-react';

const PAGE = 12;

type Ordem = 'fim' | 'desconto' | 'preco_asc' | 'preco_desc';

export default function PromocoesPage() {
  const [todos, setTodos] = useState<Produto[]>([]);
  const [categorias, setCategorias] = useState<string[]>([]);
  const [catActual, setCatActual] = useState<string | null>(null);
  const [precoIdx, setPrecoIdx] = useState(0);
  const [ordem, setOrdem] = useState<Ordem>('fim');
  const [loading, setLoading] = useState(true);
  const [pagina, setPagina] = useState(PAGE);

  useEffect(() => {
    getProdutos({ emPromocao: true, max: 500 })
      .then(({ produtos: all }) => {
        // Só as activas agora (exclui agendadas e já terminadas)
        const emPromo = all.filter(p => estadoPromocao(p).activa);
        setTodos(emPromo);
        const cats = Array.from(new Set(emPromo.map(p => p.categoria).filter(Boolean) as string[])).sort();
        setCategorias(cats);
      })
      .finally(() => setLoading(false));
  }, []);

  const filtrados = todos
    .filter(p => !catActual || p.categoria === catActual)
    .filter(p => dentroDoIntervalo(estadoPromocao(p).preco, precoIdx))
    .sort((a, b) => {
      const ea = estadoPromocao(a), eb = estadoPromocao(b);
      switch (ordem) {
        case 'desconto':   return eb.desconto - ea.desconto;
        case 'preco_asc':  return ea.preco - eb.preco;
        case 'preco_desc': return eb.preco - ea.preco;
        // A terminar primeiro; sem data de fim vão para o fim
        default:           return (ea.fim ?? Infinity) - (eb.fim ?? Infinity);
      }
    });
  const visiveis = filtrados.slice(0, pagina);

  const mudarCategoria = (cat: string | null) => { setCatActual(cat); setPagina(PAGE); };
  const mudarPreco = (idx: number) => { setPrecoIdx(idx); setPagina(PAGE); };
  const limpar = () => { setCatActual(null); setPrecoIdx(0); setPagina(PAGE); };
  const numActivos = [!!catActual, precoIdx > 0].filter(Boolean).length;

  return (
    <>
      {/* HERO */}
      <div className="promo-hero">
        <div className="promo-hero-texto">
          <h1>Promoções<br />imperdíveis</h1>
          <p>Os melhores artigos com descontos especiais. Aproveita enquanto há stock!</p>
        </div>
        <div className="promo-hero-badge">
          <Flame size={20} strokeWidth={1.5} /> {loading ? 'A carregar...' : `${todos.length} artigos em promoção`}
        </div>
      </div>

      {/* GRID */}
      <div className="promo-section">
        <div className="promo-topo">
          <h2>Artigos em promoção</h2>
          <select className="filtro-ordenacao" value={ordem} onChange={e => setOrdem(e.target.value as Ordem)}>
            <option value="fim">A terminar primeiro</option>
            <option value="desconto">Maior desconto</option>
            <option value="preco_asc">Preço: menor primeiro</option>
            <option value="preco_desc">Preço: maior primeiro</option>
          </select>
        </div>

        <div className="catalogo-com-sidebar">
          <FiltrosSidebar
            numActivos={numActivos}
            onLimpar={limpar}
            contagem={loading ? undefined : `${filtrados.length} artigo${filtrados.length !== 1 ? 's' : ''}`}
            fecharQuando={catActual}
          >
            {categorias.length > 0 && (
              <FiltroGrupo titulo="Categoria" primeiro>
                <FiltroCategorias categorias={categorias} actual={catActual} onChange={mudarCategoria} rotuloTodos="Todas" />
              </FiltroGrupo>
            )}
            <FiltroGrupo titulo="Preço" primeiro={categorias.length === 0}>
              <FiltroPreco valor={precoIdx} onChange={mudarPreco} />
            </FiltroGrupo>
          </FiltrosSidebar>

          <div className="catalogo-resultado">
            {loading ? (
              <div className="loading"><div className="spinner" /> A carregar promoções...</div>
            ) : filtrados.length === 0 ? (
              <div className="promo-vazio">
                <div className="icon"><Tag size={40} strokeWidth={1.5} /></div>
                <h3>Sem promoções {numActivos > 0 ? 'com estes filtros' : 'activas'}</h3>
                <p>{numActivos > 0 ? 'Tenta outro filtro.' : 'Volta em breve para novos descontos.'}</p>
              </div>
            ) : (
              <>
                <div className="produtos-grid">
                  {visiveis.map(p => <ProdutoCard key={p.id} produto={p} />)}
                </div>
                {filtrados.length > pagina && (
                  <div style={{ textAlign: 'center', marginTop: 40 }}>
                    <button
                      className="btn btn-outline"
                      style={{ borderColor: 'var(--red)', color: 'var(--red)' }}
                      onClick={() => setPagina(n => n + PAGE)}
                    >
                      Ver mais promoções
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
