'use client';
import Link from 'next/link';
import Image from 'next/image';
import { useCarrinho } from '@/store/carrinho';
import { mostrarToast } from './Toast';
import type { Produto } from '@/lib/produtos';

export default function ProdutoCard({ produto }: { produto: Produto }) {
  const { adicionarItem, abrirDrawer } = useCarrinho();
  const preco = produto.preco?.toFixed(2) || '0.00';
  const img = produto.imagens?.[0] || 'https://via.placeholder.com/300x300?text=Sem+Imagem';

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    adicionarItem(produto, produto.tamanhos?.[0] || '', produto.cores?.[0] || '');
    mostrarToast(`"${produto.nome}" adicionado ao carrinho!`, 'success');
    abrirDrawer();
  };

  return (
    <Link href={`/produto/${produto.id}`} className="produto-card" style={{ textDecoration: 'none', color: 'inherit' }}>
      <div className="produto-card-img">
        <Image src={img} alt={produto.nome} fill style={{ objectFit: 'cover' }} sizes="(max-width: 768px) 50vw, 25vw" />
        {produto.destaque && <span className="produto-card-badge">Destaque</span>}
        {produto.preco_original && produto.preco_original > produto.preco && (
          <span className="produto-card-badge sale">Sale</span>
        )}
      </div>
      <div className="produto-card-body">
        <p className="produto-card-nome">{produto.nome}</p>
        <div className="produto-card-preco">
          <span className="preco-atual">{preco} MZN</span>
          {produto.preco_original && (
            <span className="preco-original">{produto.preco_original.toFixed(2)} MZN</span>
          )}
        </div>
        <div className="produto-card-actions">
          <button
            className="btn btn-primary btn-sm"
            style={{ flex: 1, ...(produto.stock === 0 ? { opacity: 0.4, cursor: 'not-allowed' } : {}) }}
            disabled={produto.stock === 0}
            onClick={handleAdd}
          >
            {produto.stock === 0 ? 'Sem stock' : '+ Carrinho'}
          </button>
        </div>
      </div>
    </Link>
  );
}
