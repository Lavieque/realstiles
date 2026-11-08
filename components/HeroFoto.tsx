'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import Image from '@/components/CloudImage';
import type { Produto } from '@/lib/produtos';

// Foto do hero da home: passa pelos artigos em destaque (como o slider da
// loja em produção), a cada 4s, com setas e pontos. O cartão "Pequenos
// detalhes" mostra o artigo seguinte.
export default function HeroFoto({ destaques, rotulo }: { destaques: Produto[]; rotulo: string }) {
  const [i, setI] = useState(0);
  const [pausa, setPausa] = useState(false);
  const total = destaques.length;

  useEffect(() => {
    if (total < 2 || pausa) return;
    const iv = setInterval(() => setI(n => (n + 1) % total), 4000);
    return () => clearInterval(iv);
  }, [total, pausa]);

  const cartao = total > 1 ? destaques[(i + 1) % total] : null;
  const ir = (d: number) => setI(n => (n + d + total) % total);

  return (
    <div className="home-hero-visual" onMouseEnter={() => setPausa(true)} onMouseLeave={() => setPausa(false)}>
      <div className="home-hero-foto">
        {destaques.map((p, n) => (
          <Link key={p.id} href={`/produto/${p.id}`} className={`home-hero-slide${n === i ? ' activo' : ''}`} aria-hidden={n !== i} tabIndex={n === i ? 0 : -1}>
            <Image src={p.imagens[0]} alt={p.nome} fill priority={n === 0} style={{ objectFit: 'cover' }} sizes="(max-width: 860px) 100vw, 50vw" />
          </Link>
        ))}
        {total > 1 && (
          <>
            <button type="button" className="home-hero-seta prev" onClick={() => ir(-1)} aria-label="Artigo anterior"><ChevronLeft size={18} /></button>
            <button type="button" className="home-hero-seta next" onClick={() => ir(1)} aria-label="Artigo seguinte"><ChevronRight size={18} /></button>
            <div className="home-hero-pontos">
              {destaques.map((p, n) => (
                <button key={p.id} type="button" className={n === i ? 'activo' : ''} onClick={() => setI(n)} aria-label={`Ver artigo ${n + 1} de ${total}`} />
              ))}
            </div>
          </>
        )}
      </div>
      <div className="home-hero-selo" aria-hidden="true">
        <Sparkles size={14} strokeWidth={1.5} />
        <span>Estilo</span><span>Qualidade</span><span>Confiança</span>
      </div>
      {cartao && (
        <Link href={`/produto/${cartao.id}`} className="home-hero-cartao">
          <div className="home-hero-cartao-img">
            <Image src={cartao.imagens[0]} alt="" fill style={{ objectFit: 'cover' }} sizes="84px" />
          </div>
          <div>
            <small>Pequenos detalhes</small>
            <strong>{cartao.nome}</strong>
            <span>Descobrir <ArrowRight size={13} strokeWidth={1.75} /></span>
          </div>
        </Link>
      )}
      <span className="home-hero-lateral">{rotulo}</span>
    </div>
  );
}
