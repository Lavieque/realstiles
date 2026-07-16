'use client';
import { useEffect, useState } from 'react';
import { mostrarToast } from '@/components/Toast';
import { ClipboardList, X } from 'lucide-react';

interface SubSub {
  nome: string;
  slug: string;
}

interface Sub {
  nome: string;
  slug: string;
  subcategorias: SubSub[];
}

interface Categoria {
  nome: string;
  slug: string;
  subcategorias: Sub[];
}

function slugify(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

function ItemRow({ label, slug, onRemove, disabled }: { label: string; slug: string; onRemove: () => void; disabled: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'white', borderRadius: 8, border: '1px solid var(--gray-200)' }}>
      <span style={{ flex: 1 }}>
        <span style={{ fontWeight: 500, fontSize: 13 }}>{label}</span>
        <span style={{ fontSize: 11, color: 'var(--gray-400)', marginLeft: 6 }}>/{slug}</span>
      </span>
      <button onClick={onRemove} disabled={disabled} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-400)', display: 'flex', alignItems: 'center', padding: '2px 6px' }}><X size={16} strokeWidth={1.5} /></button>
    </div>
  );
}

function AddRow({ placeholder, onAdd, disabled }: { placeholder: string; onAdd: (nome: string) => void; disabled: boolean }) {
  const [val, setVal] = useState('');
  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
      <input value={val} onChange={e => setVal(e.target.value)} placeholder={placeholder} onKeyDown={e => { if (e.key === 'Enter' && val.trim()) { onAdd(val.trim()); setVal(''); } }} style={{ flex: 1, fontSize: 13, padding: '7px 12px' }} />
      <button className="btn btn-outline btn-sm" onClick={() => { if (val.trim()) { onAdd(val.trim()); setVal(''); } }} disabled={!val.trim() || disabled}>+</button>
    </div>
  );
}

