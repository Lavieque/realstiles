'use client';
import { useState, useEffect, useRef } from 'react';
import Image from '@/components/CloudImage';
import Link from 'next/link';
import { ShoppingBag, Loader2, XCircle } from 'lucide-react';
import { useCarrinho, getTotalPreco } from '@/store/carrinho';
import { criarEncomendaPendente, criarEncomenda } from '@/lib/encomendas';
import { onAuthChange, getPerfil } from '@/lib/auth';
import { mostrarToast } from '@/components/Toast';
import { db } from '@/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import type { User } from 'firebase/auth';

type Metodo = 'mpesa' | 'emola' | 'cartao' | 'paysuite';
type PagamentoStatus = 'idle' | 'aguardar' | 'sucesso' | 'erro';


const LogoMpesa = () => (
  // eslint-disable-next-line @next/next/no-img-element
  <img src="/img/mpesa.png" alt="M-Pesa" style={{ height: 32, width: 'auto', objectFit: 'contain' }} />
);

const LogoEmola = () => (
  // eslint-disable-next-line @next/next/no-img-element
  <img src="/img/emola.png" alt="e-Mola" style={{ height: 32, width: 'auto', objectFit: 'contain' }} />
);

const LogoCartao = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 58" style={{ height: 32, width: 'auto' }} aria-label="Visa e Mastercard">
    <rect width="180" height="58" rx="10" fill="#ffffff"/>
    <text x="18" y="37" fontFamily="Arial, Helvetica, sans-serif" fontSize="24" fontWeight="700" fontStyle="italic" fill="#1a1f71">VISA</text>
    <circle cx="120" cy="29" r="17" fill="#eb001b"/>
    <circle cx="141" cy="29" r="17" fill="#f79e1b" fillOpacity="0.92"/>
    <path d="M130.5 15.8a17 17 0 0 1 0 26.4 17 17 0 0 1 0-26.4Z" fill="#ff5f00"/>
  </svg>
);

const LogoPaySuite = () => (
  <div style={{ height: 32, display: 'flex', alignItems: 'center', fontWeight: 800, fontSize: 14, letterSpacing: '-0.02em', color: '#0d1347' }}>
    PaySuite
  </div>
);

const METODOS: { id: Metodo; label: string; sub: string; Logo: () => JSX.Element }[] = [
  { id: 'mpesa',    label: 'M-Pesa',   sub: '84 / 85',   Logo: LogoMpesa },
  { id: 'emola',    label: 'e-Mola',   sub: '86 / 87',   Logo: LogoEmola },
  { id: 'cartao',   label: 'Cartão',   sub: 'Visa / MC', Logo: LogoCartao },
  { id: 'paysuite', label: 'PaySuite', sub: 'Mpesa/eMola/Cartão', Logo: LogoPaySuite },
];

