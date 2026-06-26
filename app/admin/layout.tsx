'use client';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import AdminGuard from '@/components/AdminGuard';
import { logout } from '@/lib/auth';
import type { Perfil } from '@/lib/auth';

const NAV = [
  { href: '/admin', label: 'Dashboard', icon: '📊', section: 'Principal' },
  { href: '/admin/encomendas', label: 'Encomendas', icon: '📦' },
  { href: '/admin/produtos', label: 'Produtos', icon: '👕', section: 'Catálogo' },
  { href: '/admin/importar', label: 'Importar via link', icon: '🔗' },
  { href: '/admin/clientes', label: 'Clientes', icon: '👥', section: 'Clientes' },
  { href: '/admin/conteudo', label: 'Conteúdo do site', icon: '✏️', section: 'Site' },
];

function Sidebar({ perfil }: { perfil: Perfil | null }) {
  const path = usePathname();

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <Link href="/"><Image src="/img/logo.png" alt="Real Stiles" height={40} width={100} style={{ height: 40, width: 'auto' }} /></Link>
        <p>Painel de administração</p>
      </div>
      <nav className="sidebar-nav">
        {NAV.map((item, i) => (
          <div key={item.href}>
            {item.section && <div className="sidebar-section">{item.section}</div>}
            <Link href={item.href} className={path === item.href ? 'active' : ''}>
              <span className="icon">{item.icon}</span> {item.label}
            </Link>
          </div>
        ))}
      </nav>
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
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminGuard>
      {(perfil: Perfil | null) => (
        <div className="admin-layout">
          <Sidebar perfil={perfil} />
          <main className="admin-main">{children}</main>
        </div>
      )}
    </AdminGuard>
  );
}
