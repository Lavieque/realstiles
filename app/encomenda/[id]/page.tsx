'use client';
import { useState, useEffect, useRef } from 'react';
import Image from '@/components/CloudImage';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { onAuthChange, getPerfil } from '@/lib/auth';
import { getConfig } from '@/lib/config-site';
import type { SiteConfig } from '@/lib/config-site';
import { getEncomenda, cancelarEncomenda, badgeEstadoClass, badgeEstadoLabel, formatarData, referenciaEncomenda } from '@/lib/encomendas';
import { useCarrinho } from '@/store/carrinho';
import { mostrarToast } from '@/components/Toast';
import { db } from '@/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import type { Encomenda, EstadoEncomenda } from '@/lib/encomendas';
import type { User } from 'firebase/auth';
import { Lock, Frown, CheckCircle2, RotateCcw, MessageCircle, Printer, X, ArrowLeft, Clock, Truck, Package, Loader2, CreditCard } from 'lucide-react';


type Metodo = 'mpesa' | 'emola' | 'cartao' | 'paysuite';

const LogoMpesa = () => (
  // eslint-disable-next-line @next/next/no-img-element
  <img src="/img/mpesa.png" alt="M-Pesa" style={{ height: 28, width: 'auto', objectFit: 'contain' }} />
);
const LogoEmola = () => (
  // eslint-disable-next-line @next/next/no-img-element
  <img src="/img/emola.png" alt="e-Mola" style={{ height: 28, width: 'auto', objectFit: 'contain' }} />
);
const LogoCartao = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 58" style={{ height: 28, width: 'auto' }}>
    <rect width="180" height="58" rx="10" fill="#ffffff"/>
    <text x="18" y="37" fontFamily="Arial,sans-serif" fontSize="24" fontWeight="700" fontStyle="italic" fill="#1a1f71">VISA</text>
    <circle cx="120" cy="29" r="17" fill="#eb001b"/>
    <circle cx="141" cy="29" r="17" fill="#f79e1b" fillOpacity="0.92"/>
    <path d="M130.5 15.8a17 17 0 0 1 0 26.4 17 17 0 0 1 0-26.4Z" fill="#ff5f00"/>
  </svg>
);

const LogoPaySuite = () => (
  <div style={{ height: 28, display: 'flex', alignItems: 'center', fontWeight: 800, fontSize: 13, letterSpacing: '-0.02em', color: '#0d1347' }}>
    PaySuite
  </div>
);

const METODOS_RETRY: { id: Metodo; Logo: () => JSX.Element }[] = [
  { id: 'mpesa',    Logo: LogoMpesa },
  { id: 'emola',    Logo: LogoEmola },
  { id: 'cartao',   Logo: LogoCartao },
  { id: 'paysuite', Logo: LogoPaySuite },
];

const WHATSAPP_NUM = '258878753754';

const TIMELINE_ESTADOS = [
  { key: 'pendente',   icon: <Clock size={18} strokeWidth={1.5} />,        label: 'Encomenda recebida',  sub: 'A aguardar confirmação da loja' },
  { key: 'confirmada', icon: <CheckCircle2 size={18} strokeWidth={1.5} />, label: 'Encomenda confirmada', sub: 'A loja confirmou a tua encomenda' },
  { key: 'enviada',    icon: <Truck size={18} strokeWidth={1.5} />,        label: 'Encomenda enviada',    sub: 'A encomenda está a caminho' },
  { key: 'entregue',   icon: <Package size={18} strokeWidth={1.5} />,      label: 'Encomenda entregue',   sub: 'Entregue com sucesso' },
];

