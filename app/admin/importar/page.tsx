'use client';
import { useState } from 'react';
import Image from 'next/image';
import { criarProduto } from '@/lib/produtos';
import { mostrarToast } from '@/components/Toast';
import type { Produto } from '@/lib/produtos';

interface ScrapeResult {
  nome: string;
  preco: number;
  descricao?: string;
  imagens: string[];
  tamanhos?: string[];
  cores?: string[];
  tags?: string[];
  categoria?: string;
  url: string;
}

export default function AdminImportarPage() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<ScrapeResult | null>(null);
  const [ajustes, setAjustes] = useState<Partial<Produto>>({});
  const [salvando, setSalvando] = useState(false);

  const scrape = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setResultado(null);
    try {
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) throw new Error('Erro ao importar');
      const data = await res.json();
      setResultado(data);
      setAjustes({ nome: data.nome, preco: data.preco, descricao: data.descricao, imagens: data.imagens, tamanhos: data.tamanhos || [], cores: data.cores || [], tags: data.tags || [], categoria: data.categoria || '' });
    } catch {
      mostrarToast('Não foi possível importar este produto', 'error');
    } finally {
      setLoading(false);
    }
  };

  const importar = async () => {
    if (!ajustes.nome) return;
    setSalvando(true);
    try {
      await criarProduto(ajustes);
      mostrarToast('Produto importado com sucesso!', 'success');
      setResultado(null);
      setUrl('');
      setAjustes({});
    } catch {
      mostrarToast('Erro ao guardar produto', 'error');
    } finally {
      setSalvando(false);
    }
  };

  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setAjustes(a => ({ ...a, [k]: e.target.value }));

  return (
    <>
      <div className="admin-topbar">
        <h1>Importar produto via link</h1>
      </div>
      <div className="admin-content" style={{ maxWidth: 760 }}>
        <div className="form-card">
          <h2>URL do produto</h2>
          <p style={{ fontSize: 13, color: 'var(--gray-600)', marginBottom: 16 }}>
            Cola o link de um produto (Temu, Shein, AliExpress, Zara, H&M, etc.)
          </p>
          <div style={{ display: 'flex', gap: 12 }}>
            <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..." style={{ flex: 1, padding: '11px 14px', borderRadius: 10, border: '1.5px solid var(--gray-200)', fontSize: 14, fontFamily: 'Inter, sans-serif', outline: 'none' }} onKeyDown={e => e.key === 'Enter' && scrape()} />
            <button className="btn btn-primary" onClick={scrape} disabled={loading || !url}>
              {loading ? 'A importar...' : 'Importar'}
            </button>
          </div>
          {loading && (
            <div className="loading" style={{ paddingTop: 24 }}><div className="spinner" /> A ler o produto...</div>
          )}
        </div>

        {resultado && (
          <>
            <div className="form-card">
              <h2>Pré-visualização</h2>
              {resultado.imagens?.[0] && (
                <div style={{ position: 'relative', width: '100%', maxWidth: 300, aspectRatio: '1/1', borderRadius: 12, overflow: 'hidden', marginBottom: 16, background: 'var(--gray-100)' }}>
                  <Image src={resultado.imagens[0]} alt={resultado.nome} fill style={{ objectFit: 'contain' }} sizes="300px" />
                </div>
              )}
              <p style={{ fontSize: 12, color: 'var(--gray-400)', marginBottom: 4 }}>Fonte: {resultado.url}</p>
            </div>

            <div className="form-card">
              <h2>Ajustar antes de guardar</h2>
              <div className="form-group"><label>Nome *</label><input value={ajustes.nome || ''} onChange={f('nome')} /></div>
              <div className="form-group"><label>Descrição</label><textarea value={ajustes.descricao || ''} onChange={f('descricao')} /></div>
              <div className="form-grid-2">
                <div className="form-group"><label>Preço (MZN) *</label><input type="number" value={ajustes.preco || ''} onChange={f('preco')} /></div>
                <div className="form-group"><label>Categoria</label><input value={ajustes.categoria || ''} onChange={f('categoria')} /></div>
                <div className="form-group"><label>Stock</label><input type="number" value={ajustes.stock || 0} onChange={f('stock')} /></div>
              </div>
              <div className="form-group">
                <label>Tamanhos (separados por vírgula)</label>
                <input value={ajustes.tamanhos?.join(', ') || ''} onChange={e => setAjustes(a => ({ ...a, tamanhos: e.target.value.split(',').map(t => t.trim()).filter(Boolean) }))} />
              </div>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <button className="btn btn-outline" onClick={() => setResultado(null)}>Cancelar</button>
                <button className="btn btn-primary" onClick={importar} disabled={salvando}>{salvando ? 'A guardar...' : 'Guardar produto'}</button>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
