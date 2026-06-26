'use client';
import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useCarrinho } from '@/store/carrinho';
import { mostrarToast } from '@/components/Toast';
import ProdutoCard from '@/components/ProdutoCard';
import type { Produto } from '@/lib/produtos';

export default function ProdutoDetalhe({ produto, relacionados }: { produto: Produto; relacionados: Produto[] }) {
  const [imgActual, setImgActual] = useState(0);
  const [tamanho, setTamanho] = useState(produto.tamanhos?.[0] || '');
  const [cor, setCor] = useState(produto.cores?.[0] || '');
  const [quantidade, setQuantidade] = useState(1);
  const { adicionarItem, abrirDrawer } = useCarrinho();

  const handleAdd = () => {
    if (produto.tamanhos?.length > 0 && !tamanho) {
      mostrarToast('Selecciona um tamanho', 'error');
      return;
    }
    for (let i = 0; i < quantidade; i++) {
      adicionarItem(produto, tamanho, cor);
    }
    mostrarToast(`"${produto.nome}" adicionado ao carrinho!`, 'success');
    abrirDrawer();
  };

  const img = produto.imagens?.[imgActual] || produto.imagens?.[0] || 'https://via.placeholder.com/600x600?text=Sem+Imagem';

  return (
    <div className="page-wrapper">
      <div className="container" style={{ paddingTop: 40, paddingBottom: 80 }}>
        {/* Breadcrumb */}
        <nav style={{ fontSize: 13, color: 'var(--gray-400)', marginBottom: 24 }}>
          <Link href="/" style={{ color: 'var(--gray-400)', textDecoration: 'none' }}>Início</Link>
          {' / '}
          {produto.categoria && (
            <><Link href={`/?cat=${produto.categoria}`} style={{ color: 'var(--gray-400)', textDecoration: 'none' }}>{produto.categoria}</Link>{' / '}</>
          )}
          <span style={{ color: 'var(--black)' }}>{produto.nome}</span>
        </nav>

        {/* Layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, alignItems: 'start' }}>
          {/* Imagens */}
          <div>
            <div style={{ position: 'relative', aspectRatio: '1/1', borderRadius: 16, overflow: 'hidden', background: 'var(--gray-100)', marginBottom: 12 }}>
              <Image src={img} alt={produto.nome} fill style={{ objectFit: 'cover' }} sizes="50vw" priority />
              {produto.preco_original && produto.preco_original > produto.preco && (
                <span className="produto-card-badge sale" style={{ top: 16, left: 16, fontSize: 13, padding: '6px 14px' }}>Sale</span>
              )}
            </div>
            {produto.imagens?.length > 1 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {produto.imagens.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setImgActual(i)}
                    style={{ width: 72, height: 72, borderRadius: 8, overflow: 'hidden', border: `2px solid ${i === imgActual ? 'var(--black)' : 'var(--gray-200)'}`, cursor: 'pointer', padding: 0, background: 'none', position: 'relative' }}
                  >
                    <Image src={img} alt={`${produto.nome} ${i + 1}`} fill style={{ objectFit: 'cover' }} sizes="72px" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div>
            {produto.categoria && (
              <p style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
                {produto.categoria}
              </p>
            )}
            <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: '2rem', fontWeight: 700, marginBottom: 16 }}>
              {produto.nome}
            </h1>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 24 }}>
              <span style={{ fontSize: 28, fontWeight: 700 }}>{produto.preco?.toFixed(2)} MZN</span>
              {produto.preco_original && (
                <span style={{ fontSize: 16, color: 'var(--gray-400)', textDecoration: 'line-through' }}>
                  {produto.preco_original.toFixed(2)} MZN
                </span>
              )}
            </div>

            {produto.descricao && (
              <p style={{ color: 'var(--gray-600)', lineHeight: 1.7, marginBottom: 24 }}>{produto.descricao}</p>
            )}

            {/* Tamanhos */}
            {produto.tamanhos?.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--gray-600)', marginBottom: 10 }}>Tamanho</p>
                <div className="tamanhos-grid">
                  {produto.tamanhos.map(t => (
                    <button key={t} className={`tamanho-btn${tamanho === t ? ' active' : ''}`} onClick={() => setTamanho(t)}>{t}</button>
                  ))}
                </div>
              </div>
            )}

            {/* Cores */}
            {produto.cores?.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--gray-600)', marginBottom: 10 }}>
                  Cor: <strong>{cor}</strong>
                </p>
                <div className="cores-grid">
                  {produto.cores.map(c => (
                    <button
                      key={c}
                      className={`cor-btn${cor === c ? ' active' : ''}`}
                      style={{ background: c.toLowerCase() }}
                      title={c}
                      onClick={() => setCor(c)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Quantidade */}
            <div style={{ marginBottom: 24 }}>
              <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--gray-600)', marginBottom: 10 }}>Quantidade</p>
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
                {produto.stock !== undefined && (
                  <span style={{ fontSize: 13, color: produto.stock > 0 ? 'var(--green)' : 'var(--red)', marginLeft: 8 }}>
                    {produto.stock > 0 ? `${produto.stock} em stock` : 'Sem stock'}
                  </span>
                )}
              </div>
            </div>

            <button
              className="btn btn-primary btn-lg btn-full"
              onClick={handleAdd}
              disabled={produto.stock === 0}
              style={produto.stock === 0 ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
            >
              {produto.stock === 0 ? 'Sem stock' : '+ Adicionar ao carrinho'}
            </button>

            {/* Tags */}
            {produto.tags?.length > 0 && (
              <div style={{ marginTop: 24, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {produto.tags.map(tag => (
                  <span key={tag} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 100, background: 'var(--gray-100)', color: 'var(--gray-600)' }}>{tag}</span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Relacionados */}
        {relacionados.length > 0 && (
          <section style={{ marginTop: 64 }}>
            <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.6rem', marginBottom: 24 }}>Também podes gostar</h2>
            <div className="produtos-grid">
              {relacionados.map(p => <ProdutoCard key={p.id} produto={p} />)}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
