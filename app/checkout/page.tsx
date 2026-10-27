'use client';
import { useState, useEffect, useRef } from 'react';
import Image from '@/components/CloudImage';
import Link from 'next/link';
import { Loader2, XCircle, Check, ArrowLeft, ArrowRight } from 'lucide-react';
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
import Preco from '@/components/Preco';

type Metodo = MetodoPagamento;
type PagamentoStatus = 'idle' | 'aguardar' | 'erro';

const PASSOS = ['Entrega', 'Pagamento', 'Revisão'];

export default function CheckoutPage() {
  const { items, limpar } = useCarrinho();
  const subtotal = getTotalPreco(items);
  const [passo, setPasso] = useState(1);
  const [formaEntrega, setFormaEntrega] = useState<FormaEntrega>('recolha');
  const [entregaConfig, setEntregaConfig] = useState({
    taxa: DEFAULTS.entrega_domicilio_taxa,
    sobConsulta: DEFAULTS.entrega_domicilio_sob_consulta,
    recolhaInfo: DEFAULTS.entrega_recolha_info,
  });
  const entregaSobConsulta = formaEntrega === 'domicilio' && entregaConfig.sobConsulta;
  const taxaEntrega = formaEntrega === 'domicilio' && !entregaConfig.sobConsulta ? entregaConfig.taxa : 0;
  const total = subtotal + taxaEntrega;
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: '', morada: '', cidade: '', telefone: '', notas: '' });
  const [metodo, setMetodo] = useState<Metodo>('mpesa');
  const [metodosDisp, setMetodosDisp] = useState<Metodo[] | null>(null);
  const [pagTelefone, setPagTelefone] = useState('');
  const [pagStatus, setPagStatus] = useState<PagamentoStatus>('idle');
  const [pagErro] = useState('');
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
        sobConsulta: !!c.entrega_domicilio_sob_consulta,
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

  const handleCheckout = async () => {
    setLoading(true);
    try {
      const reutilizar = encomendaCriadaRef.current?.assinatura === assinaturaCarrinho;
      // O total cobrado é o que o servidor calcular a partir dos produtos e da
      // configuração do site — o que se mostra aqui é só a estimativa
      const encId = reutilizar ? encomendaCriadaRef.current!.id : (await criarEncomendaPendente({
        itens: items,
        // Ponto de recolha não tem morada do cliente
        morada: formaEntrega === 'domicilio' ? form.morada : '',
        cidade: formaEntrega === 'domicilio' ? form.cidade : '',
        telefone: form.telefone,
        notas: form.notas,
        pagamento_metodo: metodo,
        forma_entrega: formaEntrega,
      })).id;
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

  if (items.length === 0 && pagStatus === 'idle') {
    return (
      <div className="page-wrapper">
        <div className="container">
          <div className="empty-state" style={{ paddingTop: 96 }}>
            <span className="eyebrow" style={{ marginBottom: 14 }}>Compra simples, em cada etapa</span>
            <h1 className="display-titulo" style={{ fontSize: 'clamp(1.8rem, 3vw, 2.4rem)', marginBottom: 10 }}>O teu carrinho está vazio.</h1>
            <p>Adiciona um produto para continuar.</p>
            <Link href="/loja" className="btn-escuro" style={{ marginTop: 24 }}>Explorar coleção <ArrowRight size={16} strokeWidth={1.75} /></Link>
          </div>
        </div>
      </div>
    );
  }

  const movelOuCartao = INFO_METODO[metodo];
  const textoEntrega = entregaSobConsulta ? 'Sob consulta' : taxaEntrega > 0 ? null : 'Grátis';

  return (
    <div className="page-wrapper">
      <div className="container">
        <header className="page-header">
          <Link href="/carrinho" className="checkout-voltar"><ArrowLeft size={14} strokeWidth={1.75} /> Voltar ao carrinho</Link>
          <span className="eyebrow" style={{ margin: '18px 0 14px' }}>Simples, em cada etapa</span>
          <h1 className="display-titulo">Quase teu.</h1>
          <p>Finaliza como visitante ou entra para usar o teu perfil.</p>
        </header>

        <ol className="passos" aria-label="Etapas da compra">
          {PASSOS.map((nome, i) => {
            const n = i + 1;
            const estado = passo === n ? 'actual' : passo > n ? 'feito' : '';
            return (
              <li key={nome} className={`passo ${estado}`} aria-current={passo === n ? 'step' : undefined}>
                <span className="passo-num">{passo > n ? <Check size={14} strokeWidth={2.5} /> : n}</span>
                <span className="passo-nome">{nome}</span>
              </li>
            );
          })}
        </ol>

        <div className="carrinho-grid">
          <section className="checkout-painel">
            {/* Aguardar PIN no telemóvel */}
            {pagStatus === 'aguardar' && encomendaId && (
              <>
                <div className="checkout-aguardar">
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

            {pagStatus === 'erro' && (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <XCircle size={32} strokeWidth={1.5} style={{ color: 'var(--red)', marginBottom: 8 }} />
                <p style={{ fontWeight: 600, marginBottom: 4 }}>Pagamento falhado</p>
                <p style={{ fontSize: 13, color: 'var(--gray-400)', marginBottom: 16 }}>{pagErro}</p>
                <button className="btn btn-primary" onClick={() => setPagStatus('idle')}>Tentar novamente</button>
                {encomendaId && (
                  <Link href={`/encomenda/${encomendaId}`} style={{ display: 'block', marginTop: 8, fontSize: 12, color: 'var(--gray-400)' }}>
                    Ver encomenda
                  </Link>
                )}
              </div>
            )}

            {/* Passo 1 — Entrega */}
            {pagStatus === 'idle' && passo === 1 && (
              <form onSubmit={e => { e.preventDefault(); setPasso(2); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                <h2 className="checkout-titulo">Onde entregamos?</h2>
                {(!user || !user.email) && (
                  <div className="form-group">
                    <label>Email de contacto {!user ? '*' : '(opcional)'}</label>
                    <input type="email" required={!user} value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="o-teu@email.com" />
                  </div>
                )}
                <div className="form-group">
                  <label style={{ marginBottom: 10, display: 'block' }}>Como queres receber? *</label>
                  <div className="entrega-opcoes">
                    {(Object.keys(FORMAS_ENTREGA) as FormaEntrega[]).map(fe => {
                      const sobConsulta = fe === 'domicilio' && entregaConfig.sobConsulta;
                      const taxa = fe === 'domicilio' && !sobConsulta ? entregaConfig.taxa : 0;
                      return (
                        <label key={fe} className={`entrega-opcao${formaEntrega === fe ? ' active' : ''}`}>
                          <input type="radio" name="forma_entrega" checked={formaEntrega === fe} onChange={() => setFormaEntrega(fe)} />
                          <span className="entrega-opcao-nome">{FORMAS_ENTREGA[fe]}</span>
                          <span className="entrega-opcao-preco">{sobConsulta ? 'Sob consulta' : taxa > 0 ? `+${taxa.toFixed(2)} MZN` : 'Grátis'}</span>
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
                  <div className="form-grid-2">
                    <div className="form-group">
                      <label>Morada / ponto de referência *</label>
                      <input required value={form.morada} onChange={e => setForm(f => ({ ...f, morada: e.target.value }))} placeholder="Rua, número, bairro" />
                    </div>
                    <div className="form-group">
                      <label>Cidade / distrito *</label>
                      <input required value={form.cidade} onChange={e => setForm(f => ({ ...f, cidade: e.target.value }))} placeholder="Ex: Maputo" />
                    </div>
                  </div>
                )}
                <div className="form-group">
                  <label>Telemóvel *</label>
                  <input required type="tel" value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} placeholder="Ex: 84 000 0000" />
                </div>
                <div className="form-group">
                  <label>Notas (opcional)</label>
                  <textarea value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} placeholder="Instruções especiais..." style={{ minHeight: 80 }} />
                </div>
                {!user && (
                  <p className="checkout-nota">
                    <Link href="/conta?redirect=/checkout">Entra na tua conta</Link> para guardar o histórico de encomendas.
                  </p>
                )}
                <button className="btn-escuro checkout-cta" type="submit">Continuar para pagamento <ArrowRight size={16} strokeWidth={1.75} /></button>
              </form>
            )}

            {/* Passo 2 — Pagamento */}
            {pagStatus === 'idle' && passo === 2 && (
              <form onSubmit={e => { e.preventDefault(); setPasso(3); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                <h2 className="checkout-titulo">Como queres pagar?</h2>
                {metodosDisp?.length === 0 && (
                  <p style={{ fontSize: 13, color: 'var(--red)', marginBottom: 12 }}>
                    Pagamentos online indisponíveis de momento. Fala connosco via WhatsApp.
                  </p>
                )}
                <MetodoPagamentoSeletor
                  metodos={metodosDisp ?? (Object.keys(INFO_METODO) as Metodo[])}
                  valor={metodo}
                  onChange={setMetodo}
                />
                {metodo !== 'cartao' ? (
                  <div className="form-group" style={{ marginTop: 20 }}>
                    <label>Número {movelOuCartao.nome} para pagamento</label>
                    <input
                      type="tel"
                      value={pagTelefone}
                      onChange={e => setPagTelefone(e.target.value)}
                      placeholder={`Ex: ${movelOuCartao.sub.slice(0, 2)} 000 0000`}
                    />
                    <p className="checkout-nota">
                      Receberás uma notificação neste número para inserir o PIN {movelOuCartao.nome} e confirmar o pagamento. A equipa nunca te pede o PIN.
                    </p>
                  </div>
                ) : (
                  <p className="checkout-nota" style={{ marginTop: 16 }}>Serás redirecionado para a página de pagamento segura.</p>
                )}
                <div className="checkout-botoes">
                  <button type="button" className="btn-claro" onClick={() => setPasso(1)}><ArrowLeft size={16} strokeWidth={1.75} /> Voltar</button>
                  <button className="btn-escuro" type="submit" disabled={metodosDisp?.length === 0}>Rever a compra <ArrowRight size={16} strokeWidth={1.75} /></button>
                </div>
              </form>
            )}

            {/* Passo 3 — Revisão */}
            {pagStatus === 'idle' && passo === 3 && (
              <div>
                <h2 className="checkout-titulo">Revê e confirma.</h2>
                <dl className="revisao">
                  <div>
                    <dt>Entrega <button type="button" onClick={() => setPasso(1)}>Alterar</button></dt>
                    <dd>
                      {FORMAS_ENTREGA[formaEntrega]}
                      {formaEntrega === 'domicilio' && <><br />{form.morada}, {form.cidade}</>}
                      <br />Telemóvel {form.telefone}
                      {form.email && <><br />{form.email}</>}
                      {form.notas && <><br /><em>{form.notas}</em></>}
                    </dd>
                  </div>
                  <div>
                    <dt>Pagamento <button type="button" onClick={() => setPasso(2)}>Alterar</button></dt>
                    <dd>{movelOuCartao.nome}{metodo !== 'cartao' && pagTelefone ? ` · ${pagTelefone}` : ''}</dd>
                  </div>
                </dl>
                <p className="checkout-nota">Ao pagar, aceitas os <Link href="/termos">termos e condições</Link> e a <Link href="/politicas">política de compras</Link>.</p>
                <div className="checkout-botoes">
                  <button type="button" className="btn-claro" onClick={() => setPasso(2)}><ArrowLeft size={16} strokeWidth={1.75} /> Voltar</button>
                  <button className="btn-escuro" type="button" onClick={handleCheckout} disabled={loading}>
                    {loading ? 'A processar...' : metodo === 'cartao' ? 'Pagar com cartão' : `Pagar com ${movelOuCartao.nome}`}
                  </button>
                </div>
              </div>
            )}
          </section>

          <aside className="resumo-card">
            <h2>Resumo da compra</h2>
            <ul className="resumo-itens">
              {items.map(item => (
                <li key={item.key}>
                  <Image src={item.imagem || '/placeholder.svg'} alt="" width={48} height={60} style={{ objectFit: 'cover', borderRadius: 3 }} />
                  <div>
                    <p>{item.nome}</p>
                    <small>{[item.cor, item.tamanho && `Tamanho ${item.tamanho}`].filter(Boolean).join(' · ')}{(item.cor || item.tamanho) ? ' · ' : ''}{item.quantidade} un.</small>
                  </div>
                  <Preco valor={item.preco * item.quantidade} />
                </li>
              ))}
            </ul>
            <div className="resumo-linha"><span>Subtotal</span><Preco valor={subtotal} /></div>
            <div className="resumo-linha">
              <span>{FORMAS_ENTREGA[formaEntrega]}</span>
              {textoEntrega ? <span>{textoEntrega}</span> : <Preco valor={taxaEntrega} />}
            </div>
            <div className="resumo-linha resumo-total"><span>Total</span><Preco valor={total} className="preco-atual" /></div>
            <p className="resumo-info">Prazo final estimado de 15 a 30 dias úteis, após confirmação do pagamento e da encomenda.</p>
          </aside>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
