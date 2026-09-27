'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { AlertTriangle, ChevronDown, SlidersHorizontal } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import ProdutoCard from './ProdutoCard';
import { getProdutos, getProdutosAleatorios, getCategoriasAtivas, pesquisarProdutos } from '@/lib/produtos';
import type { Produto, CategoriaConfig, ProdutosResult, CursorAleatorio } from '@/lib/produtos';
import { gerarSeedAleatoria, baralhar } from '@/lib/aleatorio';
import { precoActual } from '@/lib/promocao';
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
const CAT_VISIVEIS = 8;
const SCROLL_KEY = 'catalogo_scroll';
const SEED_KEY = 'catalogo_seed';

// Ao voltar de um produto reutiliza a seed guardada para manter a mesma ordem;
// numa visita nova usa a seed do servidor (ou gera uma) para variar os produtos.
function escolherSeed(seedInicial?: string): string {
  let seed = seedInicial || gerarSeedAleatoria();
  try {
    const guardada = sessionStorage.getItem(SEED_KEY);
    if (guardada && sessionStorage.getItem(SCROLL_KEY)) seed = guardada;
    sessionStorage.setItem(SEED_KEY, seed);
  } catch {}
  return seed;
}

const INTERVALOS_PRECO = [
  { label: 'Todos os preços', min: 0, max: Infinity },
  { label: 'Até 500 MZN', min: 0, max: 500 },
  { label: '500 – 1 000', min: 500, max: 1000 },
  { label: '1 000 – 2 000', min: 1000, max: 2000 },
  { label: '2 000+', min: 2000, max: Infinity },
];

