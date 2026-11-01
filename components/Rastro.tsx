import Link from 'next/link';

// Rasto de localização: "Início › Página"
export default function Rastro({ pagina }: { pagina: string }) {
  return (
    <nav className="loja-trilho rastro-pagina" aria-label="Localização">
      <Link href="/">Início</Link><span aria-hidden="true">›</span><span>{pagina}</span>
    </nav>
  );
}
