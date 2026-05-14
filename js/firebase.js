// ── FIREBASE CONFIG ──
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const res = await fetch('/.netlify/functions/firebase-config');
if (!res.ok) throw new Error('Não foi possível carregar a configuração. Usa "netlify dev" para desenvolvimento local.');
const firebaseConfig = await res.json();
if (firebaseConfig.error) throw new Error(firebaseConfig.error);

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
