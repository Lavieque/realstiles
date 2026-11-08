'use client';
import { useEffect, useState } from 'react';
import Image from '@/components/CloudImage';
import { mostrarToast } from '@/components/Toast';
import { ClipboardList, X, ImagePlus } from 'lucide-react';
import { apiFetch } from '@/lib/api-fetch';
import { uploadParaCloudinary } from '@/lib/cloudinary';
import { confirmar } from '@/components/Confirmar';
import { normalizarArvore } from '@/lib/categorias';
import type { CatNo } from '@/lib/categorias';

const NIVEIS = ['categoria', 'subcategoria', 'sub-subcategoria'];
const MAX_NIVEL = 2;

function slugify(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

// Aplica `fn` ao nó em `caminho` (slugs do topo ao nó); devolve nova árvore
function mapearNo(arvore: CatNo[], caminho: string[], fn: (n: CatNo) => CatNo | null): CatNo[] {
  const [slug, ...resto] = caminho;
  return arvore.flatMap(n => {
    if (n.slug !== slug) return [n];
    if (resto.length === 0) { const r = fn(n); return r ? [r] : []; }
    return [{ ...n, subcategorias: mapearNo(n.subcategorias || [], resto, fn) }];
  });
}

function AddRow({ placeholder, onAdd, disabled }: { placeholder: string; onAdd: (nome: string) => void; disabled: boolean }) {
  const [val, setVal] = useState('');
  const enviar = () => { if (val.trim()) { onAdd(val.trim()); setVal(''); } };
  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
      <input value={val} onChange={e => setVal(e.target.value)} placeholder={placeholder} onKeyDown={e => { if (e.key === 'Enter') enviar(); }} style={{ flex: 1, fontSize: 13, padding: '7px 12px' }} />
      <button className="btn btn-outline btn-sm" onClick={enviar} disabled={!val.trim() || disabled}>+</button>
    </div>
  );
}

function NoCategoria({ no, caminho, nivel, disabled, expandidos, alternar, onRenomear, onImagem, onRemover, onAdicionar }: {
  no: CatNo;
  caminho: string[];
  nivel: number;
  disabled: boolean;
  expandidos: Record<string, boolean>;
  alternar: (chave: string) => void;
  onRenomear: (caminho: string[], nome: string) => void;
  onImagem: (caminho: string[], file: File | null) => Promise<void>;
  onRemover: (caminho: string[], no: CatNo) => void;
  onAdicionar: (caminho: string[], nome: string) => void;
}) {
  const chave = caminho.join('/');
  const subs = no.subcategorias || [];
  const aberto = !!expandidos[chave];
  const podeTerFilhos = nivel < MAX_NIVEL;
  const [nome, setNome] = useState(no.nome);
  const [enviando, setEnviando] = useState(false);
  useEffect(() => setNome(no.nome), [no.nome]);

  const confirmarNome = () => {
    const limpo = nome.trim();
    if (!limpo) { setNome(no.nome); return; }
    if (limpo !== no.nome) onRenomear(caminho, limpo);
  };

  const escolherImagem = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setEnviando(true);
    try { await onImagem(caminho, file); } finally { setEnviando(false); }
  };

  const tamanhoImg = nivel === 0 ? 44 : 34;

  return (
    <div style={{ marginBottom: nivel === 0 ? 0 : 8, marginLeft: nivel === 0 ? 0 : 16 }}>
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 10, background: 'white',
          padding: nivel === 0 ? '12px 16px' : '8px 12px',
          borderRadius: nivel === 0 ? 0 : 8,
          border: nivel === 0 ? 'none' : '1px solid var(--gray-200)',
          borderBottom: nivel === 0 && aberto ? '1px solid var(--gray-100)' : undefined,
        }}
      >
        {podeTerFilhos ? (
          <button type="button" onClick={() => alternar(chave)} aria-label={aberto ? 'Fechar' : 'Abrir'} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--gray-400)', transition: 'transform 0.15s', transform: aberto ? 'rotate(90deg)' : 'none', padding: 4 }}>▶</button>
        ) : <span style={{ width: 20 }} />}

        <label title="Alterar imagem" style={{ width: tamanhoImg, height: tamanhoImg, borderRadius: 8, background: 'var(--gray-100)', border: '1px dashed var(--gray-300)', position: 'relative', overflow: 'hidden', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gray-400)' }}>
          {no.imagem
            ? <Image src={no.imagem} alt="" fill style={{ objectFit: 'cover' }} sizes="48px" />
            : enviando ? <span className="spinner" style={{ width: 14, height: 14 }} /> : <ImagePlus size={16} strokeWidth={1.5} />}
          <input type="file" accept="image/*" onChange={escolherImagem} disabled={disabled || enviando} style={{ display: 'none' }} />
        </label>

        <span style={{ flex: 1, minWidth: 0 }}>
          <input
            value={nome}
            onChange={e => setNome(e.target.value)}
            onBlur={confirmarNome}
            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') { setNome(no.nome); (e.target as HTMLInputElement).blur(); } }}
            disabled={disabled}
            aria-label={`Nome da ${NIVEIS[nivel]}`}
            style={{ fontWeight: nivel === 0 ? 700 : 500, fontSize: nivel === 0 ? 14 : 13, padding: '4px 8px', width: '100%', maxWidth: 260, border: '1px solid transparent', background: 'transparent' }}
            onFocus={e => { e.currentTarget.style.borderColor = 'var(--gray-300)'; e.currentTarget.style.background = 'white'; }}
            onBlurCapture={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = 'transparent'; }}
          />
          <span style={{ fontSize: 11, color: 'var(--gray-400)', marginLeft: 6 }}>/{no.slug}</span>
        </span>

        {no.imagem && (
          <button type="button" onClick={() => onImagem(caminho, null)} disabled={disabled} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--gray-400)', textDecoration: 'underline' }}>sem imagem</button>
        )}
        {podeTerFilhos && <span style={{ fontSize: 11, color: 'var(--gray-400)' }}>{subs.length} sub</span>}
        <button type="button" onClick={() => onRemover(caminho, no)} disabled={disabled} aria-label="Remover" style={{ background: nivel === 0 ? 'var(--red)' : 'none', color: nivel === 0 ? 'white' : 'var(--gray-400)', border: 'none', borderRadius: 6, padding: nivel === 0 ? '3px 9px' : '2px 6px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><X size={nivel === 0 ? 14 : 16} strokeWidth={1.5} /></button>
      </div>

      {podeTerFilhos && aberto && (
        <div style={{ padding: nivel === 0 ? '12px 16px 16px' : '6px 0 0 8px', background: nivel === 0 ? 'var(--gray-50)' : undefined }}>
          {subs.map(s => (
            <NoCategoria key={s.slug} no={s} caminho={[...caminho, s.slug]} nivel={nivel + 1} disabled={disabled} expandidos={expandidos} alternar={alternar} onRenomear={onRenomear} onImagem={onImagem} onRemover={onRemover} onAdicionar={onAdicionar} />
          ))}
          <AddRow placeholder={`Nova ${NIVEIS[nivel + 1]}...`} disabled={disabled} onAdd={n => onAdicionar(caminho, n)} />
        </div>
      )}
    </div>
  );
}

