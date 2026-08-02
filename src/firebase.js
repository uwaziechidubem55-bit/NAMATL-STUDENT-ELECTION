import { initializeApp } from "firebase/app";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// 1. Safe detection of environment variables for both Vite and Node.js
const firebaseConfig = {
  apiKey: typeof process !== 'undefined'?.env?.FIREBASE_API_KEY || import.meta.env?.VITE_FIREBASE_API_KEY,
  authDomain: typeof process !== 'undefined'?.env?.FIREBASE_AUTH_DOMAIN || import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: typeof process !== 'undefined'?.env?.FIREBASE_PROJECT_ID || import.meta.env?.VITE_FIREBASE_PROJECT_ID,
  storageBucket: typeof process !== 'undefined'?.env?.FIREBASE_STORAGE_BUCKET || import.meta.env?.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: typeof process !== 'undefined'?.env?.FIREBASE_MESSAGING_SENDER_ID || import.meta.env?.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: typeof process !== 'undefined'?.env?.FIREBASE_APP_ID || import.meta.env?.VITE_FIREBASE_APP_ID,
};

// 2. Validate variables based on your rule
const missing = Object.entries(firebaseConfig).filter(([, v]) => !v);
if (missing.length > 0) {
  throw new Error(
    'Firebase env vars missing: ' + missing.map(([k]) => k).join(', ') +
    '. Ensure they are set in your deployment.'
  );
}

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);

// 3. ONLY run browser persistence if we are actually inside a browser
if (typeof window !== "undefined") {
  enableIndexedDbPersistence(db).catch((err) => {
    console.warn("Firebase persistence failed to initialize:", err.code);
  });
}
