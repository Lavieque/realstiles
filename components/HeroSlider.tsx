'use client';
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { getProdutos } from '@/lib/produtos';
import type { Produto } from '@/lib/produtos';

export default function HeroSlider({ destaques: initial }: { destaques: Produto[] }) {
  const [destaques, setDestaques] = useState<Produto[]>(initial);
  const [offset, setOffset] = useState(0);
  const VISIVEIS = 3;
  const total = destaques.length;
  const slidesRef = useRef<HTMLDivElement>(null);

  // Fallback: se SSR não trouxe destaques (sem Admin SDK), carrega pelo cliente
  useEffect(() => {
    if (initial.length > 0) return;
    getProdutos({ destaque: true, max: 12 }).then(res => {
      const comImagem = res.filter(p => p.imagens?.[0]);
      if (comImagem.length) setDestaques(comImagem);
    }).catch(() => {});
  }, [initial.length]);

  useEffect(() => {
    if (total <= VISIVEIS) return;
    const iv = setInterval(() => {
      setOffset(o => (o >= total - VISIVEIS ? 0 : o + 1));
    }, 4000);
    return () => clearInterval(iv);
  }, [total]);

  const slideW = slidesRef.current?.children[0]
    ? (slidesRef.current.children[0] as HTMLElement).offsetWidth + 10
    : 0;

  if (!destaques.length) {
    return (
      <div className="hero-slider">
        <div className="hero-slides-wrap">
          <div className="hero-slides">
            <div className="hero-sk" />
            <div className="hero-sk" />
            <div className="hero-sk" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id="hero-slider" className="hero-slider">
      <button
        className="hero-arrow prev"
        onClick={() => setOffset(o => Math.max(0, o - 1))}
        disabled={offset === 0}
      >&#8249;</button>

      <div className="hero-slides-wrap">
        <div
          ref={slidesRef}
          className="hero-slides"
          style={{ transform: `translateX(-${offset * (slideW || 0)}px)` }}
        >
          {destaques.map(p => (
            <Link key={p.id} href={`/produto/${p.id}`} className="hero-slide">
              <div style={{ position: 'relative', aspectRatio: '2/3' }}>
                <Image src={p.imagens[0]} alt={p.nome} fill style={{ objectFit: 'cover' }} sizes="33vw" />
              </div>
              <div className="hero-slide-preco">
                {p.preco?.toFixed(2)} MZN
              </div>
            </Link>
          ))}
        </div>
      </div>

      <button
        className="hero-arrow next"
        onClick={() => setOffset(o => Math.min(o + 1, total - VISIVEIS))}
        disabled={offset >= total - VISIVEIS}
      >&#8250;</button>
    </div>
  );
}
