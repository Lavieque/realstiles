'use client';
import { useEffect, useState } from 'react';
import { Timer } from 'lucide-react';
import { LIMITE_CONTAGEM_MS, formatarTempoRestante } from '@/lib/promocao';

// Contagem decrescente do fim da promoção — só aparece quando falta menos de
// 48h. Renderiza apenas no cliente (depende da hora actual) para evitar
// diferenças de hidratação.
export default function ContagemPromocao({
  fim,
  variante = 'card',
  onTerminar,
}: {
  fim: number | null;
  variante?: 'card' | 'detalhe';
  onTerminar?: () => void;
}) {
  const [agora, setAgora] = useState<number | null>(null);

  useEffect(() => {
    if (!fim) return;
    setAgora(Date.now());
    const t = setInterval(() => {
      const n = Date.now();
      setAgora(n);
      if (n >= fim) {
        clearInterval(t);
        onTerminar?.();
      }
    }, 1000);
    return () => clearInterval(t);
  }, [fim]);

  if (!fim || agora === null) return null;
  const falta = fim - agora;
  if (falta <= 0 || falta > LIMITE_CONTAGEM_MS) return null;

  if (variante === 'detalhe') {
    return (
      <div className="promo-contagem-detalhe">
        <Timer size={18} strokeWidth={1.5} />
        <span>A promoção termina em</span>
        <strong>{formatarTempoRestante(falta, true)}</strong>
      </div>
    );
  }

  return (
    <span className="promo-contagem-card">
      <Timer size={12} strokeWidth={2} />
      {formatarTempoRestante(falta)}
    </span>
  );
}
