'use client';
import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api-fetch';

interface Linha { chave: string; visitas: number; paginas: number }
type Periodo = 'hoje' | 7 | 30;

interface Dados {
  periodo: Periodo;
  granularidade: 'hora' | 'dia';
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

// Moçambique: UTC+2 todo o ano
const DESVIO_LOCAL_H = 2;

// Preenche com zeros os intervalos sem visitas, para o gráfico não saltar.
// "Hoje" vem por hora (da meia-noite local até agora); o resto por dia (UTC).
function serieDoPeriodo(dados: Dados) {
  const mapa = new Map(dados.porDia.map(l => [l.chave, l.visitas]));
  const agora = new Date();

  if (dados.periodo === 'hoje') {
    const horaAtual = (agora.getUTCHours() + DESVIO_LOCAL_H) % 24;
    return Array.from({ length: horaAtual + 1 }, (_, h) => {
      const utc = new Date(agora);
      utc.setUTCHours(agora.getUTCHours() - (horaAtual - h), 0, 0, 0);
      const visitas = [...mapa.entries()]
        .filter(([k]) => new Date(k).getTime() === utc.getTime())
        .reduce((s, [, v]) => s + v, 0);
      return { chave: `${String(h).padStart(2, '0')}:00`, visitas };
    });
  }

  const dias = dados.periodo;
  return Array.from({ length: dias }, (_, i) => {
    const d = new Date(agora);
    d.setUTCDate(agora.getUTCDate() - (dias - 1 - i));
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
  const [periodo, setPeriodo] = useState<Periodo>(7);
  const [dados, setDados] = useState<Dados | null>(null);
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let activo = true;
    setLoading(true);
    setErro('');
    apiFetch(`/api/admin/visitas?periodo=${periodo}`)
      .then(async res => {
        const corpo = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(corpo.error || 'Não foi possível carregar as visitas.');
        return corpo as Dados;
      })
      .then(d => { if (activo) setDados(d); })
      .catch(e => { if (activo) { setDados(null); setErro(e.message); } })
      .finally(() => { if (activo) setLoading(false); });
    return () => { activo = false; };
  }, [periodo]);

  const serie = useMemo(() => (dados ? serieDoPeriodo(dados) : []), [dados]);
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
        {([['hoje', 'Hoje'], [7, 'Últimos 7 dias'], [30, 'Últimos 30 dias']] as [Periodo, string][]).map(([p, rotulo]) => (
          <button
            key={p}
            className={`btn btn-sm ${periodo === p ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setPeriodo(p)}
          >
            {rotulo}
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
              <div className="stat-card-sub">{dados.periodo === 'hoje' ? 'Hoje' : `Últimos ${dados.periodo} dias`}</div>
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
            <h3>{dados.granularidade === 'hora' ? 'Visitas por hora' : 'Visitas por dia'}</h3>
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
            <p style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 8 }}>
              {dados.granularidade === 'hora' ? 'Hora de Moçambique.' : 'Dias em UTC.'}
            </p>
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