export default function CarrinhoPage() {
  const { items, removerItem, actualizarQuantidade, limpar } = useCarrinho();
  const total = getTotalPreco(items);
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: '', morada: '', cidade: '', telefone: '', notas: '' });
  const [metodo, setMetodo] = useState<Metodo>('mpesa');
  const [pagTelefone, setPagTelefone] = useState('');
  const [pagStatus, setPagStatus] = useState<PagamentoStatus>('idle');
  const [pagErro, setPagErro] = useState('');
  const [encomendaId, setEncomendaId] = useState('');
  const [aguardarSecs, setAguardarSecs] = useState(180);
  const unsubRef = useRef<(() => void) | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const canUseZumboPay = isAdmin;

  useEffect(() => {
    const unsub = onAuthChange(async (u) => {
      setUser(u);
      if (u) {
        const p = await getPerfil(u.uid);
        if (p) {
          setIsAdmin(!!p.admin);
          setForm(f => ({
            ...f,
            email: u.email || '',
            morada: f.morada || p.morada || '',
            telefone: f.telefone || p.telefone || '',
          }));
        }
      }
    });
    return unsub;
  }, []);

  // Limpa listener Firestore ao desmontar
  useEffect(() => () => { if (unsubRef.current) unsubRef.current(); }, []);

  const aguardarConfirmacao = (encId: string) => {
    setPagStatus('aguardar');
    setAguardarSecs(180);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setAguardarSecs(s => { if (s <= 1) { if (timerRef.current) clearInterval(timerRef.current!); } return Math.max(0, s - 1); });
    }, 1000);

    // Timeout de segurança: 3 minutos
    const timeout = setTimeout(() => {
      if (unsubRef.current) unsubRef.current();
      setPagStatus('erro');
      setPagErro('Tempo de espera esgotado. Verifica se o pagamento foi concluído.');
    }, 3 * 60 * 1000);

    // Escuta em tempo real — atualizado pelo webhook quando o utilizador confirma no telemóvel
    unsubRef.current = onSnapshot(doc(db, 'encomendas', encId), (snap) => {
      const estado = snap.data()?.estado;
      if (estado === 'confirmada') {
        clearTimeout(timeout);
        if (unsubRef.current) unsubRef.current();
        limpar();
        window.location.href = `/encomenda/${encId}?confirmada=1`;
      } else if (estado === 'cancelada') {
        clearTimeout(timeout);
        if (unsubRef.current) unsubRef.current();
        setPagStatus('erro');
        setPagErro('Pagamento cancelado. Tenta novamente.');
      }
    });
  };

  const handleCheckoutSimples = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const encId = await criarEncomenda({
        itens: items,
        morada: form.morada,
        cidade: form.cidade,
        telefone: form.telefone,
        notas: form.notas,
        guestEmail: form.email,
      });
      limpar();
      window.location.href = `/encomenda/${encId}`;
    } catch (err) {
      mostrarToast(err instanceof Error ? err.message : 'Erro ao processar encomenda.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setPagErro('');
    try {
      const encId = await criarEncomendaPendente({
        itens: items,
        morada: form.morada,
        cidade: form.cidade,
        telefone: form.telefone,
        notas: form.notas,
        guestEmail: form.email,
        pagamento_metodo: metodo,
      });
      setEncomendaId(encId);

      if (metodo === 'cartao') {
        const res = await fetch('/api/zumbopay/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ encomenda_id: encId, amount: total }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erro ao criar checkout');
        window.location.href = data.checkout_url;
        return;
      }

      if (metodo === 'paysuite') {
        const res = await fetch('/api/paysuite/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            encomenda_id: encId,
            amount: total,
            customer_name: user?.displayName || form.email || 'Cliente',
            customer_email: form.email,
            customer_phone: form.telefone,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erro ao criar checkout');
        window.location.href = data.checkout_url;
        return;
      }

      // M-Pesa ou e-Mola — STK push
      const res = await fetch('/api/zumbopay/charges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          encomenda_id: encId,
          amount: total,
          msisdn: pagTelefone,
          metodo,
          customer_name: user?.displayName || form.email || 'Cliente',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao iniciar pagamento');

      if (data.status === 'succeeded') {
        limpar();
        window.location.href = `/encomenda/${encId}?confirmada=1`;
        return;
      }

      if (data.status === 'redirect' && data.checkout_url) {
        window.location.href = data.checkout_url;
        return;
      }

      // STK enviado — aguardar confirmação via Firestore
      aguardarConfirmacao(encId);
    } catch (err) {
      mostrarToast(err instanceof Error ? err.message : 'Erro ao processar pagamento.', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (items.length === 0 && pagStatus !== 'sucesso') {
    return (
      <div className="page-wrapper">
        <div className="container">
          <div className="empty-state" style={{ paddingTop: 80 }}>
            <div className="icon"><ShoppingBag size={40} strokeWidth={1.5} /></div>
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

        <div className="carrinho-grid">
          {/* Itens */}
          <div style={{ background: 'white', borderRadius: 16, border: '1px solid var(--gray-200)', overflow: 'hidden' }}>
            {items.map(item => (
              <div key={item.key} style={{ display: 'flex', gap: 16, padding: 20, borderBottom: '1px solid var(--gray-100)', alignItems: 'center' }}>
                <Image src={item.imagem || '/placeholder.svg'} alt={item.nome} width={80} height={100} style={{ objectFit: 'cover', borderRadius: 8 }} />
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

          {/* Resumo + Pagamento */}
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

            {/* Estado: aguardar pagamento */}
            {pagStatus === 'aguardar' && (() => {
              const mins = Math.floor(aguardarSecs / 60);
              const secs = aguardarSecs % 60;
              const pct = (aguardarSecs / 180) * 100;
              const metodoNome = metodo === 'mpesa' ? 'M-Pesa' : 'e-Mola';
              return (
                <div style={{ padding: '4px 0 8px' }}>
                  <div style={{ background: '#fff8f0', border: '1.5px solid #f7b731', borderRadius: 12, padding: '16px 18px', marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: 14, color: '#c67a00' }}>Aguardando confirmação…</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#c67a00', fontVariantNumeric: 'tabular-nums' }}>
                        {mins}:{secs.toString().padStart(2, '0')}
                      </span>
                    </div>
                    <p style={{ fontSize: 13, color: '#555', marginBottom: 10, lineHeight: 1.5 }}>
                      Enviámos um pedido de confirmação para o número <strong>{pagTelefone}</strong>.<br />
                      Por favor, confirma o pagamento de <strong>{total.toFixed(2)} MZN</strong> no {metodoNome}.
                    </p>
                    <div style={{ height: 6, background: '#ffe4a0', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: '#f7b731', borderRadius: 99, transition: 'width 1s linear' }} />
                    </div>
                  </div>
                  <button
                    className="btn btn-outline btn-full btn-sm"
                    onClick={() => { if (unsubRef.current) { unsubRef.current(); unsubRef.current = null; } if (timerRef.current) clearInterval(timerRef.current); setPagStatus('idle'); }}
                  >
                    Cancelar
                  </button>
                </div>
              );
            })()}

            {/* Estado: erro */}
            {pagStatus === 'erro' && (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <XCircle size={32} strokeWidth={1.5} style={{ color: 'var(--red)', marginBottom: 8 }} />
                <p style={{ fontWeight: 600, marginBottom: 4 }}>Pagamento falhado</p>
                <p style={{ fontSize: 13, color: 'var(--gray-400)', marginBottom: 16 }}>{pagErro}</p>
                <button className="btn btn-primary btn-full" onClick={() => setPagStatus('idle')}>Tentar novamente</button>
                {encomendaId && (
                  <Link href={`/encomenda/${encomendaId}`} style={{ display: 'block', marginTop: 8, fontSize: 12, color: 'var(--gray-400)' }}>
                    Ver encomenda
                  </Link>
                )}
              </div>
            )}

            {/* Formulário de checkout */}
            {pagStatus === 'idle' && !checkoutOpen && (
              <button className="btn btn-primary btn-full btn-lg" onClick={() => setCheckoutOpen(true)}>
                Finalizar encomenda →
              </button>
            )}

            {pagStatus === 'idle' && checkoutOpen && (
              <form onSubmit={canUseZumboPay ? handleCheckout : handleCheckoutSimples}>
                {(!user || !user.email) && (
                  <div className="form-group">
                    <label>Email de contacto {!user ? '*' : '(opcional)'}</label>
                    <input type="email" required={!user} value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="o-teu@email.com" />
                  </div>
                )}
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

                {canUseZumboPay && (
                  <div className="form-group" style={{ marginBottom: 20 }}>
                    <label style={{ marginBottom: 10, display: 'block' }}>Método de pagamento *</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                      {METODOS.map(m => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setMetodo(m.id)}
                          style={{
                            padding: '12px 8px 10px',
                            borderRadius: 12,
                            border: `2px solid ${metodo === m.id ? 'var(--black)' : 'var(--gray-200)'}`,
                            background: metodo === m.id ? '#f5f5f5' : 'white',
                            cursor: 'pointer',
                            textAlign: 'center',
                            transition: 'all 0.15s',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 6,
                            boxShadow: metodo === m.id ? '0 0 0 2px var(--black)' : 'none',
                          }}
                        >
                          <m.Logo />
                        </button>
                      ))}
                    </div>
                    {metodo !== 'cartao' && metodo !== 'paysuite' && (
                      <div style={{ marginTop: 12 }}>
                        <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>
                          Número {metodo === 'mpesa' ? 'M-Pesa' : 'e-Mola'} para pagamento
                        </label>
                        <input
                          type="tel"
                          value={pagTelefone}
                          onChange={e => setPagTelefone(e.target.value)}
                          placeholder="Ex: 84 000 0000"
                          style={{ width: '100%' }}
                        />
                        <p style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 6 }}>
                          Receberás uma notificação neste número para inserir o PIN e confirmar o pagamento.
                        </p>
                      </div>
                    )}
                    {metodo === 'cartao' && (
                      <p style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 8 }}>
                        Serás redirecionado para a página de pagamento segura.
                      </p>
                    )}
                    {metodo === 'paysuite' && (
                      <p style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 8 }}>
                        Serás redirecionado para a página de pagamento PaySuite, onde escolhes o método (M-Pesa, e-Mola ou Cartão).
                      </p>
                    )}
                  </div>
                )}

                {!user && (
                  <p style={{ fontSize: 12, color: 'var(--gray-400)', marginBottom: 12 }}>
                    <Link href="/conta?redirect=/carrinho" style={{ color: 'var(--black)' }}>Entra na tua conta</Link> para guardar o histórico de encomendas.
                  </p>
                )}

                <button className="btn btn-primary btn-full" type="submit" disabled={loading}>
                  {loading
                    ? 'A processar...'
                    : canUseZumboPay
                      ? metodo === 'cartao'
                        ? 'Pagar com Cartão →'
                        : metodo === 'paysuite'
                          ? 'Pagar com PaySuite →'
                          : `Pagar ${total.toFixed(2)} MZN com ${metodo === 'mpesa' ? 'M-Pesa' : 'e-Mola'}`
                      : 'Finalizar encomenda →'}
                </button>
                <button type="button" className="btn btn-outline btn-full" style={{ marginTop: 8 }} onClick={() => setCheckoutOpen(false)}>
                  Cancelar
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