export default function AdminCategoriasPage() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [seeded, setSeeded] = useState(false);
  const [expandCat, setExpandCat] = useState<Record<string, boolean>>({});
  const [expandSub, setExpandSub] = useState<Record<string, boolean>>({});
  const [novaCategoria, setNovaCategoria] = useState('');

  useEffect(() => {
    fetch('/api/config/categorias')
      .then(r => r.json())
      .then(d => {
        setCategorias((d.categorias || []).map((c: Categoria) => ({
          ...c,
          subcategorias: (c.subcategorias || []).map((s: Sub) => ({ ...s, subcategorias: s.subcategorias || [] })),
        })));
        if (d.seeded) setSeeded(true);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const guardar = async (novas: Categoria[]) => {
    setSalvando(true);
    try {
      const res = await fetch('/api/config/categorias', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ categorias: novas }) });
      if (!res.ok) throw new Error(await res.text());
      setCategorias(novas);
      setSeeded(false);
      mostrarToast('Categorias guardadas!', 'success');
    } catch { mostrarToast('Erro ao guardar', 'error'); }
    finally { setSalvando(false); }
  };

  const addCat = () => {
    const nome = novaCategoria.trim();
    if (!nome) return;
    const slug = slugify(nome);
    if (categorias.some(c => c.slug === slug)) return;
    guardar([...categorias, { nome, slug, subcategorias: [] }]);
    setNovaCategoria('');
    setExpandCat(e => ({ ...e, [slug]: true }));
  };

  const removeCat = (slug: string) => guardar(categorias.filter(c => c.slug !== slug));

  const addSub = (catSlug: string, nome: string) => {
    const slug = slugify(nome);
    guardar(categorias.map(c => c.slug === catSlug && !c.subcategorias.some(s => s.slug === slug)
      ? { ...c, subcategorias: [...c.subcategorias, { nome, slug, subcategorias: [] }] }
      : c));
    setExpandSub(e => ({ ...e, [`${catSlug}/${slug}`]: true }));
  };

  const removeSub = (catSlug: string, subSlug: string) =>
    guardar(categorias.map(c => c.slug === catSlug ? { ...c, subcategorias: c.subcategorias.filter(s => s.slug !== subSlug) } : c));

  const addSubSub = (catSlug: string, subSlug: string, nome: string) => {
    const slug = slugify(nome);
    guardar(categorias.map(c => c.slug === catSlug ? {
      ...c,
      subcategorias: c.subcategorias.map(s => s.slug === subSlug && !s.subcategorias.some(ss => ss.slug === slug)
        ? { ...s, subcategorias: [...s.subcategorias, { nome, slug }] }
        : s)
    } : c));
  };

  const removeSubSub = (catSlug: string, subSlug: string, ssSlug: string) =>
    guardar(categorias.map(c => c.slug === catSlug ? {
      ...c,
      subcategorias: c.subcategorias.map(s => s.slug === subSlug ? { ...s, subcategorias: s.subcategorias.filter(ss => ss.slug !== ssSlug) } : s)
    } : c));

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 32 }}>
      <div className="admin-topbar" style={{ marginBottom: 24 }}><h1>Categorias</h1></div>

      {seeded && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: '14px 18px', marginBottom: 20, fontSize: 13, color: '#92400e', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><ClipboardList size={16} strokeWidth={1.5} /> Categorias actuais do site carregadas. Guarda para as gravar na base de dados.</span>
          <button className="btn btn-primary btn-sm" onClick={() => guardar(categorias)} disabled={salvando}>{salvando ? 'A guardar...' : 'Guardar na BD'}</button>
        </div>
      )}

      <div style={{ background: 'white', borderRadius: 12, border: '1px solid var(--gray-200)', padding: 20, marginBottom: 20 }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Nova categoria de topo</h3>
        <div style={{ display: 'flex', gap: 10 }}>
          <input value={novaCategoria} onChange={e => setNovaCategoria(e.target.value)} placeholder="Ex: Mulher" onKeyDown={e => e.key === 'Enter' && addCat()} style={{ flex: 1 }} />
          <button className="btn btn-primary btn-sm" onClick={addCat} disabled={!novaCategoria.trim() || salvando}>+ Adicionar</button>
        </div>
      </div>

      {loading ? <div className="loading"><div className="spinner" /></div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {categorias.map(cat => (
            <div key={cat.slug} style={{ background: 'white', borderRadius: 12, border: '1px solid var(--gray-200)', overflow: 'hidden' }}>

              {/* Nível 1 — Categoria */}
              <div style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', cursor: 'pointer', gap: 10, borderBottom: expandCat[cat.slug] ? '1px solid var(--gray-100)' : 'none' }} onClick={() => setExpandCat(e => ({ ...e, [cat.slug]: !e[cat.slug] }))}>
                <span style={{ fontSize: 12, color: 'var(--gray-400)', transition: 'transform 0.15s', display: 'inline-block', transform: expandCat[cat.slug] ? 'rotate(90deg)' : 'none' }}>▶</span>
                <span style={{ flex: 1 }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{cat.nome}</span>
                  <span style={{ fontSize: 12, color: 'var(--gray-400)', marginLeft: 8 }}>/{cat.slug}</span>
                </span>
                <span style={{ fontSize: 12, color: 'var(--gray-400)', marginRight: 8 }}>{cat.subcategorias.length} sub</span>
                <button onClick={e => { e.stopPropagation(); removeCat(cat.slug); }} disabled={salvando} style={{ background: 'var(--red)', color: 'white', border: 'none', borderRadius: 6, padding: '3px 9px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><X size={14} strokeWidth={1.5} /></button>
              </div>

              {expandCat[cat.slug] && (
                <div style={{ padding: '12px 16px 16px', background: 'var(--gray-50)' }}>

                  {/* Nível 2 — Subcategorias */}
                  {cat.subcategorias.map(sub => {
                    const subKey = `${cat.slug}/${sub.slug}`;
                    return (
                      <div key={sub.slug} style={{ marginBottom: 8, marginLeft: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'white', borderRadius: 8, border: '1px solid var(--gray-200)', cursor: 'pointer' }}
                          onClick={() => setExpandSub(e => ({ ...e, [subKey]: !e[subKey] }))}>
                          <span style={{ fontSize: 11, color: 'var(--gray-300)' }}>└</span>
                          <span style={{ fontSize: 12, color: 'var(--gray-400)', transition: 'transform 0.15s', display: 'inline-block', transform: expandSub[subKey] ? 'rotate(90deg)' : 'none' }}>▶</span>
                          <span style={{ flex: 1 }}>
                            <span style={{ fontWeight: 500, fontSize: 13 }}>{sub.nome}</span>
                            <span style={{ fontSize: 11, color: 'var(--gray-400)', marginLeft: 6 }}>/{sub.slug}</span>
                          </span>
                          <span style={{ fontSize: 11, color: 'var(--gray-400)', marginRight: 6 }}>{sub.subcategorias.length} sub</span>
                          <button onClick={e => { e.stopPropagation(); removeSub(cat.slug, sub.slug); }} disabled={salvando} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-400)', display: 'flex', alignItems: 'center' }}><X size={16} strokeWidth={1.5} /></button>
                        </div>

                        {/* Nível 3 — Sub-subcategorias */}
                        {expandSub[subKey] && (
                          <div style={{ marginLeft: 24, marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {sub.subcategorias.map(ss => (
                              <ItemRow key={ss.slug} label={ss.nome} slug={ss.slug} disabled={salvando} onRemove={() => removeSubSub(cat.slug, sub.slug, ss.slug)} />
                            ))}
                            <AddRow placeholder="Nova sub-subcategoria..." disabled={salvando} onAdd={nome => addSubSub(cat.slug, sub.slug, nome)} />
                          </div>
                        )}
                      </div>
                    );
                  })}

                  <AddRow placeholder="Nova subcategoria..." disabled={salvando} onAdd={nome => addSub(cat.slug, nome)} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <p style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 16 }}>Categoria → Subcategoria → Sub-subcategoria. Apenas as categorias com artigos aparecem na loja.</p>
    </div>
  );
}
