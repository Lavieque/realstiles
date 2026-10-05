import { auth } from './firebase';

// fetch para as rotas /api protegidas com exigirPermissao: junta o token
// Firebase do utilizador com sessão iniciada no cabeçalho Authorization.
export async function adminFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const token = await auth.currentUser?.getIdToken();
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}
