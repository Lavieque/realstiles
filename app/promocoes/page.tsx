'use client';
import { useEffect, useState, useRef } from 'react';
import ProdutoCard from '@/components/ProdutoCard';
import { getProdutos } from '@/lib/produtos';
import type { Produto } from '@/lib/produtos';

const PAGE = 12;

export default function PromocoesPage() {
  const [todos, setTodos] = useState<Produto[]>([]);
  const [categorias, setCategorias] = useState<string[]>([]);
  const [catActual, setCatActual] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pagina, setPagina] = useState(PAGE);

  useEffect(() => {
    getProdutos({ max: 500 })
      .then(all => {
        const emPromo = all.filter(p => p.preco_original && p.preco_original > p.preco);
        setTodos(emPromo);
        const seen = new Set<string>();
        const cats: string[] = [];
        emPromo.forEach(p => { if (p.categoria && !seen.has(p.categoria)) { seen.add(p.categoria); cats.push(p.categoria); } });
        cats.sort();
        setCategorias(cats);
      })
      .finally(() => setLoading(false));
  }, []);

  const filtrados = catActual ? todos.filter(p => p.categoria === catActual) : todos;
  const visiveis = filtrados.slice(0, pagina);

  return (
    <>
      {/* HERO */}
      <div className="promo-hero">
        <div className="promo-hero-texto">
          <h1>Promoções<br />imperdíveis</h1>
          <p>Os melhores artigos com descontos especiais. Aproveita enquanto há stock!</p>
        </div>
        <div className="promo-hero-badge">
          🔥 {loading ? 'A carregar...' : `${todos.length} artigos em promoção`}
        </div>
      </div>

      {/* FILTROS */}
      {categorias.length > 0 && (
        <div className="promo-filtros">
          <span className="promo-filtros-label">Filtrar:</span>
          <button
            className={`promo-filtro-btn${catActual === null ? ' active' : ''}`}
            onClick={() => { setCatActual(null); setPagina(PAGE); }}
          >
            Todas
          </button>
          {categorias.map(cat => (
            <button
              key={cat}
              className={`promo-filtro-btn${catActual === cat ? ' active' : ''}`}
              onClick={() => { setCatActual(cat); setPagina(PAGE); }}
            >
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </div>
      )}

      {/* GRID */}
      <div className="promo-section">
        <div className="promo-topo">
          <h2>Artigos em promoção</h2>
          {!loading && (
            <span className="promo-contador">
              <strong>{filtrados.length}</strong> artigo{filtrados.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {loading ? (
          <div className="loading"><div className="spinner" /> A carregar promoções...</div>
        ) : filtrados.length === 0 ? (
          <div className="promo-vazio">
            <div className="icon">🏷️</div>
            <h3>Sem promoções {catActual ? 'nesta categoria' : 'activas'}</h3>
            <p>Volta em breve para novos descontos.</p>
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
    </>
  );
}
