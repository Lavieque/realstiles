'use client';
import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from '@/components/CloudImage';
import Link from 'next/link';
import { Zap, AlertTriangle, Package, ExternalLink, Puzzle } from 'lucide-react';
import { mostrarToast } from '@/components/Toast';
import CookieCapturePopup from '@/components/CookieCapturePopup';
import type { Produto } from '@/lib/produtos';
import { aplicarTaxas, detalharTaxas } from '@/lib/taxas';
import type { Taxa } from '@/lib/taxas';

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
  colorImagesMap?: Record<string, string[]> | null;
  url: string;
  fonte?: string;
}

type EstadoTF = 'verificando' | 'sem_conta' | 'inativo' | 'sem_limite' | 'ok';

const isTemu = (u: string) => { try { return new URL(u).hostname.includes('temu.com'); } catch { return false; } };
const gerarToken = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const extensaoActiva = () => {
  const ts = parseInt(localStorage.getItem('tradeflow_importer_ts') || '0', 10);
  return Date.now() - ts < 60_000; // visibilitychange refresca ao voltar à aba; 60s cobre throttle do browser
};

export default function Page() {
  return <Suspense><AdminImportarPage /></Suspense>;
}

function AdminImportarPage() {
  const searchParams = useSearchParams();
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<ScrapeResult | null>(null);
  const [cookiePopupSite, setCookiePopupSite] = useState<string | null>(null);
  const [ajustes, setAjustes] = useState<Partial<Produto>>({});
  const [salvando, setSalvando] = useState(false);
  const [estadoTF, setEstadoTF] = useState<EstadoTF>('verificando');
  const [infoTF, setInfoTF] = useState<{ usados: number; limite: number; plano: string; fontes: string[] } | null>(null);
  const [catTree, setCatTree] = useState<CatTree[]>([]);
  const [imagemAtiva, setImagemAtiva] = useState(0);
  const [corAtiva, setCorAtiva] = useState<string | null>(null);
  const [taxas, setTaxas] = useState<Taxa[]>([]);

  // Modo Temu via extensão
  const [temuPopup, setTemuPopup] = useState<'url' | 'manual' | null>(null);
  const [temuToken, setTemuToken] = useState('');
  const [temuAguardar, setTemuAguardar] = useState(false);
  const [extensaoInstalada, setExtensaoInstalada] = useState<boolean | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const iniciarTemuEspera = (modo: 'url' | 'manual') => {
    const instalada = extensaoActiva();
    setExtensaoInstalada(instalada);
    const token = gerarToken();
    setTemuToken(token);
    setTemuPopup(modo);
    setTemuAguardar(instalada); // só começa a aguardar se extensão estiver instalada
    if (instalada) localStorage.setItem('rs_temu_token', token);

    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/import/temu?token=${token}`);
        const data = await res.json();
        if (data.ready && data.produto) {
          clearInterval(pollingRef.current!);
          setTemuAguardar(false);
          setTemuPopup(null);
          localStorage.removeItem('rs_temu_token');
          const p = data.produto;
          setResultado(p);
          setImagemAtiva(0);
          setAjustes({ nome: p.nome, preco: aplicarTaxas(p.preco, taxas), descricao: p.descricao, imagens: p.imagens, tamanhos: p.tamanhos || [], cores: p.cores || [], tags: p.tags || [], categoria: p.categoria || '' });
        }
      } catch { /* silencioso */ }
    }, 2000);
  };

  const confirmarExtensaoInstalada = () => {
    setExtensaoInstalada(true);
    setTemuAguardar(true);
    localStorage.setItem('rs_temu_token', temuToken);
    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/import/temu?token=${temuToken}`);
        const data = await res.json();
        if (data.ready && data.produto) {
          clearInterval(pollingRef.current!);
          setTemuAguardar(false);
          setTemuPopup(null);
          localStorage.removeItem('rs_temu_token');
          const p = data.produto;
          setResultado(p);
          setImagemAtiva(0);
          setAjustes({ nome: p.nome, preco: aplicarTaxas(p.preco, taxas), descricao: p.descricao, imagens: p.imagens, tamanhos: p.tamanhos || [], cores: p.cores || [], tags: p.tags || [], categoria: p.categoria || '' });
        }
      } catch { /* silencioso */ }
    }, 2000);
  };

  const cancelarTemuEspera = () => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    setTemuPopup(null);
    setTemuAguardar(false);
    setTemuToken('');
    localStorage.removeItem('rs_temu_token');
  };

  useEffect(() => () => { if (pollingRef.current) clearInterval(pollingRef.current); }, []);

  // Extensão pode abrir esta página com ?temu_token= quando não havia tab aberta
  useEffect(() => {
    const token = searchParams.get('temu_token');
    if (!token || pollingRef.current) return;
    setExtensaoInstalada(true);
    setTemuToken(token);
    setTemuPopup('manual');
    setTemuAguardar(true);
    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/import/temu?token=${token}`);
        const data = await res.json();
        if (data.ready && data.produto) {
          clearInterval(pollingRef.current!);
          setTemuAguardar(false);
          setTemuPopup(null);
          const p = data.produto;
          setResultado(p);
          setImagemAtiva(0);
          setAjustes({ nome: p.nome, preco: aplicarTaxas(p.preco, taxas), descricao: p.descricao, imagens: p.imagens, tamanhos: p.tamanhos || [], cores: p.cores || [], tags: p.tags || [], categoria: p.categoria || '' });
        }
      } catch { /* silencioso */ }
    }, 2000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetch('/api/config/categorias').then(r => r.json()).then(d => setCatTree(d.categorias || [])).catch(() => {});
    fetch('/api/config/taxas').then(r => r.json()).then(d => setTaxas(d.itens || [])).catch(() => {});

    fetch('/api/tradeflow/conta')
      .then(r => r.json())
      .then(data => {
        const conta = data.conta;
        if (!conta) { setEstadoTF('sem_conta'); return; }
        if (conta.billing_status === 'suspended' || conta.billing_status === 'cancelled') { setEstadoTF('inativo'); return; }
        const planos: { id: string; fontes?: string[]; tipo?: string }[] = data.planos ?? [];
        const plano = planos.find(p => p.id === conta.plano_id);
        const isPack = plano?.tipo === 'avulso';
        const limite = isPack ? (conta.creditos_extra ?? 0) : (conta.creditos_limite + (conta.creditos_extra ?? 0));
        const restantes = limite - (isPack ? 0 : conta.creditos_usados);
        if (restantes <= 0) { setEstadoTF('sem_limite'); return; }
        const fontes = plano?.fontes ?? [];
        setInfoTF({ usados: isPack ? 0 : conta.creditos_usados, limite, plano: conta.plano_id, fontes });
        setEstadoTF('ok');
      })
      .catch(() => setEstadoTF('sem_conta'));
  }, []);

  const scrape = async () => {
    if (!url.trim()) return;
    // Temu não suporta scraping automático — usar extensão
    if (isTemu(url)) {
      iniciarTemuEspera('url');
      return;
    }
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
        // Site bloqueado — mostrar popup de cookies
        if (data?.needs_cookies) {
          try {
            const detectedDomain = new URL(url).hostname.replace(/^www\./, '');
            setCookiePopupSite(detectedDomain);
          } catch {
            mostrarToast(data?.error || 'Não foi possível importar este produto', 'error');
          }
          return;
        }
        throw new Error(data?.message || data?.error || 'Erro ao importar');
      }

      setResultado(data);
      setImagemAtiva(0);
      // Actualiza contador de uso
      if (infoTF) setInfoTF(i => i ? { ...i, usados: i.usados + 1 } : i);
      setAjustes({ nome: data.nome, preco: aplicarTaxas(data.preco, taxas), descricao: data.descricao, imagens: data.imagens, tamanhos: data.tamanhos || [], cores: data.cores || [], tags: data.tags || [], categoria: data.categoria || '' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Não foi possível importar este produto';
      mostrarToast(msg, 'error');
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
        body: JSON.stringify({ ...ajustes, fonte: resultado?.fonte, url_origem: resultado?.url }),
      });
      if (res.status === 402 || res.status === 403) {
        const data = await res.json();
        mostrarToast(data.error || 'Sem acesso. Vai a Admin → TradeFlow para fazer upgrade.', 'error');
        return;
      }
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
          url={url}
          onClose={() => setCookiePopupSite(null)}
          onRetry={scrape}
        />
      )}

      {/* Popup Temu — extensão de browser */}
      {temuPopup && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'var(--white)', borderRadius: 18, padding: '32px 36px', maxWidth: 480, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            {/* Cabeçalho */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: '#ff6100', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Puzzle size={22} color="white" strokeWidth={1.5} />
              </div>
              <div>
                <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--black)' }}>Importar da Temu</p>
                <p style={{ fontSize: 12, color: 'var(--gray-500)' }}>
                  {extensaoInstalada === false ? 'Passo 1 de 2 — Instalar extensão' : 'Passo 2 de 2 — Usar extensão'}
                </p>
              </div>
            </div>

            {/* PASSO 1 — extensão não instalada */}
            {extensaoInstalada === false && (
              <>
                <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 12, padding: '14px 16px', marginBottom: 20, fontSize: 13, color: '#9a3412', lineHeight: 1.6 }}>
                  A Temu usa proteções anti-bot que impedem o scraping automático. É necessária a extensão <strong>TradeFlow Importer</strong> para fazer a importação.
                </div>

                <a
                  href="/downloads/tradeflow-importer.zip"
                  download
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: '#ff6100', color: 'white', borderRadius: 10, padding: '12px 16px', fontSize: 14, fontWeight: 700, textDecoration: 'none', marginBottom: 16 }}
                >
                  <ExternalLink size={15} strokeWidth={2} />
                  Descarregar TradeFlow Importer
                </a>

                <div style={{ background: 'var(--gray-50)', border: '1px solid var(--gray-200)', borderRadius: 12, padding: '14px 16px', marginBottom: 20 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-600)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Como instalar</p>
                  <ol style={{ paddingLeft: 18, fontSize: 13, color: 'var(--gray-700)', lineHeight: 2 }}>
                    <li>Descomprime o ficheiro .zip descarregado</li>
                    <li>Abre o Chrome e vai a <strong>chrome://extensions</strong></li>
                    <li>Activa o <strong>Modo de programador</strong> (canto superior direito)</li>
                    <li>Clica em <strong>"Carregar sem compressão"</strong> e selecciona a pasta</li>
                    <li>Nas definições da extensão, introduz o URL deste site</li>
                  </ol>
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="btn btn-outline" onClick={cancelarTemuEspera} style={{ flex: 1 }}>Cancelar</button>
                  <button className="btn btn-primary" onClick={confirmarExtensaoInstalada} style={{ flex: 1 }}>Já instalei →</button>
                </div>
              </>
            )}

            {/* PASSO 2 — extensão instalada, aguardar uso */}
            {extensaoInstalada === true && (
              <>
                <ol style={{ paddingLeft: 20, fontSize: 13, color: 'var(--gray-700)', lineHeight: 1.9, marginBottom: 20 }}>
                  <li>
                    {temuPopup === 'url'
                      ? <><strong>Abre o produto</strong> que tentaste importar na Temu</>
                      : <>Navega até ao produto que queres importar na Temu</>
                    }
                  </li>
                  <li>Clica no ícone da extensão <strong>TradeFlow Importer</strong> na barra do Chrome</li>
                  <li>Clica em <strong>"Importar este produto"</strong></li>
                  <li>Esta página actualiza automaticamente</li>
                </ol>

                {temuPopup === 'url' && url && (
                  <a href={url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--gray-50)', border: '1px solid var(--gray-200)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: 'var(--black)', textDecoration: 'none', marginBottom: 16, fontWeight: 600 }}>
                    <ExternalLink size={14} strokeWidth={2} />
                    Abrir produto na Temu
                  </a>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, fontSize: 13, color: 'var(--gray-500)' }}>
                    <div className="spinner" style={{ width: 14, height: 14 }} />
                    À espera da extensão...
                  </div>
                  <button className="btn btn-outline" onClick={cancelarTemuEspera}>Cancelar</button>
                </div>
              </>
            )}
          </div>
        </div>
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
              <Zap size={24} strokeWidth={1.5} style={{ color: '#d97706', flexShrink: 0 }} />
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
              <AlertTriangle size={24} strokeWidth={1.5} style={{ color: 'var(--red)', flexShrink: 0 }} />
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
              <Package size={24} strokeWidth={1.5} style={{ color: 'var(--red)', flexShrink: 0 }} />
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

        {/* Instruções por fonte — só aparece quando ok e há fontes */}
        {estadoTF === 'ok' && infoTF && infoTF.fontes.length > 0 && (
          <div style={{ background: 'var(--gray-50)', border: '1px solid var(--gray-200)', borderRadius: 14, padding: '18px 20px', marginBottom: 20 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 14 }}>Como importar</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {infoTF.fontes.map(fonte => {
                const info: Record<string, { label: string; instrucao: string }> = {
                  temu: { label: 'Temu', instrucao: 'Cola o link do produto no campo abaixo — ou clica em "Importar da Temu via extensão" — e segue as instruções (requer a extensão TradeFlow Importer instalada no Chrome).' },
                  shein: { label: 'Shein', instrucao: 'Cola o link do produto no campo abaixo e clica Importar.' },
                  aliexpress: { label: 'AliExpress', instrucao: 'Cola o link do produto no campo abaixo e clica Importar.' },
                  zara: { label: 'Zara', instrucao: 'Cola o link do produto no campo abaixo e clica Importar.' },
                  hm: { label: 'H&M', instrucao: 'Cola o link do produto no campo abaixo e clica Importar.' },
                  mango: { label: 'Mango', instrucao: 'Cola o link do produto no campo abaixo e clica Importar.' },
                  pull: { label: 'Pull&Bear', instrucao: 'Cola o link do produto no campo abaixo e clica Importar.' },
                  bershka: { label: 'Bershka', instrucao: 'Cola o link do produto no campo abaixo e clica Importar.' },
                };
                const f = info[fonte] ?? { label: fonte, instrucao: 'Cola o link do produto no campo abaixo e clica Importar.' };
                return (
                  <div key={fonte} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--black)', background: 'var(--gray-200)', borderRadius: 6, padding: '2px 8px', whiteSpace: 'nowrap', marginTop: 1 }}>{f.label}</span>
                    <span style={{ fontSize: 13, color: 'var(--gray-600)', lineHeight: 1.5 }}>{f.instrucao}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="form-card" style={{ opacity: bloqueado ? 0.4 : 1, pointerEvents: bloqueado ? 'none' : 'auto' }}>
          <h2>URL do produto</h2>
          <p style={{ fontSize: 13, color: 'var(--gray-600)', marginBottom: 16 }}>
            Cola o link de um produto (Shein, AliExpress, Zara, H&M, etc.)
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

          {/* Divisor Temu */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0 16px' }}>
            <div style={{ flex: 1, height: 1, background: 'var(--gray-200)' }} />
            <span style={{ fontSize: 11, color: 'var(--gray-400)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>ou</span>
            <div style={{ flex: 1, height: 1, background: 'var(--gray-200)' }} />
          </div>
          <button
            className="btn btn-outline"
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, borderColor: '#ff6100', color: '#ff6100' }}
            onClick={() => iniciarTemuEspera('manual')}
          >
            <Puzzle size={15} strokeWidth={2} />
            Importar da Temu via extensão
          </button>
        </div>

        {resultado && (
          <>
            <div className="form-card">
              <h2>Pré-visualização</h2>
              {resultado.colorImagesMap && Object.keys(resultado.colorImagesMap).length > 1 && (
                <div style={{ marginBottom: 14 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-500)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Imagens por cor</p>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {Object.entries(resultado.colorImagesMap).map(([cor, imgs]) => (
                      <button
                        key={cor}
                        onClick={() => {
                          setCorAtiva(cor);
                          setAjustes(a => ({ ...a, imagens: imgs }));
                          setImagemAtiva(0);
                        }}
                        style={{ padding: '5px 12px', borderRadius: 20, border: `2px solid ${corAtiva === cor ? 'var(--black)' : 'var(--gray-200)'}`, background: corAtiva === cor ? 'var(--black)' : 'transparent', color: corAtiva === cor ? 'white' : 'var(--gray-700)', fontSize: 13, cursor: 'pointer', fontWeight: corAtiva === cor ? 600 : 400 }}
                      >
                        {cor}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {resultado.imagens?.length > 0 && (() => {
                const imagens = (ajustes.imagens as string[] | undefined) ?? resultado.imagens;
                if (!imagens.length) return <p style={{ fontSize: 13, color: 'var(--gray-400)', marginBottom: 12 }}>Todas as imagens foram removidas.</p>;
                return (
                <>
                  {/* Imagem principal */}
                  <div style={{ position: 'relative', width: '100%', aspectRatio: '1/1', borderRadius: 12, overflow: 'hidden', marginBottom: 12, background: 'var(--gray-100)' }}>
                    <Image src={imagens[imagemAtiva] ?? imagens[0]} alt={resultado.nome} fill style={{ objectFit: 'contain' }} sizes="700px" />
                    {imagens.length > 1 && (
                      <>
                        <button onClick={() => setImagemAtiva(i => (i - 1 + imagens.length) % imagens.length)} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.45)', border: 'none', color: 'white', borderRadius: 8, width: 36, height: 36, fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
                        <button onClick={() => setImagemAtiva(i => (i + 1) % imagens.length)} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.45)', border: 'none', color: 'white', borderRadius: 8, width: 36, height: 36, fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
                        <div style={{ position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.45)', color: 'white', fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20 }}>{imagemAtiva + 1} / {imagens.length}</div>
                      </>
                    )}
                  </div>
                  {/* Thumbnails */}
                  {imagens.length > 1 && (
                    <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, marginBottom: 12 }}>
                      {imagens.map((img, i) => (
                        <div key={i} style={{ flexShrink: 0, position: 'relative' }}>
                          <button onClick={() => setImagemAtiva(i)} style={{ width: 64, height: 64, borderRadius: 8, overflow: 'hidden', border: `2px solid ${i === imagemAtiva ? 'var(--black)' : 'var(--gray-200)'}`, background: 'var(--gray-100)', cursor: 'pointer', padding: 0, position: 'relative', display: 'block' }}>
                            <Image src={img} alt={`Imagem ${i + 1}`} fill style={{ objectFit: 'cover' }} sizes="64px" />
                          </button>
                          <button onClick={() => {
                            const novas = imagens.filter((_, j) => j !== i);
                            setAjustes(a => ({ ...a, imagens: novas }));
                            setImagemAtiva(idx => Math.min(idx, Math.max(0, novas.length - 1)));
                          }} style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', background: '#ef4444', border: '2px solid white', color: 'white', fontSize: 11, lineHeight: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>×</button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
                );
              })()}
              <p style={{ fontSize: 12, color: 'var(--gray-400)', marginBottom: 4, wordBreak: 'break-all', overflowWrap: 'anywhere' }}>Fonte: <a href={resultado.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--gray-400)' }}>{resultado.url}</a></p>
              {taxas.length > 0 && (
                <div style={{ background: 'var(--gray-50)', border: '1px solid var(--gray-200)', borderRadius: 10, padding: '10px 14px', marginTop: 8 }}>
                  <p style={{ fontSize: 12, color: 'var(--gray-500)', marginBottom: 6 }}>Preço da fonte: {Number(resultado.preco || 0).toFixed(2)} MZN</p>
                  {detalharTaxas(resultado.preco || 0, taxas).map((t, i) => (
                    <p key={i} style={{ fontSize: 12, color: 'var(--gray-500)', display: 'flex', justifyContent: 'space-between' }}>
                      <span>+ {t.nome} ({t.descricao})</span>
                      <span>{t.valorAplicado.toFixed(2)} MZN</span>
                    </p>
                  ))}
                  <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--black)', display: 'flex', justifyContent: 'space-between', marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--gray-200)' }}>
                    <span>Preço final sugerido</span>
                    <span>{aplicarTaxas(resultado.preco || 0, taxas).toFixed(2)} MZN</span>
                  </p>
                </div>
              )}
            </div>

            <div className="form-card">
              <h2>Ajustar antes de guardar</h2>
              <div className="form-group"><label>Nome *</label><input value={ajustes.nome || ''} onChange={f('nome')} /></div>
              <div className="form-group"><label>Descrição</label><textarea value={ajustes.descricao || ''} onChange={f('descricao')} /></div>
              <div className="form-grid-2">
                <div className="form-group"><label>Preço (MZN) *</label><input type="number" value={ajustes.preco || ''} onChange={f('preco')} /></div>
                <div className="form-group">
                  <label>Preço original (MZN) <span style={{ color: 'var(--gray-400)', fontWeight: 400 }}>(opcional — marca como promoção)</span></label>
                  <input type="number" value={ajustes.preco_original || ''} onChange={f('preco_original')} />
                  {!!ajustes.preco_original && (
                    <p style={{ fontSize: 12, marginTop: 4, color: Number(ajustes.preco_original) > Number(ajustes.preco || 0) ? 'var(--green)' : 'var(--gray-500)' }}>
                      {Number(ajustes.preco_original) > Number(ajustes.preco || 0) ? '✓ Em promoção' : 'Não conta como promoção (tem de ser maior que o preço final)'}
                    </p>
                  )}
                </div>
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
