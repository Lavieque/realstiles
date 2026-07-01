'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { getTodasEncomendas, getEncomenda, actualizarEstado, badgeEstadoClass, badgeEstadoLabel, formatarData } from '@/lib/encomendas';
import { mostrarToast } from '@/components/Toast';
import type { Encomenda, EstadoEncomenda } from '@/lib/encomendas';

const ESTADOS: EstadoEncomenda[] = ['pendente', 'confirmada', 'enviada', 'entregue', 'cancelada'];

export default function AdminEncomendasPage() {
  const searchParams = useSearchParams();
  const idParam = searchParams.get('id');

  const [encomendas, setEncomendas] = useState<Encomenda[]>([]);
  const [seleccionada, setSeleccionada] = useState<Encomenda | null>(null);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('');
  const [notas, setNotas] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    getTodasEncomendas().then(enc => { setEncomendas(enc); setLoading(false); });
  }, []);

  useEffect(() => {
    if (idParam && encomendas.length) {
      const enc = encomendas.find(e => e.id === idParam) || null;
      setSeleccionada(enc);
      if (enc) setNotas(enc.notas_admin || '');
    }
  }, [idParam, encomendas]);

  const handleEstado = async (id: string, estado: EstadoEncomenda) => {
    setSalvando(true);
    try {
      await actualizarEstado(id, estado, notas);
      setEncomendas(enc => enc.map(e => e.id === id ? { ...e, estado } : e));
      setSeleccionada(s => s ? { ...s, estado } : s);
      mostrarToast('Estado actualizado', 'success');
    } catch {
      mostrarToast('Erro ao actualizar', 'error');
    } finally {
      setSalvando(false);
    }
  };

  const handleNotas = async () => {
    if (!seleccionada) return;
    setSalvando(true);
    try {
      await actualizarEstado(seleccionada.id, seleccionada.estado as EstadoEncomenda, notas);
      mostrarToast('Notas guardadas', 'success');
    } finally {
      setSalvando(false);
    }
  };

  const filtradas = encomendas.filter(e =>
    !filtro || e.id.includes(filtro) || e.cliente_email?.toLowerCase().includes(filtro.toLowerCase())
  );

  const exportarCSV = () => {
    const linhas = [
      ['ID', 'Email', 'Estado', 'Total (MZN)', 'Morada', 'Cidade', 'Telefone', 'Data'],
      ...filtradas.map(e => [
        e.id,
        e.cliente_email || '',
        e.estado,
        (e.total || 0).toFixed(2),
        e.morada_entrega || '',
        e.cidade_entrega || '',
        e.telefone_contacto || '',
        formatarData(e.criado_em),
      ]),
    ];
    const csv = linhas.map(l => l.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `encomendas_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      {/* Lista */}
      <div style={{ width: 420, borderRight: '1px solid var(--gray-200)', display: 'flex', flexDirection: 'column', background: 'white' }}>
        <div className="admin-topbar" style={{ position: 'sticky', top: 0 }}>
          <h1>Encomendas</h1>
          <button className="btn btn-outline btn-sm" onClick={exportarCSV} title="Exportar CSV">↓ CSV</button>
        </div>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--gray-200)' }}>
          <input
            placeholder="Pesquisar por ID ou email..."
            value={filtro}
            onChange={e => setFiltro(e.target.value)}
            style={{ width: '100%', padding: '8px 14px', borderRadius: 8, border: '1.5px solid var(--gray-200)', fontSize: 14, fontFamily: 'Inter, sans-serif', outline: 'none' }}
          />
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? <div className="loading"><div className="spinner" /></div> :
            filtradas.map(enc => (
              <div key={enc.id}
                onClick={() => { setSeleccionada(enc); setNotas(enc.notas_admin || ''); }}
                style={{ padding: '16px 20px', borderBottom: '1px solid var(--gray-100)', cursor: 'pointer', background: seleccionada?.id === enc.id ? 'var(--gray-100)' : 'white', transition: 'background 0.15s' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <code style={{ fontSize: 12, fontWeight: 700 }}>#{enc.id.substring(0, 8).toUpperCase()}</code>
                  <span className={`badge-estado ${badgeEstadoClass(enc.estado as EstadoEncomenda)}`} style={{ fontSize: 11 }}>{badgeEstadoLabel(enc.estado as EstadoEncomenda)}</span>
                </div>
                <p style={{ fontSize: 13, color: 'var(--gray-600)', marginBottom: 2 }}>{enc.cliente_email}</p>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>{formatarData(enc.criado_em)}</span>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{enc.total?.toFixed(2)} MZN</span>
                </div>
              </div>
            ))
          }
        </div>
      </div>

      {/* Detalhe */}
      <div style={{ flex: 1, overflowY: 'auto', background: '#f8f8f6' }}>
        {!seleccionada ? (
          <div className="empty-state" style={{ paddingTop: 120 }}>
            <div className="icon">📦</div>
            <h3>Selecciona uma encomenda</h3>
          </div>
        ) : (
          <div style={{ padding: 32, maxWidth: 720 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700 }}>#{seleccionada.id.substring(0, 8).toUpperCase()}</h2>
              <span className={`badge-estado ${badgeEstadoClass(seleccionada.estado as EstadoEncomenda)}`} style={{ fontSize: 13 }}>{badgeEstadoLabel(seleccionada.estado as EstadoEncomenda)}</span>
            </div>

            {/* Alterar estado */}
            <div style={{ background: 'white', borderRadius: 12, border: '1px solid var(--gray-200)', padding: 20, marginBottom: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Alterar estado</h3>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {ESTADOS.map(est => (
                  <button key={est} className={`filtro-btn${seleccionada.estado === est ? ' active' : ''}`} style={{ fontSize: 12 }}
                    onClick={() => handleEstado(seleccionada.id, est)} disabled={salvando}>
                    {badgeEstadoLabel(est)}
                  </button>
                ))}
              </div>
            </div>

            {/* Notas admin */}
            <div style={{ background: 'white', borderRadius: 12, border: '1px solid var(--gray-200)', padding: 20, marginBottom: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Notas para o cliente</h3>
              <textarea value={notas} onChange={e => setNotas(e.target.value)} placeholder="Ex: Produto chega amanhã..." style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1.5px solid var(--gray-200)', fontSize: 14, fontFamily: 'Inter, sans-serif', resize: 'vertical', minHeight: 80, outline: 'none' }} />
              <button className="btn btn-primary btn-sm" style={{ marginTop: 8 }} onClick={handleNotas} disabled={salvando}>Guardar notas</button>
            </div>

            {/* Itens */}
            <div style={{ background: 'white', borderRadius: 12, border: '1px solid var(--gray-200)', padding: 20, marginBottom: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Produtos ({seleccionada.itens?.length})</h3>
              {seleccionada.itens?.map(item => (
                <div key={item.key} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--gray-100)', fontSize: 14 }}>
                  <div>
                    <p style={{ fontWeight: 500 }}>{item.nome}</p>
                    <p style={{ fontSize: 12, color: 'var(--gray-400)' }}>{item.tamanho && `Tam: ${item.tamanho}`} {item.cor && `· ${item.cor}`} · Qtd: {item.quantidade}</p>
                  </div>
                  <p style={{ fontWeight: 700 }}>{(item.preco * item.quantidade).toFixed(2)} MZN</p>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 12, fontWeight: 700 }}>
                <span>Total</span><span>{seleccionada.total?.toFixed(2)} MZN</span>
              </div>
            </div>

            {/* Entrega */}
            <div style={{ background: 'white', borderRadius: 12, border: '1px solid var(--gray-200)', padding: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Entrega</h3>
              <p style={{ fontSize: 14, color: 'var(--gray-600)', marginBottom: 4 }}>📧 {seleccionada.cliente_email}</p>
              <p style={{ fontSize: 14, color: 'var(--gray-600)', marginBottom: 4 }}>📍 {seleccionada.morada_entrega}, {seleccionada.cidade_entrega}</p>
              <p style={{ fontSize: 14, color: 'var(--gray-600)', marginBottom: 4 }}>📞 {seleccionada.telefone_contacto}</p>
              {seleccionada.notas && <p style={{ fontSize: 14, color: 'var(--gray-600)' }}>📝 {seleccionada.notas}</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
