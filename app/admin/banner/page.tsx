'use client';
import { useEffect, useState } from 'react';
import { mostrarToast } from '@/components/Toast';
import { ICONES } from '@/lib/announcement-icons';

interface ItemAnuncio {
  id: string;
  texto: string;
  descricao?: string;
  icone?: string;
}

export default function AdminBannerPage() {
  const [itens, setItens] = useState<ItemAnuncio[]>([]);
  const [texto, setTexto] = useState('');
  const [icone, setIcone] = useState('truck');
  const [descricao, setDescricao] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/config/anuncios')
      .then(r => r.json())
      .then(d => { setItens(d.itens || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const guardar = async (novosItens: ItemAnuncio[]) => {
    setSalvando(true);
    try {
      const res = await fetch('/api/config/anuncios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itens: novosItens }),
      });
      if (!res.ok) throw new Error(await res.text());
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
    const novo: ItemAnuncio = { id: Date.now().toString(), texto: texto.trim(), descricao: descricao.trim() || undefined, icone: icone || undefined };
    guardar([...itens, novo]);
    setTexto('');
    setDescricao('');
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

      <div style={{ background: 'white', borderRadius: 12, border: '1px solid var(--gray-200)', padding: 24, marginBottom: 24 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Adicionar item</h3>

        <div className="form-group" style={{ margin: '0 0 16px' }}>
          <label style={{ fontSize: 12 }}>Ícone</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
            {Object.entries(ICONES).map(([key, { label, svg }]) => (
              <button
                key={key}
                type="button"
                onClick={() => setIcone(key)}
                title={label}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
                  border: icone === key ? '2px solid var(--black)' : '1px solid var(--gray-200)',
                  background: icone === key ? 'var(--gray-100)' : 'white',
                  minWidth: 60,
                }}
              >
                <span
                  style={{ color: 'var(--gray-700)', display: 'flex' }}
                  dangerouslySetInnerHTML={{ __html: svg }}
                />
                <span style={{ fontSize: 10, color: 'var(--gray-500)', fontWeight: 500 }}>{label}</span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => setIcone('')}
              title="Sem ícone"
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
                border: icone === '' ? '2px solid var(--black)' : '1px solid var(--gray-200)',
                background: icone === '' ? 'var(--gray-100)' : 'white',
                minWidth: 60,
              }}
            >
              <span style={{ fontSize: 18, color: 'var(--gray-300)' }}>—</span>
              <span style={{ fontSize: 10, color: 'var(--gray-500)', fontWeight: 500 }}>Nenhum</span>
            </button>
          </div>
        </div>

        <div className="form-group" style={{ margin: '0 0 12px' }}>
          <label style={{ fontSize: 12 }}>Título</label>
          <input
            value={texto}
            onChange={e => setTexto(e.target.value)}
            placeholder="Envio grátis"
            onKeyDown={e => e.key === 'Enter' && adicionar()}
          />
        </div>
        <div className="form-group" style={{ margin: '0 0 16px' }}>
          <label style={{ fontSize: 12 }}>Descrição <span style={{ color: 'var(--gray-400)', fontWeight: 400 }}>(opcional)</span></label>
          <input
            value={descricao}
            onChange={e => setDescricao(e.target.value)}
            placeholder="em todas as encomendas"
            onKeyDown={e => e.key === 'Enter' && adicionar()}
          />
        </div>

        <button className="btn btn-primary btn-sm" onClick={adicionar} disabled={!texto.trim() || salvando}>
          + Adicionar
        </button>
      </div>

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
              <span
                style={{ color: 'var(--gray-600)', width: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                dangerouslySetInnerHTML={{ __html: item.icone && ICONES[item.icone] ? ICONES[item.icone].svg : '—' }}
              />
              <span style={{ flex: 1 }}>
                <span style={{ fontSize: 14, fontWeight: 600, display: 'block' }}>{item.texto}</span>
                {item.descricao && <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>{item.descricao}</span>}
              </span>
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
