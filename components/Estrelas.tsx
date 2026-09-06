import { Star } from 'lucide-react';

export default function Estrelas({ valor, tamanho = 16, onChange }: { valor: number; tamanho?: number; onChange?: (v: number) => void }) {
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <span
          key={i}
          onClick={onChange ? () => onChange(i) : undefined}
          style={{ cursor: onChange ? 'pointer' : 'default', lineHeight: 0 }}
        >
          <Star
            size={tamanho}
            strokeWidth={1.5}
            fill={i <= Math.round(valor) ? '#f5b301' : 'none'}
            color={i <= Math.round(valor) ? '#f5b301' : 'var(--gray-300)'}
          />
        </span>
      ))}
    </div>
  );
}
