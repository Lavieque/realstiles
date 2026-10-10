'use client';
import { useState, useEffect, useRef } from 'react';
import Image from '@/components/CloudImage';
import Link from 'next/link';
import { ShoppingBag, Loader2, XCircle } from 'lucide-react';
import { useCarrinho, getTotalPreco } from '@/store/carrinho';
import { criarEncomendaPendente, FORMAS_ENTREGA } from '@/lib/encomendas';
import type { FormaEntrega } from '@/lib/encomendas';
import { getConfig, DEFAULTS } from '@/lib/config-site';
import { onAuthChange, getPerfil } from '@/lib/auth';
import { mostrarToast } from '@/components/Toast';
import type { User } from 'firebase/auth';
import { getMetodosDisponiveis, iniciarPagamento } from '@/lib/pagamento-cliente';
import { INFO_METODO } from '@/lib/metodos-pagamento';
import type { MetodoPagamento } from '@/lib/metodos-pagamento';
import MetodoPagamentoSeletor from '@/components/MetodoPagamentoSeletor';
import PagamentoMovel from '@/components/PagamentoMovel';

type Metodo = MetodoPagamento;
type PagamentoStatus = 'idle' | 'aguardar' | 'sucesso' | 'erro';

export default function CarrinhoPage() {
  const { items, removerItem, actualizarQuantidade, limpar } = useCarrinho();
  const subtotal = getTotalPreco(items);
  const [formaEntrega, setFormaEntrega] = useState<FormaEntrega>('recolha');
  const [entregaConfig, setEntregaConfig] = useState({
    taxa: DEFAULTS.entrega_domicilio_taxa,
    recolhaInfo: DEFAULTS.entrega_recolha_info,
  });
  const taxaEntrega = formaEntrega === 'domicilio' ? entregaConfig.taxa : 0;
  const total = subtotal + taxaEntrega;
  const [user, setUser] = useState<User | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: '', morada: '', cidade: '', telefone: '', notas: '' });
  const [metodo, setMetodo] = useState<Metodo>('mpesa');
  const [metodosDisp, setMetodosDisp] = useState<Metodo[] | null>(null);
  const [pagTelefone, setPagTelefone] = useState('');
  const [pagStatus, setPagStatus] = useState<PagamentoStatus>('idle');
  const [pagErro, setPagErro] = useState('');
  const [encomendaId, setEncomendaId] = useState('');

  useEffect(() => {
    const unsub = onAuthChange(async (u) => {
      setUser(u);
      if (u) {
        const p = await getPerfil(u.uid);
        if (p) {
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

  useEffect(() => {
    getConfig()
      .then(c => setEntregaConfig({
        taxa: Math.max(0, Number(c.entrega_domicilio_taxa) || 0),
        recolhaInfo: c.entrega_recolha_info || '',
      }))
      .catch(() => {});
  }, []);

  // Métodos disponíveis no site; se o escolhido não estiver disponível, passa ao primeiro
  useEffect(() => {
    getMetodosDisponiveis().then(lista => {
      setMetodosDisp(lista);
      setMetodo(m => (lista.includes(m) || !lista.length ? m : lista[0]));
    });
  }, []);

  // Encomenda já criada para este carrinho: "Tentar de novo" depois de uma
  // tentativa falhada paga a mesma, em vez de criar outra
  const assinaturaCarrinho = JSON.stringify([items.map(i => [i.key, i.quantidade, i.preco]), formaEntrega, total]);
  const encomendaCriadaRef = useRef<{ id: string; assinatura: string } | null>(null);

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setPagErro('');
    try {
      const reutilizar = encomendaCriadaRef.current?.assinatura === assinaturaCarrinho;
      const encId = reutilizar ? encomendaCriadaRef.current!.id : await criarEncomendaPendente({
        itens: items,
        // Ponto de recolha não tem morada do cliente
        morada: formaEntrega === 'domicilio' ? form.morada : '',
        cidade: formaEntrega === 'domicilio' ? form.cidade : '',
        telefone: form.telefone,
        notas: form.notas,
        guestEmail: form.email,
        pagamento_metodo: metodo,
        forma_entrega: formaEntrega,
        taxa_entrega: taxaEntrega,
      });
      encomendaCriadaRef.current = { id: encId, assinatura: assinaturaCarrinho };
      setEncomendaId(encId);

      // Telemóvel: o popup abre já e é ele que envia o pedido e espera o PIN
      if (INFO_METODO[metodo].movel) {
        setPagStatus('aguardar');
        return;
      }

      // Cartão → redirect para o checkout
      const data = await iniciarPagamento({ encomendaId: encId, metodo });
      if (data.status === 'redirect' && data.checkout_url) {
        window.location.href = data.checkout_url;
        return;
      }
      if (data.status === 'succeeded') {
        limpar();
        window.location.href = `/encomenda/${encId}?confirmada=1`;
      }
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
              <span>Subtotal</span><span>{subtotal.toFixed(2)} MZN</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20, fontSize: 14, color: 'var(--gray-600)' }}>
              <span>{FORMAS_ENTREGA[formaEntrega]}</span>
              <span>{taxaEntrega > 0 ? `${taxaEntrega.toFixed(2)} MZN` : 'Grátis'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 16, borderTop: '1px solid var(--gray-200)', marginBottom: 20 }}>
              <span style={{ fontWeight: 700, fontSize: 16 }}>Total</span>
              <span style={{ fontWeight: 700, fontSize: 20 }}>{total.toFixed(2)} MZN</span>
            </div>

            {/* Estado: aguardar PIN no telemóvel */}
            {pagStatus === 'aguardar' && encomendaId && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 0', fontSize: 14, color: 'var(--gray-500)' }}>
                  <Loader2 size={16} strokeWidth={1.8} style={{ animation: 'spin 1s linear infinite' }} /> A aguardar confirmação do pagamento…
                </div>
                <PagamentoMovel
                  encomendaId={encomendaId}
                  metodo={metodo}
                  telefone={pagTelefone}
                  montante={total}
                  iniciar={() => iniciarPagamento({
                    encomendaId,
                    metodo,
                    msisdn: pagTelefone,
                    customerName: user?.displayName || form.email || 'Cliente',
                  })}
                  onPago={() => {
                    limpar();
                    window.location.href = `/encomenda/${encomendaId}?confirmada=1`;
                  }}
                  onFechar={() => setPagStatus('idle')}
                />
              </>
            )}

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
              <form onSubmit={handleCheckout}>
                {(!user || !user.email) && (
                  <div className="form-group">
                    <label>Email de contacto {!user ? '*' : '(opcional)'}</label>
                    <input type="email" required={!user} value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="o-teu@email.com" />
                  </div>
                )}
                <div className="form-group">
                  <label style={{ marginBottom: 10, display: 'block' }}>Forma de entrega *</label>
                  <div className="entrega-opcoes">
                    {(Object.keys(FORMAS_ENTREGA) as FormaEntrega[]).map(fe => {
                      const taxa = fe === 'domicilio' ? entregaConfig.taxa : 0;
                      return (
                        <label key={fe} className={`entrega-opcao${formaEntrega === fe ? ' active' : ''}`}>
                          <input type="radio" name="forma_entrega" checked={formaEntrega === fe} onChange={() => setFormaEntrega(fe)} />
                          <span className="entrega-opcao-nome">{FORMAS_ENTREGA[fe]}</span>
                          <span className="entrega-opcao-preco">{taxa > 0 ? `+${taxa.toFixed(2)} MZN` : 'Grátis'}</span>
                        </label>
                      );
                    })}
                  </div>
                  {formaEntrega === 'recolha' && (
                    <p className="entrega-recolha-info">
                      {entregaConfig.recolhaInfo || 'Combinamos contigo o ponto de recolha pelo telefone de contacto.'}
                    </p>
                  )}
                </div>
                {formaEntrega === 'domicilio' && (
                  <>
                    <div className="form-group">
                      <label>Morada de entrega *</label>
                      <input required value={form.morada} onChange={e => setForm(f => ({ ...f, morada: e.target.value }))} placeholder="Rua, número, bairro" />
                    </div>
                    <div className="form-group">
                      <label>Cidade *</label>
                      <input required value={form.cidade} onChange={e => setForm(f => ({ ...f, cidade: e.target.value }))} placeholder="Ex: Maputo" />
                    </div>
                  </>
                )}
                <div className="form-group">
                  <label>Telefone de contacto *</label>
                  <input required value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} placeholder="Ex: 84 000 0000" />
                </div>
                <div className="form-group">
                  <label>Notas (opcional)</label>
                  <textarea value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} placeholder="Instruções especiais..." style={{ minHeight: 80 }} />
                </div>

                <div className="form-group" style={{ marginBottom: 20 }}>
                  <label style={{ marginBottom: 10, display: 'block' }}>Método de pagamento *</label>
                  {metodosDisp?.length === 0 && (
                    <p style={{ fontSize: 13, color: 'var(--red)' }}>
                      Pagamentos online indisponíveis de momento. Fala connosco via WhatsApp.
                    </p>
                  )}
                  <MetodoPagamentoSeletor
                    metodos={metodosDisp ?? (Object.keys(INFO_METODO) as Metodo[])}
                    valor={metodo}
                    onChange={setMetodo}
                  />
                  {metodo !== 'cartao' && (
                    <div style={{ marginTop: 12 }}>
                      <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>
                        Número {INFO_METODO[metodo].nome} para pagamento
                      </label>
                      <input
                        type="tel"
                        value={pagTelefone}
                        onChange={e => setPagTelefone(e.target.value)}
                        placeholder={`Ex: ${INFO_METODO[metodo].sub.slice(0, 2)} 000 0000`}
                        style={{ width: '100%' }}
                      />
                      <p style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 6 }}>
                        Receberás uma notificação neste número para inserir o PIN {INFO_METODO[metodo].nome} e confirmar o pagamento.
                      </p>
                    </div>
                  )}
                  {metodo === 'cartao' && (
                    <p style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 8 }}>
                      Serás redirecionado para a página de pagamento segura.
                    </p>
                  )}
                </div>

                {!user && (
                  <p style={{ fontSize: 12, color: 'var(--gray-400)', marginBottom: 12 }}>
                    <Link href="/conta?redirect=/carrinho" style={{ color: 'var(--black)' }}>Entra na tua conta</Link> para guardar o histórico de encomendas.
                  </p>
                )}

                <button className="btn btn-primary btn-full" type="submit" disabled={loading || metodosDisp?.length === 0}>
                  {loading
                    ? 'A processar...'
                    : metodo === 'cartao'
                      ? 'Pagar com Cartão →'
                      : `Pagar ${total.toFixed(2)} MZN com ${INFO_METODO[metodo].nome}`}
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
