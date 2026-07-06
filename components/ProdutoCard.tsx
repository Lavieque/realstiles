'use client';
import Link from 'next/link';
import Image from 'next/image';
import { useCarrinho } from '@/store/carrinho';
import { useFavoritos } from '@/store/favoritos';
import { mostrarToast } from './Toast';
import type { Produto } from '@/lib/produtos';

function Estrelas({ valor, total }: { valor: number; total?: number }) {
  const cheias = Math.round(valor);
  return (
    <div className="produto-card-rating">
      <span className="estrelas">
        {[1,2,3,4,5].map(i => (
          <span key={i} style={{ color: i <= cheias ? '#f59e0b' : '#d1d5db', fontSize: 12 }}>★</span>
        ))}
      </span>
      {total != null && <span className="num-avaliacoes">({total})</span>}
    </div>
  );
}

function isNovo(criadoEm: unknown): boolean {
  if (!criadoEm) return false;
  try {
    const ts = (criadoEm as { toDate?: () => Date }).toDate?.() ?? new Date(criadoEm as string);
    return Date.now() - ts.getTime() < 30 * 24 * 60 * 60 * 1000;
  } catch { return false; }
}

export default function ProdutoCard({ produto }: { produto: Produto }) {
  const { adicionarItem, abrirDrawer } = useCarrinho();
  const { isFavorito, toggleFavorito } = useFavoritos();
  const favorito = isFavorito(produto.id);
  const preco = Number(produto.preco || 0).toFixed(2);
  const img = produto.imagens?.[0] || '/placeholder.svg';

  const desconto = produto.preco_original && produto.preco_original > produto.preco
    ? Math.round((1 - produto.preco / produto.preco_original) * 100)
    : 0;

  const novo = isNovo(produto.criado_em);

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
    toggleFavorito(produto.id);
  };

  return (
    <Link href={`/produto/${produto.id}`} className="produto-card" style={{ textDecoration: 'none', color: 'inherit' }}>
      <div className="produto-card-img">
        <Image src={img} alt={produto.nome} fill style={{ objectFit: 'cover' }} sizes="(max-width: 768px) 50vw, 25vw" />
        {desconto > 0 && <span className="produto-card-badge sale">-{desconto}%</span>}
        {novo && !desconto && <span className="produto-card-badge novo">Novo</span>}
        {produto.destaque && !desconto && !novo && <span className="produto-card-badge">Destaque</span>}
        <button className={`btn-fav${favorito ? ' active' : ''}`} onClick={handleFavorito} title={favorito ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}>
          {favorito ? '♥' : '♡'}
        </button>
      </div>
      <div className="produto-card-body">
        <p className="produto-card-nome">{produto.nome}</p>
        {produto.avaliacao != null && (
          <Estrelas valor={produto.avaliacao} total={produto.num_avaliacoes} />
        )}
        <div className="produto-card-footer">
          <div className="produto-card-preco">
            <span className="preco-atual">{preco} MZN</span>
            {produto.preco_original && produto.preco_original > produto.preco && (
              <span className="preco-original">{Number(produto.preco_original).toFixed(2)} MZN</span>
            )}
          </div>
          <button
            className="btn-carrinho-icon"
            disabled={produto.stock === 0}
            onClick={handleAdd}
            title={produto.stock === 0 ? 'Sem stock' : 'Adicionar ao carrinho'}
          >
            {produto.stock === 0 ? (
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>
            ) : (
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>
            )}
          </button>
        </div>
      </div>
    </Link>
  );
}
