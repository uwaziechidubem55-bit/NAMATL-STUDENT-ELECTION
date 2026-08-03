// NAMTLS server-side Firebase init (ADMIN SDK only).
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

export const missingFirebaseEnv = process.env.FIREBASE_SERVICE_ACCOUNT
  ? []
  : ['FIREBASE_SERVICE_ACCOUNT'];

let firestore;

export function getDb() {
  if (firestore) return firestore;
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT is not set in Vercel env vars');
  }
  if (!getApps().length) {
    initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
  }
  firestore = getFirestore();
  return firestore;
}
