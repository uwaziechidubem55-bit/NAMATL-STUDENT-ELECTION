import { initializeApp } from "firebase/app";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBwdhpv7e0Y3xNBovOpJEpRn9_jmDUOq8E",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "namtls-voting-2026-2027.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "namtls-voting-2026-2027",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "namtls-voting-2026-2027.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "955792311858",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:955792311858:web:49a566b351ebab86c05e2b"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Enable offline persistence silently (ignores errors if already enabled)
try {
  enableIndexedDbPersistence(db).catch(() => {});
} catch (e) {}