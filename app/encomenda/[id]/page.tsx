'use client';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { onAuthChange } from '@/lib/auth';
import { getEncomenda, cancelarEncomenda, badgeEstadoClass, badgeEstadoLabel, formatarData } from '@/lib/encomendas';
import { useCarrinho } from '@/store/carrinho';
import { mostrarToast } from '@/components/Toast';
import type { Encomenda, EstadoEncomenda } from '@/lib/encomendas';
import type { User } from 'firebase/auth';

const WHATSAPP_NUM = '258878753754';

const TIMELINE_ESTADOS = [
  { key: 'pendente',   icon: '⏳', label: 'Encomenda recebida',  sub: 'A aguardar confirmação da loja' },
  { key: 'confirmada', icon: '✅', label: 'Encomenda confirmada', sub: 'A loja confirmou a tua encomenda' },
  { key: 'enviada',    icon: '🚚', label: 'Encomenda enviada',    sub: 'A encomenda está a caminho' },
  { key: 'entregue',   icon: '📦', label: 'Encomenda entregue',   sub: 'Entregue com sucesso' },
];

export default function EncomendaPage({ params }: { params: { id: string } }) {
  const searchParams = useSearchParams();
  const confirmada = searchParams.get('confirmada') === '1';
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [encomenda, setEncomenda] = useState<Encomenda | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelando, setCancelando] = useState(false);
  const [confirmarCancel, setConfirmarCancel] = useState(false);
  const { adicionarItem, abrirDrawer } = useCarrinho();

  useEffect(() => {
    const unsub = onAuthChange(async (u) => {
      setUser(u);
      if (!u) { setLoading(false); return; }
      const enc = await getEncomenda(params.id);
      setEncomenda(enc);
      setLoading(false);
    });
    return unsub;
  }, [params.id]);

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
          <div className="icon">🔒</div>
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
          <div className="icon">😕</div>
          <h3>Encomenda não encontrada</h3>
          <Link href="/encomendas" className="btn btn-primary" style={{ marginTop: 20 }}>As minhas encomendas</Link>
        </div>
      </div></div>
    );
  }

  const ordemActual = TIMELINE_ESTADOS.findIndex(e => e.key === encomenda.estado);
  const codCurto = encomenda.id.substring(0, 8).toUpperCase();

  // Data de cada estado a partir do histórico (se existir)
  const dataEstado = (key: string): string => {
    const hist = encomenda.historico_estados?.find(h => h.estado === key);
    if (hist) return formatarData(hist.data);
    if (key === encomenda.estado) return formatarData(encomenda.actualizado_em || encomenda.criado_em);
    return '';
  };

  const whatsappUrl = `https://wa.me/${WHATSAPP_NUM}?text=${encodeURIComponent(
    `Olá, tenho uma dúvida sobre a minha encomenda #${codCurto}.`
  )}`;

  return (
    <div className="page-wrapper">
      <div className="container enc-detalhe-container">

        {confirmada && (
          <div className="enc-confirmada-banner">
            <span>✅</span>
            <div>
              <p style={{ fontWeight: 700 }}>Encomenda confirmada!</p>
              <p style={{ fontSize: 14, opacity: 0.9 }}>Receberás um email com os detalhes. Entraremos em contacto em breve.</p>
            </div>
          </div>
        )}

        <div className="page-header" style={{ paddingBottom: 24 }}>
          <Link href="/encomendas" className="enc-back-link">← Voltar às encomendas</Link>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h1 style={{ fontSize: '1.6rem' }}>
                Encomenda <span style={{ fontFamily: 'monospace', fontSize: '1.2rem' }}>#{codCurto}</span>
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
          <button className="btn btn-outline btn-sm" onClick={handleRepetir} title="Adicionar os mesmos artigos ao carrinho">
            🔁 Repetir encomenda
          </button>
          <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm">
            💬 Contactar via WhatsApp
          </a>
          <button className="btn btn-outline btn-sm enc-print-btn" onClick={handleImprimir}>
            🖨️ Imprimir / PDF
          </button>
          {encomenda.estado === 'pendente' && (
            <button
              className="btn btn-sm enc-cancel-btn"
              onClick={() => setConfirmarCancel(true)}
              disabled={cancelando}
            >
              ✕ Cancelar encomenda
            </button>
          )}
        </div>

        {/* Modal de confirmação de cancelamento */}
        {confirmarCancel && (
          <div className="enc-modal-overlay" onClick={() => setConfirmarCancel(false)}>
            <div className="enc-modal" onClick={e => e.stopPropagation()}>
              <h3>Cancelar encomenda?</h3>
              <p>Esta acção não pode ser desfeita. Tens a certeza que queres cancelar a encomenda <strong>#{codCurto}</strong>?</p>
              <div className="enc-modal-acoes">
                <button className="btn btn-outline" onClick={() => setConfirmarCancel(false)}>Não, manter</button>
                <button className="btn enc-cancel-btn" onClick={handleCancelar} disabled={cancelando}>
                  {cancelando ? 'A cancelar…' : 'Sim, cancelar'}
                </button>
              </div>
            </div>
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
                <div className="tl-dot done" style={{ background: 'var(--red)', borderColor: 'var(--red)' }}>❌</div>
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
          <Link href="/encomendas" className="btn btn-outline">← As minhas encomendas</Link>
          <Link href="/" className="btn btn-primary">Continuar a comprar</Link>
        </div>
      </div>
    </div>
  );
}
