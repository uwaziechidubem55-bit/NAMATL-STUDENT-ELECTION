import { initializeApp } from "firebase/app";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDGJNGr2IiEswfBh0vgrptSIR1EgbXJtaE",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "namatls-voting-2026-2027.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "namatls-voting-2026-2027",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "namatls-voting-2026-2027.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "59393480018",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:59393480018:web:71d68fde73d0c219f3968b"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Enable offline persistence silently (ignores errors if already enabled)
try {
  enableIndexedDbPersistence(db).catch(() => {});
} catch (e) {}