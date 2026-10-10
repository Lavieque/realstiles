import type { MetodoPagamento } from '@/lib/metodos-pagamento';

// Logótipo de um método de pagamento, sempre centrado numa caixa da mesma
// altura para os mosaicos ficarem alinhados. M-Pesa, e-Mola e mKesh usam os
// PNG em /public/img; o cartão é desenhado em SVG (Visa + Mastercard).

function Cartoes({ altura }: { altura: number }) {
  return (
    <svg viewBox="0 0 120 40" style={{ height: altura, width: 'auto' }} role="img" aria-label="Visa e Mastercard">
      <rect x="0.5" y="0.5" width="56" height="39" rx="6" fill="#fff" stroke="#e5e7eb" />
      <text x="28.5" y="26" textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif" fontSize="17" fontWeight="800" fontStyle="italic" fill="#1a1f71">VISA</text>
      <rect x="63.5" y="0.5" width="56" height="39" rx="6" fill="#fff" stroke="#e5e7eb" />
      <circle cx="84" cy="20" r="11" fill="#eb001b" />
      <circle cx="99" cy="20" r="11" fill="#f79e1b" fillOpacity="0.95" />
      <path d="M91.5 11.9a11 11 0 0 1 0 16.2 11 11 0 0 1 0-16.2Z" fill="#ff5f00" />
    </svg>
  );
}

const PNG: Record<Exclude<MetodoPagamento, 'cartao'>, { src: string; alt: string }> = {
  mpesa: { src: '/img/mpesa.png', alt: 'M-Pesa' },
  emola: { src: '/img/emola.png', alt: 'e-Mola' },
  mkesh: { src: '/img/mkesh.png', alt: 'mKesh' },
};

export default function MetodoPagamentoLogo({ metodo, altura = 30 }: { metodo: MetodoPagamento; altura?: number }) {
  const caixa: React.CSSProperties = { height: altura, display: 'flex', alignItems: 'center', justifyContent: 'center' };

  if (metodo === 'cartao') return <span style={caixa}><Cartoes altura={altura} /></span>;

  const { src, alt } = PNG[metodo];
  return (
    <span style={caixa}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        style={{
          height: altura, width: 'auto', maxWidth: altura * 3, objectFit: 'contain',
          // O logo do mKesh é um quadrado com fundo amarelo
          ...(metodo === 'mkesh' ? { borderRadius: Math.round(altura / 5) } : {}),
        }}
      />
    </span>
  );
}
