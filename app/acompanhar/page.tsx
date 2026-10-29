'use client';
import { useState } from 'react';
import Link from 'next/link';
import Image from '@/components/CloudImage';
import { Clock, CheckCircle2, Truck, Package, X, Search, MessageCircle } from 'lucide-react';

interface Resultado {
  referencia: string;
  estado: string;
  pagamento_estado: string | null;
  criado_em: number | null;
  actualizado_em: number | null;
  historico: { estado: string; data: number | null }[];
  itens: { nome: string; imagem: string; quantidade: number }[];
}

const ETAPAS = [
  { key: 'pendente', icon: <Clock size={16} strokeWidth={1.5} />, label: 'Encomenda recebida', sub: 'A aguardar confirmação do pagamento e da encomenda' },
  { key: 'confirmada', icon: <CheckCircle2 size={16} strokeWidth={1.5} />, label: 'Encomenda confirmada', sub: 'Estamos a tratar da aquisição do teu artigo' },
  { key: 'enviada', icon: <Truck size={16} strokeWidth={1.5} />, label: 'Encomenda enviada', sub: 'A caminho do destino escolhido' },
  { key: 'entregue', icon: <Package size={16} strokeWidth={1.5} />, label: 'Encomenda entregue', sub: 'Entregue com sucesso' },
];

const data = (ms: number | null | undefined) =>
  ms ? new Date(ms).toLocaleDateString('pt-MZ', { day: '2-digit', month: 'short', year: 'numeric' }) : '';

export default function AcompanharPage() {
  const [referencia, setReferencia] = useState('');
  const [telefone, setTelefone] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [res, setRes] = useState<Resultado | null>(null);

  const consultar = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErro('');
    setRes(null);
    try {
      const r = await fetch('/api/encomendas/acompanhar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referencia, telefone }),
      });
      const corpo = await r.json();
      if (!r.ok) throw new Error(corpo.error || 'Não foi possível consultar a encomenda.');
      setRes(corpo);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível consultar a encomenda.');
    } finally {
      setLoading(false);
    }
  };

  const actual = res ? ETAPAS.findIndex(e => e.key === res.estado) : -1;
  const dataEtapa = (key: string) => {
    const h = res?.historico.find(x => x.estado === key);
    if (h?.data) return data(h.data);
    return res?.estado === key ? data(res.actualizado_em ?? res.criado_em) : '';
  };

  return (
    <div className="page-wrapper">
      <div className="container acompanhar">
        <header className="page-header">
          <span className="eyebrow" style={{ marginBottom: 14 }}>Contigo, em cada etapa</span>
          <h1 className="display-titulo">A tua encomenda, <em>mais perto.</em></h1>
          <p>Consulta o progresso sem perder o fio à tua compra.</p>
        </header>

        <form onSubmit={consultar} className="acompanhar-form">
          <div className="form-group">
            <label htmlFor="ref">Referência da encomenda *</label>
            <input id="ref" required value={referencia} onChange={e => setReferencia(e.target.value)} placeholder="Ex: ENCA3F942" autoCapitalize="characters" autoComplete="off" />
          </div>
          <div className="form-group">
            <label htmlFor="tel">Telemóvel usado na compra *</label>
            <input id="tel" required type="tel" value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="Ex: 84 000 0000" />
          </div>
          <button className="btn-escuro" type="submit" disabled={loading}>
            <Search size={16} strokeWidth={1.75} /> {loading ? 'A consultar...' : 'Acompanhar'}
          </button>
          <p className="checkout-nota">Encontras a referência no email de confirmação e em <Link href="/encomendas">As minhas encomendas</Link>. Pedimos o telemóvel para proteger os teus dados.</p>
          {erro && <p className="acompanhar-erro" role="alert">{erro}</p>}
        </form>

        {res && (
          <section className="detalhe-card acompanhar-res" aria-live="polite">
            <div className="acompanhar-res-topo">
              <div>
                <span className="eyebrow">Encomenda</span>
                <h2 className="display-titulo" style={{ fontSize: '1.7rem', marginTop: 8 }}>{res.referencia}</h2>
                {res.criado_em && <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>Feita a {data(res.criado_em)}</p>}
              </div>
            </div>

            <ul className="timeline">
              {res.estado === 'cancelada' ? (
                <li>
                  <div className="tl-dot done" style={{ background: 'var(--red)', borderColor: 'var(--red)', color: 'white' }}><X size={14} strokeWidth={2} /></div>
                  <div className="tl-body"><strong>Encomenda cancelada</strong><span>{data(res.actualizado_em ?? res.criado_em)}</span></div>
                </li>
              ) : ETAPAS.map((e, i) => {
                const feito = i <= actual;
                return (
                  <li key={e.key}>
                    <div className={`tl-dot${feito ? ' done' : ''}`} style={feito ? { color: 'white' } : undefined}>{feito ? e.icon : ''}</div>
                    <div className="tl-body">
                      <strong style={{ color: feito ? 'var(--black)' : 'var(--gray-400)' }}>{e.label}</strong>
                      <span>{dataEtapa(e.key) || (feito ? 'Concluído' : 'Pendente')}</span>
                      {i === actual && <span className="tl-sub">{e.sub}</span>}
                    </div>
                  </li>
                );
              })}
            </ul>

            <ul className="acompanhar-itens">
              {res.itens.map((i, k) => (
                <li key={k}>
                  <Image src={i.imagem || '/placeholder.svg'} alt="" width={44} height={56} style={{ objectFit: 'cover', borderRadius: 3 }} />
                  <span>{i.nome}</span><small>{i.quantidade} un.</small>
                </li>
              ))}
            </ul>
          </section>
        )}

        <aside className="acompanhar-ajuda">
          <div>
            <h2>Precisas de ajuda com o pedido?</h2>
            <p>A nossa equipa está por perto.</p>
          </div>
          <a href="https://wa.me/258878753754" target="_blank" rel="noopener noreferrer" className="btn-claro"><MessageCircle size={16} strokeWidth={1.5} /> Pedir apoio</a>
        </aside>
      </div>
    </div>
  );
}
