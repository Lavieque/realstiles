'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthChange, isAdmin, getPerfil } from '@/lib/auth';
import type { Perfil } from '@/lib/auth';
import type { User } from 'firebase/auth';

export default function AdminGuard({ children }: { children: React.ReactNode | ((p: Perfil | null) => React.ReactNode) }) {
  const router = useRouter();
  const [ok, setOk] = useState(false);
  const [perfil, setPerfil] = useState<Perfil | null>(null);

  useEffect(() => {
    const unsub = onAuthChange(async (user: User | null) => {
      if (!user) { router.replace('/conta'); return; }
      const admin = await isAdmin(user.uid);
      if (!admin) { router.replace('/'); return; }
      const p = await getPerfil(user.uid);
      setPerfil(p);
      setOk(true);
    });
    return unsub;
  }, [router]);

  if (!ok) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}><div className="spinner" /></div>;
  }

  return <>{typeof children === 'function' ? (children as (p: Perfil | null) => React.ReactNode)(perfil) : children}</>;
}
