'use client';
import Link from 'next/link';
import Image from 'next/image';
import { useCarrinho } from '@/store/carrinho';
import { mostrarToast } from './Toast';
import type { Produto } from '@/lib/produtos';

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
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
              <line x1="3" y1="6" x2="21" y2="6"/>
              <path d="M16 10a4 4 0 01-8 0"/>
            </svg>
          </button>
        </div>
      </div>
    </Link>
  );
}
