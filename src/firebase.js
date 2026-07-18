import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBwdhpv7e0Y3xNBovOpJEpRn9_jmDUOq8E",
  authDomain: "namtls-voting-2026-2027.firebaseapp.com",
  projectId: "namtls-voting-2026-2027",
  storageBucket: "namtls-voting-2026-2027.firebasestorage.app",
  messagingSenderId: "955792311858",
  appId: "1:955792311858:web:49a566b351ebab86c05e2b",
  measurementId: "G-SVDG83TZSG"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);