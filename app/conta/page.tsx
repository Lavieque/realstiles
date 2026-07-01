'use client';
import { Suspense, useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { login, loginGoogle, registar, recuperarSenha, onAuthChange, getPerfil, logout } from '@/lib/auth';
import { getEncomendasCliente, badgeEstadoLabel, badgeEstadoClass, formatarData } from '@/lib/encomendas';
import type { Encomenda, EstadoEncomenda } from '@/lib/encomendas';
import { mostrarToast } from '@/components/Toast';
import type { Perfil } from '@/lib/auth';
import type { User } from 'firebase/auth';

type Tab = 'entrar' | 'registar' | 'recuperar';

export default function ContaPage() {
  return (
    <Suspense fallback={<div className="auth-split"><div className="auth-lado-form"><div className="loading"><div className="spinner" /></div></div></div>}>
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
  const [encomendas, setEncomendas] = useState<Encomenda[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ nome: '', email: '', password: '', telefone: '' });

  useEffect(() => {
    const unsub = onAuthChange(async (u) => {
      setUser(u);
      if (u) {
        const [p, enc] = await Promise.all([
          getPerfil(u.uid),
          getEncomendasCliente(u.uid),
        ]);
        setPerfil(p);
        setEncomendas(enc.slice(0, 3));
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
    } finally { setLoading(false); }
  };

  const handleGoogle = async () => {
    setLoading(true);
    try {
      await loginGoogle();
      router.push(redirect);
    } catch {
      mostrarToast('Erro ao entrar com Google', 'error');
    } finally { setLoading(false); }
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
    } finally { setLoading(false); }
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
    } finally { setLoading(false); }
  };

  const handlePasswordReset = async () => {
    if (!user?.email) return;
    setLoading(true);
    try {
      await recuperarSenha(user.email);
      mostrarToast('Email de recuperação enviado!', 'success');
    } catch {
      mostrarToast('Erro ao enviar email', 'error');
    } finally { setLoading(false); }
  };

  // Página de conta (já autenticado)
  if (user && perfil) {
    return (
      <div className="page-wrapper">
        <div className="container">
          <div className="page-header"><h1>A minha conta</h1></div>

          <div className="conta-grid">
            {/* Coluna esquerda — Perfil */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Avatar + nome */}
              <div style={{ background: 'var(--black)', borderRadius: 16, padding: 28, color: 'white', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 80% 20%, rgba(201,164,60,0.18) 0%, transparent 60%)', pointerEvents: 'none' }} />
                <div style={{ position: 'relative', zIndex: 1 }}>
                  <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'rgba(201,164,60,0.2)', border: '2px solid rgba(201,164,60,0.4)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 24, fontFamily: 'Playfair Display, serif', marginBottom: 16 }}>
                    {(perfil.nome || 'U')[0].toUpperCase()}
                  </div>
                  <p style={{ fontWeight: 700, fontSize: 18, marginBottom: 4 }}>{perfil.nome}</p>
                  <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>{perfil.email}</p>
                  {perfil.admin && <span style={{ display: 'inline-block', marginTop: 10, background: 'rgba(201,164,60,0.2)', color: 'var(--accent)', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 100, border: '1px solid rgba(201,164,60,0.3)', letterSpacing: '0.06em' }}>ADMIN</span>}
                </div>
              </div>

              {/* Dados de contacto */}
              <div style={{ background: 'white', borderRadius: 16, border: '1px solid var(--gray-200)', padding: 24 }}>
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--gray-400)', marginBottom: 16 }}>Dados de contacto</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <p style={{ fontSize: 11, color: 'var(--gray-400)', marginBottom: 2 }}>Telefone</p>
                    <p style={{ fontSize: 14, fontWeight: 500 }}>{perfil.telefone || '—'}</p>
                  </div>
                  <div style={{ borderTop: '1px solid var(--gray-100)', paddingTop: 14 }}>
                    <p style={{ fontSize: 11, color: 'var(--gray-400)', marginBottom: 2 }}>Morada</p>
                    <p style={{ fontSize: 14, fontWeight: 500 }}>{perfil.morada || '—'}</p>
                  </div>
                </div>
              </div>

              {/* Acções */}
              <div style={{ background: 'white', borderRadius: 16, border: '1px solid var(--gray-200)', padding: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <a href="/encomendas" className="btn btn-outline btn-full" style={{ justifyContent: 'flex-start', textAlign: 'left' }}>📦 Todas as encomendas</a>
                {perfil.admin && <a href="/admin" className="btn btn-outline btn-full" style={{ justifyContent: 'flex-start', textAlign: 'left' }}>⚙️ Painel admin</a>}
                <button className="btn btn-outline btn-full" style={{ justifyContent: 'flex-start', textAlign: 'left' }} onClick={handlePasswordReset} disabled={loading}>🔑 Alterar password</button>
                <button className="btn btn-outline btn-full" style={{ justifyContent: 'flex-start', textAlign: 'left', color: 'var(--red)', borderColor: 'var(--red)' }} onClick={async () => { await logout(); setUser(null); setPerfil(null); setEncomendas([]); }}>← Sair da conta</button>
              </div>
            </div>

            {/* Coluna direita — Encomendas recentes */}
            <div style={{ background: 'white', borderRadius: 16, border: '1px solid var(--gray-200)', padding: 28 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h2 style={{ fontSize: 16, fontWeight: 700 }}>Encomendas recentes</h2>
                <a href="/encomendas" className="btn btn-outline btn-sm">Ver todas →</a>
              </div>
              {encomendas.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--gray-400)' }}>
                  <p style={{ fontSize: 32, marginBottom: 12 }}>📦</p>
                  <p style={{ fontSize: 14, marginBottom: 16 }}>Ainda não fizeste nenhuma encomenda.</p>
                  <a href="/" className="btn btn-primary btn-sm">Ver produtos</a>
                </div>
              ) : (
                <>
                  {encomendas.map(enc => (
                    <a key={enc.id} href={`/encomenda/${enc.id}`} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 0', borderBottom: '1px solid var(--gray-100)', textDecoration: 'none', color: 'inherit', transition: 'opacity 0.15s' }}>
                      {/* Miniaturas */}
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        {enc.itens?.slice(0, 2).map((item, i) => (
                          <Image key={i} src={item.imagem || '/placeholder.svg'} alt={item.nome} width={44} height={56} style={{ objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} />
                        ))}
                        {(enc.itens?.length || 0) > 2 && (
                          <div style={{ width: 44, height: 56, borderRadius: 8, background: 'var(--gray-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: 'var(--gray-400)', flexShrink: 0 }}>+{enc.itens!.length - 2}</div>
                        )}
                      </div>
                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <code style={{ fontSize: 11, background: 'var(--gray-100)', padding: '2px 7px', borderRadius: 5, fontWeight: 600 }}>#{enc.id.substring(0, 8).toUpperCase()}</code>
                          <span style={{ fontSize: 11, color: 'var(--gray-400)' }}>{formatarData(enc.criado_em)}</span>
                        </div>
                        <p style={{ fontSize: 13, color: 'var(--gray-600)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {enc.itens?.map(i => i.nome).join(', ')}
                        </p>
                      </div>
                      {/* Estado + total */}
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <span className={`badge-estado ${badgeEstadoClass(enc.estado as EstadoEncomenda)}`} style={{ fontSize: 11, display: 'block', marginBottom: 6 }}>{badgeEstadoLabel(enc.estado as EstadoEncomenda)}</span>
                        <strong style={{ fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>{enc.total?.toFixed(2)} MZN</strong>
                      </div>
                    </a>
                  ))}
                  <a href="/encomendas" style={{ display: 'block', textAlign: 'center', marginTop: 20, fontSize: 13, color: 'var(--gray-400)', textDecoration: 'none' }}>
                    Ver histórico completo →
                  </a>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Página de login — split screen
  return (
    <div className="auth-split">

      {/* Lado esquerdo — branding */}
      <div className="auth-lado-marca">
        <div className="auth-marca-conteudo">
          <Link href="/">
            <Image src="/img/logo.png" alt="Real Stiles" width={120} height={48} style={{ height: 48, width: 'auto', mixBlendMode: 'screen' }} />
          </Link>
          <h2 className="auth-marca-titulo">Veste o teu<br /><em>estilo.</em></h2>
          <p className="auth-marca-sub">As melhores peças de vestuário, cuidadosamente seleccionadas para ti.</p>
          <div className="auth-marca-pontos">
            <div className="auth-ponto"><span>✓</span> Entrega em todo o país</div>
            <div className="auth-ponto"><span>✓</span> Pagamento seguro</div>
            <div className="auth-ponto"><span>✓</span> Devoluções em 30 dias</div>
          </div>
        </div>
        <Link href="/" className="auth-volta-loja">← Voltar à loja</Link>
      </div>

      {/* Lado direito — formulário */}
      <div className="auth-lado-form">
        <div className="auth-form-wrap">

          {tab !== 'recuperar' && (
            <>
              <h1 className="auth-form-titulo">
                {tab === 'entrar' ? 'Bem-vindo de volta' : 'Criar conta'}
              </h1>
              <p className="auth-form-sub">
                {tab === 'entrar' ? 'Entra na tua conta para continuar.' : 'Regista-te para começar a comprar.'}
              </p>
              <div className="auth-tabs">
                {(['entrar', 'registar'] as Tab[]).map(t => (
                  <button key={t} onClick={() => setTab(t)} className={`auth-tab${tab === t ? ' active' : ''}`}>
                    {t === 'entrar' ? 'Entrar' : 'Registar'}
                  </button>
                ))}
              </div>
            </>
          )}

          {tab === 'recuperar' && (
            <>
              <h1 className="auth-form-titulo">Recuperar password</h1>
              <p className="auth-form-sub">Introduz o teu email e enviamos um link de recuperação.</p>
            </>
          )}

          {tab === 'entrar' && (
            <form onSubmit={handleLogin} className="auth-form">
              <div className="form-group"><label>Email</label><input type="email" required value={form.email} onChange={f('email')} placeholder="o-teu@email.com" /></div>
              <div className="form-group"><label>Password</label><input type="password" required value={form.password} onChange={f('password')} placeholder="••••••••" /></div>
              <button className="btn btn-primary btn-full" type="submit" disabled={loading}>{loading ? 'A entrar...' : 'Entrar'}</button>
              <p style={{ textAlign: 'center', marginTop: 12, fontSize: 13, color: 'var(--gray-600)' }}>
                <button type="button" onClick={() => setTab('recuperar')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--black)', fontWeight: 600, fontSize: 13 }}>Esqueci a password</button>
              </p>
              <div className="auth-divider"><span>ou</span></div>
              <button type="button" className="btn btn-outline btn-full" onClick={handleGoogle} disabled={loading} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                Continuar com Google
              </button>
            </form>
          )}

          {tab === 'registar' && (
            <form onSubmit={handleRegistar} className="auth-form">
              <div className="form-group"><label>Nome completo</label><input required value={form.nome} onChange={f('nome')} placeholder="O teu nome" /></div>
              <div className="form-group"><label>Email</label><input type="email" required value={form.email} onChange={f('email')} placeholder="o-teu@email.com" /></div>
              <div className="form-group"><label>Password</label><input type="password" required minLength={6} value={form.password} onChange={f('password')} placeholder="Mínimo 6 caracteres" /></div>
              <div className="form-group"><label>Telefone <span style={{ color: 'var(--gray-400)', fontWeight: 400 }}>(opcional)</span></label><input value={form.telefone} onChange={f('telefone')} placeholder="+258 8X XXX XXXX" /></div>
              <button className="btn btn-primary btn-full" type="submit" disabled={loading}>{loading ? 'A criar conta...' : 'Criar conta'}</button>
              <div className="auth-divider"><span>ou</span></div>
              <button type="button" className="btn btn-outline btn-full" onClick={handleGoogle} disabled={loading} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                Continuar com Google
              </button>
            </form>
          )}

          {tab === 'recuperar' && (
            <form onSubmit={handleRecuperar} className="auth-form">
              <div className="form-group"><label>Email</label><input type="email" required value={form.email} onChange={f('email')} placeholder="o-teu@email.com" /></div>
              <button className="btn btn-primary btn-full" type="submit" disabled={loading}>{loading ? 'A enviar...' : 'Enviar link de recuperação'}</button>
              <button type="button" className="btn btn-outline btn-full" style={{ marginTop: 8 }} onClick={() => setTab('entrar')}>← Voltar</button>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}