export default function CatalogoProdutos({ inicial, seedInicial, categoriasIniciais = [], tituloDefault = 'Todos os produtos' }: { inicial: Produto[]; seedInicial?: string; categoriasIniciais?: string[]; tituloDefault?: string }) {
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
  const [catExpandida, setCatExpandida] = useState(false);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const scrollRestored = useRef(false);
  const seedRef = useRef<string | null>(null);
  const cursorAleatorioRef = useRef<CursorAleatorio | null>(null);
  const ordenacaoRef = useRef(ordenacao);
  ordenacaoRef.current = ordenacao;

  // Restaurar scroll ao voltar de um produto
  useEffect(() => {
    if (scrollRestored.current) return;
    scrollRestored.current = true;
    // Tem de correr antes de SCROLL_KEY ser apagada
    seedRef.current = escolherSeed(seedInicial);
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
      getCategoriasAtivas().then(cats => { if (cats.length) setCategorias(cats); }).catch(() => {});
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
      const seed = seedRef.current ?? (seedRef.current = escolherSeed(seedInicial));
      const aleatorio = ordenacaoRef.current !== 'novidades';
      let resultado: Produto[];
      if (!cat && aleatorio) {
        // Página inicial: amostra aleatória paginada (não sempre os mais recentes)
        const cursor: CursorAleatorio | null = append
          ? cursorAleatorioRef.current
          : { seed, ultimoId: null, deuVolta: false };
        const res = cursor ? await getProdutosAleatorios(cursor, PAGE) : { produtos: [], cursor: null };
        resultado = res.produtos;
        cursorAleatorioRef.current = res.cursor;
        setTemMais(!!res.cursor && res.produtos.length === PAGE);
        setUltimoDoc(null);
        setTodos(p => append ? [...p, ...resultado] : resultado);
      } else {
        const max = cat ? 200 : PAGE + 1;
        const cursor = cat ? null : (append ? ultimoDocRef.current : null);
        const slugs = cat ? resolveDescendants(catTreeRef.current, cat) : null;
        const res = await getProdutos({ categorias: slugs, max, ultimoDoc: cursor });
        resultado = res.produtos;
        const maisDisp = !cat && resultado.length > PAGE;
        let slice = maisDisp ? resultado.slice(0, PAGE) : resultado;
        // Categoria: vem tudo de uma vez — baralhar para não mostrar sempre os mais recentes primeiro
        if (cat && aleatorio) slice = baralhar(slice, seed);
        setTemMais(maisDisp);
        setUltimoDoc(maisDisp ? res.ultimoDoc : null);
        setTodos(p => append ? [...p, ...slice] : slice);
      }
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
  }, [seedInicial]);

  // Aplicar filtros de preço, tamanho, cor e ordenação
  useEffect(() => {
    const intervalo = INTERVALOS_PRECO[precoIdx];
    let filtrados = todos.filter(p => precoActual(p) >= intervalo.min && precoActual(p) <= intervalo.max);
    if (tamActual) filtrados = filtrados.filter(p => p.tamanhos?.includes(tamActual));
    if (corActual) filtrados = filtrados.filter(p => p.cores?.includes(corActual));
    if (ordenacao === 'preco_asc') filtrados = [...filtrados].sort((a, b) => precoActual(a) - precoActual(b));
    else if (ordenacao === 'preco_desc') filtrados = [...filtrados].sort((a, b) => precoActual(b) - precoActual(a));
    else if (ordenacao === 'novidades') filtrados = [...filtrados].sort((a, b) => {
      const ta = (a.criado_em as { toDate?: () => Date })?.toDate?.()?.getTime() ?? 0;
      const tb = (b.criado_em as { toDate?: () => Date })?.toDate?.()?.getTime() ?? 0;
      return tb - ta;
    });
    setProdutos(filtrados);
  }, [todos, precoIdx, tamActual, corActual, ordenacao]);

  // Sem categoria, "Novidades" carrega os mais recentes do servidor e as
  // restantes ordenações partem da amostra aleatória — recarregar ao alternar.
  const ehNovidades = ordenacao === 'novidades';
  const ehNovidadesAnterior = useRef(ehNovidades);
  useEffect(() => {
    if (ehNovidadesAnterior.current === ehNovidades) return;
    ehNovidadesAnterior.current = ehNovidades;
    if (!catActual && !searchTerm.trim()) carregarProdutos(null, false);
  }, [ehNovidades]);

  const filtrar = (cat: string | null) => {
    setCatActual(cat);
    setSearchTerm('');
    setPrecoIdx(0);
    setTamActual(null);
    setCorActual(null);
    setCatExpandida(false);
    setFiltrosAbertos(false);
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
  const numFiltrosActivos = [!!catActual, precoIdx > 0, tamActual !== null, corActual !== null].filter(Boolean).length;

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

  const mostrarSidebar = !searchTerm;

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
      <div className="icon"><AlertTriangle size={40} strokeWidth={1.5} /></div>
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
        <h2>{catActual ? catActual.charAt(0).toUpperCase() + catActual.slice(1) : tituloDefault}</h2>
        <select className="filtro-ordenacao" value={ordenacao} onChange={e => setOrdenacao(e.target.value)}>
          <option value="relevancia">Relevância</option>
          <option value="novidades">Novidades</option>
          <option value="preco_asc">Preço: menor primeiro</option>
          <option value="preco_desc">Preço: maior primeiro</option>
        </select>
      </div>

      {/* Layout com sidebar */}
      {mostrarSidebar ? (
        <div className="catalogo-com-sidebar">
          {/* Sidebar */}
          <aside className={`filtros-sidebar${filtrosAbertos ? ' aberto' : ''}`}>
            <div className="filtros-sidebar-header">
              {/* Em mobile o título é o botão que abre/fecha os filtros */}
              <button
                type="button"
                className="filtros-toggle"
                onClick={() => setFiltrosAbertos(v => !v)}
                aria-expanded={filtrosAbertos}
              >
                <SlidersHorizontal size={16} strokeWidth={1.5} className="filtros-toggle-icone" />
                <span>Filtros</span>
                {numFiltrosActivos > 0 && <span className="filtros-toggle-contador">{numFiltrosActivos}</span>}
                <ChevronDown size={16} strokeWidth={1.5} className="filtros-toggle-seta" />
              </button>
              {temFiltrosActivos && (
                <button className="filtros-limpar" onClick={limparFiltros}>Limpar</button>
              )}
            </div>

            <div className="filtros-corpo">

            {/* Categoria */}
            <div className="filtro-grupo" style={{ borderTop: 'none', paddingTop: 0 }}>
              <p className="filtro-grupo-titulo">Categoria</p>
              <div className="filtro-cat-lista">
                <button className={`filtro-cat-item${!catActual ? ' active' : ''}`} onClick={() => filtrar(null)}>
                  Todos
                </button>
                {(catExpandida ? categoriasVisiveis : categoriasVisiveis.slice(0, CAT_VISIVEIS)).map(cat => (
                  <button key={cat} className={`filtro-cat-item${catActual === cat ? ' active' : ''}`} onClick={() => filtrar(cat)}>
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </button>
                ))}
              </div>
              {categoriasVisiveis.length > CAT_VISIVEIS && (
                <button className="filtro-cat-vermais" onClick={() => setCatExpandida(v => !v)}>
                  {catExpandida ? 'Ver menos' : `Ver mais (${categoriasVisiveis.length - CAT_VISIVEIS})`}
                </button>
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
            </div>
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
