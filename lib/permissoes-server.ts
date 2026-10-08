import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from './firebase-admin';
import { CHAVES_PERMISSAO, filtrarPermissoes } from './permissoes';
import type { Permissao } from './permissoes';

// Permissões efectivas de um utilizador, lidas com o Admin SDK. Espelha
// getPermissoesPerfil (lib/roles.ts) e a função temPerm das firestore.rules.
export async function permissoesDoUtilizador(uid: string): Promise<Set<Permissao>> {
  const perfil = (await adminDb.collection('clientes').doc(uid).get()).data();
  if (!perfil) return new Set();
  if (perfil.admin === true) return new Set(CHAVES_PERMISSAO);
  if (typeof perfil.role !== 'string' || !perfil.role) return new Set();
  const role = (await adminDb.collection('roles').doc(perfil.role).get()).data();
  return new Set(filtrarPermissoes(role?.permissoes));
}

export type Caller = { uid: string; email: string | null; permissoes: Set<Permissao> };

// Valida o token Bearer do pedido (qualquer utilizador com sessão, cliente ou
// staff). Devolve o caller com as suas permissões, ou a resposta 401 a enviar.
export async function autenticar(req: Request): Promise<Caller | NextResponse> {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

  let uid: string;
  let email: string | null;
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    uid = decoded.uid;
    email = decoded.email ?? null;
  } catch {
    return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 });
  }

  return { uid, email, permissoes: await permissoesDoUtilizador(uid) };
}

// Valida o token Bearer do pedido e exige uma das permissões indicadas.
// Devolve o uid, ou a resposta de erro a enviar ao cliente.
export async function exigirPermissao(req: Request, ...aceites: Permissao[]): Promise<{ uid: string } | NextResponse> {
  const caller = await autenticar(req);
  if (caller instanceof NextResponse) return caller;
  if (!aceites.some(p => caller.permissoes.has(p))) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }
  return { uid: caller.uid };
}

// Encomenda a que o caller tem acesso: a sua, ou qualquer uma se gerir
// encomendas. Devolve null se não existir ou não lhe pertencer.
export async function encomendaDoCaller(caller: Caller, encomendaId: string) {
  if (!encomendaId) return null;
  const snap = await adminDb.collection('encomendas').doc(encomendaId).get();
  if (!snap.exists) return null;
  const data = snap.data()!;
  if (data.cliente_id !== caller.uid && !caller.permissoes.has('encomendas')) return null;
  return data;
}
