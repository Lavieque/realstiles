// ── FIREBASE CONFIG ──
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyD2DiY5Gqm2pdflZYb2Lx75oLheCo-qPAQ",
  authDomain: "clothesshop-43d13.firebaseapp.com",
  projectId: "clothesshop-43d13",
  storageBucket: "clothesshop-43d13.firebasestorage.app",
  messagingSenderId: "213129064111",
  appId: "1:213129064111:web:0471e3c390ca00dbc02e5a"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
