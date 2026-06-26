'use client';
import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { useCarrinho, getTotalItems } from '@/store/carrinho';
import { onAuthChange, getPerfil, logout } from '@/lib/auth';
import type { Perfil } from '@/lib/auth';

export default function Nav() {
  const { items, abrirDrawer } = useCarrinho();
  const count = getTotalItems(items);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const unsub = onAuthChange(async (user) => {
      if (user) {
        const p = await getPerfil(user.uid);
        setPerfil(p);
      } else {
        setPerfil(null);
      }
    });
    return unsub;
  }, []);

  const handleLogout = async () => {
    await logout();
    setPerfil(null);
    window.location.href = '/';
  };

  return (
    <nav>
      <Link href="/" className="nav-logo">
        <Image src="/img/logo.png" alt="Real Stiles" height={52} width={120} style={{ height: 52, width: 'auto' }} />
      </Link>

      <ul className={`nav-links${menuOpen ? ' open' : ''}`}>
        <li><Link href="/">Início</Link></li>
        <li><Link href="/?cat=novidades">Novidades</Link></li>
        <li><Link href="/promocoes" style={{ color: 'var(--red)', fontWeight: 600 }}>Promoções 🔥</Link></li>
        <li><Link href="/quem-somos">Quem Somos</Link></li>
      </ul>

      <div className="nav-actions">
        {perfil ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="nav-dropdown">
              <a href="#" style={{ fontSize: 14, fontWeight: 500, color: 'var(--gray-600)', textDecoration: 'none', padding: '8px 14px', borderRadius: 8 }}>
                {perfil.nome || perfil.email}
              </a>
              <ul className="nav-submenu">
                <li><Link href="/conta">A minha conta</Link></li>
                <li><Link href="/encomendas">Encomendas</Link></li>
                {perfil.admin && <li><Link href="/admin">Admin</Link></li>}
                <li className="nav-submenu-sep" />
                <li><a href="#" onClick={(e) => { e.preventDefault(); handleLogout(); }}>Sair</a></li>
              </ul>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8 }}>
            <Link href="/conta" className="btn btn-outline btn-sm">Entrar</Link>
            <Link href="/conta?tab=registar" className="btn btn-primary btn-sm">Registar</Link>
          </div>
        )}

        <button className="nav-cart-btn" onClick={abrirDrawer}>
          🛒 {count > 0 && <span className="cart-count">{count}</span>}
        </button>

        <button className="nav-menu-btn" onClick={() => setMenuOpen(o => !o)}>
          <span /><span /><span />
        </button>
      </div>
    </nav>
  );
}
