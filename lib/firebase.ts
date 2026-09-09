import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _db: Firestore | null = null;

function initFirebaseClient() {
  const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAW8NwxgKEdDHpUzNxRZ-y-aHuj7e44MS0",
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "sih-auth-dd035.firebaseapp.com",
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "sih-auth-dd035",
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "sih-auth-dd035.firebasestorage.app",
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "1053379644344",
    appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:1053379644344:web:98cbcaf0f5ad692948dd4d",
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