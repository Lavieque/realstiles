'use client';
import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useCarrinho } from '@/store/carrinho';
import { mostrarToast } from '@/components/Toast';
import ProdutoCard from '@/components/ProdutoCard';
import { getProduto as getProdutoClient, getProdutos } from '@/lib/produtos';
import type { Produto } from '@/lib/produtos';

const COR_MAP: Record<string, string> = {
  'preto':'#111','branco':'#fff','cinzento':'#888','cinza':'#888',
  'vermelho':'#e53e3e','azul':'#3182ce','verde':'#38a169','amarelo':'#ecc94b',
  'laranja':'#ed8936','rosa':'#ed64a6','roxo':'#805ad5','púrpura':'#805ad5',
  'castanho':'#a0522d','marrom':'#a0522d','bege':'#f5f0e0','creme':'#fffdd0',
  'bordeaux':'#800020','vinho':'#722f37','camel':'#c19a6b','cáqui':'#c3b091',
  'nude':'#e3bc9a','dourado':'#cfb53b','prateado':'#c0c0c0',
  'azul-marinho':'#002366','marinho':'#002366','navy':'#001f5b',
  'salmão':'#fa8072','turquesa':'#40e0d0',
  'grey':'#888','gray':'#888','black':'#111','white':'#fff',
  'red':'#e53e3e','blue':'#3182ce','green':'#38a169','yellow':'#ecc94b',
  'orange':'#ed8936','pink':'#ed64a6','purple':'#805ad5','brown':'#a0522d',
  'beige':'#f5f0e0','cream':'#fffdd0','gold':'#cfb53b','silver':'#c0c0c0',
  'khaki':'#c3b091','coral':'#ff7f50','mint':'#98ff98','lilac':'#c8a2c8',
  'olive':'#808000','teal':'#008080','burgundy':'#800020','wine':'#722f37',
  'charcoal':'#36454f','ivory':'#fffff0','indigo':'#4b0082','violet':'#ee82ee',
};

function corParaCSS(nome: string): string {
  const chave = nome.toLowerCase().trim();
  if (COR_MAP[chave]) return COR_MAP[chave];
  let h = 0;
  for (let i = 0; i < nome.length; i++) h = (h * 31 + nome.charCodeAt(i)) & 0xffffff;
  return '#' + (h & 0xffffff).toString(16).padStart(6, '0');
}

