import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAW8NwxgKEdDHpUzNxRZ-y-aHuj7e44MS0",
  authDomain: "sih-auth-dd035.firebaseapp.com",
  projectId: "sih-auth-dd035",
  storageBucket: "sih-auth-dd035.firebasestorage.app",
  messagingSenderId: "1053379644344",
  appId: "1:1053379644344:web:6982ff19e8d3713c48dd4d"
};


const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);