export default function AdminCategoriasPage() {
  const [categorias, setCategorias] = useState<CatNo[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [seeded, setSeeded] = useState(false);
  const [expandidos, setExpandidos] = useState<Record<string, boolean>>({});
  const [novaCategoria, setNovaCategoria] = useState('');

  useEffect(() => {
    fetch('/api/config/categorias')
      .then(r => r.json())
      .then(d => {
        setCategorias(normalizarArvore(d.categorias));
        if (d.seeded) setSeeded(true);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const guardar = async (novas: CatNo[], msg = 'Categorias guardadas!') => {
    setSalvando(true);
    try {
      const res = await apiFetch('/api/config/categorias', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ categorias: novas }) });
      if (!res.ok) throw new Error(await res.text());
      setCategorias(novas);
      setSeeded(false);
      mostrarToast(msg, 'success');
    } catch { mostrarToast('Erro ao guardar', 'error'); }
    finally { setSalvando(false); }
  };

  const alternar = (chave: string) => setExpandidos(e => ({ ...e, [chave]: !e[chave] }));

  const addCat = () => {
    const nome = novaCategoria.trim();
    if (!nome) return;
    const slug = slugify(nome);
    if (!slug || categorias.some(c => c.slug === slug)) { mostrarToast('Já existe uma categoria com esse nome', 'error'); return; }
    guardar([...categorias, { nome, slug, subcategorias: [] }]);
    setNovaCategoria('');
    setExpandidos(e => ({ ...e, [slug]: true }));
  };

  const adicionar = (caminho: string[], nome: string) => {
    const slug = slugify(nome);
    if (!slug) return;
    const pai = caminho.join('/');
    guardar(mapearNo(categorias, caminho, n => (n.subcategorias || []).some(s => s.slug === slug)
      ? n
      : { ...n, subcategorias: [...(n.subcategorias || []), { nome, slug, subcategorias: [] }] }));
    setExpandidos(e => ({ ...e, [pai]: true, [`${pai}/${slug}`]: true }));
  };

  // O slug mantém-se: os artigos referem-se à categoria pelo slug
  const renomear = (caminho: string[], nome: string) =>
    guardar(mapearNo(categorias, caminho, n => ({ ...n, nome })), 'Nome actualizado');

  const remover = async (caminho: string[], no: CatNo) => {
    const filhos = (no.subcategorias || []).length;
    const ok = await confirmar({
      titulo: `Remover "${no.nome}"?`,
      mensagem: filhos ? `Remove também as ${filhos} subcategorias. Os artigos mantêm-se, mas deixam de aparecer nesta categoria.` : 'Os artigos mantêm-se, mas deixam de aparecer nesta categoria.',
      confirmar: 'Remover',
      perigo: true,
    });
    if (ok) guardar(mapearNo(categorias, caminho, () => null));
  };

  // file === null remove a imagem
  const mudarImagem = async (caminho: string[], file: File | null) => {
    try {
      const imagem = file ? await uploadParaCloudinary(file) : undefined;
      await guardar(mapearNo(categorias, caminho, n => ({ ...n, imagem })), file ? 'Imagem guardada' : 'Imagem removida');
    } catch { mostrarToast('Erro no upload da imagem', 'error'); }
  };

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: 32 }}>
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
              <NoCategoria no={cat} caminho={[cat.slug]} nivel={0} disabled={salvando} expandidos={expandidos} alternar={alternar} onRenomear={renomear} onImagem={mudarImagem} onRemover={remover} onAdicionar={adicionar} />
            </div>
          ))}
        </div>
      )}
      <p style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 16 }}>
        Categoria → Subcategoria → Sub-subcategoria. Clica no nome para o editar (o endereço /slug não muda) e no quadrado à esquerda para definir a imagem. Apenas as categorias com artigos aparecem na loja.
      </p>
    </div>
  );
}
