'use client';
import { useEffect, useState } from 'react';
import { mostrarToast } from '@/components/Toast';
import { aplicarTaxas } from '@/lib/taxas';
import type { Taxa } from '@/lib/taxas';
import { X } from 'lucide-react';

export default function AdminTaxasPage() {
  const [itens, setItens] = useState<Taxa[]>([]);
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState<Taxa['tipo']>('percentagem');
  const [valor, setValor] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/config/taxas')
      .then(r => r.json())
      .then(d => { setItens(d.itens || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const guardar = async (novosItens: Taxa[]) => {
    setSalvando(true);
    try {
      const res = await fetch('/api/config/taxas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itens: novosItens }),
      });
      if (!res.ok) throw new Error(await res.text());
      setItens(novosItens);
      mostrarToast('Taxas actualizadas!', 'success');
    } catch {
      mostrarToast('Erro ao guardar', 'error');
    } finally {
      setSalvando(false);
    }
  };

  const adicionar = () => {
    const v = Number(valor);
    if (!nome.trim() || !v) return;
    const novo: Taxa = { id: Date.now().toString(), nome: nome.trim(), tipo, valor: v };
    guardar([...itens, novo]);
    setNome('');
    setValor('');
  };

  const remover = (id: string) => guardar(itens.filter(i => i.id !== id));

  const exemplo = 1000;

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: 32 }}>
      <div className="admin-topbar" style={{ marginBottom: 24 }}>
        <h1>Taxas de importação</h1>
      </div>

      <div style={{ background: 'white', borderRadius: 12, border: '1px solid var(--gray-200)', padding: 24, marginBottom: 24 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Adicionar taxa</h3>

        <div className="form-group" style={{ margin: '0 0 12px' }}>
          <label style={{ fontSize: 12 }}>Nome</label>
          <input
            value={nome}
            onChange={e => setNome(e.target.value)}
            placeholder="Ex: Taxa alfandegária, Transporte..."
            onKeyDown={e => e.key === 'Enter' && adicionar()}
          />
        </div>
        <div className="form-grid-2" style={{ marginBottom: 16 }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label style={{ fontSize: 12 }}>Tipo</label>
            <select value={tipo} onChange={e => setTipo(e.target.value as Taxa['tipo'])}>
              <option value="percentagem">Percentagem (%)</option>
              <option value="fixo">Valor fixo (MZN)</option>
            </select>
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label style={{ fontSize: 12 }}>Valor</label>
            <input
              type="number"
              value={valor}
              onChange={e => setValor(e.target.value)}
              placeholder={tipo === 'percentagem' ? 'Ex: 15' : 'Ex: 200'}
              onKeyDown={e => e.key === 'Enter' && adicionar()}
            />
          </div>
        </div>

        <button className="btn btn-primary btn-sm" onClick={adicionar} disabled={!nome.trim() || !Number(valor) || salvando}>
          + Adicionar
        </button>
      </div>

      <div style={{ background: 'white', borderRadius: 12, border: '1px solid var(--gray-200)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--gray-100)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>Taxas actuais</h3>
          <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>{itens.length} taxa{itens.length !== 1 ? 's' : ''}</span>
        </div>
        {loading ? (
          <div className="loading"><div className="spinner" /></div>
        ) : itens.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--gray-400)', fontSize: 14 }}>
            Sem taxas configuradas. O preço importado será usado tal como vem da fonte.
          </div>
        ) : (
          itens.map(item => (
            <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: '1px solid var(--gray-100)' }}>
              <span style={{ flex: 1 }}>
                <span style={{ fontSize: 14, fontWeight: 600, display: 'block' }}>{item.nome}</span>
                <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>
                  {item.tipo === 'percentagem' ? `${item.valor}%` : `${item.valor.toFixed(2)} MZN fixo`}
                </span>
              </span>
              <button className="btn btn-sm" onClick={() => remover(item.id)} disabled={salvando} style={{ background: 'var(--red)', color: 'white', border: 'none', display: 'flex', alignItems: 'center' }}><X size={14} strokeWidth={1.5} /></button>
            </div>
          ))
        )}
      </div>

      {itens.length > 0 && (
        <p style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 16 }}>
          Exemplo: um produto importado a {exemplo.toFixed(2)} MZN ficaria a <strong>{aplicarTaxas(exemplo, itens).toFixed(2)} MZN</strong> depois de aplicadas estas taxas.
        </p>
      )}
      <p style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: itens.length > 0 ? 4 : 16 }}>
        As taxas são aplicadas automaticamente ao preço sugerido sempre que importas um produto via link ou pela extensão da Temu — podes sempre ajustar o preço final antes de guardar.
      </p>
    </div>
  );
}
