// Copia o catálogo de produção para as colecções do preview (uso único).
//   node --env-file=.env.local scripts/copiar-catalogo-para-preview.mjs
// Copia: produtos -> produtos_preview e config/loja -> config/loja_preview
// (mesmos IDs). Só LÊ de produção. Recusa-se a correr se o preview já tiver
// dados, para não apagar categorias/atribuições feitas; usa --force para repor.
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;
if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
  console.error('Faltam FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY.');
  process.exit(1);
}
const db = getFirestore(initializeApp({
  credential: cert({
    projectId: FIREBASE_PROJECT_ID,
    clientEmail: FIREBASE_CLIENT_EMAIL,
    privateKey: FIREBASE_PRIVATE_KEY.replace(/\n/g, '\n'),
  }),
}));

const force = process.argv.includes('--force');
const existente = await db.collection('produtos_preview').limit(1).get();
const lojaPreview = await db.collection('config').doc('loja_preview').get();
if ((!existente.empty || lojaPreview.exists) && !force) {
  console.error('O preview já tem dados. Corre com --force para os substituir (perde as alterações do preview).');
  process.exit(1);
}

const produtos = await db.collection('produtos').get();
let writer = db.bulkWriter();
for (const d of produtos.docs) writer.set(db.collection('produtos_preview').doc(d.id), d.data());
await writer.close();
console.log(`produtos_preview: ${produtos.size} artigos copiados`);

const loja = await db.collection('config').doc('loja').get();
if (loja.exists) {
  await db.collection('config').doc('loja_preview').set(loja.data());
  console.log('config/loja_preview copiado');
} else {
  console.log('config/loja não existe em produção; nada a copiar');
}
