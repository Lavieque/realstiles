'use client';
import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import AdminGuard from '@/components/AdminGuard';
import { logout } from '@/lib/auth';
import type { Perfil } from '@/lib/auth';

function AdminTopBar() {
  const path = usePathname();
  const item = NAV.find(n => n.href === path);
  const titulo = item?.label ?? 'Admin';
  return (
    <div className="admin-topbar">
      <span className="admin-topbar-titulo">{item?.icon} {titulo}</span>
      <Link href="/" className="admin-topbar-site">
        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
        Ver site
      </Link>
    </div>
  );
}

const NAV = [
  { href: '/admin', label: 'Dashboard', icon: '📊', section: 'Principal' },
  { href: '/admin/encomendas', label: 'Encomendas', icon: '📦' },
  { href: '/admin/produtos', label: 'Produtos', icon: '👕', section: 'Catálogo' },
  { href: '/admin/importar', label: 'Importar via link', icon: '🔗' },
  { href: '/admin/categorias', label: 'Categorias', icon: '🗂️' },
  { href: '/admin/clientes', label: 'Clientes', icon: '👥', section: 'Clientes' },
  { href: '/admin/conteudo', label: 'Conteúdo do site', icon: '✏️', section: 'Site' },
  { href: '/admin/banner', label: 'Barra de anúncios', icon: '📢' },
  { href: '/admin/reclamacoes', label: 'Reclamações', icon: '📋' },
  { href: '/admin/tradeflow', label: 'TradeFlow', icon: '⚡', section: 'Integrações' },
  { href: '/admin/whatsapp', label: 'WhatsApp Notify', icon: '💬' },
];

function Sidebar({ perfil, open, onClose }: { perfil: Perfil | null; open: boolean; onClose: () => void }) {
  const path = usePathname();

  return (
    <>
      {open && <div className="sidebar-overlay" onClick={onClose} />}
      <aside className={`sidebar${open ? ' open' : ''}`}>
        <div className="sidebar-logo">
          <Link href="/"><Image src="/img/logo.png" alt="Real Stiles" height={40} width={100} style={{ height: 40, width: 'auto' }} /></Link>
          <p>Painel de administração</p>
        </div>
        <div className="sidebar-nav">
          {NAV.map((item) => (
            <div key={item.href}>
              {item.section && <div className="sidebar-section">{item.section}</div>}
              <Link href={item.href} className={path === item.href ? 'active' : ''} onClick={onClose}>
                <span className="icon">{item.icon}</span> {item.label}
              </Link>
            </div>
          ))}
        </div>
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-user-avatar">{(perfil?.nome || 'A')[0].toUpperCase()}</div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-nome">{perfil?.nome || 'Admin'}</div>
              <div className="sidebar-user-role">Administrador</div>
            </div>
          </div>
          <button onClick={() => logout().then(() => window.location.href = '/')} className="btn btn-outline btn-sm btn-full" style={{ marginTop: 8 }}>Sair</button>
        </div>
      </aside>
    </>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <AdminGuard>
      {(perfil: Perfil | null) => (
        <div className="admin-layout">
          <Sidebar perfil={perfil} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
          <main className="admin-main">
            <div className="admin-hamburguer-bar">
              <button className="sidebar-toggle" onClick={() => setSidebarOpen(o => !o)} aria-label="Menu">
                <span /><span /><span />
              </button>
            </div>
            <AdminTopBar />
            {children}
          </main>
        </div>
      )}
    </AdminGuard>
  );
}
