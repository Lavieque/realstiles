'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Compass, Heart, ShoppingCart, User } from 'lucide-react';
import { useCarrinho, getTotalItems } from '@/store/carrinho';

// Barra de navegação fixa em ecrãs pequenos (escondida em desktop por CSS)
export default function NavInferior() {
  const pathname = usePathname() || '/';
  const { items } = useCarrinho();
  const count = getTotalItems(items);
  if (pathname.startsWith('/admin')) return null;

  const itens = [
    { href: '/', rotulo: 'Início', Icone: Home, activo: pathname === '/' },
    { href: '/loja', rotulo: 'Explorar', Icone: Compass, activo: pathname.startsWith('/loja') || pathname.startsWith('/produto') },
    { href: '/favoritos', rotulo: 'Favoritos', Icone: Heart, activo: pathname.startsWith('/favoritos') },
    { href: '/carrinho', rotulo: 'Carrinho', Icone: ShoppingCart, activo: pathname.startsWith('/carrinho') || pathname.startsWith('/checkout') },
    { href: '/conta', rotulo: 'Conta', Icone: User, activo: pathname.startsWith('/conta') || pathname.startsWith('/encomenda') },
  ];

  return (
    <nav className="nav-inferior" aria-label="Navegação principal">
      {itens.map(({ href, rotulo, Icone, activo }) => (
        <Link key={href} href={href} className={activo ? 'activo' : ''} aria-current={activo ? 'page' : undefined}>
          <Icone size={20} strokeWidth={1.5} />
          {rotulo}
          {href === '/carrinho' && count > 0 && <span className="cart-count">{count}</span>}
        </Link>
      ))}
    </nav>
  );
}
