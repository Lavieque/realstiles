'use client';
import Link from 'next/link';
import Image from 'next/image';
import { useCarrinho } from '@/store/carrinho';
import { useFavoritos } from '@/store/favoritos';
import { mostrarToast } from './Toast';
import type { Produto } from '@/lib/produtos';

export default function ProdutoCard({ produto }: { produto: Produto }) {
  const { adicionarItem, abrirDrawer } = useCarrinho();
  const { isFavorito, toggleFavorito } = useFavoritos();
  const favorito = isFavorito(produto.id);
  const preco = Number(produto.preco || 0).toFixed(2);
  const img = produto.imagens?.[0] || '/placeholder.svg';

  const desconto = produto.preco_original && produto.preco_original > produto.preco
    ? Math.round((1 - produto.preco / produto.preco_original) * 100)
    : 0;

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    if (produto.tamanhos?.length > 0 || produto.cores?.length > 0) {
      // Tem opções — redireciona para a página de detalhe para o utilizador escolher
      window.location.href = `/produto/${produto.id}`;
      return;
    }
    adicionarItem(produto, '', '');
    const nome = produto.nome.length > 30 ? produto.nome.substring(0, 30) + '…' : produto.nome;
    mostrarToast(`"${nome}" adicionado ao carrinho!`, 'success');
    abrirDrawer();
  };

  const handleFavorito = (e: React.MouseEvent) => {
    e.preventDefault();
    toggleFavorito(produto.id);
  };

  return (
    <Link href={`/produto/${produto.id}`} className="produto-card" style={{ textDecoration: 'none', color: 'inherit' }}>
      <div className="produto-card-img">
        <Image src={img} alt={produto.nome} fill style={{ objectFit: 'cover' }} sizes="(max-width: 768px) 50vw, 25vw" />
        {desconto > 0 && <span className="produto-card-badge sale">-{desconto}%</span>}
        {produto.destaque && !desconto && <span className="produto-card-badge">Destaque</span>}
        <button className={`btn-fav${favorito ? ' active' : ''}`} onClick={handleFavorito} title={favorito ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}>
          {favorito ? '♥' : '♡'}
        </button>
      </div>
      <div className="produto-card-body">
        <p className="produto-card-nome">{produto.nome}</p>
        <div className="produto-card-preco">
          <span className="preco-atual">{preco} MZN</span>
          {produto.preco_original && produto.preco_original > produto.preco && (
            <span className="preco-original">{Number(produto.preco_original).toFixed(2)} MZN</span>
          )}
        </div>
        <div className="produto-card-actions">
          <button
            className="btn btn-primary btn-sm"
            style={{ flex: 1, ...(produto.stock === 0 ? { opacity: 0.4, cursor: 'not-allowed' } : {}) }}
            disabled={produto.stock === 0}
            onClick={handleAdd}
          >
            {produto.stock === 0 ? 'Sem stock'
              : (produto.tamanhos?.length > 0 || produto.cores?.length > 0) ? 'Escolher opções'
              : '+ Carrinho'}
          </button>
        </div>
      </div>
    </Link>
  );
}
