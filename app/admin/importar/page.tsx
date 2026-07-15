'use client';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { mostrarToast } from '@/components/Toast';
import CookieCapturePopup from '@/components/CookieCapturePopup';
import type { Produto } from '@/lib/produtos';

interface SubSub { nome: string; slug: string; }
interface Sub { nome: string; slug: string; subcategorias?: SubSub[]; }
interface CatTree { nome: string; slug: string; subcategorias: Sub[]; }

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

type EstadoTF = 'verificando' | 'sem_conta' | 'inativo' | 'sem_limite' | 'ok';

export default function AdminImportarPage() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<ScrapeResult | null>(null);
  const [cookiePopupSite, setCookiePopupSite] = useState<string | null>(null);
  const [ajustes, setAjustes] = useState<Partial<Produto>>({});
  const [salvando, setSalvando] = useState(false);
  const [estadoTF, setEstadoTF] = useState<EstadoTF>('verificando');
  const [infoTF, setInfoTF] = useState<{ usados: number; limite: number; plano: string } | null>(null);
  const [catTree, setCatTree] = useState<CatTree[]>([]);

  useEffect(() => {
    fetch('/api/config/categorias').then(r => r.json()).then(d => setCatTree(d.categorias || [])).catch(() => {});

    fetch('/api/tradeflow/conta')
      .then(r => r.json())
      .then(data => {
        const conta = data.conta;
        if (!conta) { setEstadoTF('sem_conta'); return; }
        if (conta.billing_status === 'suspended' || conta.billing_status === 'cancelled') { setEstadoTF('inativo'); return; }
        const restantes = conta.creditos_limite - conta.creditos_usados;
        if (restantes <= 0) { setEstadoTF('sem_limite'); return; }
        setInfoTF({ usados: conta.creditos_usados, limite: conta.creditos_limite, plano: conta.plano_id });
        setEstadoTF('ok');
      })
      .catch(() => setEstadoTF('sem_conta'));
  }, []);

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
      const data = await res.json();

      if (!res.ok) {
        // Créditos esgotados (HTTP 429)
        if (res.status === 429 || data?.upgrade) {
          setEstadoTF('sem_limite');
          mostrarToast('Sem produtos disponíveis este mês. Faz upgrade do plano.', 'error');
          return;
        }
        // Conta suspensa (HTTP 402)
        if (res.status === 402) {
          setEstadoTF('inativo');
          mostrarToast('Conta TradeFlow suspensa. Vai a Integrações → TradeFlow.', 'error');
          return;
        }
        throw new Error(data?.message || data?.error || 'Erro ao importar');
      }

      setResultado(data);
      // Actualiza contador de uso
      if (infoTF) setInfoTF(i => i ? { ...i, usados: i.usados + 1 } : i);
      setAjustes({ nome: data.nome, preco: data.preco, descricao: data.descricao, imagens: data.imagens, tamanhos: data.tamanhos || [], cores: data.cores || [], tags: data.tags || [], categoria: data.categoria || '' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Não foi possível importar este produto';
      const isBlocked = /blocked|cookie/i.test(msg);
      if (isBlocked) {
        try {
          const detectedDomain = new URL(url).hostname.replace(/^www\./, '');
          setCookiePopupSite(detectedDomain);
        } catch {
          mostrarToast(msg, 'error');
        }
      } else {
        mostrarToast(msg, 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const importar = async () => {
    if (!ajustes.nome) return;
    setSalvando(true);
    try {
      const res = await fetch('/api/produtos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ajustes),
      });
      if (!res.ok) throw new Error(await res.text());
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

  const bloqueado = estadoTF !== 'ok' && estadoTF !== 'verificando';

  return (
    <>
      {cookiePopupSite && (
        <CookieCapturePopup
          site={cookiePopupSite}
          onClose={() => setCookiePopupSite(null)}
          onRetry={scrape}
        />
      )}
      <div className="admin-topbar">
        <h1>Importar produto via link</h1>
      </div>
      <div className="admin-content" style={{ maxWidth: 760 }}>

        {/* Banner TradeFlow — só aparece se necessário */}
        {estadoTF === 'verificando' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--gray-50)', border: '1px solid var(--gray-200)', borderRadius: 12, padding: '14px 18px', marginBottom: 20, fontSize: 13, color: 'var(--gray-500)' }}>
            <div className="spinner" style={{ width: 14, height: 14 }} />
            A verificar subscrição TradeFlow...
          </div>
        )}

        {estadoTF === 'sem_conta' && (
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 14, padding: '24px 28px', marginBottom: 20 }}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 24, lineHeight: 1 }}>⚡</span>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 15, fontWeight: 700, color: '#92400e', marginBottom: 6 }}>Precisas de uma subscrição TradeFlow para importar produtos</p>
                <p style={{ fontSize: 13, color: '#b45309', lineHeight: 1.6, marginBottom: 16 }}>
                  A importação automática de produtos (Shein, Temu, Zara, etc.) funciona através do TradeFlow.
                  Para activar, vai ao menu <strong>Integrações → TradeFlow</strong>, escolhe um plano e cria a tua conta.
                </p>
                <div style={{ background: 'rgba(255,255,255,0.6)', border: '1px solid #fde68a', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#92400e' }}>
                  <p style={{ fontWeight: 700, marginBottom: 6 }}>Como activar:</p>
                  <ol style={{ paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <li>No menu lateral, clica em <strong>Integrações</strong></li>
                    <li>Selecciona <strong>TradeFlow</strong></li>
                    <li>Escolhe um plano (começa com o Trial gratuito)</li>
                    <li>Clica em <strong>Subscrever</strong> e preenche o formulário</li>
                    <li>Volta a esta página e importa o teu primeiro produto</li>
                  </ol>
                </div>
                <Link href="/admin/tradeflow" style={{ display: 'inline-block', background: '#d97706', color: 'white', fontWeight: 700, fontSize: 13, padding: '9px 20px', borderRadius: 9, textDecoration: 'none' }}>
                  Ir para TradeFlow →
                </Link>
              </div>
            </div>
          </div>
        )}

        {estadoTF === 'inativo' && (
          <div style={{ background: '#fff0f0', border: '1px solid #ffc0c0', borderRadius: 14, padding: '24px 28px', marginBottom: 20 }}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 24, lineHeight: 1 }}>⚠️</span>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--red)', marginBottom: 6 }}>A tua conta TradeFlow está suspensa</p>
                <p style={{ fontSize: 13, color: 'var(--gray-600)', lineHeight: 1.6, marginBottom: 16 }}>
                  A conta associada a este site foi suspensa ou cancelada. Para voltar a importar produtos, vai ao <strong>TradeFlow</strong> e reactiva a subscrição.
                </p>
                <Link href="/admin/tradeflow" style={{ display: 'inline-block', background: 'var(--red)', color: 'white', fontWeight: 700, fontSize: 13, padding: '9px 20px', borderRadius: 9, textDecoration: 'none' }}>
                  Ver estado da conta →
                </Link>
              </div>
            </div>
          </div>
        )}

        {estadoTF === 'sem_limite' && (
          <div style={{ background: '#fff0f0', border: '1px solid #ffc0c0', borderRadius: 14, padding: '24px 28px', marginBottom: 20 }}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 24, lineHeight: 1 }}>📦</span>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--red)', marginBottom: 6 }}>Limite de produtos atingido este mês</p>
                <p style={{ fontSize: 13, color: 'var(--gray-600)', lineHeight: 1.6, marginBottom: 16 }}>
                  Já usaste todos os produtos disponíveis no teu plano este mês. Podes aguardar a renovação ou fazer upgrade do plano para continuar a importar.
                </p>
                <Link href="/admin/tradeflow" style={{ display: 'inline-block', background: 'var(--black)', color: 'white', fontWeight: 700, fontSize: 13, padding: '9px 20px', borderRadius: 9, textDecoration: 'none' }}>
                  Fazer upgrade do plano →
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Indicador de uso — só aparece quando está ok */}
        {estadoTF === 'ok' && infoTF && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, background: 'var(--gray-50)', border: '1px solid var(--gray-200)', borderRadius: 12, padding: '12px 18px', marginBottom: 20 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>TradeFlow · Plano {infoTF.plano}</span>
                <span style={{ fontSize: 12, color: 'var(--gray-500)', fontVariantNumeric: 'tabular-nums' }}>{infoTF.usados} / {infoTF.limite} produtos</span>
              </div>
              <div style={{ background: 'var(--gray-200)', borderRadius: 100, height: 5 }}>
                <div style={{ height: 5, borderRadius: 100, background: 'var(--black)', width: `${Math.min(100, Math.round((infoTF.usados / infoTF.limite) * 100))}%`, transition: 'width 0.3s' }} />
              </div>
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray-700)', whiteSpace: 'nowrap' }}>
              {infoTF.limite - infoTF.usados} restantes
            </span>
          </div>
        )}

        <div className="form-card" style={{ opacity: bloqueado ? 0.4 : 1, pointerEvents: bloqueado ? 'none' : 'auto' }}>
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
                <div className="form-group">
                  <label>Categoria</label>
                  {catTree.length > 0 ? (
                    <select
                      value={ajustes.categoria || ''}
                      onChange={e => setAjustes(a => ({ ...a, categoria: e.target.value }))}
                    >
                      <option value="">— Sem categoria —</option>
                      {catTree.map(cat => (
                        <optgroup key={cat.slug} label={cat.nome}>
                          <option value={cat.slug}>{cat.nome} (geral)</option>
                          {cat.subcategorias.flatMap(sub => [
                            <option key={sub.slug} value={sub.slug}>{'  '}{sub.nome}</option>,
                            ...(sub.subcategorias || []).map(ss => (
                              <option key={ss.slug} value={ss.slug}>{'    '}· {ss.nome}</option>
                            )),
                          ])}
                        </optgroup>
                      ))}
                      {ajustes.categoria && !catTree.some(c => c.slug === ajustes.categoria || c.subcategorias.some(s => s.slug === ajustes.categoria || (s.subcategorias || []).some(ss => ss.slug === ajustes.categoria))) && (
                        <option value={ajustes.categoria}>{ajustes.categoria} (nova)</option>
                      )}
                    </select>
                  ) : (
                    <input value={ajustes.categoria || ''} onChange={f('categoria')} placeholder="Ex: Camisas" />
                  )}
                </div>
                <div className="form-group"><label>Stock</label><input type="number" value={ajustes.stock || 0} onChange={f('stock')} /></div>
              </div>
              <div className="form-group">
                <label>Tamanhos (separados por vírgula)</label>
                <input value={ajustes.tamanhos?.join(', ') || ''} onChange={e => setAjustes(a => ({ ...a, tamanhos: e.target.value.split(',').map(t => t.trim()).filter(Boolean) }))} />
              </div>
              <div className="form-group">
                <label>Cores (separadas por vírgula)</label>
                <input value={(ajustes.cores as string[] | undefined)?.join(', ') || ''} onChange={e => setAjustes(a => ({ ...a, cores: e.target.value.split(',').map(t => t.trim()).filter(Boolean) }))} placeholder="Ex: Preto, Branco, Azul" />
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
