'use client';
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { Produto } from '@/lib/produtos';

export default function HeroSlider({ destaques }: { destaques: Produto[] }) {
  const [offset, setOffset] = useState(0);
  const VISIVEIS = 3;
  const total = destaques.length;
  const slidesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (total <= VISIVEIS) return;
    const iv = setInterval(() => {
      setOffset(o => (o >= total - VISIVEIS ? 0 : o + 1));
    }, 4000);
    return () => clearInterval(iv);
  }, [total]);

  if (!destaques.length) return null;

  const slideW = slidesRef.current?.children[0]
    ? (slidesRef.current.children[0] as HTMLElement).offsetWidth + 10
    : 0;

  return (
    <div id="hero-slider" style={{ position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'stretch', padding: 'calc(var(--nav-h) + 14px) 10px 14px' }}>
      {total > VISIVEIS && (
        <button
          onClick={() => setOffset(o => Math.max(0, o - 1))}
          disabled={offset === 0}
          style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', zIndex: 10, background: 'rgba(255,255,255,0.9)', border: 'none', borderRadius: '50%', width: 36, height: 36, cursor: 'pointer', fontSize: 18 }}
        >‹</button>
      )}

      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', alignItems: 'stretch' }}>
        <div
          ref={slidesRef}
          style={{ display: 'flex', gap: 10, width: '100%', transition: 'transform 0.4s cubic-bezier(.4,0,.2,1)', transform: `translateX(-${offset * (slideW || 0)}px)` }}
        >
          {destaques.map(p => (
            <Link
              key={p.id}
              href={`/produto/${p.id}`}
              style={{ flex: '0 0 calc(33.333% - 7px)', minWidth: 0, borderRadius: 12, overflow: 'hidden', cursor: 'pointer', position: 'relative', boxShadow: '0 6px 20px rgba(0,0,0,0.4)', display: 'block' }}
            >
              <div style={{ position: 'relative', aspectRatio: '2/3' }}>
                <Image src={p.imagens[0]} alt={p.nome} fill style={{ objectFit: 'cover' }} sizes="33vw" />
              </div>
              <div style={{ position: 'absolute', bottom: 10, left: 10, background: 'rgba(13,19,71,0.82)', backdropFilter: 'blur(6px)', color: 'var(--accent)', fontWeight: 700, fontSize: 14, padding: '6px 12px', borderRadius: 8 }}>
                {p.preco?.toFixed(2)} MZN
              </div>
            </Link>
          ))}
        </div>
      </div>

      {total > VISIVEIS && (
        <button
          onClick={() => setOffset(o => Math.min(o + 1, total - VISIVEIS))}
          disabled={offset >= total - VISIVEIS}
          style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', zIndex: 10, background: 'rgba(255,255,255,0.9)', border: 'none', borderRadius: '50%', width: 36, height: 36, cursor: 'pointer', fontSize: 18 }}
        >›</button>
      )}
    </div>
  );
}
