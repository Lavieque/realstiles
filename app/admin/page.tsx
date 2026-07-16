'use client';
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { getProdutos } from '@/lib/produtos';
import { getTodasEncomendas, badgeEstadoClass, badgeEstadoLabel, formatarData } from '@/lib/encomendas';
import { getDocs, collection } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Encomenda, EstadoEncomenda } from '@/lib/encomendas';
import type { Produto } from '@/lib/produtos';

export default function AdminDashboard() {
  const [stats, setStats] = useState({ pendentes: 0, total: 0, produtos: 0, clientes: 0 });
  const [recentes, setRecentes] = useState<Encomenda[]>([]);
  const [todasEncomendas, setTodasEncomendas] = useState<Encomenda[]>([]);
  const [produtosBaixoStock, setProdutosBaixoStock] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [encomendas, { produtos }, clientesSnap] = await Promise.all([
        getTodasEncomendas(),
        getProdutos({ max: 500 }),
        getDocs(collection(db, 'clientes')),
      ]);
      setStats({
        pendentes: encomendas.filter(e => e.estado === 'pendente').length,
        total: encomendas.length,
        produtos: produtos.length,
        clientes: clientesSnap.size,
      });
      setRecentes(encomendas.slice(0, 8));
      setTodasEncomendas(encomendas);
      setProdutosBaixoStock(produtos.filter(p => typeof p.stock === 'number' && p.stock <= 3).slice(0, 10));
      setLoading(false);
    })();
  }, []);

  const semanas = useMemo(() => {
    const agora = new Date();
    return Array.from({ length: 8 }, (_, i) => {
      const fim = new Date(agora);
      fim.setDate(agora.getDate() - i * 7);
      const inicio = new Date(fim);
      inicio.setDate(fim.getDate() - 7);
      const enc = todasEncomendas.filter(e => {
        const t = e.criado_em as { toDate?: () => Date } | string | null;
        if (!t) return false;
        const d = (t as { toDate?: () => Date }).toDate ? (t as { toDate: () => Date }).toDate() : new Date(t as string);
        return d >= inicio && d < fim;
      });
      return { label: i === 0 ? 'Esta semana' : `${i}s atrás`, valor: enc.reduce((s, e) => s + (e.total || 0), 0), count: enc.length };
    }).reverse();
  }, [todasEncomendas]);

  const topProdutos = useMemo(() => {
    const map = new Map<string, { nome: string; total: number; qty: number }>();
    todasEncomendas.forEach(enc => {
      enc.itens?.forEach(item => {
        const entry = map.get(item.produto_id) || { nome: item.nome, total: 0, qty: 0 };
        entry.total += item.preco * item.quantidade;
        entry.qty += item.quantidade;
        map.set(item.produto_id, entry);
      });
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total).slice(0, 5);
  }, [todasEncomendas]);

  const maxVendas = Math.max(...semanas.map(s => s.valor), 1);

  return (
    <>
      <div className="admin-topbar">
        <h1>Dashboard</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href="/admin/produtos" className="btn btn-primary btn-sm">+ Novo produto</Link>
          <Link href="/" className="btn btn-outline btn-sm" target="_blank">Ver loja</Link>
        </div>
      </div>

      <div className="admin-content">
        {loading ? (
          <div className="loading"><div className="spinner" /> A carregar...</div>
        ) : (
          <>
            <div className="stats-grid">
              <div className="stat-card red">
                <div className="stat-card-label">Encomendas pendentes</div>
                <div className="stat-card-value">{stats.pendentes}</div>
                <div className="stat-card-sub">Aguardam confirmação</div>
              </div>
              <div className="stat-card">
                <div className="stat-card-label">Total encomendas</div>
                <div className="stat-card-value">{stats.total}</div>
                <div className="stat-card-sub">Todas as encomendas</div>
              </div>
              <div className="stat-card accent">
                <div className="stat-card-label">Produtos activos</div>
                <div className="stat-card-value">{stats.produtos}</div>
                <div className="stat-card-sub">No catálogo</div>
              </div>
              <div className="stat-card green">
                <div className="stat-card-label">Clientes registados</div>
                <div className="stat-card-value">{stats.clientes}</div>
              </div>
            </div>

            {/* Alertas stock baixo */}
            {produtosBaixoStock.length > 0 && (
              <div className="stock-alert">
                <div className="stock-alert-header" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><AlertTriangle size={16} strokeWidth={1.5} /> Stock baixo — {produtosBaixoStock.length} produto{produtosBaixoStock.length !== 1 ? 's' : ''}</div>
                {produtosBaixoStock.map(p => (
                  <div key={p.id} className="stock-item">
                    <span>{p.nome}</span>
                    <Link href={`/admin/produtos?id=${p.id}`} style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
                      <span className="stock-badge">{p.stock === 0 ? 'Sem stock' : `${p.stock} un.`}</span>
                    </Link>
                  </div>
                ))}
              </div>
            )}

            {/* Analytics */}
            <div className="analytics-grid">
              {/* Vendas por semana */}
              <div className="chart-card">
                <h3>Vendas — últimas 8 semanas</h3>
                <svg viewBox={`0 0 ${semanas.length * 52} 120`} style={{ width: '100%', height: 120, overflow: 'visible' }}>
                  {semanas.map((s, i) => {
                    const barH = maxVendas > 0 ? Math.round((s.valor / maxVendas) * 90) : 0;
                    const x = i * 52 + 10;
                    return (
                      <g key={i}>
                        <rect x={x} y={100 - barH} width={32} height={Math.max(barH, 2)} rx={4}
                          fill={i === semanas.length - 1 ? 'var(--black)' : 'var(--gray-200)'} />
                        {s.count > 0 && (
                          <text x={x + 16} y={100 - barH - 4} textAnchor="middle" fontSize={10} fill="var(--gray-600)">{s.count}</text>
                        )}
                        <text x={x + 16} y={114} textAnchor="middle" fontSize={9} fill="var(--gray-400)">{i === semanas.length - 1 ? 'atual' : `S${i + 1}`}</text>
                      </g>
                    );
                  })}
                </svg>
                <p style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 8 }}>
                  Total: <strong>{todasEncomendas.reduce((s, e) => s + (e.total || 0), 0).toFixed(0)} MZN</strong>
                </p>
              </div>

              {/* Top produtos */}
              <div className="chart-card">
                <h3>Top produtos</h3>
                {topProdutos.length === 0 ? (
                  <p style={{ fontSize: 13, color: 'var(--gray-400)', paddingTop: 8 }}>Sem dados de vendas ainda.</p>
                ) : topProdutos.map((p, i) => {
                  const pct = Math.round((p.total / topProdutos[0].total) * 100);
                  return (
                    <div key={i} style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13 }}>
                        <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '65%' }}>{p.nome}</span>
                        <span style={{ color: 'var(--gray-600)', fontVariantNumeric: 'tabular-nums' }}>{p.total.toFixed(0)} MZN</span>
                      </div>
                      <div style={{ height: 6, borderRadius: 3, background: 'var(--gray-200)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', borderRadius: 3, background: 'var(--black)', width: `${pct}%`, transition: 'width 0.4s' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="table-card">
              <div className="table-card-header">
                <h2>Encomendas recentes</h2>
                <Link href="/admin/encomendas" className="btn btn-outline btn-sm">Ver todas</Link>
              </div>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Ref.</th><th>Cliente</th><th>Total</th><th>Estado</th><th>Data</th><th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentes.length === 0 ? (
                      <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--gray-400)', padding: 32 }}>Sem encomendas ainda</td></tr>
                    ) : recentes.map(e => (
                      <tr key={e.id}>
                        <td><code style={{ fontSize: 12 }}>#{e.id.substring(0, 8).toUpperCase()}</code></td>
                        <td>{e.cliente_email || '—'}</td>
                        <td><strong>{e.total?.toFixed(2)} MZN</strong></td>
                        <td><span className={`badge-estado ${badgeEstadoClass(e.estado as EstadoEncomenda)}`}>{badgeEstadoLabel(e.estado as EstadoEncomenda)}</span></td>
                        <td>{formatarData(e.criado_em)}</td>
                        <td><Link href={`/admin/encomendas?id=${e.id}`} className="btn btn-outline btn-sm">Ver</Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
