'use client';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthChange, getPerfil } from '@/lib/auth';
import { getPermissoesPerfil } from '@/lib/roles';
import { logoutRecente, registarFimSessao } from '@/lib/sessao';
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
  // Houve sessão nesta página: um `null` a seguir é a sessão a terminar,
  // não uma visita sem login
  const teveSessao = useRef(false);

  useEffect(() => {
    const unsub = onAuthChange(async (user: User | null) => {
      if (!user) {
        // Depois do login volta-se à mesma página do admin
        const pagina = window.location.pathname + window.location.search;
        const params = new URLSearchParams({ redirect: pagina });
        if (teveSessao.current) {
          teveSessao.current = false;
          setAcesso(null);
          const voluntario = logoutRecente();
          // Regista o motivo antes de sair da página (máx. ~3s, ver lib/sessao.ts)
          await registarFimSessao(pagina).catch(() => {});
          if (!voluntario) params.set('sessao', 'expirada');
        }
        router.replace(`/conta?${params.toString()}`);
        return;
      }
      teveSessao.current = true;
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
