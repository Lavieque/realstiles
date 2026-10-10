import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';
import { marcarLogoutVoluntario } from './sessao';

const googleProvider = new GoogleAuthProvider();

export interface Perfil {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  morada: string;
  // admin: true = super admin (acesso total). Os restantes membros da equipa
  // têm uma role (id em roles/) que define as funcionalidades a que acedem.
  admin: boolean;
  role?: string | null;
  notif_canal?: 'email' | 'whatsapp';
  criado_em?: unknown;
}

export async function actualizarPerfil(
  uid: string,
  dados: Partial<Pick<Perfil, 'nome' | 'telefone' | 'morada'>>,
): Promise<void> {
  await import('firebase/firestore').then(({ updateDoc, doc: fsDoc }) =>
    updateDoc(fsDoc(db, 'clientes', uid), dados as Record<string, unknown>)
  );
}

export async function registar(
  nome: string, email: string, password: string,
  telefone = '', morada = ''
): Promise<User> {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await setDoc(doc(db, 'clientes', cred.user.uid), {
    nome, email, telefone, morada, admin: false, notif_canal: 'email', criado_em: serverTimestamp(),
  });
  await sendEmailVerification(cred.user);
  return cred.user;
}

export async function login(email: string, password: string): Promise<User> {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function loginGoogle(): Promise<User> {
  const cred = await signInWithPopup(auth, googleProvider);
  const ref = doc(db, 'clientes', cred.user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      nome: cred.user.displayName || '',
      email: cred.user.email,
      telefone: '', morada: '', admin: false, notif_canal: 'email', criado_em: serverTimestamp(),
    });
  }
  return cred.user;
}

export async function logout(): Promise<void> {
  marcarLogoutVoluntario();
  await signOut(auth);
}

export async function recuperarSenha(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email);
}

export async function getPerfil(uid: string): Promise<Perfil | null> {
  const user = auth.currentUser;
  const ref = doc(db, 'clientes', uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return { id: snap.id, ...snap.data() } as Perfil;

  if (user && user.uid === uid) {
    const dados = {
      nome: user.displayName || user.email?.split('@')[0] || '',
      email: user.email || '',
      telefone: '', morada: '', admin: false, criado_em: serverTimestamp(),
    };
    await setDoc(ref, dados);
    return { id: uid, ...dados } as Perfil;
  }
  return null;
}

// Indica se o utilizador deve ver a entrada "Admin" no site. A validação
// final das permissões é feita no AdminGuard e nas firestore.rules.
export function temAcessoAdmin(perfil: Pick<Perfil, 'admin' | 'role'> | null | undefined): boolean {
  return !!perfil && (perfil.admin === true || !!perfil.role);
}

export function onAuthChange(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}
