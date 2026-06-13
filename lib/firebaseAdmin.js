// lib/firebaseAdmin.js
// Initialise Firebase Admin (Cloud Functions / API routes Next.js).
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

function getAdminApp() {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  // Option 1 : Identifiants encodés en Base64 (pratique pour contourner les retours à la ligne sur Render/Vercel)
  if (process.env.FIREBASE_ADMIN_CREDENTIALS_B64) {
    try {
      const jsonStr = Buffer.from(process.env.FIREBASE_ADMIN_CREDENTIALS_B64, 'base64').toString('utf8');
      const credentials = JSON.parse(jsonStr);
      return initializeApp({
        credential: cert(credentials),
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
      });
    } catch (e) {
      console.error("Échec d'initialisation de Firebase Admin via Base64 credentials:", e);
    }
  }

  // Option 2 : Chaîne JSON brute d'identifiants
  if (process.env.FIREBASE_ADMIN_CREDENTIALS) {
    try {
      const credentials = JSON.parse(process.env.FIREBASE_ADMIN_CREDENTIALS);
      return initializeApp({
        credential: cert(credentials),
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
      });
    } catch (e) {
      console.error("Échec d'initialisation de Firebase Admin via Raw JSON credentials:", e);
    }
  }

  // Option 3 : Variables d'environnement individuelles (par défaut sur Render via render.yaml)
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (projectId && clientEmail && privateKey) {
    return initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey: privateKey.replace(/\\n/g, "\n"),
      }),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    });
  }

  // Si on est dans le processus de compilation (Next.js build), les variables d'environnement ne sont
  // pas forcément définies. On lève une exception uniquement lors d'un appel réel en production.
  throw new Error(
    "Les identifiants Firebase Admin ne sont pas configurés. Veuillez définir FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL et FIREBASE_PRIVATE_KEY, ou FIREBASE_ADMIN_CREDENTIALS_B64."
  );
}

// Proxies transparents pour empêcher l'exécution de getAdminApp() lors de la phase d'import statique (au build Next.js).
// L'initialisation réelle se fera lors du premier appel de propriété (ex: adminDb.collection).
export const adminDb = new Proxy({}, {
  get(target, prop) {
    const app = getAdminApp();
    const db = getFirestore(app);
    const value = db[prop];
    return typeof value === 'function' ? value.bind(db) : value;
  }
});

export const adminStorage = new Proxy({}, {
  get(target, prop) {
    const app = getAdminApp();
    const storage = getStorage(app);
    const value = storage[prop];
    return typeof value === 'function' ? value.bind(storage) : value;
  }
});
