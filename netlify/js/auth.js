// ── AUTH.JS ──
import { auth, db } from './firebase.js';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  doc, setDoc, getDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const googleProvider = new GoogleAuthProvider();

// ── REGISTO ──
export async function registar(nome, email, password, telefone = '', morada = '') {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await setDoc(doc(db, 'clientes', cred.user.uid), {
    nome, email, telefone, morada,
    admin: false,
    criado_em: serverTimestamp()
  });
  return cred.user;
}

// ── LOGIN EMAIL ──
export async function login(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

// ── LOGIN GOOGLE ──
export async function loginGoogle() {
  const cred = await signInWithPopup(auth, googleProvider);
  // Criar perfil se for primeira vez
  const ref = doc(db, 'clientes', cred.user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      nome: cred.user.displayName || '',
      email: cred.user.email,
      telefone: '',
      morada: '',
      admin: false,
      criado_em: serverTimestamp()
    });
  }
  return cred.user;
}

// ── LOGOUT ──
export async function logout() {
  await signOut(auth);
  window.location.href = '/index.html';
}

// ── RECUPERAR SENHA ──
export async function recuperarSenha(email) {
  await sendPasswordResetEmail(auth, email);
}

// ── OBTER PERFIL ──
export async function getPerfil(uid) {
  const snap = await getDoc(doc(db, 'clientes', uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// ── VERIFICAR ADMIN ──
export async function isAdmin(uid) {
  const perfil = await getPerfil(uid);
  return perfil?.admin === true;
}

// ── ESTADO DO UTILIZADOR ──
// Chama o callback sempre que o estado de auth muda
export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}

// ── PROTEGER PÁGINA (requer login) ──
export function requireAuth(redirectTo = '/conta.html') {
  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (user) => {
      unsub();
      if (!user) {
        window.location.href = redirectTo;
      } else {
        resolve(user);
      }
    });
  });
}

// ── PROTEGER PÁGINA ADMIN ──
export async function requireAdmin(redirectTo = '/index.html') {
  const user = await requireAuth('/conta.html');
  const admin = await isAdmin(user.uid);
  if (!admin) window.location.href = redirectTo;
  return user;
}

// ── ACTUALIZAR NAV conforme estado auth ──
export function initNav() {
  onAuthStateChanged(auth, async (user) => {
    const navAuth = document.getElementById('nav-auth');
    const navUser = document.getElementById('nav-user');
    if (!navAuth || !navUser) return;

    if (user) {
      const perfil = await getPerfil(user.uid);
      navAuth.style.display = 'none';
      navUser.style.display = 'flex';
      const nomeEl = document.getElementById('nav-nome');
      if (nomeEl) nomeEl.textContent = perfil?.nome || user.email;
      if (perfil?.admin) {
        const adminLink = document.getElementById('nav-admin-link');
        if (adminLink) adminLink.style.display = 'inline-flex';
      }
    } else {
      navAuth.style.display = 'flex';
      navUser.style.display = 'none';
    }
  });
}
