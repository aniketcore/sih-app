import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _db: Firestore | null = null;

function initFirebaseClient() {
  if (typeof window === "undefined") return;
  if (_app) return;

  const getEnv = (key: string) => {
    return (
      (import.meta.env as any)?.[key] ||
      (typeof process !== "undefined" ? process.env?.[key] : undefined) ||
      (typeof window !== "undefined" ? (window as any)?.__ENV__?.[key] : undefined) ||
      ""
    );
  };

  const firebaseConfig = {
    apiKey: getEnv("VITE_FIREBASE_API_KEY") || getEnv("FIREBASE_API_KEY"),
    authDomain: getEnv("VITE_FIREBASE_AUTH_DOMAIN") || getEnv("FIREBASE_AUTH_DOMAIN"),
    projectId: getEnv("VITE_FIREBASE_PROJECT_ID") || getEnv("FIREBASE_PROJECT_ID"),
    storageBucket: getEnv("VITE_FIREBASE_STORAGE_BUCKET") || getEnv("FIREBASE_STORAGE_BUCKET"),
    messagingSenderId: getEnv("VITE_FIREBASE_MESSAGING_SENDER_ID") || getEnv("FIREBASE_MESSAGING_SENDER_ID"),
    appId: getEnv("VITE_FIREBASE_APP_ID") || getEnv("FIREBASE_APP_ID"),
  };

  for (const [key, value] of Object.entries(firebaseConfig)) {
    if (!value) {
      console.warn(`[Firebase Warning] Missing env var for ${key}`);
    }
  }

  _app = initializeApp(firebaseConfig);
  _auth = getAuth(_app);
  _db = getFirestore(_app);
}

initFirebaseClient();

export const auth = _auth as Auth;
export const db = _db as Firestore;