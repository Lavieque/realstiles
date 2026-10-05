'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthChange, getPerfil } from '@/lib/auth';
import { getPermissoesPerfil } from '@/lib/roles';
import type { Perfil } from '@/lib/auth';
import type { Role } from '@/lib/roles';
import type { Permissao } from '@/lib/permissoes';
import type { User } from 'firebase/auth';

export interface AcessoAdmin {
  perfil: Perfil | null;
  role: Role | null;
  superAdmin: boolean;
  permissoes: ReadonlySet<Permissao>;
  tem: (p: Permissao) => boolean;
}

const AcessoContext = createContext<AcessoAdmin>({
  perfil: null, role: null, superAdmin: false, permissoes: new Set(), tem: () => false,
});

export function useAcessoAdmin(): AcessoAdmin {
  return useContext(AcessoContext);
}

export default function AdminGuard({ children }: { children: React.ReactNode | ((a: AcessoAdmin) => React.ReactNode) }) {
  const router = useRouter();
  const [acesso, setAcesso] = useState<AcessoAdmin | null>(null);

  useEffect(() => {
    const unsub = onAuthChange(async (user: User | null) => {
      if (!user) { router.replace('/conta'); return; }
      const perfil = await getPerfil(user.uid);
      const { permissoes, role } = await getPermissoesPerfil(perfil);
      if (permissoes.size === 0) { router.replace('/'); return; }
      setAcesso({
        perfil, role, permissoes,
        superAdmin: perfil?.admin === true,
        tem: (p) => permissoes.has(p),
      });
    });
    return unsub;
  }, [router]);

  if (!acesso) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}><div className="spinner" /></div>;
  }

  return (
    <AcessoContext.Provider value={acesso}>
      {typeof children === 'function' ? (children as (a: AcessoAdmin) => React.ReactNode)(acesso) : children}
    </AcessoContext.Provider>
  );
}