export default function EncomendaPage({ params }: { params: { id: string } }) {
  const searchParams = useSearchParams();
  const confirmada = searchParams.get('confirmada') === '1';
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [isAdmin, setIsAdmin] = useState(false);
  const [encomenda, setEncomenda] = useState<Encomenda | null>(null);
  const [loading, setLoading] = useState(true);
  const [siteConfig, setSiteConfig] = useState<SiteConfig | null>(null);
  const [cancelando, setCancelando] = useState(false);
  const [confirmarCancel, setConfirmarCancel] = useState(false);
  const [retryMetodo, setRetryMetodo] = useState<Metodo>('mpesa');
  const [retryTelefone, setRetryTelefone] = useState('');
  const [retryLoading, setRetryLoading] = useState(false);
  const [retryStatus, setRetryStatus] = useState<'idle' | 'aguardar'>('idle');
  const unsubRef = useRef<(() => void) | null>(null);
  const { adicionarItem, abrirDrawer } = useCarrinho();

  useEffect(() => {
    const unsub = onAuthChange(async (u) => {
      setUser(u);
      if (!u) { setLoading(false); return; }
      const [enc, cfg, perfil] = await Promise.all([getEncomenda(params.id), getConfig(), getPerfil(u.uid)]);
      setIsAdmin(!!perfil?.admin);
      setEncomenda(enc);
      setSiteConfig(cfg);
      if (enc?.telefone_contacto) setRetryTelefone(enc.telefone_contacto);
      setLoading(false);
    });
    return unsub;
  }, [params.id]);

  useEffect(() => () => { if (unsubRef.current) unsubRef.current(); }, []);

  const handleRetry = async () => {
    if (!encomenda) return;
    setRetryLoading(true);
    try {
      if (retryMetodo === 'cartao') {
        const res = await fetch('/api/zumbopay/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ encomenda_id: encomenda.id, amount: encomenda.total }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erro ao criar checkout');
        window.location.href = data.checkout_url;
        return;
      }

      if (retryMetodo === 'paysuite') {
        const res = await fetch('/api/paysuite/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            encomenda_id: encomenda.id,
            amount: encomenda.total,
            customer_name: user?.displayName || encomenda.cliente_email || 'Cliente',
            customer_email: encomenda.cliente_email,
            customer_phone: retryTelefone,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erro ao criar checkout');
        window.location.href = data.checkout_url;
        return;
      }

      const res = await fetch('/api/zumbopay/charges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          encomenda_id: encomenda.id,
          amount: encomenda.total,
          msisdn: retryTelefone,
          metodo: retryMetodo,
          customer_name: user?.displayName || encomenda.cliente_email || 'Cliente',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao iniciar pagamento');

      if (data.status === 'succeeded') {
        window.location.href = `/encomenda/${encomenda.id}?confirmada=1`;
        return;
      }

      if (data.status === 'redirect' && data.checkout_url) {
        window.location.href = data.checkout_url;
        return;
      }

      setRetryStatus('aguardar');
      const timeout = setTimeout(() => {
        if (unsubRef.current) unsubRef.current();
        setRetryStatus('idle');
        mostrarToast('Tempo esgotado. Verifica se o pagamento foi concluído.', 'error');
      }, 3 * 60 * 1000);

      unsubRef.current = onSnapshot(doc(db, 'encomendas', encomenda.id), (snap) => {
        const estado = snap.data()?.estado;
        if (estado === 'confirmada') {
          clearTimeout(timeout);
          if (unsubRef.current) unsubRef.current();
          window.location.href = `/encomenda/${encomenda.id}?confirmada=1`;
        }
      });
    } catch (err) {
      mostrarToast(err instanceof Error ? err.message : 'Erro ao processar pagamento.', 'error');
    } finally {
      setRetryLoading(false);
    }
  };

  const handleCancelar = async () => {
    if (!encomenda) return;
    setCancelando(true);
    try {
      await cancelarEncomenda(encomenda.id);
      setEncomenda(e => e ? { ...e, estado: 'cancelada' } : e);
      mostrarToast('Encomenda cancelada.', 'success');
    } catch {
      mostrarToast('Erro ao cancelar. Tenta novamente.', 'error');
    } finally {
      setCancelando(false);
      setConfirmarCancel(false);
    }
  };

  const handleRepetir = () => {
    if (!encomenda) return;
    encomenda.itens.forEach(item => {
      adicionarItem(
        { id: item.produto_id, nome: item.nome, preco: item.preco, imagens: [item.imagem] },
        item.tamanho, item.cor, item.quantidade
      );
    });
    mostrarToast(`${encomenda.itens.length} artigo${encomenda.itens.length !== 1 ? 's' : ''} adicionado${encomenda.itens.length !== 1 ? 's' : ''} ao carrinho!`, 'success');
    abrirDrawer();
  };

  const handleImprimir = () => window.print();

  if (user === undefined || loading) {
    return <div className="page-wrapper"><div className="container"><div className="loading"><div className="spinner" /> A carregar...</div></div></div>;
  }

  if (!user) {
    return (
      <div className="page-wrapper"><div className="container">
        <div className="empty-state" style={{ paddingTop: 80 }}>
          <div className="icon"><Lock size={40} strokeWidth={1.5} /></div>
          <h3>Acesso restrito</h3>
          <Link href="/conta" className="btn btn-primary" style={{ marginTop: 20 }}>Entrar</Link>
        </div>
      </div></div>
    );
  }

  if (!encomenda) {
    return (
      <div className="page-wrapper"><div className="container">
        <div className="empty-state" style={{ paddingTop: 80 }}>
          <div className="icon"><Frown size={40} strokeWidth={1.5} /></div>
          <h3>Encomenda não encontrada</h3>
          <Link href="/encomendas" className="btn btn-primary" style={{ marginTop: 20 }}>As minhas encomendas</Link>
        </div>
      </div></div>
    );
  }

  const ordemActual = TIMELINE_ESTADOS.findIndex(e => e.key === encomenda.estado);
  const codCurto = encomenda.id.substring(0, 8).toUpperCase();
  const ref = referenciaEncomenda(encomenda);

  // Data de cada estado a partir do histórico (se existir)
  const dataEstado = (key: string): string => {
    const hist = encomenda.historico_estados?.find(h => h.estado === key);
    if (hist) return formatarData(hist.data);
    if (key === encomenda.estado) return formatarData(encomenda.actualizado_em || encomenda.criado_em);
    return '';
  };

  const whatsappUrl = `https://wa.me/${WHATSAPP_NUM}?text=${encodeURIComponent(
    `Olá, tenho uma dúvida sobre a minha encomenda ${ref}.`
  )}`;

  return (
    <div className="page-wrapper">
      <div className="container enc-detalhe-container">

        {confirmada && (
          <div className="enc-confirmada-banner">
            <CheckCircle2 size={24} strokeWidth={1.5} />
            <div>
              <p style={{ fontWeight: 700 }}>Encomenda confirmada!</p>
              <p style={{ fontSize: 14, opacity: 0.9 }}>
                {encomenda?.notif_canal === 'whatsapp'
                  ? 'Receberás uma confirmação pelo WhatsApp. Entraremos em contacto em breve.'
                  : 'Receberás um email com os detalhes. Entraremos em contacto em breve.'}
              </p>
            </div>
          </div>
        )}

        <div className="page-header" style={{ paddingBottom: 24 }}>
          <Link href="/encomendas" className="enc-back-link" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><ArrowLeft size={14} strokeWidth={1.5} /> Voltar às encomendas</Link>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h1 style={{ fontSize: '1.6rem' }}>
                Encomenda <span style={{ fontFamily: 'monospace', fontSize: '1.2rem' }}>{ref}</span>
              </h1>
              <p style={{ marginTop: 4 }}>{formatarData(encomenda.criado_em)}</p>
            </div>
            <span className={`badge-estado ${badgeEstadoClass(encomenda.estado as EstadoEncomenda)}`} style={{ fontSize: 14, padding: '6px 14px' }}>
              {badgeEstadoLabel(encomenda.estado as EstadoEncomenda)}
            </span>
          </div>
        </div>

        {/* Acções rápidas */}
        <div className="enc-acoes">
          <button className="btn btn-outline btn-sm" onClick={handleRepetir} title="Adicionar os mesmos artigos ao carrinho" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <RotateCcw size={14} strokeWidth={1.5} /> Repetir encomenda
          </button>
          <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <MessageCircle size={14} strokeWidth={1.5} /> Contactar via WhatsApp
          </a>
          <button className="btn btn-outline btn-sm enc-print-btn" onClick={handleImprimir} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Printer size={14} strokeWidth={1.5} /> Imprimir / PDF
          </button>
          {encomenda.estado === 'pendente' && (
            <button
              className="btn btn-sm enc-cancel-btn"
              onClick={() => setConfirmarCancel(true)}
              disabled={cancelando}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <X size={14} strokeWidth={1.5} /> Cancelar encomenda
            </button>
          )}
        </div>

        {/* Modal de confirmação de cancelamento */}
        {confirmarCancel && (
          <div className="enc-modal-overlay" onClick={() => setConfirmarCancel(false)}>
            <div className="enc-modal" onClick={e => e.stopPropagation()}>
              <h3>Cancelar encomenda?</h3>
              <p>Esta acção não pode ser desfeita. Tens a certeza que queres cancelar a encomenda <strong>{ref}</strong>?</p>
              <div className="enc-modal-acoes">
                <button className="btn btn-outline" onClick={() => setConfirmarCancel(false)}>Não, manter</button>
                <button className="btn enc-cancel-btn" onClick={handleCancelar} disabled={cancelando}>
                  {cancelando ? 'A cancelar…' : 'Sim, cancelar'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Retry pagamento ZumboPay */}
        {isAdmin &&
          encomenda.estado === 'pendente' &&
          encomenda.pagamento_metodo &&
          encomenda.pagamento_estado !== 'pago' && (
          <div className="detalhe-card" style={{ border: '1.5px solid #f7b731', background: '#fffdf0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <CreditCard size={18} strokeWidth={1.5} />
              <h3 style={{ margin: 0 }}>Pagamento pendente</h3>
            </div>

            {retryStatus === 'aguardar' ? (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <Loader2 size={32} strokeWidth={1.5} style={{ animation: 'spin 1s linear infinite', marginBottom: 8 }} />
                <p style={{ fontWeight: 600 }}>Aguarda confirmação no telemóvel</p>
                <p style={{ fontSize: 13, color: 'var(--gray-400)', marginTop: 4 }}>
                  Confirma o pagamento de <strong>{encomenda.total?.toFixed(2)} MZN</strong> no {retryMetodo === 'mpesa' ? 'M-Pesa' : 'e-Mola'}.
                </p>
                <button style={{ marginTop: 12, fontSize: 12, color: 'var(--gray-400)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                  onClick={() => { if (unsubRef.current) { unsubRef.current(); unsubRef.current = null; } setRetryStatus('idle'); }}>
                  Cancelar
                </button>
              </div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 14 }}>
                  {METODOS_RETRY.map(m => (
                    <button key={m.id} type="button" onClick={() => setRetryMetodo(m.id)} style={{
                      padding: '10px 8px', borderRadius: 12, cursor: 'pointer', textAlign: 'center',
                      border: `2px solid ${retryMetodo === m.id ? 'var(--black)' : 'var(--gray-200)'}`,
                      background: retryMetodo === m.id ? '#f5f5f5' : 'white',
                      boxShadow: retryMetodo === m.id ? '0 0 0 2px var(--black)' : 'none',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <m.Logo />
                    </button>
                  ))}
                </div>
                {retryMetodo !== 'cartao' && retryMetodo !== 'paysuite' && (
                  <div className="form-group" style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 13, marginBottom: 6, display: 'block' }}>Número de telemóvel</label>
                    <input
                      value={retryTelefone}
                      onChange={e => setRetryTelefone(e.target.value)}
                      placeholder="Ex: 84 000 0000"
                      style={{ width: '100%' }}
                    />
                  </div>
                )}
                <button className="btn btn-primary btn-full" onClick={handleRetry} disabled={retryLoading}>
                  {retryLoading
                    ? 'A processar...'
                    : retryMetodo === 'cartao'
                      ? 'Pagar com Cartão →'
                      : retryMetodo === 'paysuite'
                        ? 'Pagar com PaySuite →'
                        : `Pagar ${encomenda.total?.toFixed(2)} MZN`}
                </button>
              </>
            )}
          </div>
        )}

        {/* Artigos */}
        <div className="detalhe-card">
          <h3>Artigos encomendados</h3>
          {encomenda.itens?.map(item => (
            <div key={item.key} className="item-row">
              <Image src={item.imagem || '/placeholder.svg'} alt={item.nome} width={56} height={72} className="item-img" />
              <div className="item-info">
                <div className="item-info-nome">{item.nome}</div>
                <div className="item-info-sub">
                  {item.tamanho ? `Tamanho: ${item.tamanho}` : ''}
                  {item.cor ? ` · Cor: ${item.cor}` : ''}
                  {' · '}Qtd: {item.quantidade}
                </div>
              </div>
              <div className="item-preco">{(item.preco * item.quantidade).toFixed(2)} MZN</div>
            </div>
          ))}
          <div className="total-row">
            <span style={{ fontSize: 15, color: 'var(--gray-600)' }}>Total</span>
            <span style={{ fontSize: 22, fontWeight: 700 }}>{encomenda.total?.toFixed(2)} MZN</span>
          </div>
        </div>

        {/* Entrega */}
        <div className="detalhe-card">
          <h3>Informações de entrega</h3>
          <div className="info-grid">
            <div className="info-item"><label>Morada</label><span>{encomenda.morada_entrega || '—'}</span></div>
            <div className="info-item"><label>Cidade</label><span>{encomenda.cidade_entrega || '—'}</span></div>
            <div className="info-item"><label>Telefone</label><span>{encomenda.telefone_contacto || '—'}</span></div>
            <div className="info-item"><label>Email</label><span>{encomenda.cliente_email || '—'}</span></div>
          </div>
          {encomenda.notas && (
            <div style={{ marginTop: 16 }}>
              <label style={{ fontSize: 12, color: 'var(--gray-400)', display: 'block', marginBottom: 4 }}>Notas</label>
              <span style={{ fontSize: 14 }}>{encomenda.notas}</span>
            </div>
          )}
        </div>

        {/* Timeline */}
        <div className="detalhe-card">
          <h3>Estado da encomenda</h3>

          {encomenda.estado === 'cancelada' ? (
            <ul className="timeline">
              <li>
                <div className="tl-dot done" style={{ background: 'var(--red)', borderColor: 'var(--red)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={14} strokeWidth={2} color="white" /></div>
                <div className="tl-body">
                  <strong>Encomenda cancelada</strong>
                  <span>{formatarData(encomenda.actualizado_em || encomenda.criado_em)}</span>
                </div>
              </li>
            </ul>
          ) : (
            <ul className="timeline">
              {TIMELINE_ESTADOS.map((e, i) => {
                const data = dataEstado(e.key);
                const concluido = i <= ordemActual;
                const actual = i === ordemActual;
                return (
                  <li key={e.key}>
                    <div className={`tl-dot${concluido ? ' done' : ''}`}>{concluido ? e.icon : ''}</div>
                    <div className="tl-body">
                      <strong style={{ color: concluido ? 'var(--black)' : 'var(--gray-400)' }}>{e.label}</strong>
                      <span>
                        {data
                          ? data
                          : actual
                            ? formatarData(encomenda.actualizado_em || encomenda.criado_em)
                            : concluido ? 'Concluído' : 'Pendente'}
                      </span>
                      {actual && <span className="tl-sub">{e.sub}</span>}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {encomenda.notas_admin && (
            <div className="nota-admin">
              <strong>Mensagem da loja</strong>
              {encomenda.notas_admin}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Link href="/encomendas" className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><ArrowLeft size={14} strokeWidth={1.5} /> As minhas encomendas</Link>
          <Link href="/" className="btn btn-primary">Continuar a comprar</Link>
        </div>
      </div>

      {/* Layout só visível na impressão — modelo Factura-Recibo */}
      {siteConfig && (() => {
        const IVA_TAXA = 0.16;
        const pago = encomenda.pagamento_estado === 'pago';
        const criadoEmDate = (encomenda.criado_em as { toDate?: () => Date } | undefined)?.toDate?.() ?? new Date();
        const anoDoc = criadoEmDate.getFullYear();
        const numeroDoc = `FR ${anoDoc}/${codCurto}`;
        const totalComIva = encomenda.total || 0;
        const baseTributavel = totalComIva / (1 + IVA_TAXA);
        const valorIva = totalComIva - baseTributavel;
        const metodoLabel = encomenda.pagamento_metodo === 'mpesa' ? 'M-Pesa'
          : encomenda.pagamento_metodo === 'emola' ? 'e-Mola'
          : encomenda.pagamento_metodo === 'paysuite' ? 'PaySuite'
          : encomenda.pagamento_metodo === 'cartao' ? 'Cartão' : '—';

        return (
          <div className="fatura-print">
            <div className="fp-header">
              <table className="fp-meta-topo">
                <thead>
                  <tr><th>N.º DO DOCUMENTO</th><th>DATA</th><th>ESTADO</th></tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{numeroDoc}</td>
                    <td>{formatarData(encomenda.criado_em)}</td>
                    <td>{pago ? 'PAGO' : 'Pendente de pagamento'}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="fp-partes">
              <div className="fp-parte">
                <span className="fp-parte-label">FORNECEDOR</span>
                <strong>{siteConfig.empresa_nome}</strong>
                {siteConfig.empresa_nif && <span>NUIT: {siteConfig.empresa_nif}</span>}
                {(siteConfig.empresa_cidade || siteConfig.empresa_morada) && (
                  <span>{[siteConfig.empresa_morada, siteConfig.empresa_cidade].filter(Boolean).join(', ')}</span>
                )}
                {(siteConfig.tel1 || siteConfig.tel2) && (
                  <span>Tel.: {[siteConfig.tel1, siteConfig.tel2].filter(Boolean).join(' / ')}</span>
                )}
              </div>
              <div className="fp-parte">
                <span className="fp-parte-label">CLIENTE</span>
                <strong>{encomenda.cliente_nome || encomenda.cliente_email}</strong>
                <span>NUIT: Consumidor final</span>
                <span>{encomenda.morada_entrega}{encomenda.cidade_entrega ? `, ${encomenda.cidade_entrega}` : ''}</span>
                {encomenda.telefone_contacto && <span>Tel.: {encomenda.telefone_contacto}</span>}
              </div>
            </div>

            <table className="fp-tabela">
              <thead>
                <tr>
                  <th className="fp-th-qty">QTD.</th>
                  <th>DESCRIÇÃO</th>
                  <th className="fp-th-num">P. UNIT.</th>
                  <th className="fp-th-num">IVA</th>
                  <th className="fp-th-num">TOTAL</th>
                </tr>
              </thead>
              <tbody>
                {encomenda.itens?.map((item, i) => (
                  <tr key={i}>
                    <td className="fp-td-center">{item.quantidade}</td>
                    <td>
                      {item.nome}
                      {(item.tamanho || item.cor) && (
                        <span className="fp-variante"> — {[item.tamanho && `Tam: ${item.tamanho}`, item.cor && `Cor: ${item.cor}`].filter(Boolean).join(' · ')}</span>
                      )}
                    </td>
                    <td className="fp-td-right">{(Number(item.preco) / (1 + IVA_TAXA)).toFixed(2)} MZN</td>
                    <td className="fp-td-right">{(IVA_TAXA * 100).toFixed(0)}%</td>
                    <td className="fp-td-right">{(Number(item.preco) * item.quantidade).toFixed(2)} MZN</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="fp-totais">
              <div><span>Base tributável</span><span>{baseTributavel.toFixed(2)} MZN</span></div>
              <div><span>IVA ({(IVA_TAXA * 100).toFixed(0)}%)</span><span>{valorIva.toFixed(2)} MZN</span></div>
              <div className="fp-total-final"><span>TOTAL</span><span>{totalComIva.toFixed(2)} MZN</span></div>
            </div>

            <div className="fp-rodape">
              <div>
                <strong>Pagamento {pago ? 'recebido integralmente' : 'pendente'}:</strong> {totalComIva.toFixed(2)} MZN — {metodoLabel}
                {encomenda.pagamento_ref && <> — Referência: {encomenda.pagamento_ref}</>}
              </div>
              {siteConfig.fatura_condicoes && (
                <div><strong>CONDIÇÕES DE ENTREGA:</strong> {siteConfig.fatura_condicoes}</div>
              )}
              {(encomenda.notas || siteConfig.fatura_obs) && (
                <div className="fp-obs">
                  <strong>OBSERVAÇÕES:</strong>
                  {encomenda.notas && <div>{encomenda.notas}</div>}
                  {siteConfig.fatura_obs && <div>{siteConfig.fatura_obs}</div>}
                </div>
              )}
              <p className="fp-nota-legal">
                A utilização de um documento único de factura/recibo deve respeitar o enquadramento fiscal e as regras aplicáveis à emissão e numeração dos documentos.
              </p>
            </div>
          </div>
        );
      })()}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
