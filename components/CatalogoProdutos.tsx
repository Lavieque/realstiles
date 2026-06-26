'use client';
import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import ProdutoCard from './ProdutoCard';
import { getProdutos, getCategorias, pesquisarProdutos } from '@/lib/produtos';
import type { Produto } from '@/lib/produtos';

const PAGE = 12;

export default function CatalogoProdutos({ inicial }: { inicial: Produto[] }) {
  const searchParams = useSearchParams();
  const catParam = searchParams.get('cat');

  const [produtos, setProdutos] = useState<Produto[]>(inicial);
  const [categorias, setCategorias] = useState<string[]>([]);
  const [catActual, setCatActual] = useState<string | null>(catParam);
  const [temMais, setTemMais] = useState(false);
  const [ultimo, setUltimo] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    getCategorias().then(setCategorias);
  }, []);

  useEffect(() => {
    if (catParam !== catActual) {
      setCatActual(catParam);
      carregarProdutos(catParam, false);
    }
  }, [catParam]);

  const carregarProdutos = useCallback(async (cat: string | null, append: boolean) => {
    setLoading(true);
    try {
      const max = cat ? 200 : PAGE + 1;
      const ult = cat ? null : (append ? ultimo : null);
      const resultado = await getProdutos({ categoria: cat, max, ultimo: ult });
      const maisDisp = !cat && resultado.length > PAGE;
      const slice = maisDisp ? resultado.slice(0, PAGE) : resultado;
      setTemMais(maisDisp);
      setUltimo(maisDisp ? slice[slice.length - 1] : null);
      setProdutos(p => append ? [...p, ...slice] : slice);
    } finally {
      setLoading(false);
    }
  }, [ultimo]);

  const filtrar = (cat: string | null) => {
    setCatActual(cat);
    const url = cat ? `/?cat=${cat}` : '/';
    window.history.pushState({}, '', url);
    carregarProdutos(cat, false);
  };

  useEffect(() => {
    if (!searchTerm.trim()) {
      carregarProdutos(catActual, false);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      const res = await pesquisarProdutos(searchTerm);
      setProdutos(res);
      setTemMais(false);
      setLoading(false);
    }, 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  return (
    <>
      {/* Search */}
      <div style={{ marginBottom: 20 }}>
        <input
          type="search"
          placeholder="Pesquisar produtos..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          style={{ width: '100%', maxWidth: 360, padding: '10px 16px', borderRadius: 10, border: '1.5px solid var(--gray-200)', fontSize: 14, fontFamily: 'Inter, sans-serif', outline: 'none' }}
        />
      </div>

      {/* Filtros */}
      <div className="filtros">
        <button className={`filtro-btn${!catActual ? ' active' : ''}`} onClick={() => filtrar(null)}>
          Todos
        </button>
        {categorias.map(cat => (
          <button
            key={cat}
            className={`filtro-btn${catActual === cat ? ' active' : ''}`}
            onClick={() => filtrar(cat)}
          >
            {cat.charAt(0).toUpperCase() + cat.slice(1)}
          </button>
        ))}
      </div>

      {/* Grid */}
      {loading && produtos.length === 0 ? (
        <div className="loading"><div className="spinner" /> A carregar...</div>
      ) : produtos.length === 0 ? (
        <div className="empty-state">
          <div className="icon">👕</div>
          <h3>Nenhum produto encontrado</h3>
          <p>Tenta outra categoria ou pesquisa.</p>
        </div>
      ) : (
        <div className="produtos-grid">
          {produtos.map(p => <ProdutoCard key={p.id} produto={p} />)}
        </div>
      )}

      {/* Ver mais */}
      {temMais && (
        <div style={{ textAlign: 'center', marginTop: 32 }}>
          <button
            className="btn btn-outline"
            onClick={() => carregarProdutos(catActual, true)}
            disabled={loading}
          >
            {loading ? 'A carregar...' : 'Ver mais produtos'}
          </button>
        </div>
      )}
    </>
  );
}
