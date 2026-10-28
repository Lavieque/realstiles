'use client';
import Image from '@/components/CloudImage';
import Link from 'next/link';
import { ShoppingBag, Trash2, Minus, Plus, ArrowRight, Truck } from 'lucide-react';
import { useCarrinho, getTotalPreco } from '@/store/carrinho';
import Preco from '@/components/Preco';

export default function CarrinhoPage() {
  const { items, removerItem, actualizarQuantidade } = useCarrinho();
  const subtotal = getTotalPreco(items);

  if (items.length === 0) {
    return (
      <div className="page-wrapper">
        <div className="container">
          <div className="empty-state" style={{ paddingTop: 96 }}>
            <div className="icon"><ShoppingBag size={40} strokeWidth={1.5} /></div>
            <span className="eyebrow" style={{ marginBottom: 14 }}>As tuas escolhas</span>
            <h1 className="display-titulo" style={{ fontSize: 'clamp(1.8rem, 3vw, 2.4rem)', marginBottom: 10 }}>O teu carrinho espera por ti.</h1>
            <p>Explora a seleção e encontra os teus próximos favoritos.</p>
            <Link href="/loja" className="btn-escuro" style={{ marginTop: 24 }}>Descobrir produtos <ArrowRight size={16} strokeWidth={1.75} /></Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrapper">
      <div className="container">
        <header className="page-header">
          <span className="eyebrow" style={{ marginBottom: 14 }}>As tuas escolhas</span>
          <h1 className="display-titulo">O teu carrinho.</h1>
          <p>{items.length} {items.length === 1 ? 'artigo selecionado' : 'artigos selecionados'}. Mais um passo para o teu próximo favorito.</p>
        </header>

        <div className="pol-nota" style={{ margin: '0 0 20px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <Truck size={16} strokeWidth={1.5} style={{ flexShrink: 0, marginTop: 2 }} />
          <span><strong style={{ color: 'var(--black)' }}>Escolhes o destino antes de confirmar.</strong> Recolha em Chimoio sem taxa de entrega. Transporte nacional calculado por rota e pacote. <Link href="/entregas" style={{ color: 'var(--black)', fontWeight: 600 }}>Consultar entregas e preços</Link></span>
        </div>

        <div className="carrinho-grid">
          <ul className="carrinho-lista">
            {items.map(item => (
              <li key={item.key} className="carrinho-item">
                <Image src={item.imagem || '/placeholder.svg'} alt={item.nome} width={88} height={110} style={{ objectFit: 'cover', borderRadius: 4 }} />
                <div className="carrinho-item-info">
                  <p className="carrinho-item-nome">{item.nome}</p>
                  {(item.tamanho || item.cor) && (
                    <p className="carrinho-item-variante">
                      {[item.cor, item.tamanho && `Tamanho ${item.tamanho}`].filter(Boolean).join(' · ')}
                    </p>
                  )}
                  <div className="carrinho-qtd">
                    <button type="button" onClick={() => actualizarQuantidade(item.key, item.quantidade - 1)} aria-label="Diminuir quantidade"><Minus size={14} strokeWidth={1.75} /></button>
                    <span aria-live="polite">{item.quantidade}</span>
                    <button type="button" onClick={() => actualizarQuantidade(item.key, item.quantidade + 1)} aria-label="Aumentar quantidade"><Plus size={14} strokeWidth={1.75} /></button>
                  </div>
                </div>
                <div className="carrinho-item-preco">
                  <Preco valor={item.preco * item.quantidade} className="preco-atual" />
                  <button type="button" className="carrinho-remover" onClick={() => removerItem(item.key)}>
                    <Trash2 size={13} strokeWidth={1.5} /> Remover
                  </button>
                </div>
              </li>
            ))}
            <li className="carrinho-continuar">
              <Link href="/loja">← Continuar a explorar</Link>
            </li>
          </ul>

          <aside className="resumo-card">
            <h2>Resumo da compra</h2>
            <div className="resumo-linha"><span>Subtotal</span><Preco valor={subtotal} /></div>
            <div className="resumo-linha"><span>Entrega</span><span className="resumo-nota">Escolhes no passo seguinte</span></div>
            <div className="resumo-linha resumo-total"><span>Total</span><Preco valor={subtotal} className="preco-atual" /></div>
            <p className="resumo-info"><Truck size={15} strokeWidth={1.5} /><span>Prazo final estimado de 15 a 30 dias úteis, após confirmação do pagamento e da encomenda. <Link href="/entregas">Ver entregas e preços</Link></span></p>
            <Link href="/checkout" className="btn-escuro resumo-cta">Continuar para entrega <ArrowRight size={16} strokeWidth={1.75} /></Link>
          </aside>
        </div>
      </div>
    </div>
  );
}
