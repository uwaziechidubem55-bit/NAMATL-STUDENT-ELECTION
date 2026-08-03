
// NAMTLS server-side Firebase init.
// Vercel serverless functions run in Node.js and do NOT have Vite's
// `import.meta.env`. Env vars must come from process.env.
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase-admin/firestore';

const pick = (...names) => {
  for (const n of names) {
    if (process.env[n]) return process.env[n];
  }
  return '';
};

const cfg = {
  apiKey: pick('FIREBASE_API_KEY', 'VITE_FIREBASE_API_KEY'),
  authDomain: pick('FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: pick('FIREBASE_PROJECT_ID', 'VITE_FIREBASE_PROJECT_ID'),
  storageBucket: pick('FIREBASE_STORAGE_BUCKET', 'VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: pick('FIREBASE_MESSAGING_SENDER_ID', 'VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: pick('FIREBASE_APP_ID', 'VITE_FIREBASE_APP_ID'),
};

export const missingFirebaseEnv = Object.entries(cfg)
  .filter(([, v]) => !v)
  .map(([k]) => k);

let app;
let firestore;

export function getDb() {
  if (firestore) return firestore; // reuse across warm invocations
  if (missingFirebaseEnv.length) {
    throw new Error('Missing Firebase env vars on server: ' + missingFirebaseEnv.join(', '));
  }
  app = app || initializeApp(cfg);
  firestore = getFirestore(app);
  return firestore;
}