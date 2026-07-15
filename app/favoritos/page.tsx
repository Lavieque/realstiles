'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import ProdutoCard from '@/components/ProdutoCard';
import { useFavoritos } from '@/store/favoritos';
import { getProdutos } from '@/lib/produtos';
import type { Produto } from '@/lib/produtos';

export default function FavoritosPage() {
  const { ids } = useFavoritos();
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const prevIds = useRef<string>('');

  useEffect(() => {
    const key = [...ids].sort().join(',');
    if (key === prevIds.current) return;
    prevIds.current = key;
    if (ids.length === 0) { setProdutos([]); setLoading(false); return; }
    setLoading(true);
    // Carrega todos os activos e filtra pelos ids favoritos (evita N+1 queries)
    getProdutos({ max: 300 })
      .then(({ produtos: todos }) => {
        const set = new Set(ids);
        setProdutos(todos.filter(p => set.has(p.id)));
      })
      .finally(() => setLoading(false));
  }, [ids]);

  return (
    <div className="page-wrapper">
      <div className="container">
        <div className="page-header">
          <h1>Os meus favoritos</h1>
          <p>{ids.length} produto{ids.length !== 1 ? 's' : ''} guardado{ids.length !== 1 ? 's' : ''}</p>
        </div>

        {loading ? (
          <div className="loading"><div className="spinner" /> A carregar...</div>
        ) : produtos.length === 0 ? (
          <div className="empty-state">
            <div className="icon">♡</div>
            <h3>Sem favoritos</h3>
            <p>Clica no coração nos produtos para os guardar aqui.</p>
            <Link href="/" className="btn btn-primary" style={{ marginTop: 20 }}>Ver produtos</Link>
          </div>
        ) : (
          <div className="produtos-grid">
            {produtos.map(p => <ProdutoCard key={p.id} produto={p} />)}
          </div>
        )}
      </div>
    </div>
  );
}
