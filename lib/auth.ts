import { type User, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "./firebase";
import { allowedEmailDomain, isAllowedEmail } from "./auth-policy";

import { teamStore } from "./team-store";

export type AuthUser = User;

export function subscribeAuth(cb: (user: User | null) => void) {
  return onAuthStateChanged(auth, (u) => {
    if (u && u.email) {
      teamStore.syncUser({ uid: u.uid, email: u.email, photoUrl: u.photoURL }).catch((err) => {
        console.error("Auto syncUser failed:", err);
      });
    }
    cb(u);
  });
}

export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  provider.addScope("email");
  provider.addScope("profile");
  if (import.meta.env.VITE_ENABLE_TEST_MODE !== "true") {
    provider.setCustomParameters({ hd: allowedEmailDomain, prompt: "select_account" });
  }

  const result = await signInWithPopup(auth, provider);

  if (!isAllowedEmail(result.user.email)) {
    await signOut(auth);
    throw new Error(`Only @${allowedEmailDomain} accounts are allowed.`);
  }

  return result.user;
}

export async function signInWithEmail(email: string, password: string) {
  const result = await signInWithEmailAndPassword(auth, email, password);

  if (!isAllowedEmail(result.user.email)) {
    await signOut(auth);
    throw new Error(`Only @${allowedEmailDomain} accounts are allowed.`);
  }

  return result.user;
}

export async function createUserWithEmail(email: string, password: string) {
  const result = await createUserWithEmailAndPassword(auth, email, password);

  if (!isAllowedEmail(result.user.email)) {
    await signOut(auth);
    throw new Error(`Only @${allowedEmailDomain} accounts are allowed.`);
  }

  return result.user;
}

export async function signOutUser() {
  return signOut(auth);
}
