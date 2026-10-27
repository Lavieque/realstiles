'use client';
import { useEffect, useState } from 'react';
import { mostrarToast } from '@/components/Toast';
import { X } from 'lucide-react';
import { apiFetch } from '@/lib/api-fetch';
import { PROVINCIAS, MODALIDADES, ZONAS, descricaoTarifa } from '@/lib/entregas';
import type { TarifaEntrega, Modalidade, Zona } from '@/lib/entregas';

const card = { background: 'white', borderRadius: 12, border: '1px solid var(--gray-200)' } as const;

export default function TarifasEntrega() {
  const [itens, setItens] = useState<TarifaEntrega[]>([]);
  const [provincia, setProvincia] = useState<string>(PROVINCIAS[0]);
  const [modalidade, setModalidade] = useState<Modalidade>('domicilio');
  const [zona, setZona] = useState<Zona>('urbana');
  const [base, setBase] = useState('');
  const [porKg, setPorKg] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/config/entregas')
      .then(r => r.json())
      .then(d => { setItens(d.itens || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const guardar = async (novos: TarifaEntrega[]) => {
    setSalvando(true);
    try {
      const res = await apiFetch('/api/config/entregas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itens: novos }),
      });
      if (!res.ok) throw new Error(await res.text());
      setItens(novos);
      mostrarToast('Tarifas de entrega actualizadas!', 'success');
    } catch {
      mostrarToast('Erro ao guardar', 'error');
    } finally {
      setSalvando(false);
    }
  };

  const zonaEfectiva: Zona = modalidade === 'domicilio' ? zona : '';
  const valorBase = Number(base);
  const valorKg = Number(porKg || 0);
  const invalido = base === '' || !Number.isFinite(valorBase) || valorBase < 0 || !Number.isFinite(valorKg) || valorKg < 0;

  const adicionar = () => {
    if (invalido) return;
    const nova: TarifaEntrega = {
      id: Date.now().toString(), provincia, modalidade, zona: zonaEfectiva, preco_base: valorBase, preco_kg: valorKg,
    };
    // Uma tarifa por destino: substitui a existente
    const mesmo = (t: TarifaEntrega) => t.provincia === nova.provincia && t.modalidade === nova.modalidade && t.zona === nova.zona;
    guardar([...itens.filter(t => !mesmo(t)), nova]);
    setBase('');
    setPorKg('');
  };

  const remover = (id: string) => guardar(itens.filter(i => i.id !== id));

  return (
    <section style={{ marginTop: 48 }}>
      <div className="admin-topbar" style={{ marginBottom: 24 }}>
        <h1>Tarifas de entrega</h1>
      </div>

      <div style={{ ...card, padding: 24, marginBottom: 24 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Adicionar tarifa</h3>
        <div className="form-grid-2" style={{ marginBottom: 12 }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label style={{ fontSize: 12 }}>Província de destino</label>
            <select value={provincia} onChange={e => setProvincia(e.target.value)}>
              {PROVINCIAS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label style={{ fontSize: 12 }}>Modalidade</label>
            <select value={modalidade} onChange={e => setModalidade(e.target.value as Modalidade)}>
              {(Object.keys(MODALIDADES) as Modalidade[]).map(m => <option key={m} value={m}>{MODALIDADES[m]}</option>)}
            </select>
          </div>
        </div>
        {modalidade === 'domicilio' && (
          <div className="form-group" style={{ margin: '0 0 12px' }}>
            <label style={{ fontSize: 12 }}>Zona da morada</label>
            <select value={zona} onChange={e => setZona(e.target.value as Zona)}>
              {(Object.keys(ZONAS) as Exclude<Zona, ''>[]).map(z => <option key={z} value={z}>{ZONAS[z]}</option>)}
            </select>
          </div>
        )}
        <div className="form-grid-2" style={{ marginBottom: 16 }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label style={{ fontSize: 12 }}>Preço base (MZN)</label>
            <input type="number" min="0" value={base} onChange={e => setBase(e.target.value)} placeholder="Ex: 200" onKeyDown={e => e.key === 'Enter' && adicionar()} />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label style={{ fontSize: 12 }}>Preço por kg (MZN)</label>
            <input type="number" min="0" value={porKg} onChange={e => setPorKg(e.target.value)} placeholder="Ex: 50 (opcional)" onKeyDown={e => e.key === 'Enter' && adicionar()} />
          </div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={adicionar} disabled={invalido || salvando}>+ Adicionar</button>
        <p style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 12 }}>
          Custo = preço base + preço por kg × peso. Adicionar um destino já existente substitui a tarifa anterior.
        </p>
      </div>

      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--gray-100)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>Tarifas actuais</h3>
          <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>{itens.length} tarifa{itens.length !== 1 ? 's' : ''}</span>
        </div>
        {loading ? (
          <div className="loading"><div className="spinner" /></div>
        ) : itens.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--gray-400)', fontSize: 14 }}>
            Sem tarifas. Os destinos sem tarifa aparecem ao cliente como &ldquo;sob orçamento&rdquo;.
          </div>
        ) : (
          [...itens].sort((a, b) => descricaoTarifa(a).localeCompare(descricaoTarifa(b))).map(t => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: '1px solid var(--gray-100)' }}>
              <span style={{ flex: 1 }}>
                <span style={{ fontSize: 14, fontWeight: 600, display: 'block' }}>{descricaoTarifa(t)}</span>
                <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>
                  {t.preco_base.toFixed(2)} MZN{t.preco_kg > 0 ? ` + ${t.preco_kg.toFixed(2)} MZN/kg` : ''}
                </span>
              </span>
              <button className="btn btn-sm" onClick={() => remover(t.id)} disabled={salvando} aria-label="Remover tarifa" style={{ background: 'var(--red)', color: 'white', border: 'none', display: 'flex', alignItems: 'center' }}><X size={14} strokeWidth={1.5} /></button>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
