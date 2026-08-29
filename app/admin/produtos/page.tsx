'use client';
import { useEffect, useState } from 'react';
import Image from '@/components/CloudImage';
import { ShoppingBag, X } from 'lucide-react';
import { getProdutos, criarProduto, actualizarProduto, apagarProduto, getCategorias } from '@/lib/produtos';
import { uploadParaCloudinary } from '@/lib/cloudinary';
import { mostrarToast } from '@/components/Toast';
import type { Produto } from '@/lib/produtos';

const VAZIO: Partial<Produto> = { nome: '', descricao: '', preco: 0, preco_original: 0, categoria: '', stock: 0, imagens: [], tamanhos: [], cores: [], tags: [], destaque: false, activo: true };

export default function AdminProdutosPage() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [seleccionado, setSeleccionado] = useState<Partial<Produto> | null>(null);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [filtro, setFiltro] = useState('');
  const [categorias, setCategorias] = useState<string[]>([]);

  useEffect(() => {
    getProdutos({ max: 200 }).then(({ produtos: p }) => { setProdutos(p); setLoading(false); });
    getCategorias().then(setCategorias).catch(() => {});
    fetch('/api/admin/sincronizar-categorias', { method: 'POST' }).catch(() => {});
  }, []);

  const novo = () => setSeleccionado({ ...VAZIO });

  const editar = (p: Produto) => setSeleccionado({ ...p });

  const salvar = async () => {
    if (!seleccionado?.nome) { mostrarToast('Nome obrigatório', 'error'); return; }
    setSalvando(true);
    try {
      if ((seleccionado as Produto).id) {
        await actualizarProduto((seleccionado as Produto).id, seleccionado);
        setProdutos(p => p.map(x => x.id === (seleccionado as Produto).id ? { ...x, ...seleccionado } as Produto : x));
        mostrarToast('Produto actualizado', 'success');
      } else {
        const id = await criarProduto(seleccionado);
        const novo = { ...seleccionado, id } as Produto;
        setProdutos(p => [novo, ...p]);
        mostrarToast('Produto criado', 'success');
      }
      setSeleccionado(null);
    } catch {
      mostrarToast('Erro ao guardar', 'error');
    } finally {
      setSalvando(false);
    }
  };

  const apagar = async (id: string) => {
    if (!confirm('Tens a certeza?')) return;
    await apagarProduto(id);
    setProdutos(p => p.filter(x => x.id !== id));
    if ((seleccionado as Produto)?.id === id) setSeleccionado(null);
    mostrarToast('Produto apagado', 'success');
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadPct(0);
    try {
      const url = await uploadParaCloudinary(file, setUploadPct);
      setSeleccionado(s => ({ ...s, imagens: [...(s?.imagens || []), url] }));
    } catch {
      mostrarToast('Erro no upload', 'error');
    } finally {
      setUploadPct(null);
    }
  };

  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setSeleccionado(s => ({ ...s, [k]: e.target.value }));

  const filtrados = produtos.filter(p => !filtro || p.nome?.toLowerCase().includes(filtro.toLowerCase()) || p.categoria?.toLowerCase().includes(filtro.toLowerCase()));

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      {/* Lista */}
      <div style={{ width: 380, borderRight: '1px solid var(--gray-200)', display: 'flex', flexDirection: 'column', background: 'white' }}>
        <div className="admin-topbar" style={{ position: 'sticky', top: 0 }}>
          <h1>Produtos</h1>
          <button className="btn btn-primary btn-sm" onClick={novo}>+ Novo</button>
        </div>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--gray-200)' }}>
          <input placeholder="Pesquisar..." value={filtro} onChange={e => setFiltro(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1.5px solid var(--gray-200)', fontSize: 14, fontFamily: 'Inter, sans-serif', outline: 'none' }} />
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? <div className="loading"><div className="spinner" /></div> :
            filtrados.map(p => (
              <div key={p.id} onClick={() => editar(p)} style={{ display: 'flex', gap: 12, padding: '12px 16px', borderBottom: '1px solid var(--gray-100)', cursor: 'pointer', background: (seleccionado as Produto)?.id === p.id ? 'var(--gray-100)' : 'white', alignItems: 'center' }}>
                <div style={{ width: 48, height: 48, borderRadius: 8, overflow: 'hidden', background: 'var(--gray-100)', flexShrink: 0, position: 'relative' }}>
                  {p.imagens?.[0] && <Image src={p.imagens[0]} alt={p.nome} fill style={{ objectFit: 'cover' }} sizes="48px" />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 500, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.nome}</p>
                  <p style={{ fontSize: 12, color: 'var(--gray-400)' }}>{Number(p.preco ?? 0).toFixed(2)} MZN · Stock: {p.stock}</p>
                </div>
                {!p.activo && <span style={{ fontSize: 10, background: 'var(--gray-200)', padding: '2px 6px', borderRadius: 4, color: 'var(--gray-600)' }}>Inactivo</span>}
              </div>
            ))
          }
        </div>
      </div>

      {/* Formulário */}
      <div style={{ flex: 1, overflowY: 'auto', background: '#f8f8f6' }}>
        {!seleccionado ? (
          <div className="empty-state" style={{ paddingTop: 120 }}>
            <div className="icon"><ShoppingBag size={40} strokeWidth={1.5} /></div>
            <h3>Selecciona ou cria um produto</h3>
            <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={novo}>+ Novo produto</button>
          </div>
        ) : (
          <div style={{ padding: 32, maxWidth: 680 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700 }}>{(seleccionado as Produto).id ? 'Editar produto' : 'Novo produto'}</h2>
              <div style={{ display: 'flex', gap: 8 }}>
                {(seleccionado as Produto).id && (
                  <button className="btn btn-danger btn-sm" onClick={() => apagar((seleccionado as Produto).id)}>Apagar</button>
                )}
                <button className="btn btn-outline btn-sm" onClick={() => setSeleccionado(null)}>Cancelar</button>
                <button className="btn btn-primary btn-sm" onClick={salvar} disabled={salvando}>{salvando ? 'A guardar...' : 'Guardar'}</button>
              </div>
            </div>

            <div className="form-card">
              <h2>Informações básicas</h2>
              <div className="form-group"><label>Nome *</label><input value={seleccionado.nome || ''} onChange={f('nome')} /></div>
              <div className="form-group"><label>Descrição</label><textarea value={seleccionado.descricao || ''} onChange={f('descricao')} /></div>
              <div className="form-grid-2">
                <div className="form-group"><label>Preço (MZN) *</label><input type="number" value={seleccionado.preco || ''} onChange={f('preco')} /></div>
                <div className="form-group"><label>Preço original (MZN)</label><input type="number" value={seleccionado.preco_original || ''} onChange={f('preco_original')} /></div>
                <div className="form-group">
                  <label>Categoria</label>
                  {categorias.length > 0 ? (
                    <select value={seleccionado.categoria || ''} onChange={f('categoria')}>
                      <option value="">— Sem categoria —</option>
                      {categorias.map(c => <option key={c} value={c}>{c}</option>)}
                      {seleccionado.categoria && !categorias.includes(seleccionado.categoria) && (
                        <option value={seleccionado.categoria}>{seleccionado.categoria} (nova)</option>
                      )}
                    </select>
                  ) : (
                    <input value={seleccionado.categoria || ''} onChange={f('categoria')} placeholder="Ex: Camisas" />
                  )}
                </div>
                <div className="form-group"><label>Stock</label><input type="number" value={seleccionado.stock || ''} onChange={f('stock')} /></div>
              </div>
              {seleccionado.url_origem && (
                <div className="form-group">
                  <label>URL de origem</label>
                  <p style={{ fontSize: 13, wordBreak: 'break-all' }}>
                    <a href={seleccionado.url_origem} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--gray-600)' }}>{seleccionado.url_origem}</a>
                  </p>
                </div>
              )}
              <div className="form-group" style={{ display: 'flex', gap: 24, alignItems: 'center', marginBottom: 0 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 0 }}>
                  <input type="checkbox" checked={seleccionado.destaque || false} onChange={e => setSeleccionado(s => ({ ...s, destaque: e.target.checked }))} />
                  <span style={{ fontWeight: 500, color: 'var(--gray-600)', fontSize: 13 }}>Produto em destaque</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 0 }}>
                  <input type="checkbox" checked={seleccionado.activo !== false} onChange={e => setSeleccionado(s => ({ ...s, activo: e.target.checked }))} />
                  <span style={{ fontWeight: 500, color: 'var(--gray-600)', fontSize: 13 }}>Activo (visível na loja)</span>
                </label>
              </div>
            </div>

            <div className="form-card">
              <h2>Imagens</h2>
              <input type="file" accept="image/*" onChange={handleUpload} style={{ marginBottom: 12 }} />
              {uploadPct !== null && (
                <div style={{ background: 'var(--gray-200)', borderRadius: 4, marginBottom: 12, height: 4 }}>
                  <div style={{ background: 'var(--black)', height: 4, borderRadius: 4, width: `${uploadPct}%`, transition: 'width 0.3s' }} />
                </div>
              )}
              <div className="img-preview-grid">
                {seleccionado.imagens?.map((img, i) => (
                  <div key={i} className="img-preview">
                    <Image src={img} alt={`img ${i}`} fill style={{ objectFit: 'cover' }} sizes="80px" />
                    <button className="img-preview-remove" onClick={() => setSeleccionado(s => ({ ...s, imagens: s?.imagens?.filter((_, j) => j !== i) }))}><X size={12} strokeWidth={1.5} /></button>
                  </div>
                ))}
              </div>
            </div>

            <div className="form-card">
              <h2>Variantes</h2>
              <div className="form-group">
                <label>Tamanhos (separados por vírgula)</label>
                <input value={seleccionado.tamanhos?.join(', ') || ''} onChange={e => setSeleccionado(s => ({ ...s, tamanhos: e.target.value.split(',').map(t => t.trim()).filter(Boolean) }))} placeholder="XS, S, M, L, XL" />
              </div>
              <div className="form-group">
                <label>Cores (separadas por vírgula)</label>
                <input value={seleccionado.cores?.join(', ') || ''} onChange={e => setSeleccionado(s => ({ ...s, cores: e.target.value.split(',').map(c => c.trim()).filter(Boolean) }))} placeholder="Preto, Branco, Azul" />
              </div>
              <div className="form-group">
                <label>Tags (separadas por vírgula)</label>
                <input value={seleccionado.tags?.join(', ') || ''} onChange={e => setSeleccionado(s => ({ ...s, tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) }))} placeholder="casual, verão, novo" />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
