'use client';
import { useEffect, useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Image from '@/components/CloudImage';
import { uploadParaCloudinary } from '@/lib/cloudinary';
import { mostrarToast } from '@/components/Toast';
import { confirmar } from '@/components/Confirmar';
import { ArrowUp, ArrowDown, Pencil, Trash2 } from 'lucide-react';

// Publicações da página /noticias, guardadas em config/noticias.itens.
// "artigo" aparece no bloco principal; "imprensa" no bloco Imprensa local.
interface Noticia {
  id: string;
  tipo: 'artigo' | 'imprensa';
  categoria: string;
  titulo: string;
  resumo: string;
  corpo: string;
  imagem: string;
  data: string;
  link: string;
}

const VAZIA: Omit<Noticia, 'id'> = { tipo: 'artigo', categoria: '', titulo: '', resumo: '', corpo: '', imagem: '', data: '', link: '' };

export default function AdminNoticiasPage() {
  const [itens, setItens] = useState<Noticia[]>([]);
  const [form, setForm] = useState<Omit<Noticia, 'id'>>({ ...VAZIA });
  const [editando, setEditando] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [uploadPct, setUploadPct] = useState<number | null>(null);

  useEffect(() => {
    getDoc(doc(db, 'config', 'noticias'))
      .then(s => setItens(((s.data()?.itens || []) as Partial<Noticia>[]).map(n => ({ ...VAZIA, id: String(n.id || Date.now()), ...n }) as Noticia)))
      .catch(() => mostrarToast('Erro ao carregar', 'error'))
      .finally(() => setLoading(false));
  }, []);

  const guardar = async (novos: Noticia[]) => {
    setSalvando(true);
    try {
      await setDoc(doc(db, 'config', 'noticias'), { itens: novos });
      setItens(novos);
      mostrarToast('Notícias actualizadas!', 'success');
      return true;
    } catch {
      mostrarToast('Erro ao guardar', 'error');
      return false;
    } finally {
      setSalvando(false);
    }
  };

  const f = (campo: keyof Omit<Noticia, 'id'>) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(v => ({ ...v, [campo]: e.target.value }));

  const submeter = async () => {
    if (!form.titulo.trim()) { mostrarToast('Indica o título', 'error'); return; }
    const limpo = { ...form, titulo: form.titulo.trim() };
    const novos = editando
      ? itens.map(n => n.id === editando ? { ...n, ...limpo } : n)
      : [{ id: Date.now().toString(), ...limpo }, ...itens];
    if (await guardar(novos)) { setForm({ ...VAZIA }); setEditando(null); }
  };

  const editar = (n: Noticia) => {
    const { id, ...resto } = n;
    setEditando(id);
    setForm(resto);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const remover = async (n: Noticia) => {
    if (!(await confirmar({ titulo: `Remover "${n.titulo}"?`, confirmar: 'Remover', perigo: true }))) return;
    guardar(itens.filter(i => i.id !== n.id));
    if (editando === n.id) { setEditando(null); setForm({ ...VAZIA }); }
  };

  const mover = (i: number, dir: -1 | 1) => {
    const novos = [...itens];
    const j = i + dir;
    if (j < 0 || j >= novos.length) return;
    [novos[i], novos[j]] = [novos[j], novos[i]];
    guardar(novos);
  };

  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadPct(0);
    try {
      const url = await uploadParaCloudinary(file, setUploadPct);
      setForm(v => ({ ...v, imagem: url }));
    } catch {
      mostrarToast('Erro no upload', 'error');
    } finally {
      setUploadPct(null);
    }
  };

  if (loading) return <div className="loading"><div className="spinner" /> A carregar...</div>;

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: 32 }}>
      <div className="admin-topbar" style={{ marginBottom: 24 }}>
        <h1>Notícias e imprensa</h1>
      </div>

      <div className="form-card" style={{ marginBottom: 24 }}>
        <h2>{editando ? 'Editar publicação' : 'Nova publicação'}</h2>
        <div className="form-grid-2">
          <div className="form-group">
            <label>Tipo</label>
            <select value={form.tipo} onChange={f('tipo')}>
              <option value="artigo">Artigo (guia, história da equipa)</option>
              <option value="imprensa">Imprensa local (referência nos media)</option>
            </select>
          </div>
          <div className="form-group"><label>Categoria (opcional)</label><input value={form.categoria} onChange={f('categoria')} placeholder="Ex: Guia de compra" /></div>
        </div>
        <div className="form-group"><label>Título *</label><input value={form.titulo} onChange={f('titulo')} /></div>
        <div className="form-group"><label>Resumo</label><textarea value={form.resumo} onChange={f('resumo')} style={{ minHeight: 70 }} /></div>
        <div className="form-group"><label>Texto completo (opcional)</label><textarea value={form.corpo} onChange={f('corpo')} style={{ minHeight: 140 }} /></div>
        <div className="form-grid-2">
          <div className="form-group"><label>Data (opcional)</label><input value={form.data} onChange={f('data')} placeholder="Ex: 12 Out 2026" /></div>
          <div className="form-group"><label>Ligação (opcional)</label><input value={form.link} onChange={f('link')} placeholder="https://…" /></div>
        </div>
        <div className="form-group">
          <label>Imagem (opcional)</label>
          {form.imagem && (
            <div style={{ position: 'relative', width: 160, aspectRatio: '16 / 10', marginBottom: 8, background: 'var(--sand)' }}>
              <Image src={form.imagem} alt="" fill style={{ objectFit: 'cover' }} sizes="160px" />
            </div>
          )}
          <input type="file" accept="image/*" onChange={upload} />
          {uploadPct !== null && <p style={{ fontSize: 12, marginTop: 4 }}>A enviar… {uploadPct}%</p>}
          {form.imagem && <button type="button" className="btn btn-outline btn-sm" style={{ marginTop: 8 }} onClick={() => setForm(v => ({ ...v, imagem: '' }))}>Remover imagem</button>}
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          {editando && <button className="btn btn-outline" onClick={() => { setEditando(null); setForm({ ...VAZIA }); }}>Cancelar</button>}
          <button className="btn btn-primary" onClick={submeter} disabled={salvando}>{salvando ? 'A guardar...' : editando ? 'Guardar alterações' : 'Publicar'}</button>
        </div>
      </div>

      {itens.length === 0 ? (
        <p style={{ color: 'var(--gray-500)', fontSize: 14 }}>Ainda não há publicações. A página de notícias mostra &ldquo;Em breve&rdquo; até adicionares a primeira.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {itens.map((n, i) => (
            <div key={n.id} style={{ background: 'white', border: '1px solid var(--gray-200)', borderRadius: 10, padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontWeight: 600, fontSize: 14, margin: 0 }}>{n.titulo}</p>
                <p style={{ fontSize: 12, color: 'var(--gray-500)', margin: '2px 0 0' }}>{n.tipo === 'imprensa' ? 'Imprensa local' : 'Artigo'}{n.data ? ` · ${n.data}` : ''}</p>
              </div>
              <button className="btn btn-outline btn-sm" onClick={() => mover(i, -1)} disabled={i === 0 || salvando} aria-label="Subir"><ArrowUp size={14} /></button>
              <button className="btn btn-outline btn-sm" onClick={() => mover(i, 1)} disabled={i === itens.length - 1 || salvando} aria-label="Descer"><ArrowDown size={14} /></button>
              <button className="btn btn-outline btn-sm" onClick={() => editar(n)} aria-label="Editar"><Pencil size={14} /></button>
              <button className="btn btn-outline btn-sm" onClick={() => remover(n)} aria-label="Remover"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
