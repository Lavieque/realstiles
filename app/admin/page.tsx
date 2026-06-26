'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getProdutos } from '@/lib/produtos';
import { getTodasEncomendas, badgeEstadoClass, badgeEstadoLabel, formatarData } from '@/lib/encomendas';
import { getDocs, collection } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Encomenda, EstadoEncomenda } from '@/lib/encomendas';

export default function AdminDashboard() {
  const [stats, setStats] = useState({ pendentes: 0, total: 0, produtos: 0, clientes: 0 });
  const [recentes, setRecentes] = useState<Encomenda[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [encomendas, produtos, clientesSnap] = await Promise.all([
        getTodasEncomendas(),
        getProdutos({ max: 200 }),
        getDocs(collection(db, 'clientes')),
      ]);
      setStats({
        pendentes: encomendas.filter(e => e.estado === 'pendente').length,
        total: encomendas.length,
        produtos: produtos.length,
        clientes: clientesSnap.size,
      });
      setRecentes(encomendas.slice(0, 8));
      setLoading(false);
    })();
  }, []);

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
                <div className="stat-card-label">Pendentes</div>
                <div className="stat-card-value">{stats.pendentes}</div>
                <div className="stat-card-sub">encomendas por confirmar</div>
              </div>
              <div className="stat-card">
                <div className="stat-card-label">Total de encomendas</div>
                <div className="stat-card-value">{stats.total}</div>
              </div>
              <div className="stat-card accent">
                <div className="stat-card-label">Produtos</div>
                <div className="stat-card-value">{stats.produtos}</div>
              </div>
              <div className="stat-card green">
                <div className="stat-card-label">Clientes</div>
                <div className="stat-card-value">{stats.clientes}</div>
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
                      <th>Referência</th><th>Cliente</th><th>Total</th><th>Estado</th><th>Data</th><th></th>
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
