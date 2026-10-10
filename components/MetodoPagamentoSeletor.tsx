'use client';
import { Check } from 'lucide-react';
import MetodoPagamentoLogo from './MetodoPagamentoLogo';
import { INFO_METODO } from '@/lib/metodos-pagamento';
import type { MetodoPagamento } from '@/lib/metodos-pagamento';

// Mosaicos de escolha do método de pagamento (checkout e página da encomenda).
export default function MetodoPagamentoSeletor({ metodos, valor, onChange, compacto = false }: {
  metodos: MetodoPagamento[];
  valor: MetodoPagamento;
  onChange: (m: MetodoPagamento) => void;
  compacto?: boolean;
}) {
  return (
    <div className={`mp-grid${compacto ? ' compacto' : ''}`} data-n={metodos.length} role="radiogroup" aria-label="Método de pagamento">
      {metodos.map(m => {
        const info = INFO_METODO[m];
        const activo = valor === m;
        return (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={activo}
            onClick={() => onChange(m)}
            className={`mp-tile${activo ? ' active' : ''}`}
            style={{ '--mp-cor': info.cor, '--mp-fundo': info.fundo } as React.CSSProperties}
          >
            {activo && <span className="mp-check"><Check size={12} strokeWidth={3} /></span>}
            <MetodoPagamentoLogo metodo={m} altura={compacto ? 38 : 44} />
            {!compacto && (
              <span className="mp-texto">
                <span className="mp-nome">{info.nome}</span>
                <span className="mp-sub">{info.sub}</span>
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
