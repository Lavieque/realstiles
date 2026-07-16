'use client';
import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { useCarrinho, getTotalItems } from '@/store/carrinho';
import { onAuthChange, getPerfil, logout } from '@/lib/auth';
import type { Perfil } from '@/lib/auth';
import { ShoppingCart, Flame, Heart, Search } from 'lucide-react';

export default function Nav() {
  const { items, bumped, abrirDrawer } = useCarrinho();
  const count = getTotalItems(items);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      window.location.href = `/?q=${encodeURIComponent(searchTerm.trim())}`;
      setSearchTerm('');
    }
  };

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
        <li><Link href="/promocoes" style={{ color: 'var(--red)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>Promoções <Flame size={16} strokeWidth={1.5} /></Link></li>

        <li className="nav-dropdown">
          <Link href="/?cat=mulher">Mulher</Link>
          <ul className="nav-submenu">
            <li><Link href="/?cat=vestidos">Vestidos</Link></li>
            <li><Link href="/?cat=camisas">Camisas</Link></li>
            <li><Link href="/?cat=calças">Calças</Link></li>
            <li><Link href="/?cat=casacos">Casacos</Link></li>
            <li><Link href="/?cat=saias">Saias</Link></li>
            <li><Link href="/?cat=acessórios">Acessórios</Link></li>
          </ul>
        </li>

        <li className="nav-dropdown">
          <Link href="/?cat=homem">Homem</Link>
          <ul className="nav-submenu">
            <li><Link href="/?cat=camisas">Camisas</Link></li>
            <li><Link href="/?cat=calças">Calças</Link></li>
            <li><Link href="/?cat=casacos">Casacos</Link></li>
            <li><Link href="/?cat=sapatos">Sapatos</Link></li>
            <li><Link href="/?cat=acessórios">Acessórios</Link></li>
          </ul>
        </li>

        <li className="nav-dropdown">
          <Link href="/?cat=crianca">Criança</Link>
          <ul className="nav-submenu">
            <li><Link href="/?cat=crianca-menina">Menina</Link></li>
            <li><Link href="/?cat=crianca-menino">Menino</Link></li>
            <li><Link href="/?cat=crianca-bebe">Bebé</Link></li>
            <li><Link href="/?cat=crianca-calcado">Calçado</Link></li>
          </ul>
        </li>

        <li className="nav-dropdown">
          <Link href="/?cat=desporto">Desporto</Link>
          <ul className="nav-submenu">
            <li><Link href="/?cat=roupa-desporto">Roupa</Link></li>
            <li><Link href="/?cat=calcado-desporto">Calçado</Link></li>
            <li><Link href="/?cat=equipamento">Equipamento</Link></li>
          </ul>
        </li>

        <li className="nav-dropdown">
          <Link href="/?cat=lar">Lar</Link>
          <ul className="nav-submenu">
            <li><Link href="/?cat=decoracao">Decoração</Link></li>
            <li><Link href="/?cat=cama-banho">Cama &amp; Banho</Link></li>
            <li><Link href="/?cat=cozinha">Cozinha</Link></li>
            <li><Link href="/?cat=organizacao">Organização</Link></li>
          </ul>
        </li>
      </ul>

      <div className="nav-actions">
        {/* Pesquisa */}
        <form onSubmit={handleSearch} className="nav-search-form">
          <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Pesquisar produtos..." className="nav-search-input" />
          <button type="submit" className="nav-search-submit">
            <Search size={16} strokeWidth={1.5} />
          </button>
        </form>

        {perfil ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="nav-dropdown">
              <a href="#" style={{ fontSize: 14, fontWeight: 500, color: 'var(--gray-600)', textDecoration: 'none', padding: '8px 14px', borderRadius: 8 }}>
                {perfil.nome || perfil.email}
              </a>
              <ul className="nav-submenu">
                <li><Link href="/conta">A minha conta</Link></li>
                <li><Link href="/favoritos" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Favoritos <Heart size={14} strokeWidth={1.5} /></Link></li>
                <li><Link href="/encomendas">Encomendas</Link></li>
                {perfil.admin && <li><Link href="/admin">Admin</Link></li>}
                <li className="nav-submenu-sep" />
                <li><a href="#" onClick={(e) => { e.preventDefault(); handleLogout(); }}>Sair</a></li>
              </ul>
            </div>
          </div>
        ) : (
          <Link href="/conta" className="btn btn-outline btn-sm">Entrar</Link>
        )}

        <button className={`nav-cart-btn${bumped ? ' bumped' : ''}`} onClick={abrirDrawer}>
          <ShoppingCart size={20} strokeWidth={1.5} /> {count > 0 && <span className="cart-count">{count}</span>}
        </button>

        <button className="nav-menu-btn" onClick={() => setMenuOpen(o => !o)}>
          <span /><span /><span />
        </button>
      </div>
    </nav>
  );
}
