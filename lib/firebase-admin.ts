import { getApps, initializeApp, cert, App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function getAdminApp(): App | null {
  if (getApps().length) return getApps()[0];

  const projectId   = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey  = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) return null;

  return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

export function getAdminDb() {
  const app = getAdminApp();
  if (!app) return null;
  return getFirestore(app);
}

type FirestoreDb = ReturnType<typeof getFirestore>;

// Proxy lazy — só inicializa quando uma propriedade é acedida
export const adminDb = new Proxy({} as FirestoreDb, {
  get(_target, prop) {
    const db = getAdminDb();
    if (!db) throw new Error('Firebase Admin não configurado. Define FIREBASE_CLIENT_EMAIL e FIREBASE_PRIVATE_KEY.');
    const val = (db as unknown as Record<string | symbol, unknown>)[prop];
    return typeof val === 'function' ? val.bind(db) : val;
  },
});
