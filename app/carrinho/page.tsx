'use client';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useCarrinho, getTotalPreco } from '@/store/carrinho';
import { criarEncomenda } from '@/lib/encomendas';
import { onAuthChange } from '@/lib/auth';
import { mostrarToast } from '@/components/Toast';
import type { User } from 'firebase/auth';

export default function CarrinhoPage() {
  const { items, removerItem, actualizarQuantidade, limpar } = useCarrinho();
  const total = getTotalPreco(items);
  const [user, setUser] = useState<User | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ morada: '', cidade: '', telefone: '', notas: '' });

  useEffect(() => {
    const unsub = onAuthChange(setUser);
    return unsub;
  }, []);

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { window.location.href = '/conta?redirect=/carrinho'; return; }
    setLoading(true);
    try {
      const id = await criarEncomenda({ itens: items, ...form });
      limpar();
      window.location.href = `/encomenda/${id}?confirmada=1`;
    } catch (err) {
      mostrarToast('Erro ao criar encomenda. Tenta novamente.', 'error');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="page-wrapper">
        <div className="container">
          <div className="empty-state" style={{ paddingTop: 80 }}>
            <div className="icon">🛍️</div>
            <h3>O teu carrinho está vazio</h3>
            <p>Adiciona produtos para começar</p>
            <Link href="/" className="btn btn-primary" style={{ marginTop: 20 }}>Ver produtos</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrapper">
      <div className="container">
        <div className="page-header">
          <h1>Carrinho</h1>
          <p>{items.length} {items.length === 1 ? 'produto' : 'produtos'}</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 32, alignItems: 'start' }}>
          {/* Itens */}
          <div style={{ background: 'white', borderRadius: 16, border: '1px solid var(--gray-200)', overflow: 'hidden' }}>
            {items.map(item => (
              <div key={item.key} style={{ display: 'flex', gap: 16, padding: 20, borderBottom: '1px solid var(--gray-100)', alignItems: 'center' }}>
                <Image src={item.imagem || 'https://via.placeholder.com/80x100'} alt={item.nome} width={80} height={100} style={{ objectFit: 'cover', borderRadius: 8 }} />
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 600, marginBottom: 4 }}>{item.nome}</p>
                  <p style={{ fontSize: 13, color: 'var(--gray-400)', marginBottom: 8 }}>
                    {item.tamanho && `Tam: ${item.tamanho}`} {item.cor && `· Cor: ${item.cor}`}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button onClick={() => actualizarQuantidade(item.key, item.quantidade - 1)} style={{ width: 28, height: 28, border: '1.5px solid var(--gray-200)', borderRadius: 6, background: 'white', cursor: 'pointer' }}>−</button>
                    <span style={{ fontWeight: 600, minWidth: 20, textAlign: 'center' }}>{item.quantidade}</span>
                    <button onClick={() => actualizarQuantidade(item.key, item.quantidade + 1)} style={{ width: 28, height: 28, border: '1.5px solid var(--gray-200)', borderRadius: 6, background: 'white', cursor: 'pointer' }}>+</button>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontWeight: 700, fontSize: 16 }}>{(item.preco * item.quantidade).toFixed(2)} MZN</p>
                  <button onClick={() => removerItem(item.key)} style={{ fontSize: 12, color: 'var(--red)', background: 'none', border: 'none', cursor: 'pointer', marginTop: 8 }}>Remover</button>
                </div>
              </div>
            ))}
          </div>

          {/* Resumo */}
          <div style={{ background: 'white', borderRadius: 16, border: '1px solid var(--gray-200)', padding: 24, position: 'sticky', top: 'calc(var(--nav-h) + 16px)' }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>Resumo da encomenda</h2>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 14, color: 'var(--gray-600)' }}>
              <span>Subtotal</span><span>{total.toFixed(2)} MZN</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20, fontSize: 14, color: 'var(--gray-600)' }}>
              <span>Entrega</span><span>A definir</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 16, borderTop: '1px solid var(--gray-200)', marginBottom: 20 }}>
              <span style={{ fontWeight: 700, fontSize: 16 }}>Total</span>
              <span style={{ fontWeight: 700, fontSize: 20 }}>{total.toFixed(2)} MZN</span>
            </div>

            {!checkoutOpen ? (
              <button className="btn btn-primary btn-full btn-lg" onClick={() => setCheckoutOpen(true)}>
                Finalizar encomenda →
              </button>
            ) : (
              <form onSubmit={handleCheckout}>
                <div className="form-group">
                  <label>Morada de entrega *</label>
                  <input required value={form.morada} onChange={e => setForm(f => ({ ...f, morada: e.target.value }))} placeholder="Rua, número, bairro" />
                </div>
                <div className="form-group">
                  <label>Cidade *</label>
                  <input required value={form.cidade} onChange={e => setForm(f => ({ ...f, cidade: e.target.value }))} placeholder="Ex: Maputo" />
                </div>
                <div className="form-group">
                  <label>Telefone de contacto *</label>
                  <input required value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} placeholder="Ex: 84 000 0000" />
                </div>
                <div className="form-group">
                  <label>Notas (opcional)</label>
                  <textarea value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} placeholder="Instruções especiais..." style={{ minHeight: 80 }} />
                </div>
                {!user && (
                  <p style={{ fontSize: 13, color: 'var(--gray-600)', marginBottom: 16 }}>
                    <Link href="/conta?redirect=/carrinho" style={{ color: 'var(--black)', fontWeight: 600 }}>Entra na tua conta</Link> para finalizar a encomenda.
                  </p>
                )}
                <button className="btn btn-primary btn-full" type="submit" disabled={loading || !user}>
                  {loading ? 'A processar...' : 'Confirmar encomenda'}
                </button>
                <button type="button" className="btn btn-outline btn-full" style={{ marginTop: 8 }} onClick={() => setCheckoutOpen(false)}>
                  Cancelar
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
