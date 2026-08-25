'use client';
import Link from 'next/link';
import Image from '@/components/CloudImage';
import { useCarrinho } from '@/store/carrinho';
import { mostrarToast } from './Toast';
import type { Produto } from '@/lib/produtos';
import { ShoppingCart } from 'lucide-react';

export default function ProdutoCard({ produto }: { produto: Produto }) {
  const { adicionarItem, abrirDrawer } = useCarrinho();
  const preco = Number(produto.preco || 0).toFixed(2);
  const img = produto.imagens?.[0] || '/placeholder.svg';

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

  return (
    <Link href={`/produto/${produto.id}`} className="produto-card" style={{ textDecoration: 'none', color: 'inherit' }}>
      <div className="produto-card-img">
        <Image src={img} alt={produto.nome} fill style={{ objectFit: 'cover' }} sizes="(max-width: 768px) 50vw, 25vw" />
      </div>
      <div className="produto-card-body">
        <p className="produto-card-nome">{produto.nome}</p>
        <div className="produto-card-footer">
          <span className="preco-atual">{preco} MZN</span>
          <button
            className="btn-carrinho-icon"
            disabled={produto.stock === 0}
            onClick={handleAdd}
            title={produto.stock === 0 ? 'Sem stock' : 'Adicionar ao carrinho'}
          >
            <ShoppingCart size={16} strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </Link>
  );
}
