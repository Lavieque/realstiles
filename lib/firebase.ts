import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import {
  getAuth, initializeAuth, indexedDBLocalPersistence, browserLocalPersistence,
  browserPopupRedirectResolver,
} from 'firebase/auth';
import type { Auth } from 'firebase/auth';

const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

// A sessão fica no localStorage, e só no IndexedDB se o localStorage não
// estiver disponível. Num perfil com o IndexedDB avariado, o Firebase dava a
// sessão como terminada a meio da navegação; o localStorage é síncrono e não
// tem esse problema. Sessões já guardadas no IndexedDB são migradas pelo
// Firebase ao abrir o site (procura o utilizador em todas as persistências
// da lista), por isso ninguém perde o login com esta mudança.
// O popupRedirectResolver é preciso para o login com Google
// (signInWithPopup); o getAuth() incluía-o por omissão, o initializeAuth() não.
function criarAuth(): Auth {
  if (typeof window === 'undefined') return getAuth(app);
  try {
    return initializeAuth(app, {
      persistence: [browserLocalPersistence, indexedDBLocalPersistence],
      popupRedirectResolver: browserPopupRedirectResolver,
    });
  } catch {
    // Já inicializado (ex.: hot reload em desenvolvimento)
    return getAuth(app);
  }
}

export const db  = getFirestore(app);
export const auth = criarAuth();
