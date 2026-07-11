'use client';
import { useEffect, useState } from 'react';
import { mostrarToast } from '@/components/Toast';

interface Subcategoria {
  nome: string;
  slug: string;
}

interface Categoria {
  nome: string;
  slug: string;
  subcategorias: Subcategoria[];
}

function slugify(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

export default function AdminCategoriasPage() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [seeded, setSeeded] = useState(false);
  const [expandido, setExpandido] = useState<Record<string, boolean>>({});
  const [novaCategoria, setNovaCategoria] = useState('');
  const [novasSub, setNovasSub] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch('/api/config/categorias')
      .then(r => r.json())
      .then(d => {
        setCategorias(d.categorias || []);
        if (d.seeded) setSeeded(true);
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
      setSeeded(false);
      mostrarToast('Categorias guardadas!', 'success');
    } catch {
      mostrarToast('Erro ao guardar', 'error');
    } finally {
      setSalvando(false);
    }
  };

  const adicionarCategoria = () => {
    const nome = novaCategoria.trim();
    if (!nome) return;
    const slug = slugify(nome);
    if (categorias.some(c => c.slug === slug)) return;
    const novas = [...categorias, { nome, slug, subcategorias: [] }];
    guardar(novas);
    setNovaCategoria('');
    setExpandido(e => ({ ...e, [slug]: true }));
  };

  const removerCategoria = (slug: string) =>
    guardar(categorias.filter(c => c.slug !== slug));

  const adicionarSub = (catSlug: string) => {
    const nome = (novasSub[catSlug] || '').trim();
    if (!nome) return;
    const slug = slugify(nome);
    guardar(categorias.map(c =>
      c.slug === catSlug && !c.subcategorias.some(s => s.slug === slug)
        ? { ...c, subcategorias: [...c.subcategorias, { nome, slug }] }
        : c
    ));
    setNovasSub(s => ({ ...s, [catSlug]: '' }));
  };

  const removerSub = (catSlug: string, subSlug: string) =>
    guardar(categorias.map(c =>
      c.slug === catSlug
        ? { ...c, subcategorias: c.subcategorias.filter(s => s.slug !== subSlug) }
        : c
    ));

  const toggleExpandido = (slug: string) =>
    setExpandido(e => ({ ...e, [slug]: !e[slug] }));

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: 32 }}>
      <div className="admin-topbar" style={{ marginBottom: 24 }}>
        <h1>Categorias</h1>
      </div>

      {seeded && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: '14px 18px', marginBottom: 20, fontSize: 13, color: '#92400e', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>📋 Carregadas as categorias actuais do site. Clica em <strong>Guardar na base de dados</strong> para as guardar.</span>
          <button className="btn btn-primary btn-sm" onClick={() => guardar(categorias)} disabled={salvando}>
            {salvando ? 'A guardar...' : 'Guardar na base de dados'}
          </button>
        </div>
      )}

      {/* Adicionar categoria */}
      <div style={{ background: 'white', borderRadius: 12, border: '1px solid var(--gray-200)', padding: 20, marginBottom: 20 }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Nova categoria</h3>
        <div style={{ display: 'flex', gap: 10 }}>
          <input value={novaCategoria} onChange={e => setNovaCategoria(e.target.value)} placeholder="Ex: Mulher" onKeyDown={e => e.key === 'Enter' && adicionarCategoria()} style={{ flex: 1 }} />
          <button className="btn btn-primary btn-sm" onClick={adicionarCategoria} disabled={!novaCategoria.trim() || salvando}>+ Adicionar</button>
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="loading"><div className="spinner" /></div>
      ) : categorias.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--gray-400)', fontSize: 14, background: 'white', borderRadius: 12, border: '1px solid var(--gray-200)' }}>
          Sem categorias. Adiciona a primeira acima.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {categorias.map(cat => (
            <div key={cat.slug} style={{ background: 'white', borderRadius: 12, border: '1px solid var(--gray-200)', overflow: 'hidden' }}>

              {/* Cabeçalho */}
              <div style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', cursor: 'pointer', gap: 10 }} onClick={() => toggleExpandido(cat.slug)}>
                <span style={{ fontSize: 13, color: 'var(--gray-400)', transition: 'transform 0.15s', display: 'inline-block', transform: expandido[cat.slug] ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                <span style={{ flex: 1 }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{cat.nome}</span>
                  <span style={{ fontSize: 12, color: 'var(--gray-400)', marginLeft: 8 }}>/{cat.slug}</span>
                </span>
                <span style={{ fontSize: 12, color: 'var(--gray-400)', marginRight: 8 }}>
                  {cat.subcategorias.length} subcategoria{cat.subcategorias.length !== 1 ? 's' : ''}
                </span>
                <button
                  className="btn btn-sm"
                  onClick={e => { e.stopPropagation(); removerCategoria(cat.slug); }}
                  disabled={salvando}
                  style={{ background: 'var(--red)', color: 'white', border: 'none', padding: '4px 10px' }}
                >✕</button>
              </div>

              {/* Subcategorias — visíveis quando expandido */}
              {expandido[cat.slug] && (
                <div style={{ borderTop: '1px solid var(--gray-100)', padding: '14px 16px', background: 'var(--gray-50)' }}>
                  {cat.subcategorias.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                      {cat.subcategorias.map(sub => (
                        <div key={sub.slug} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'white', borderRadius: 8, border: '1px solid var(--gray-200)' }}>
                          <span style={{ fontSize: 13, color: 'var(--gray-300)', marginRight: 2 }}>└</span>
                          <span style={{ flex: 1 }}>
                            <span style={{ fontWeight: 500, fontSize: 13 }}>{sub.nome}</span>
                            <span style={{ fontSize: 11, color: 'var(--gray-400)', marginLeft: 6 }}>/{sub.slug}</span>
                          </span>
                          <button
                            onClick={() => removerSub(cat.slug, sub.slug)}
                            disabled={salvando}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-400)', fontSize: 16, lineHeight: 1, padding: '2px 6px' }}
                          >×</button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      value={novasSub[cat.slug] || ''}
                      onChange={e => setNovasSub(s => ({ ...s, [cat.slug]: e.target.value }))}
                      placeholder="Nova subcategoria..."
                      onKeyDown={e => e.key === 'Enter' && adicionarSub(cat.slug)}
                      style={{ flex: 1, fontSize: 13, padding: '8px 12px' }}
                    />
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => adicionarSub(cat.slug)}
                      disabled={!(novasSub[cat.slug] || '').trim() || salvando}
                    >+ Sub</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <p style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 16 }}>
        As categorias e subcategorias aparecem nos filtros da loja (apenas as que têm artigos) e no formulário de produtos.
      </p>
    </div>
  );
}