export default function ProdutoDetalhe({
  id,
  produto: initialProduto,
  relacionados: initialRelacionados,
}: {
  id: string;
  produto: Produto | null;
  relacionados: Produto[];
}) {
  const [produto, setProduto] = useState<Produto | null>(initialProduto);
  const [relacionados, setRelacionados] = useState<Produto[]>(initialRelacionados);
  const [loading, setLoading] = useState(!initialProduto);
  const [imgIdx, setImgIdx] = useState(0);
  const [fade, setFade] = useState(false);
  const [tamanho, setTamanho] = useState('');
  const [cor, setCor] = useState('');
  const [quantidade, setQuantidade] = useState(1);
  const touchStartX = useRef(0);
  const { adicionarItem, abrirDrawer } = useCarrinho();

  useEffect(() => {
    if (initialProduto) {
      setTamanho(initialProduto.tamanhos?.[0] || '');
      setCor(initialProduto.cores?.[0] || '');
      setLoading(false);
      // Relacionados já vêm do servidor — só busca no cliente se não vieram
      if (initialRelacionados.length === 0 && initialProduto.categoria) {
        getProdutos({ categoria: initialProduto.categoria, max: 5 })
          .then(rel => setRelacionados(rel.filter(r => r.id !== id).slice(0, 4)))
          .catch(() => {});
      }
      return;
    }
    getProdutoClient(id).then(p => {
      setProduto(p);
      setTamanho(p?.tamanhos?.[0] || '');
      setCor(p?.cores?.[0] || '');
      if (p?.categoria) {
        getProdutos({ categoria: p.categoria, max: 5 })
          .then(rel => setRelacionados(rel.filter(r => r.id !== id).slice(0, 4)))
          .catch(() => {});
      }
    }).catch(() => setProduto(null)).finally(() => setLoading(false));
  }, [id, initialProduto]);

  if (loading) return (
    <div className="page-wrapper">
      <div className="container">
        <div className="loading" style={{ paddingTop: 80 }}><div className="spinner" /> A carregar produto...</div>
      </div>
    </div>
  );

  if (!produto) return (
    <div className="page-wrapper">
      <div className="container">
        <div className="empty-state" style={{ paddingTop: 80 }}>
          <div className="icon">😕</div>
          <h3>Produto não encontrado</h3>
          <p>Este produto pode ter sido removido ou o link está incorrecto.</p>
          <Link href="/" className="btn btn-primary" style={{ marginTop: 20 }}>Voltar à loja</Link>
        </div>
      </div>
    </div>
  );

  const imagens = produto.imagens?.length ? produto.imagens : [];
  const temVarias = imagens.length > 1;

  const irParaImagem = (idx: number) => {
    const next = (idx + imagens.length) % imagens.length;
    setFade(true);
    setTimeout(() => { setImgIdx(next); setFade(false); }, 150);
  };

  const desconto = produto.preco_original && produto.preco_original > produto.preco
    ? Math.round((1 - produto.preco / produto.preco_original) * 100)
    : 0;

  const handleAdd = () => {
    if (produto.tamanhos?.length > 0 && !tamanho) {
      mostrarToast('Selecciona um tamanho', 'error');
      return;
    }
    for (let i = 0; i < quantidade; i++) adicionarItem(produto, tamanho, cor);
    const nome = produto.nome.length > 30 ? produto.nome.substring(0, 30) + '…' : produto.nome;
    mostrarToast(`"${nome}" adicionado ao carrinho!`, 'success');
    abrirDrawer();
  };

  return (
    <div className="page-wrapper">
      <div className="container" style={{ paddingTop: 40, paddingBottom: 80 }}>

        {/* Breadcrumb */}
        <div className="pd-breadcrumb">
          <Link href="/">Loja</Link>
          <span>›</span>
          {produto.categoria
            ? <Link href={`/?cat=${produto.categoria}`}>{produto.categoria.charAt(0).toUpperCase() + produto.categoria.slice(1)}</Link>
            : <span>Produto</span>
          }
          <span>›</span>
          <span style={{ color: 'var(--black)', fontWeight: 500 }}>{produto.nome}</span>
        </div>

        {/* Grid principal */}
        <div className="pd-grid">

          {/* ── GALERIA ── */}
          <div className="pd-galeria">

            {/* Thumbnails verticais */}
            {temVarias && (
              <div className="pd-thumbs">
                {imagens.map((src, i) => (
                  <button
                    key={i}
                    className={`pd-thumb${i === imgIdx ? ' active' : ''}`}
                    onClick={() => irParaImagem(i)}
                  >
                    <Image src={src} alt={`${produto.nome} ${i + 1}`} fill style={{ objectFit: 'cover' }} sizes="72px" />
                  </button>
                ))}
              </div>
            )}

            {/* Imagem principal */}
            <div className="pd-main-wrap">
              <div
                className="pd-main"
                onTouchStart={e => { touchStartX.current = e.touches[0].clientX; }}
                onTouchEnd={e => {
                  const dx = e.changedTouches[0].clientX - touchStartX.current;
                  if (Math.abs(dx) > 40) irParaImagem(imgIdx + (dx < 0 ? 1 : -1));
                }}
              >
                {imagens[imgIdx] && (
                  <Image
                    src={imagens[imgIdx]}
                    alt={produto.nome}
                    fill
                    style={{ objectFit: 'cover', opacity: fade ? 0 : 1, transition: 'opacity 0.2s ease' }}
                    sizes="45vw"
                    priority
                  />
                )}
                {desconto > 0 && (
                  <span className="pd-badge-sale">-{desconto}%</span>
                )}
              </div>

              {/* Setas */}
              {temVarias && (
                <>
                  <button className="pd-arrow prev" onClick={() => irParaImagem(imgIdx - 1)} disabled={imgIdx === 0}>&#8249;</button>
                  <button className="pd-arrow next" onClick={() => irParaImagem(imgIdx + 1)} disabled={imgIdx === imagens.length - 1}>&#8250;</button>
                </>
              )}

              {/* Dots */}
              {temVarias && (
                <div className="pd-dots">
                  {imagens.map((_, i) => (
                    <button key={i} className={`pd-dot${i === imgIdx ? ' active' : ''}`} onClick={() => irParaImagem(i)} />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── INFO ── */}
          <div className="pd-info">
            {produto.categoria && (
              <p className="pd-categoria">{produto.categoria.charAt(0).toUpperCase() + produto.categoria.slice(1)}</p>
            )}

            <h1 className="pd-nome">{produto.nome}</h1>

            <div className="pd-precos">
              <span className="pd-preco-atual">{Number(produto.preco || 0).toFixed(2)} MZN</span>
              {produto.preco_original && produto.preco_original > produto.preco && (
                <span className="pd-preco-orig">{Number(produto.preco_original).toFixed(2)} MZN</span>
              )}
            </div>

            {produto.descricao && (
              <p className="pd-descricao">{produto.descricao}</p>
            )}

            {/* Tamanhos */}
            {produto.tamanhos?.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <p className="pd-opcao-label">Tamanho: <span>{tamanho || '—'}</span></p>
                <div className="tamanhos-grid">
                  {produto.tamanhos.map(t => (
                    <button key={t} className={`tamanho-btn${tamanho === t ? ' active' : ''}`} onClick={() => setTamanho(t)}>{t}</button>
                  ))}
                </div>
              </div>
            )}

            {/* Cores */}
            {produto.cores?.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <p className="pd-opcao-label">Cor: <span>{cor || '—'}</span></p>
                <div className="cores-grid">
                  {produto.cores.map(c => (
                    <button
                      key={c}
                      className={`pd-cor-swatch${cor === c ? ' active' : ''}`}
                      style={{ backgroundColor: corParaCSS(c) }}
                      title={c}
                      onClick={() => setCor(c)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Quantidade */}
            <div style={{ marginBottom: 20 }}>
              <p className="pd-opcao-label">Quantidade</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button
                  onClick={() => setQuantidade(q => Math.max(1, q - 1))}
                  style={{ width: 36, height: 36, border: '1.5px solid var(--gray-200)', borderRadius: 8, background: 'white', cursor: 'pointer', fontSize: 18 }}
                >−</button>
                <span style={{ fontWeight: 600, minWidth: 24, textAlign: 'center' }}>{quantidade}</span>
                <button
                  onClick={() => setQuantidade(q => Math.min(produto.stock || 99, q + 1))}
                  style={{ width: 36, height: 36, border: '1.5px solid var(--gray-200)', borderRadius: 8, background: 'white', cursor: 'pointer', fontSize: 18 }}
                >+</button>
              </div>
            </div>

            {produto.stock > 0 && produto.stock <= 5 && (
              <p style={{ fontSize: 13, color: 'var(--red)', fontWeight: 600, marginBottom: 10 }}>
                ⚠ Apenas {produto.stock} unidade{produto.stock !== 1 ? 's' : ''} disponível{produto.stock !== 1 ? 'eis' : ''}!
              </p>
            )}

            <button
              className="btn btn-primary btn-lg btn-full"
              onClick={handleAdd}
              disabled={produto.stock === 0}
              style={{ marginBottom: 10, ...(produto.stock === 0 ? { opacity: 0.4, cursor: 'not-allowed' } : {}) }}
            >
              {produto.stock === 0 ? 'Sem stock' : '+ Adicionar ao carrinho'}
            </button>

            <Link href="/carrinho" className="btn btn-outline btn-full">Ver carrinho</Link>

            {/* Partilhar */}
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`${produto.nome} — ${Number(produto.preco || 0).toFixed(2)} MZN\n${typeof window !== 'undefined' ? window.location.href : ''}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline btn-sm"
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                Partilhar no WhatsApp
              </a>
              <button
                className="btn btn-outline btn-sm"
                style={{ padding: '8px 14px' }}
                title="Copiar link"
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href);
                  mostrarToast('Link copiado!', 'success');
                }}
              >
                🔗
              </button>
            </div>

            {/* Tags */}
            {produto.tags?.length > 0 && (
              <div style={{ marginTop: 24, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {produto.tags.map(tag => (
                  <span key={tag} style={{ fontSize: 12, padding: '4px 12px', borderRadius: 100, background: 'var(--gray-100)', color: 'var(--gray-600)' }}>{tag}</span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Relacionados */}
        {relacionados.length > 0 && (
          <section style={{ marginTop: 64 }}>
            <h2 style={{ fontFamily: 'var(--font-playfair, "Playfair Display"), serif', fontSize: '1.6rem', marginBottom: 24 }}>Também podes gostar</h2>
            <div className="produtos-grid">
              {relacionados.map(p => <ProdutoCard key={p.id} produto={p} />)}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
