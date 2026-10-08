import { auth } from './firebase';

// fetch para as rotas /api que exigem sessão (autenticar/exigirPermissao em
// lib/permissoes-server.ts): junta o token Firebase no cabeçalho Authorization.
// Espera que o Firebase restaure a sessão, para os pedidos feitos logo ao
// montar a página não saírem sem token.
export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  await auth.authStateReady();
  const token = await auth.currentUser?.getIdToken();
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}
