// NAMTLS server-side Firebase init (ADMIN SDK only).
// Vercel serverless functions run in Node.js: they do NOT have Vite's
// `import.meta.env`, and a CLIENT app object (firebase/app) cannot be passed
// to firebase-admin's getFirestore() — that caused:
//   "firebaseApp.getOrInitService is not a function"
// The Admin SDK authenticates with a service account, never with apiKey.
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

export const missingFirebaseEnv = process.env.FIREBASE_SERVICE_ACCOUNT
  ? []
  : ['FIREBASE_SERVICE_ACCOUNT'];

let firestore;

export function getDb() {
  if (firestore) return firestore; // reuse across warm invocations
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT is not set in Vercel env vars');
  }
  if (!getApps().length) {
    initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
  }
  firestore = getFirestore();
  return firestore;
}