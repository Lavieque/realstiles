'use client';
import Link from 'next/link';
import Image from '@/components/CloudImage';
import Estrelas from '@/components/Estrelas';
import { useCarrinho } from '@/store/carrinho';
import { mostrarToast } from './Toast';
import type { Produto } from '@/lib/produtos';
import { ShoppingCart } from 'lucide-react';

export default function ProdutoCard({ produto }: { produto: Produto }) {
  const { adicionarItem, abrirDrawer } = useCarrinho();
  const preco = Number(produto.preco || 0).toFixed(2);
  const img = produto.imagens?.[0] || '/placeholder.svg';
  const emPromocao = !!(produto.preco_original && produto.preco_original > produto.preco);
  const desconto = emPromocao ? Math.round((1 - produto.preco / produto.preco_original!) * 100) : 0;

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
        {emPromocao && <span className="produto-card-badge-sale">-{desconto}%</span>}
      </div>
      <div className="produto-card-body">
        <p className="produto-card-nome">{produto.nome}</p>
        {!!produto.num_avaliacoes && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
            <Estrelas valor={produto.avaliacao || 0} tamanho={12} />
            <span style={{ fontSize: 11, color: 'var(--gray-400)' }}>({produto.num_avaliacoes})</span>
          </div>
        )}
        <div className="produto-card-footer">
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span className="preco-atual">{preco} MZN</span>
            {emPromocao && <span className="preco-original">{Number(produto.preco_original).toFixed(2)} MZN</span>}
          </div>
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
