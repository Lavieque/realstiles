const fmt = new Intl.NumberFormat('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: true });

// Preço com a parte inteira em destaque e ",99 MZN" em sobrescrito.
export default function Preco({ valor, riscado = false, className = '' }: { valor: number; riscado?: boolean; className?: string }) {
  const [inteiro, centimos] = fmt.format(valor).split(',');
  return (
    <span className={`preco${riscado ? ' preco-riscado' : ''}${className ? ` ${className}` : ''}`} aria-label={`${fmt.format(valor)} meticais`}>
      <span className="preco-inteiro">{inteiro}</span>
      <sup className="preco-resto">,{centimos} MZN</sup>
    </span>
  );
}
