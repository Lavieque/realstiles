'use client';
import { useEffect, useState } from 'react';
import { mostrarToast } from '@/components/Toast';

interface Categoria {
  nome: string;
  subcategorias: string[];
}

export default function AdminCategoriasPage() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [novaCategoria, setNovaCategoria] = useState('');
  const [novasSub, setNovasSub] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch('/api/config/categorias')
      .then(r => r.json())
      .then(d => {
        // suporta array de strings (legado) ou array de objectos
        const raw: (string | Categoria)[] = d.categorias || [];
        setCategorias(raw.map(c =>
          typeof c === 'string' ? { nome: c, subcategorias: [] } : c
        ));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const guardar = async (novas: Categoria[]) => {
    setSalvando(true);
    try {
      const res = await fetch('/api/config/categorias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categorias: novas }),
      });
      if (!res.ok) throw new Error(await res.text());
      setCategorias(novas);
      mostrarToast('Categorias guardadas!', 'success');
    } catch {
      mostrarToast('Erro ao guardar', 'error');
    } finally {
      setSalvando(false);
    }
  };

  const adicionarCategoria = () => {
    const nome = novaCategoria.trim();
    if (!nome || categorias.some(c => c.nome === nome)) return;
    guardar([...categorias, { nome, subcategorias: [] }]);
    setNovaCategoria('');
  };

  const removerCategoria = (nome: string) =>
    guardar(categorias.filter(c => c.nome !== nome));

  const adicionarSub = (catNome: string) => {
    const sub = (novasSub[catNome] || '').trim();
    if (!sub) return;
    guardar(categorias.map(c =>
      c.nome === catNome && !c.subcategorias.includes(sub)
        ? { ...c, subcategorias: [...c.subcategorias, sub] }
        : c
    ));
    setNovasSub(s => ({ ...s, [catNome]: '' }));
  };

  const removerSub = (catNome: string, sub: string) =>
    guardar(categorias.map(c =>
      c.nome === catNome
        ? { ...c, subcategorias: c.subcategorias.filter(s => s !== sub) }
        : c
    ));

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: 32 }}>
      <div className="admin-topbar" style={{ marginBottom: 24 }}>
        <h1>Categorias</h1>
      </div>

      {/* Adicionar categoria */}
      <div style={{ background: 'white', borderRadius: 12, border: '1px solid var(--gray-200)', padding: 24, marginBottom: 24 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Nova categoria</h3>
        <div style={{ display: 'flex', gap: 10 }}>
          <input
            value={novaCategoria}
            onChange={e => setNovaCategoria(e.target.value)}
            placeholder="Ex: Vestidos"
            onKeyDown={e => e.key === 'Enter' && adicionarCategoria()}
            style={{ flex: 1 }}
          />
          <button className="btn btn-primary btn-sm" onClick={adicionarCategoria} disabled={!novaCategoria.trim() || salvando}>
            + Adicionar
          </button>
        </div>
      </div>

      {/* Lista de categorias */}
      {loading ? (
        <div className="loading"><div className="spinner" /></div>
      ) : categorias.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--gray-400)', fontSize: 14, background: 'white', borderRadius: 12, border: '1px solid var(--gray-200)' }}>
          Sem categorias. Adiciona a primeira acima.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {categorias.map(cat => (
            <div key={cat.nome} style={{ background: 'white', borderRadius: 12, border: '1px solid var(--gray-200)', overflow: 'hidden' }}>
              {/* Cabeçalho da categoria */}
              <div style={{ display: 'flex', alignItems: 'center', padding: '14px 20px', borderBottom: cat.subcategorias.length > 0 || true ? '1px solid var(--gray-100)' : 'none' }}>
                <span style={{ flex: 1, fontWeight: 600, fontSize: 14 }}>{cat.nome}</span>
                <span style={{ fontSize: 12, color: 'var(--gray-400)', marginRight: 12 }}>
                  {cat.subcategorias.length} sub{cat.subcategorias.length !== 1 ? 'categorias' : 'categoria'}
                </span>
                <button
                  className="btn btn-sm"
                  onClick={() => removerCategoria(cat.nome)}
                  disabled={salvando}
                  style={{ background: 'var(--red)', color: 'white', border: 'none' }}
                >✕</button>
              </div>

              {/* Subcategorias */}
              <div style={{ padding: '12px 20px' }}>
                {cat.subcategorias.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                    {cat.subcategorias.map(sub => (
                      <span key={sub} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--gray-100)', borderRadius: 100, padding: '4px 12px', fontSize: 12, fontWeight: 500 }}>
                        {sub}
                        <button
                          onClick={() => removerSub(cat.nome, sub)}
                          disabled={salvando}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-400)', fontSize: 14, lineHeight: 1, padding: 0 }}
                        >×</button>
                      </span>
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    value={novasSub[cat.nome] || ''}
                    onChange={e => setNovasSub(s => ({ ...s, [cat.nome]: e.target.value }))}
                    placeholder="Nova subcategoria..."
                    onKeyDown={e => e.key === 'Enter' && adicionarSub(cat.nome)}
                    style={{ flex: 1, fontSize: 13, padding: '7px 12px' }}
                  />
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => adicionarSub(cat.nome)}
                    disabled={!(novasSub[cat.nome] || '').trim() || salvando}
                  >+ Sub</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <p style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 16 }}>
        As categorias aparecem nos filtros da loja e no formulário de produtos.
      </p>
    </div>
  );
}
