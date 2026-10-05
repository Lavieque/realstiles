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

// Valida o token Bearer do pedido e exige uma das permissões indicadas.
// Devolve o uid, ou a resposta de erro a enviar ao cliente.
export async function exigirPermissao(req: Request, ...aceites: Permissao[]): Promise<{ uid: string } | NextResponse> {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

  let uid: string;
  try {
    uid = (await adminAuth.verifyIdToken(token)).uid;
  } catch {
    return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 });
  }

  const permissoes = await permissoesDoUtilizador(uid);
  if (!aceites.some(p => permissoes.has(p))) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }
  return { uid };
}
