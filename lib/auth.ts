import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';

const googleProvider = new GoogleAuthProvider();

export interface Perfil {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  morada: string;
  admin: boolean;
  criado_em?: unknown;
}

export async function registar(
  nome: string, email: string, password: string,
  telefone = '', morada = ''
): Promise<User> {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await setDoc(doc(db, 'clientes', cred.user.uid), {
    nome, email, telefone, morada, admin: false, criado_em: serverTimestamp(),
  });
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
      telefone: '', morada: '', admin: false, criado_em: serverTimestamp(),
    });
  }
  return cred.user;
}

export async function logout(): Promise<void> {
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

export async function isAdmin(uid: string): Promise<boolean> {
  const perfil = await getPerfil(uid);
  return perfil?.admin === true;
}

export function onAuthChange(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}
