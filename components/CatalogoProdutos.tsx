'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import ProdutoCard from './ProdutoCard';
import { getProdutos, getCategorias, pesquisarProdutos } from '@/lib/produtos';
import type { Produto, CategoriaConfig, ProdutosResult } from '@/lib/produtos';
import type { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';

function resolveDescendants(tree: CategoriaConfig[], slug: string): string[] {
  for (const cat of tree) {
    if (cat.slug === slug) {
      const subs = cat.subcategorias.flatMap(s => [s.slug, ...(s.subcategorias || []).map(ss => ss.slug)]);
      return [slug, ...subs];
    }
    for (const sub of cat.subcategorias) {
      if (sub.slug === slug) {
        return [slug, ...(sub.subcategorias || []).map(ss => ss.slug)];
      }
    }
  }
  return [slug];
}

const PAGE = 12;
const SCROLL_KEY = 'catalogo_scroll';

const INTERVALOS_PRECO = [
  { label: 'Todos os preços', min: 0, max: Infinity },
  { label: 'Até 500 MZN', min: 0, max: 500 },
  { label: '500 – 1 000', min: 500, max: 1000 },
  { label: '1 000 – 2 000', min: 1000, max: 2000 },
  { label: '2 000+', min: 2000, max: Infinity },
];

export default function CatalogoProdutos({ inicial, categoriasIniciais = [] }: { inicial: Produto[]; categoriasIniciais?: string[] }) {
  const searchParams = useSearchParams();
  const catParam = searchParams.get('cat');
  const qParam = searchParams.get('q') || '';

  const [todos, setTodos] = useState<Produto[]>(inicial);
  const [produtos, setProdutos] = useState<Produto[]>(inicial);
  const [categorias, setCategorias] = useState<string[]>(categoriasIniciais);
  const [catTree, setCatTree] = useState<CategoriaConfig[]>([]);
  const catTreeRef = useRef<CategoriaConfig[]>([]);
  const [tamanhos, setTamanhos] = useState<string[]>([]);
  const [cores, setCores] = useState<string[]>([]);
  const [catActual, setCatActual] = useState<string | null>(catParam);
  const [temMais, setTemMais] = useState(false);
  const [ultimoDoc, setUltimoDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState(qParam);
  const [erro, setErro] = useState(false);
  const [precoIdx, setPrecoIdx] = useState(0);
  const [tamActual, setTamActual] = useState<string | null>(null);
  const [corActual, setCorActual] = useState<string | null>(null);
  const [ordenacao, setOrdenacao] = useState('relevancia');
  const scrollRestored = useRef(false);

  // Restaurar scroll ao voltar de um produto
  useEffect(() => {
    if (scrollRestored.current) return;
    scrollRestored.current = true;
    const saved = sessionStorage.getItem(SCROLL_KEY);
    if (saved) {
      sessionStorage.removeItem(SCROLL_KEY);
      requestAnimationFrame(() => window.scrollTo(0, parseInt(saved, 10)));
    }
  }, []);

  useEffect(() => {
    fetch('/api/config/categorias')
      .then(r => r.json())
      .then((d: { categorias?: CategoriaConfig[] }) => {
        const tree = d.categorias || [];
        catTreeRef.current = tree;
        setCatTree(tree);
      })
      .catch(() => {});

    if (categoriasIniciais.length === 0) {
      getCategorias().then(setCategorias).catch(() => {});
    }
  }, [inicial]);

  useEffect(() => {
    if (catParam !== catActual) {
      setCatActual(catParam);
      carregarProdutos(catParam, false);
    }
  }, [catParam]);

  const ultimoDocRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);
  ultimoDocRef.current = ultimoDoc;

  const carregarProdutos = useCallback(async (cat: string | null, append: boolean) => {
    setLoading(true);
    setErro(false);
    try {
      const max = cat ? 200 : PAGE + 1;
      const cursor = cat ? null : (append ? ultimoDocRef.current : null);
      const slugs = cat ? resolveDescendants(catTreeRef.current, cat) : null;
      const { produtos: resultado, ultimoDoc: novoUltimoDoc } = await getProdutos({ categorias: slugs, max, ultimoDoc: cursor });
      const maisDisp = !cat && resultado.length > PAGE;
      const slice = maisDisp ? resultado.slice(0, PAGE) : resultado;
      setTemMais(maisDisp);
      setUltimoDoc(maisDisp ? novoUltimoDoc : null);
      setTodos(p => append ? [...p, ...slice] : slice);
      if (cat) {
        const tams = new Set<string>();
        const cors = new Set<string>();
        resultado.forEach(p => {
          p.tamanhos?.forEach(t => tams.add(t));
          p.cores?.forEach(c => cors.add(c));
        });
        setTamanhos(Array.from(tams).sort());
        setCores(Array.from(cors).sort());
      } else {
        setTamanhos([]);
        setCores([]);
      }
    } catch {
      setErro(true);
    } finally {
      setLoading(false);
    }
  }, []);

  // Aplicar filtros de preço, tamanho, cor e ordenação
  useEffect(() => {
    const intervalo = INTERVALOS_PRECO[precoIdx];
    let filtrados = todos.filter(p => p.preco >= intervalo.min && p.preco <= intervalo.max);
    if (tamActual) filtrados = filtrados.filter(p => p.tamanhos?.includes(tamActual));
    if (corActual) filtrados = filtrados.filter(p => p.cores?.includes(corActual));
    if (ordenacao === 'preco_asc') filtrados = [...filtrados].sort((a, b) => a.preco - b.preco);
    else if (ordenacao === 'preco_desc') filtrados = [...filtrados].sort((a, b) => b.preco - a.preco);
    else if (ordenacao === 'novidades') filtrados = [...filtrados].sort((a, b) => {
      const ta = (a.criado_em as { toDate?: () => Date })?.toDate?.()?.getTime() ?? 0;
      const tb = (b.criado_em as { toDate?: () => Date })?.toDate?.()?.getTime() ?? 0;
      return tb - ta;
    });
    setProdutos(filtrados);
  }, [todos, precoIdx, tamActual, corActual, ordenacao]);

  const filtrar = (cat: string | null) => {
    setCatActual(cat);
    setSearchTerm('');
    setPrecoIdx(0);
    setTamActual(null);
    setCorActual(null);
    const url = cat ? `/?cat=${cat}` : '/';
    window.history.pushState({}, '', url);
    carregarProdutos(cat, false);
  };

  const limparFiltros = () => {
    setPrecoIdx(0);
    setTamActual(null);
    setCorActual(null);
  };

  const temFiltrosActivos = precoIdx > 0 || tamActual !== null || corActual !== null;

  // Debounce pesquisa + sync URL
  useEffect(() => {
    if (!searchTerm.trim()) {
      const url = catActual ? `/?cat=${catActual}` : '/';
      window.history.replaceState({}, '', url);
      carregarProdutos(catActual, false);
      return;
    }
    const url = `/?q=${encodeURIComponent(searchTerm)}`;
    window.history.replaceState({}, '', url);
    const t = setTimeout(async () => {
      setLoading(true);
      setErro(false);
      try {
        const res = await pesquisarProdutos(searchTerm);
        setTodos(res);
        setTemMais(false);
      } catch {
        setErro(true);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  const mostrarSidebar = !!catActual && !searchTerm;

  // Quando há categoria activa, mostrar só descendentes que têm produtos nos resultados
  // Quando não há nada seleccionado, mostrar todas as categorias com produtos
  const categoriasVisiveis = catActual
    ? (() => {
        const descendants = resolveDescendants(catTree, catActual).filter(s => s !== catActual);
        const comProdutos = new Set(todos.map(p => p.categoria).filter(Boolean) as string[]);
        return descendants.filter(s => comProdutos.has(s));
      })()
    : categorias;

  const conteudo = erro ? (
    <div className="empty-state">
      <div className="icon">⚠️</div>
      <h3>Erro ao carregar produtos</h3>
      <p>Verifica a tua ligação e tenta novamente.</p>
      <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={() => carregarProdutos(catActual, false)}>Tentar novamente</button>
    </div>
  ) : loading && produtos.length === 0 ? (
    <div className="loading"><div className="spinner" /> A carregar...</div>
  ) : produtos.length === 0 ? (
    <div className="empty-state">
      <h3>Nenhum produto encontrado</h3>
      <p>Tenta outro filtro ou pesquisa.</p>
    </div>
  ) : (
    <>
      <div className="produtos-grid">
        {produtos.map(p => (
          <div key={p.id} onClick={() => sessionStorage.setItem(SCROLL_KEY, String(window.scrollY))}>
            <ProdutoCard produto={p} />
          </div>
        ))}
      </div>
      {temMais && !searchTerm && !erro && (
        <div style={{ textAlign: 'center', marginTop: 32 }}>
          <button className="btn btn-outline" onClick={() => carregarProdutos(catActual, true)} disabled={loading}>
            {loading ? 'A carregar...' : 'Ver mais produtos'}
          </button>
        </div>
      )}
    </>
  );

  return (
    <>
      {/* Header */}
      <div className="catalogo-header">
        <h2>{catActual ? catActual.charAt(0).toUpperCase() + catActual.slice(1) : 'Todos os produtos'}</h2>
      </div>

      {/* Categorias + Ordenação */}
      <div className="filtros">
        <button className={`filtro-btn${!catActual ? ' active' : ''}`} onClick={() => filtrar(null)}>Todos</button>
        {categoriasVisiveis.map(cat => (
          <button key={cat} className={`filtro-btn${catActual === cat ? ' active' : ''}`} onClick={() => filtrar(cat)}>
            {cat.charAt(0).toUpperCase() + cat.slice(1)}
          </button>
        ))}
        <select className="filtro-ordenacao" value={ordenacao} onChange={e => setOrdenacao(e.target.value)}>
          <option value="relevancia">Relevância</option>
          <option value="novidades">Novidades</option>
          <option value="preco_asc">Preço: menor primeiro</option>
          <option value="preco_desc">Preço: maior primeiro</option>
        </select>
      </div>

      {/* Layout com sidebar se categoria activa */}
      {mostrarSidebar ? (
        <div className="catalogo-com-sidebar">
          {/* Sidebar */}
          <aside className="filtros-sidebar">
            <div className="filtros-sidebar-header">
              <span>Filtros</span>
              {temFiltrosActivos && (
                <button className="filtros-limpar" onClick={limparFiltros}>Limpar</button>
              )}
            </div>

            {/* Preço */}
            <div className="filtro-grupo">
              <p className="filtro-grupo-titulo">Preço</p>
              {INTERVALOS_PRECO.map((f, i) => (
                <label key={f.label} className="filtro-radio">
                  <input
                    type="radio"
                    name="preco"
                    checked={precoIdx === i}
                    onChange={() => setPrecoIdx(i)}
                  />
                  <span>{f.label}</span>
                </label>
              ))}
            </div>

            {/* Tamanho */}
            {tamanhos.length > 0 && (
              <div className="filtro-grupo">
                <p className="filtro-grupo-titulo">Tamanho</p>
                <div className="filtro-tam-grid">
                  <button
                    className={`filtro-tam-btn${tamActual === null ? ' active' : ''}`}
                    onClick={() => setTamActual(null)}
                  >
                    Todos
                  </button>
                  {tamanhos.map(t => (
                    <button
                      key={t}
                      className={`filtro-tam-btn${tamActual === t ? ' active' : ''}`}
                      onClick={() => setTamActual(tamActual === t ? null : t)}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Cor */}
            {cores.length > 0 && (
              <div className="filtro-grupo">
                <p className="filtro-grupo-titulo">Cor</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label className="filtro-radio">
                    <input type="radio" name="cor" checked={corActual === null} onChange={() => setCorActual(null)} />
                    <span>Todas as cores</span>
                  </label>
                  {cores.map(c => (
                    <label key={c} className="filtro-radio">
                      <input type="radio" name="cor" checked={corActual === c} onChange={() => setCorActual(c)} />
                      <span>{c.charAt(0).toUpperCase() + c.slice(1)}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Contagem */}
            <p className="filtros-contagem">
              {produtos.length} produto{produtos.length !== 1 ? 's' : ''}
            </p>
          </aside>

          {/* Produtos */}
          <div className="catalogo-resultado">
            {conteudo}
          </div>
        </div>
      ) : (
        conteudo
      )}
    </>
  );
}
