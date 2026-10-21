'use client';
import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api-fetch';

interface Linha { chave: string; visitas: number; paginas: number }
interface Dados {
  dias: number;
  visitas: number;
  paginas: number;
  porDia: Linha[];
  topPaginas: Linha[];
  origens: Linha[];
  dispositivos: Linha[];
  paises: Linha[];
  encomendas: { criadas: number; pagas: number };
}

const DISPOSITIVOS: Record<string, string> = {
  mobile: 'Telemóvel', desktop: 'Computador', tablet: 'Tablet',
};

const nf = new Intl.NumberFormat('pt-PT');

// Preenche com zeros os dias sem visitas, para o gráfico não saltar datas
function diasDoPeriodo(dias: number, porDia: Linha[]) {
  const mapa = new Map(porDia.map(l => [l.chave, l.visitas]));
  const hoje = new Date();
  return Array.from({ length: dias }, (_, i) => {
    const d = new Date(hoje);
    d.setUTCDate(hoje.getUTCDate() - (dias - 1 - i));
    const chave = d.toISOString().slice(0, 10);
    return { chave, visitas: mapa.get(chave) ?? 0 };
  });
}

function ListaBarras({ titulo, linhas, rotulo, vazio }: {
  titulo: string;
  linhas: Linha[];
  rotulo: (chave: string) => string;
  vazio: string;
}) {
  const max = Math.max(...linhas.map(l => l.visitas), 1);
  return (
    <div className="chart-card">
      <h3>{titulo}</h3>
      {linhas.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--gray-400)', paddingTop: 8 }}>{vazio}</p>
      ) : linhas.map(l => (
        <div key={l.chave} style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 4, fontSize: 13 }}>
            <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rotulo(l.chave)}</span>
            <span style={{ color: 'var(--gray-600)', fontVariantNumeric: 'tabular-nums' }}>{nf.format(l.visitas)}</span>
          </div>
          <div style={{ height: 6, borderRadius: 3, background: 'var(--gray-200)', overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 3, background: 'var(--black)', width: `${Math.round((l.visitas / max) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AdminVisitas() {
  const [dias, setDias] = useState(7);
  const [dados, setDados] = useState<Dados | null>(null);
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let activo = true;
    setLoading(true);
    setErro('');
    apiFetch(`/api/admin/visitas?dias=${dias}`)
      .then(async res => {
        const corpo = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(corpo.error || 'Não foi possível carregar as visitas.');
        return corpo as Dados;
      })
      .then(d => { if (activo) setDados(d); })
      .catch(e => { if (activo) { setDados(null); setErro(e.message); } })
      .finally(() => { if (activo) setLoading(false); });
    return () => { activo = false; };
  }, [dias]);

  const serie = useMemo(() => (dados ? diasDoPeriodo(dados.dias, dados.porDia) : []), [dados]);
  const maxDia = Math.max(...serie.map(s => s.visitas), 1);
  const largura = 100 / Math.max(serie.length, 1);

  const conversao = dados && dados.visitas > 0
    ? (dados.encomendas.pagas / dados.visitas) * 100
    : 0;
  const abandono = dados && dados.encomendas.criadas > 0
    ? ((dados.encomendas.criadas - dados.encomendas.pagas) / dados.encomendas.criadas) * 100
    : 0;

  return (
    <div className="admin-content">
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {[7, 30].map(d => (
          <button
            key={d}
            className={`btn btn-sm ${dias === d ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setDias(d)}
          >
            Últimos {d} dias
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading"><div className="spinner" /> A carregar...</div>
      ) : erro || !dados ? (
        <div style={{ background: 'white', borderRadius: 12, border: '1px solid var(--gray-200)', padding: 24, maxWidth: 560 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Visitas indisponíveis</h2>
          <p style={{ fontSize: 14, color: 'var(--gray-600)' }}>{erro}</p>
        </div>
      ) : (
        <>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-card-label">Visitas</div>
              <div className="stat-card-value">{nf.format(dados.visitas)}</div>
              <div className="stat-card-sub">Últimos {dados.dias} dias</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-label">Páginas vistas</div>
              <div className="stat-card-value">{nf.format(dados.paginas)}</div>
              <div className="stat-card-sub">
                {dados.visitas > 0 ? `${(dados.paginas / dados.visitas).toFixed(1)} por visita` : '—'}
              </div>
            </div>
            <div className="stat-card accent">
              <div className="stat-card-label">Encomendas pagas</div>
              <div className="stat-card-value">{nf.format(dados.encomendas.pagas)}</div>
              <div className="stat-card-sub">de {nf.format(dados.encomendas.criadas)} criadas</div>
            </div>
            <div className="stat-card green">
              <div className="stat-card-label">Taxa de conversão</div>
              <div className="stat-card-value">{conversao.toFixed(1)}%</div>
              <div className="stat-card-sub">
                {dados.encomendas.criadas > 0 ? `${abandono.toFixed(0)}% das encomendas ficaram por pagar` : 'Pagas ÷ visitas'}
              </div>
            </div>
          </div>

          <div className="chart-card" style={{ marginBottom: 24 }}>
            <h3>Visitas por dia</h3>
            <svg viewBox="0 0 100 40" preserveAspectRatio="none" style={{ width: '100%', height: 140 }}>
              {serie.map((s, i) => {
                const h = (s.visitas / maxDia) * 36;
                return (
                  <rect key={s.chave} x={i * largura + largura * 0.15} y={38 - h}
                    width={largura * 0.7} height={Math.max(h, 0.4)} rx={0.4}
                    fill={i === serie.length - 1 ? 'var(--black)' : 'var(--gray-200)'}>
                    <title>{`${s.chave}: ${s.visitas}`}</title>
                  </rect>
                );
              })}
            </svg>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--gray-400)', marginTop: 4 }}>
              <span>{serie[0]?.chave}</span>
              <span>{serie[serie.length - 1]?.chave}</span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 8 }}>Dias em UTC.</p>
          </div>

          <div className="analytics-grid">
            <ListaBarras titulo="Páginas mais vistas" linhas={dados.topPaginas}
              rotulo={c => c || '/'} vazio="Sem visitas neste período." />
            <ListaBarras titulo="Origem das visitas" linhas={dados.origens}
              rotulo={c => c || 'Direto'} vazio="Sem visitas neste período." />
          </div>
          <div className="analytics-grid" style={{ marginTop: 24 }}>
            <ListaBarras titulo="Dispositivo" linhas={dados.dispositivos}
              rotulo={c => DISPOSITIVOS[c] || c || 'Desconhecido'} vazio="Sem visitas neste período." />
            <ListaBarras titulo="País" linhas={dados.paises}
              rotulo={c => c || 'Desconhecido'} vazio="Sem visitas neste período." />
          </div>
        </>
      )}
    </div>
  );
}
