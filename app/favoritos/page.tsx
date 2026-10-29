'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Heart, ArrowRight } from 'lucide-react';
import ProdutoCard from '@/components/ProdutoCard';
import { useFavoritos } from '@/store/favoritos';
import { getProduto } from '@/lib/produtos';
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
    Promise.all(ids.map(id => getProduto(id)))
      .then(results => setProdutos(results.filter((p): p is Produto => p !== null)))
      .finally(() => setLoading(false));
  }, [ids]);

  return (
    <div className="page-wrapper">
      <div className="container">
        <header className="page-header">
          <span className="eyebrow" style={{ marginBottom: 14 }}>Guarda o que combina contigo</span>
          <h1 className="display-titulo">Os teus favoritos.</h1>
          <p>{ids.length === 0 ? 'As boas escolhas merecem ficar por perto.' : `${ids.length} produto${ids.length !== 1 ? 's' : ''} guardado${ids.length !== 1 ? 's' : ''}.`}</p>
        </header>

        {loading ? (
          <div className="loading"><div className="spinner" /> A carregar...</div>
        ) : produtos.length === 0 ? (
          <div className="empty-state">
            <div className="icon"><Heart size={40} strokeWidth={1.5} /></div>
            <h3>Ainda à procura do teu favorito?</h3>
            <p>Toca no coração de um produto para o guardar aqui.</p>
            <Link href="/loja" className="btn-escuro" style={{ marginTop: 24 }}>Explorar produtos <ArrowRight size={16} strokeWidth={1.75} /></Link>
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
