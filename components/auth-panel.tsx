"use client";

import { useEffect, useState } from "react";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { auth } from "../lib/firebase";
import { TeamBoard } from "./team-board";

const allowedEmailDomain = "poornima.org";

function isAllowedEmail(email: string | null | undefined) {
  return Boolean(email && email.toLowerCase().endsWith(`@${allowedEmailDomain}`));
}

export function AuthPanel() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Subscribe once to Firebase auth state and keep the UI in sync.
  useEffect(() => {
    return onAuthStateChanged(auth, (nextUser) => {
      console.log("auth state changed", nextUser);

      if (!nextUser) {
        setUser(null);
        setLoading(false);
        return;
      }

      if (!isAllowedEmail(nextUser.email)) {
        setUser(null);
        setNotice(`Only @${allowedEmailDomain} accounts are allowed.`);
        setLoading(false);
        void signOut(auth);
        return;
      }

      setNotice(null);
      setUser(nextUser);
      setLoading(false);
    });
  }, []);

  async function handleGoogleSignIn() {
    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      const provider = new GoogleAuthProvider();
      provider.addScope("email");
      provider.addScope("profile");
      provider.setCustomParameters({
        hd: allowedEmailDomain,
        prompt: "select_account",
      });

      // Popup sign-in only works when Google is enabled in Firebase.
      const result = await signInWithPopup(auth, provider);
      console.log("google sign-in result", result.user);

      if (!isAllowedEmail(result.user.email)) {
        await signOut(auth);
        setUser(null);
        setNotice(`Only @${allowedEmailDomain} accounts are allowed.`);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Google sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleSignOut() {
    setBusy(true);
    setError(null);

    try {
      await signOut(auth);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sign-out failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-600">Firebase auth</p>
          <h2 className="mt-1 text-2xl font-semibold text-slate-950">Sign in to continue</h2>
          <p className="mt-1 text-sm text-slate-500">Only @{allowedEmailDomain} accounts can stay signed in.</p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
          {loading ? "Loading" : user ? "Authenticated" : "Guest"}
        </span>
      </div>

      {user ? (
        <div className="mt-6 space-y-4">
          <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
            <p className="font-medium text-slate-950">{user.displayName ?? user.email ?? "Signed in user"}</p>
            <p className="mt-1">{user.email ?? "No email available"}</p>
          </div>
          <button
            className="rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
            disabled={busy}
            onClick={handleSignOut}
            type="button"
          >
            Sign out
          </button>

          <TeamBoard user={user} />
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          <button
            className="rounded-full border border-orange-200 bg-orange-50 px-5 py-3 text-sm font-medium text-orange-700 transition hover:bg-orange-100 disabled:opacity-50"
            disabled={busy}
            onClick={handleGoogleSignIn}
            type="button"
          >
            Continue with Google
          </button>

          {notice ? (
            <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">{notice}</p>
          ) : null}
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>
      )}
    </section>
  );
}