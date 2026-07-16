'use client';
import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import AdminGuard from '@/components/AdminGuard';
import { logout } from '@/lib/auth';
import type { Perfil } from '@/lib/auth';
import type { ReactNode } from 'react';
import {
  LayoutDashboard, Package, ShirtIcon, Layers, Users, Pencil, Bell,
  ClipboardList, Zap, MessageCircle, Link as LinkIcon,
} from 'lucide-react';

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
  section?: string;
}

function AdminTopBar() {
  const path = usePathname();
  if (path === '/admin') return null;
  const item = NAV.find(n => n.href === path);
  const titulo = item?.label ?? 'Admin';
  return (
    <div className="admin-topbar">
      <span className="admin-topbar-titulo" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{item?.icon} {titulo}</span>
      <Link href="/" className="btn btn-outline btn-sm" target="_blank">Ver loja</Link>
    </div>
  );
}

const NAV: NavItem[] = [
  { href: '/admin', label: 'Dashboard', icon: <BarChart2 size={18} strokeWidth={1.5} />, section: 'Principal' },
  { href: '/admin/encomendas', label: 'Encomendas', icon: <Package size={18} strokeWidth={1.5} /> },
  { href: '/admin/produtos', label: 'Produtos', icon: <Tag size={18} strokeWidth={1.5} />, section: 'Catálogo' },
  { href: '/admin/importar', label: 'Importar via link', icon: <LinkIcon size={18} strokeWidth={1.5} /> },
  { href: '/admin/categorias', label: 'Categorias', icon: <Layers size={18} strokeWidth={1.5} /> },
  { href: '/admin/clientes', label: 'Clientes', icon: <Users size={18} strokeWidth={1.5} />, section: 'Clientes' },
  { href: '/admin/conteudo', label: 'Conteúdo do site', icon: <Pencil size={18} strokeWidth={1.5} />, section: 'Site' },
  { href: '/admin/banner', label: 'Barra de anúncios', icon: <Bell size={18} strokeWidth={1.5} /> },
  { href: '/admin/reclamacoes', label: 'Reclamações', icon: <ClipboardList size={18} strokeWidth={1.5} /> },
  { href: '/admin/tradeflow', label: 'TradeFlow', icon: <Zap size={18} strokeWidth={1.5} />, section: 'Integrações' },
  { href: '/admin/whatsapp', label: 'WhatsApp Notify', icon: <MessageCircle size={18} strokeWidth={1.5} /> },
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
