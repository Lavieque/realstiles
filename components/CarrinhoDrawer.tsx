'use client';
import Link from 'next/link';
import Image from 'next/image';
import { useCarrinho, getTotalItems, getTotalPreco } from '@/store/carrinho';
import { X, ShoppingBag, ArrowRight } from 'lucide-react';

export default function CarrinhoDrawer() {
  const { items, drawerOpen, fecharDrawer, removerItem, actualizarQuantidade } = useCarrinho();
  const total = getTotalPreco(items);
  const count = getTotalItems(items);

  return (
    <>
      <div className={`cart-overlay${drawerOpen ? ' open' : ''}`} onClick={fecharDrawer} />
      <div className={`cart-drawer${drawerOpen ? ' open' : ''}`}>
        <div className="cart-drawer-header">
          <h3>O meu carrinho <span style={{ color: 'var(--gray-400)', fontWeight: 400, fontSize: 14 }}>{count > 0 ? `(${count})` : ''}</span></h3>
          <button className="cart-drawer-close" onClick={fecharDrawer}><X size={20} strokeWidth={1.5} /></button>
        </div>

        <div className="cart-drawer-items">
          {items.length === 0 ? (
            <div className="cd-empty">
              <div className="icon"><ShoppingBag size={40} strokeWidth={1.5} /></div>
              <p>O teu carrinho está vazio</p>
            </div>
          ) : (
            items.map(item => (
              <div key={item.key} className="cd-item">
                <Image
                  className="cd-item-img"
                  src={item.imagem || '/placeholder.svg'}
                  alt={item.nome}
                  width={52} height={64}
                  style={{ objectFit: 'cover', borderRadius: 8 }}
                />
                <div className="cd-item-info">
                  <div className="cd-item-nome">{item.nome}</div>
                  <div className="cd-item-meta">
                    {item.tamanho && <span>Tam: {item.tamanho}</span>}
                    {item.cor && <span>Cor: {item.cor}</span>}
                  </div>
                  <div className="cd-item-preco">{(item.preco * item.quantidade).toFixed(2)} MZN</div>
                  <div className="cd-item-qty">
                    <button onClick={() => actualizarQuantidade(item.key, item.quantidade - 1)}>−</button>
                    <span>{item.quantidade}</span>
                    <button onClick={() => actualizarQuantidade(item.key, Math.min(item.stock, item.quantidade + 1))}>+</button>
                  </div>
                </div>
                <button className="cd-item-remove" onClick={() => removerItem(item.key)}><X size={16} strokeWidth={1.5} /></button>
              </div>
            ))
          )}
        </div>

        <div className="cart-drawer-footer">
          {items.length > 0 && (
            <>
              <div className="cd-total-row">
                <span>Total</span>
                <strong>{total.toFixed(2)} MZN</strong>
              </div>
              <Link href="/carrinho" className="btn btn-primary btn-full" onClick={fecharDrawer} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                Ir para o checkout <ArrowRight size={16} strokeWidth={1.5} />
              </Link>
              <button onClick={fecharDrawer} className="btn btn-outline btn-full" style={{ marginTop: 8 }}>
                Continuar a comprar
              </button>
            </>
          )}
          {items.length === 0 && (
            <Link href="/" className="btn btn-primary btn-full" onClick={fecharDrawer}>
              Ver produtos
            </Link>
          )}
        </div>
      </div>
    </>
  );
}
