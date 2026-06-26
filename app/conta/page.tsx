'use client';
import { Suspense, useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { login, loginGoogle, registar, recuperarSenha, onAuthChange, getPerfil } from '@/lib/auth';
import { mostrarToast } from '@/components/Toast';
import type { Perfil } from '@/lib/auth';
import type { User } from 'firebase/auth';

type Tab = 'entrar' | 'registar' | 'recuperar';

export default function ContaPage() {
  return (
    <Suspense fallback={<div className="page-wrapper"><div className="container"><div className="loading"><div className="spinner" /> A carregar...</div></div></div>}>
      <ContaInner />
    </Suspense>
  );
}

function ContaInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab') as Tab | null;
  const redirect = searchParams.get('redirect') || '/';

  const [tab, setTab] = useState<Tab>(tabParam || 'entrar');
  const [user, setUser] = useState<User | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ nome: '', email: '', password: '', telefone: '' });

  useEffect(() => {
    const unsub = onAuthChange(async (u) => {
      setUser(u);
      if (u) {
        const p = await getPerfil(u.uid);
        setPerfil(p);
      }
    });
    return unsub;
  }, []);

  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(prev => ({ ...prev, [k]: e.target.value }));

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(form.email, form.password);
      router.push(redirect);
    } catch {
      mostrarToast('Email ou password incorrectos', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    try {
      await loginGoogle();
      router.push(redirect);
    } catch {
      mostrarToast('Erro ao entrar com Google', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRegistar = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await registar(form.nome, form.email, form.password, form.telefone);
      mostrarToast('Conta criada com sucesso!', 'success');
      router.push(redirect);
    } catch (err: unknown) {
      const msg = (err as { code?: string }).code === 'auth/email-already-in-use'
        ? 'Este email já está registado'
        : 'Erro ao criar conta';
      mostrarToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRecuperar = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await recuperarSenha(form.email);
      mostrarToast('Email de recuperação enviado!', 'success');
      setTab('entrar');
    } catch {
      mostrarToast('Email não encontrado', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (user && perfil) {
    return (
      <div className="page-wrapper">
        <div className="container" style={{ maxWidth: 640 }}>
          <div className="page-header">
            <h1>A minha conta</h1>
          </div>
          <div style={{ background: 'white', borderRadius: 16, border: '1px solid var(--gray-200)', padding: 32, marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--black)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 20, fontFamily: 'Playfair Display, serif' }}>
                {(perfil.nome || 'U')[0].toUpperCase()}
              </div>
              <div>
                <p style={{ fontWeight: 700, fontSize: 18 }}>{perfil.nome}</p>
                <p style={{ color: 'var(--gray-400)', fontSize: 14 }}>{perfil.email}</p>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <p style={{ fontSize: 12, color: 'var(--gray-400)', fontWeight: 600, marginBottom: 4 }}>TELEFONE</p>
                <p style={{ fontSize: 14 }}>{perfil.telefone || '—'}</p>
              </div>
              <div>
                <p style={{ fontSize: 12, color: 'var(--gray-400)', fontWeight: 600, marginBottom: 4 }}>MORADA</p>
                <p style={{ fontSize: 14 }}>{perfil.morada || '—'}</p>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <a href="/encomendas" className="btn btn-outline">📦 As minhas encomendas</a>
            {perfil.admin && <a href="/admin" className="btn btn-outline">⚙️ Painel admin</a>}
            <button className="btn btn-outline" onClick={async () => { const { logout } = await import('@/lib/auth'); await logout(); setUser(null); setPerfil(null); }}>Sair</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrapper">
      <div className="container" style={{ maxWidth: 480 }}>
        <div className="page-header">
          <h1>{tab === 'entrar' ? 'Entrar' : tab === 'registar' ? 'Criar conta' : 'Recuperar password'}</h1>
        </div>

        <div style={{ background: 'white', borderRadius: 16, border: '1px solid var(--gray-200)', padding: 32 }}>
          {tab !== 'recuperar' && (
            <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderRadius: 10, overflow: 'hidden', border: '1.5px solid var(--gray-200)' }}>
              {(['entrar', 'registar'] as Tab[]).map(t => (
                <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: '10px 0', fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer', background: tab === t ? 'var(--black)' : 'white', color: tab === t ? 'white' : 'var(--gray-600)', fontFamily: 'Inter, sans-serif' }}>
                  {t === 'entrar' ? 'Entrar' : 'Registar'}
                </button>
              ))}
            </div>
          )}

          {tab === 'entrar' && (
            <form onSubmit={handleLogin}>
              <div className="form-group"><label>Email</label><input type="email" required value={form.email} onChange={f('email')} /></div>
              <div className="form-group"><label>Password</label><input type="password" required value={form.password} onChange={f('password')} /></div>
              <button className="btn btn-primary btn-full" type="submit" disabled={loading}>{loading ? 'A entrar...' : 'Entrar'}</button>
              <p style={{ textAlign: 'center', marginTop: 12, fontSize: 13, color: 'var(--gray-600)' }}>
                <button type="button" onClick={() => setTab('recuperar')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--black)', fontWeight: 600 }}>Esqueci a password</button>
              </p>
              <div style={{ margin: '20px 0', borderTop: '1px solid var(--gray-200)', position: 'relative' }}>
                <span style={{ position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)', background: 'white', padding: '0 12px', fontSize: 13, color: 'var(--gray-400)' }}>ou</span>
              </div>
              <button type="button" className="btn btn-outline btn-full" onClick={handleGoogle} disabled={loading}>
                <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                Entrar com Google
              </button>
            </form>
          )}

          {tab === 'registar' && (
            <form onSubmit={handleRegistar}>
              <div className="form-group"><label>Nome completo</label><input required value={form.nome} onChange={f('nome')} /></div>
              <div className="form-group"><label>Email</label><input type="email" required value={form.email} onChange={f('email')} /></div>
              <div className="form-group"><label>Password</label><input type="password" required minLength={6} value={form.password} onChange={f('password')} /></div>
              <div className="form-group"><label>Telefone (opcional)</label><input value={form.telefone} onChange={f('telefone')} /></div>
              <button className="btn btn-primary btn-full" type="submit" disabled={loading}>{loading ? 'A criar conta...' : 'Criar conta'}</button>
            </form>
          )}

          {tab === 'recuperar' && (
            <form onSubmit={handleRecuperar}>
              <p style={{ color: 'var(--gray-600)', fontSize: 14, marginBottom: 20 }}>Introduz o teu email e enviamos um link para recuperares a password.</p>
              <div className="form-group"><label>Email</label><input type="email" required value={form.email} onChange={f('email')} /></div>
              <button className="btn btn-primary btn-full" type="submit" disabled={loading}>{loading ? 'A enviar...' : 'Enviar link'}</button>
              <button type="button" className="btn btn-outline btn-full" style={{ marginTop: 8 }} onClick={() => setTab('entrar')}>Voltar</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
