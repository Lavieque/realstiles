'use client';
import { useReducer } from 'react';
import Link from 'next/link';
import Image from '@/components/CloudImage';
import Estrelas from '@/components/Estrelas';
import Preco from '@/components/Preco';
import { useCarrinho } from '@/store/carrinho';
import { useFavoritos } from '@/store/favoritos';
import { mostrarToast } from './Toast';
import type { Produto } from '@/lib/produtos';
import { ShoppingCart, Heart } from 'lucide-react';
import { estadoPromocao } from '@/lib/promocao';
import ContagemPromocao from './ContagemPromocao';

export default function ProdutoCard({ produto }: { produto: Produto }) {
  const { adicionarItem, abrirDrawer } = useCarrinho();
  const favorito = useFavoritos(s => s.ids.includes(produto.id));
  const toggleFavorito = useFavoritos(s => s.toggleFavorito);
  // Re-render quando a promoção termina para o preço voltar ao original
  const [, actualizar] = useReducer((n: number) => n + 1, 0);
  const promo = estadoPromocao(produto);
  const img = produto.imagens?.[0] || '/placeholder.svg';
  const emPromocao = promo.activa;
  const desconto = promo.desconto;

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    if (produto.tamanhos?.length > 0 || produto.cores?.length > 0) {
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
    e.stopPropagation();
    toggleFavorito(produto.id);
  };

  return (
    <Link href={`/produto/${produto.id}`} className="produto-card" style={{ textDecoration: 'none', color: 'inherit' }}>
      <div className="produto-card-img">
        <Image src={img} alt={produto.nome} fill style={{ objectFit: 'cover' }} sizes="(max-width: 768px) 50vw, 25vw" />
        {emPromocao && <span className="produto-card-badge-sale">-{desconto}%</span>}
        {emPromocao && <ContagemPromocao fim={promo.fim} onTerminar={actualizar} />}
        <button
          type="button"
          className={`produto-card-fav${favorito ? ' activo' : ''}`}
          onClick={handleFavorito}
          aria-label={favorito ? 'Remover dos favoritos' : 'Guardar nos favoritos'}
          aria-pressed={favorito}
        >
          <Heart size={16} strokeWidth={1.5} fill={favorito ? 'currentColor' : 'none'} />
        </button>
      </div>
      <div className="produto-card-body">
        <p className="produto-card-nome">{produto.nome}</p>
        <div className="produto-card-footer">
          <div className="produto-card-precos">
            <Preco valor={promo.preco} className="preco-atual" />
            {emPromocao && <Preco valor={Number(promo.precoOriginal)} riscado className="preco-original" />}
          </div>
          <button
            className="btn-carrinho-icon"
            disabled={produto.stock === 0}
            onClick={handleAdd}
            aria-label={produto.stock === 0 ? 'Sem stock' : 'Adicionar ao carrinho'}
            title={produto.stock === 0 ? 'Sem stock' : 'Adicionar ao carrinho'}
          >
            <ShoppingCart size={16} strokeWidth={1.5} />
          </button>
        </div>
        {(!!produto.num_avaliacoes || !!produto.vendidos) && (
          <div className="produto-card-rating">
            {!!produto.num_avaliacoes && <Estrelas valor={produto.avaliacao || 0} tamanho={12} />}
            {!!produto.num_avaliacoes && <span className="num-avaliacoes">({produto.num_avaliacoes})</span>}
            {!!produto.vendidos && <span className="num-avaliacoes produto-card-vendidos">{produto.vendidos} vendido{produto.vendidos !== 1 ? 's' : ''}</span>}
          </div>
        )}
      </div>
    </Link>
  );
}
