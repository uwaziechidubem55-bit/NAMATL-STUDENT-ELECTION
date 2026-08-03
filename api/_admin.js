import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

let db = null;
export function getAdminDb() {
  if (db) return db;
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT not configured');
  }
  if (!getApps().length) {
    initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
  }
  db = getFirestore();
  return db;
}
