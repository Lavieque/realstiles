'use client';
import { useEffect, useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { mostrarToast } from '@/components/Toast';

interface ItemAnuncio {
  id: string;
  texto: string;
  icone?: string;
}

export default function AdminBannerPage() {
  const [itens, setItens] = useState<ItemAnuncio[]>([]);
  const [texto, setTexto] = useState('');
  const [icone, setIcone] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDoc(doc(db, 'config', 'anuncios'))
      .then(snap => {
        if (snap.exists()) setItens(snap.data().itens || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const guardar = async (novosItens: ItemAnuncio[]) => {
    setSalvando(true);
    try {
      await setDoc(doc(db, 'config', 'anuncios'), { itens: novosItens });
      setItens(novosItens);
      mostrarToast('Barra actualizada!', 'success');
    } catch {
      mostrarToast('Erro ao guardar', 'error');
    } finally {
      setSalvando(false);
    }
  };

  const adicionar = () => {
    if (!texto.trim()) return;
    const novo: ItemAnuncio = { id: Date.now().toString(), texto: texto.trim(), icone: icone.trim() || undefined };
    guardar([...itens, novo]);
    setTexto('');
    setIcone('');
  };

  const remover = (id: string) => guardar(itens.filter(i => i.id !== id));

  const mover = (index: number, dir: -1 | 1) => {
    const novos = [...itens];
    const swap = index + dir;
    if (swap < 0 || swap >= novos.length) return;
    [novos[index], novos[swap]] = [novos[swap], novos[index]];
    guardar(novos);
  };

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: 32 }}>
      <div className="admin-topbar" style={{ marginBottom: 24 }}>
        <h1>Barra de anúncios</h1>
      </div>

      {/* Adicionar item */}
      <div style={{ background: 'white', borderRadius: 12, border: '1px solid var(--gray-200)', padding: 24, marginBottom: 24 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Adicionar item</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: 12, marginBottom: 12 }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label style={{ fontSize: 12 }}>Ícone</label>
            <input value={icone} onChange={e => setIcone(e.target.value)} placeholder="🚚" maxLength={2} style={{ textAlign: 'center', fontSize: 20 }} />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label style={{ fontSize: 12 }}>Texto</label>
            <input value={texto} onChange={e => setTexto(e.target.value)} placeholder="Envio grátis em todas as encomendas" onKeyDown={e => e.key === 'Enter' && adicionar()} />
          </div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={adicionar} disabled={!texto.trim() || salvando}>
          + Adicionar
        </button>
      </div>

      {/* Lista de itens */}
      <div style={{ background: 'white', borderRadius: 12, border: '1px solid var(--gray-200)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--gray-100)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>Itens actuais</h3>
          <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>{itens.length} item{itens.length !== 1 ? 's' : ''}</span>
        </div>
        {loading ? (
          <div className="loading"><div className="spinner" /></div>
        ) : itens.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--gray-400)', fontSize: 14 }}>
            Sem itens. Adiciona o primeiro acima.
          </div>
        ) : (
          itens.map((item, i) => (
            <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: '1px solid var(--gray-100)' }}>
              <span style={{ fontSize: 20, width: 28, textAlign: 'center' }}>{item.icone || '—'}</span>
              <span style={{ flex: 1, fontSize: 14 }}>{item.texto}</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-outline btn-sm" onClick={() => mover(i, -1)} disabled={i === 0 || salvando} title="Mover para cima">↑</button>
                <button className="btn btn-outline btn-sm" onClick={() => mover(i, 1)} disabled={i === itens.length - 1 || salvando} title="Mover para baixo">↓</button>
                <button className="btn btn-sm" onClick={() => remover(item.id)} disabled={salvando} style={{ background: 'var(--red)', color: 'white', border: 'none' }}>✕</button>
              </div>
            </div>
          ))
        )}
      </div>

      <p style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 16 }}>
        Os itens aparecem em loop na barra no topo do site. Recomenda-se 3–5 itens.
      </p>
    </div>
  );
}
