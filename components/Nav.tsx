'use client';
import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { useCarrinho, getTotalItems } from '@/store/carrinho';
import { onAuthChange, getPerfil, logout, temAcessoAdmin } from '@/lib/auth';
import type { Perfil } from '@/lib/auth';
import { getCategoriasConfig } from '@/lib/produtos';
import type { CategoriaConfig } from '@/lib/produtos';
import { ShoppingCart, Heart, Search, User, Truck, ChevronDown, Menu, X, Sparkles, Star, Tag, ThumbsUp, PackageSearch, ArrowRight, Headphones, Globe } from 'lucide-react';

export default function Nav() {
  const { items, bumped, abrirDrawer } = useCarrinho();
  const count = getTotalItems(items);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [catsOpen, setCatsOpen] = useState(false);
  const [contaMenuOpen, setContaMenuOpen] = useState(false);
  const [topMenu, setTopMenu] = useState<'apoio' | 'regiao' | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categorias, setCategorias] = useState<CategoriaConfig[]>([]);
  const [catActiva, setCatActiva] = useState<string | null>(null);

  useEffect(() => {
    getCategoriasConfig().then(setCategorias).catch(() => {});
  }, []);

  useEffect(() => {
    if (!contaMenuOpen && !catsOpen && !topMenu) return;
    const fechar = () => { setContaMenuOpen(false); setCatsOpen(false); setTopMenu(null); };
    document.addEventListener('click', fechar);
    return () => document.removeEventListener('click', fechar);
  }, [contaMenuOpen, catsOpen, topMenu]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      window.location.href = `/loja?q=${encodeURIComponent(searchTerm.trim())}`;
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

  const fecharTudo = () => { setMenuOpen(false); setCatsOpen(false); setCatActiva(null); };
  const catAberta = categorias.find(c => c.slug === catActiva) || categorias[0];

  return (
    <nav className="site-nav">
      <div className="nav-topbar">
        <span>Compras por encomenda · entrega estimada de 15 a 30 dias úteis</span>
        <div className="nav-topbar-dir">
          <div className={`nav-top-dropdown${topMenu === 'apoio' ? ' open' : ''}`}>
            <button type="button" className="nav-top-btn" aria-expanded={topMenu === 'apoio'} aria-controls="menu-apoio" onClick={e => { e.stopPropagation(); setTopMenu(m => m === 'apoio' ? null : 'apoio'); }}>
              <Headphones size={14} strokeWidth={1.5} /> Atendimento <ChevronDown size={12} strokeWidth={1.5} />
            </button>
            <ul id="menu-apoio" className="nav-submenu" onClick={() => setTopMenu(null)}>
              <li className="nav-submenu-titulo">Sempre por perto. Conta connosco.</li>
              <li><Link href="/ajuda">Atendimento ao cliente</Link></li>
              <li><Link href="/seguranca">Centro de segurança</Link></li>
              <li><a href="https://wa.me/258878753754" target="_blank" rel="noopener noreferrer">Conversa com a Real Stiles</a></li>
              <li><Link href="/protecao-compras">Proteção de compras</Link></li>
              <li className="nav-submenu-sep" />
              <li><Link href="/politicas#privacidade">Política de privacidade</Link></li>
              <li><Link href="/termos">Termos e condições</Link></li>
              <li><Link href="/informacao-empresa">Informação da empresa</Link></li>
              <li><Link href="/parcerias">Parcerias</Link></li>
            </ul>
          </div>
          <div className={`nav-top-dropdown${topMenu === 'regiao' ? ' open' : ''}`}>
            <button type="button" className="nav-top-btn" aria-expanded={topMenu === 'regiao'} aria-controls="menu-regiao" aria-label="Idioma e moeda: Português, MZN" onClick={e => { e.stopPropagation(); setTopMenu(m => m === 'regiao' ? null : 'regiao'); }}>
              <Globe size={14} strokeWidth={1.5} /> PT · MZN <ChevronDown size={12} strokeWidth={1.5} />
            </button>
            <div id="menu-regiao" className="nav-submenu nav-regiao" onClick={e => e.stopPropagation()}>
              <p className="nav-regiao-rotulo">Idioma</p>
              <div className="nav-regiao-opcoes">
                <span className="nav-regiao-op desligada" aria-disabled="true">English <small>em breve</small></span>
                <span className="nav-regiao-op activa" aria-current="true">Português</span>
              </div>
              <p className="nav-regiao-rotulo">Moeda</p>
              <div className="nav-regiao-opcoes">
                <span className="nav-regiao-op activa" aria-current="true">MZN: MT <small>Metical moçambicano</small></span>
              </div>
              <p className="nav-regiao-nota">Estás a comprar na Real Stiles Moçambique.</p>
            </div>
          </div>
          <a href="tel:+258878753754">+258 878 753 754</a>
        </div>
      </div>

      <div className="nav-main">
        <button className="nav-menu-btn" onClick={() => setMenuOpen(o => !o)} aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}>
          {menuOpen ? <X size={22} strokeWidth={1.5} /> : <Menu size={22} strokeWidth={1.5} />}
        </button>

        <Link href="/" className="nav-logo" onClick={fecharTudo}>
          <Image src="/img/logo.png" alt="" height={48} width={48} style={{ height: 48, width: 48 }} />
          <span className="nav-logo-texto">
            <span className="nav-logo-nome">Real <em>Stiles</em></span>
            <span className="nav-logo-sub">Multi Service</span>
          </span>
        </Link>

        <form onSubmit={handleSearch} className="nav-search-form" role="search">
          <Search size={16} strokeWidth={1.5} className="nav-search-icone" />
          <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="O que estás à procura?" className="nav-search-input" aria-label="Pesquisar produtos" />
          <button type="submit" className="nav-search-submit" aria-label="Pesquisar"><ArrowRight size={16} strokeWidth={1.75} /></button>
        </form>

        <div className="nav-actions">
          <Link href="/acompanhar" className="nav-icon-btn" aria-label="Acompanhar encomenda" title="Acompanhar encomenda"><Truck size={21} strokeWidth={1.5} /></Link>

          {perfil ? (
            <div className={`nav-dropdown nav-dropdown-conta${contaMenuOpen ? ' open' : ''}`}>
              <button
                type="button"
                className="nav-icon-btn"
                aria-label="A minha conta"
                title={perfil.nome || perfil.email}
                onClick={e => { e.stopPropagation(); setContaMenuOpen(o => !o); }}
              >
                <User size={21} strokeWidth={1.5} />
              </button>
              <ul className="nav-submenu" onClick={() => setContaMenuOpen(false)}>
                <li className="nav-submenu-titulo">{perfil.nome || perfil.email}</li>
                <li><Link href="/conta">A minha conta</Link></li>
                <li><Link href="/encomendas">Encomendas</Link></li>
                {temAcessoAdmin(perfil) && <li><Link href="/admin">Admin</Link></li>}
                <li className="nav-submenu-sep" />
                <li><a href="#" onClick={(e) => { e.preventDefault(); handleLogout(); }}>Sair</a></li>
              </ul>
            </div>
          ) : (
            <Link href="/conta" className="nav-icon-btn" aria-label="Entrar" title="Entrar"><User size={21} strokeWidth={1.5} /></Link>
          )}

          <Link href="/favoritos" className="nav-icon-btn" aria-label="Favoritos" title="Favoritos"><Heart size={21} strokeWidth={1.5} /></Link>

          <button className={`nav-icon-btn nav-cart-btn${bumped ? ' bumped' : ''}`} onClick={abrirDrawer} aria-label="Carrinho">
            <ShoppingCart size={21} strokeWidth={1.5} />
            {count > 0 && <span className="cart-count">{count}</span>}
          </button>
        </div>
      </div>

      <div className={`nav-sub${menuOpen ? ' open' : ''}`}>
        <div className={`nav-cats${catsOpen ? ' open' : ''}`}>
          <button
            type="button"
            className="nav-cats-btn"
            aria-expanded={catsOpen}
            onClick={e => { e.stopPropagation(); setCatsOpen(o => !o); }}
          >
            <Menu size={18} strokeWidth={1.5} /> Todas as categorias <ChevronDown size={14} strokeWidth={1.5} />
          </button>
          <div className="nav-mega" onClick={e => e.stopPropagation()}>
            <ul className="nav-mega-cats">
              {categorias.map(c => (
                <li key={c.slug}>
                  <Link
                    href={`/loja?cat=${c.slug}`}
                    className={catAberta?.slug === c.slug ? 'activo' : ''}
                    onMouseEnter={() => setCatActiva(c.slug)}
                    onFocus={() => setCatActiva(c.slug)}
                    onClick={fecharTudo}
                  >
                    {c.nome}
                  </Link>
                </li>
              ))}
              <li><Link href="/loja" className="nav-mega-todos" onClick={fecharTudo}>Todos os produtos</Link></li>
            </ul>
            {catAberta && (
              <div className="nav-mega-subs">
                <Link href={`/loja?cat=${catAberta.slug}`} className="nav-mega-ver" onClick={fecharTudo}>Ver tudo em {catAberta.nome} <ArrowRight size={14} strokeWidth={1.5} /></Link>
                <ul>
                  {catAberta.subcategorias.map(s => (
                    <li key={s.slug}><Link href={`/loja?cat=${s.slug}`} onClick={fecharTudo}>{s.nome}</Link></li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        <ul className="nav-links">
          <li><Link href="/loja?mode=mais-vendidos" onClick={fecharTudo}><ThumbsUp size={15} strokeWidth={1.5} /> Artigos mais vendidos</Link></li>
          <li><Link href="/loja?mode=cinco-estrelas" onClick={fecharTudo}><Star size={15} strokeWidth={1.5} /> Avaliação 5 estrelas</Link></li>
          <li><Link href="/loja?mode=novidades" onClick={fecharTudo}><Sparkles size={15} strokeWidth={1.5} /> Novidades</Link></li>
          <li><Link href="/promocoes" className="nav-link-promo" onClick={fecharTudo}><Tag size={15} strokeWidth={1.5} /> Promoções</Link></li>
          <li><Link href="/entregas" onClick={fecharTudo}><Truck size={15} strokeWidth={1.5} /> Entregas</Link></li>
          <li className="nav-so-mobile"><Link href="/acompanhar" onClick={fecharTudo}><PackageSearch size={15} strokeWidth={1.5} /> Acompanhar encomenda</Link></li>
        </ul>

        <span className="nav-prazo">Entrega estimada: 15–30 dias úteis</span>
      </div>
    </nav>
  );
}
