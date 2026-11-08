'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import Image from '@/components/CloudImage';
import { useSearchParams } from 'next/navigation';
import ProdutoCard from './ProdutoCard';
import FiltrosSidebar, { FiltroGrupo, FiltroCategorias, FiltroPreco, INTERVALOS_PRECO } from './FiltrosSidebar';
import { getProdutos, getProdutosAleatorios, getCategoriasAtivas, pesquisarProdutos } from '@/lib/produtos';
import type { Produto, CategoriaConfig, ProdutosResult, CursorAleatorio } from '@/lib/produtos';
import { gerarSeedAleatoria, baralhar } from '@/lib/aleatorio';
import { precoActual } from '@/lib/promocao';
import { indexarCategorias, acharNo, slugsDaSubarvore } from '@/lib/categorias';
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

export type ModoLoja = 'novidades' | 'cinco-estrelas' | 'mais-vendidos' | null;

export type TopoLoja = {
  eyebrow: string;
  titulo: string;
  sub: string;
  modos: { rotulo: string; href: string; activo: boolean }[];
};

export default function CatalogoProdutos({ inicial, seedInicial, categoriasIniciais = [], tituloDefault = 'Todos os produtos', basePath = '/', modo = null, ocultarTitulo = false, topo }: { inicial: Produto[]; seedInicial?: string; categoriasIniciais?: string[]; tituloDefault?: string; basePath?: string; modo?: ModoLoja; ocultarTitulo?: boolean; topo?: TopoLoja }) {
  // URL da listagem para uma categoria, preservando o modo (novidades, 5 estrelas)
  const urlLista = (cat: string | null) => {
    const q = new URLSearchParams();
    if (cat) q.set('cat', cat);
    if (modo) q.set('mode', modo);
    const qs = q.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
  // 5 estrelas precisa de todo o catálogo para filtrar — sem paginação aleatória
  const carregaTudo = modo === 'cinco-estrelas' || modo === 'mais-vendidos';
  const searchParams = useSearchParams();
  const catParam = searchParams.get('sub') || searchParams.get('cat');
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
  const [ordenacao, setOrdenacao] = useState(modo === 'novidades' ? 'novidades' : 'relevancia');
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
      if (!cat && aleatorio && !carregaTudo) {
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
        const max = cat || carregaTudo ? 200 : PAGE + 1;
        const cursor = cat || carregaTudo ? null : (append ? ultimoDocRef.current : null);
        const slugs = cat ? resolveDescendants(catTreeRef.current, cat) : null;
        const res = await getProdutos({ categorias: slugs, max, ultimoDoc: cursor });
        resultado = res.produtos;
        const maisDisp = !cat && !carregaTudo && resultado.length > PAGE;
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
    if (modo === 'mais-vendidos') filtrados = filtrados.filter(p => (p.vendidos || 0) > 0);
    if (modo === 'cinco-estrelas') filtrados = filtrados.filter(p => (p.avaliacao || 0) >= 4.5 && !!p.num_avaliacoes);
    if (tamActual) filtrados = filtrados.filter(p => p.tamanhos?.includes(tamActual));
    if (corActual) filtrados = filtrados.filter(p => p.cores?.includes(corActual));
    if (modo === 'mais-vendidos' && ordenacao === 'relevancia') filtrados = [...filtrados].sort((a, b) => (b.vendidos || 0) - (a.vendidos || 0));
    else if (ordenacao === 'preco_asc') filtrados = [...filtrados].sort((a, b) => precoActual(a) - precoActual(b));
    else if (ordenacao === 'preco_desc') filtrados = [...filtrados].sort((a, b) => precoActual(b) - precoActual(a));
    else if (ordenacao === 'novidades') filtrados = [...filtrados].sort((a, b) => {
      const ta = (a.criado_em as { toDate?: () => Date })?.toDate?.()?.getTime() ?? 0;
      const tb = (b.criado_em as { toDate?: () => Date })?.toDate?.()?.getTime() ?? 0;
      return tb - ta;
    });
    setProdutos(filtrados);
  }, [todos, precoIdx, tamActual, corActual, ordenacao, modo]);

  // Sem categoria, "Novidades" carrega os mais recentes do servidor e as
  // restantes ordenações partem da amostra aleatória — recarregar ao alternar.
  const ehNovidades = ordenacao === 'novidades';
  const ehNovidadesAnterior = useRef(ehNovidades);
  useEffect(() => {
    if (ehNovidadesAnterior.current === ehNovidades) return;
    ehNovidadesAnterior.current = ehNovidades;
    if (!catActual && !searchTerm.trim() && !carregaTudo) carregarProdutos(null, false);
  }, [ehNovidades]);

  const filtrar = (cat: string | null) => {
    setCatActual(cat);
    setSearchTerm('');
    setPrecoIdx(0);
    setTamActual(null);
    setCorActual(null);
    const url = urlLista(cat);
    window.history.pushState({}, '', url);
    carregarProdutos(cat, false);
  };

  // "Limpar" repõe tudo, incluindo a categoria (filtrar já limpa preço/tamanho/cor)
  const limparTudo = () => {
    if (catActual) { filtrar(null); return; }
    setPrecoIdx(0);
    setTamActual(null);
    setCorActual(null);
  };

  const numFiltrosActivos = [!!catActual, precoIdx > 0, tamActual !== null, corActual !== null].filter(Boolean).length;

  // Debounce pesquisa + sync URL
  useEffect(() => {
    if (!searchTerm.trim()) {
      const url = urlLista(catActual);
      window.history.replaceState({}, '', url);
      carregarProdutos(catActual, false);
      return;
    }
    const url = `${basePath}?q=${encodeURIComponent(searchTerm)}`;
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

  // Imagem de uma categoria/modo: primeiro artigo carregado que lhe pertence
  const infoCats = indexarCategorias(catTree);
  const capitalizar = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const rotuloCat = (slug: string) => infoCats[slug]?.nome ?? capitalizar(slug);
  const imgCategoria = (slug: string) => infoCats[slug]?.imagem || todos.find(p => p.categoria === slug)?.imagens?.[0];
  const imgModo = (i: number) => todos[i % Math.max(todos.length, 1)]?.imagens?.[0];
  // Mosaicos: filhos directos da categoria actual (ou categorias de topo) que
  // têm artigos activos na sua sub-árvore. Mostram o nome e a imagem definidos
  // no admin; sem imagem, usam a do primeiro artigo da sub-árvore.
  type Tile = { slug: string; nome: string; src?: string };
  const ativos = new Set<string>([...categorias, ...(todos.map(p => p.categoria).filter(Boolean) as string[])]);
  const tilesArvore: Tile[] = (catActual ? acharNo(catTree, catActual)?.subcategorias || [] : catTree)
    .filter(n => slugsDaSubarvore(n).some(s => ativos.has(s)))
    .map(n => {
      const slugs = slugsDaSubarvore(n);
      return { slug: n.slug, nome: n.nome, src: n.imagem || todos.find(p => p.categoria && slugs.includes(p.categoria))?.imagens?.[0] };
    });
  const tiles: Tile[] = catTree.length > 0
    ? tilesArvore
    : (catActual ? categoriasVisiveis : categorias).map(slug => ({ slug, nome: rotuloCat(slug), src: imgCategoria(slug) }));
  const nomeCat = catActual ? rotuloCat(catActual) : '';

  const corpo = (
    <>
      {/* Subcategorias / categorias com imagem */}
      {!searchTerm && tiles.length > 0 && (
        <div className="cat-tiles">
          {tiles.slice(0, 12).map(({ slug, nome, src }) => {
            return (
              <button key={slug} type="button" className="cat-tile" onClick={() => filtrar(slug)}>
                <span className="cat-tile-img">{src && <Image src={src} alt="" fill style={{ objectFit: 'cover' }} sizes="72px" />}</span>
                <span>{nome}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Header */}
      <div className={`catalogo-header${ocultarTitulo ? ' sem-titulo' : ''}`}>
        {!ocultarTitulo && <h2>{catActual ? nomeCat : tituloDefault}</h2>}
        <select className="filtro-ordenacao" value={ordenacao} onChange={e => setOrdenacao(e.target.value)}>
          <option value="relevancia">Relevância</option>
          <option value="novidades">Novidades</option>
          <option value="preco_asc">Preço: menor primeiro</option>
          <option value="preco_desc">Preço: maior primeiro</option>
        </select>
      </div>

      {/* Layout com sidebar */}
      {mostrarSidebar && catActual ? (
        <div className="catalogo-com-sidebar">
          {/* Sidebar */}
          <FiltrosSidebar
            numActivos={numFiltrosActivos}
            onLimpar={limparTudo}
            contagem={`${produtos.length} produto${produtos.length !== 1 ? 's' : ''}`}
            fecharQuando={catActual}
          >
            <FiltroGrupo titulo="Categoria" primeiro>
              <FiltroCategorias categorias={categoriasVisiveis} actual={catActual} onChange={filtrar} visiveis={CAT_VISIVEIS} rotulo={rotuloCat} />
            </FiltroGrupo>

            <FiltroGrupo titulo="Preço">
              <FiltroPreco valor={precoIdx} onChange={setPrecoIdx} />
            </FiltroGrupo>

            {tamanhos.length > 0 && (
              <FiltroGrupo titulo="Tamanho">
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
              </FiltroGrupo>
            )}

            {cores.length > 0 && (
              <FiltroGrupo titulo="Cor">
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
              </FiltroGrupo>
            )}
          </FiltrosSidebar>

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

  if (!topo) return corpo;

  return (
    <>
      <header className="loja-topo">
        <div className="loja-topo-inner">
          <nav className="loja-trilho" aria-label="Localização">
            <Link href="/">Início</Link><span aria-hidden="true">›</span>
            {catActual ? (
              <>
                <Link href={urlLista(null)} onClick={e => { e.preventDefault(); filtrar(null); }}>Explorar</Link>
                <span aria-hidden="true">›</span><span>{nomeCat}</span>
              </>
            ) : <span>Explorar</span>}
          </nav>
          {!catActual && (
            <>
              <span className="eyebrow">{topo.eyebrow}</span>
              <h1 className="display-titulo">{topo.titulo}</h1>
              <p className="loja-sub">{topo.sub}</p>
            </>
          )}
          <div className="loja-modos">
            {topo.modos.map((m, i) => {
              const src = imgModo(i);
              return (
                <Link key={m.rotulo} href={m.href} className={`loja-modo${m.activo ? ' activo' : ''}`}>
                  {src && <span className="loja-modo-img"><Image src={src} alt="" fill style={{ objectFit: 'cover' }} sizes="28px" /></span>}
                  {m.rotulo}
                </Link>
              );
            })}
          </div>
        </div>
      </header>
      <div className="loja-corpo">{corpo}</div>
    </>
  );
}
