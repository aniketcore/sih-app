"use client";

import { useEffect, useState } from "react";
import { subscribeAuth, signInWithGoogle, signInWithEmail, createUserWithEmail, type AuthUser } from "../../lib/auth";

const isDev = process.env.NODE_ENV === "development";

export default function LoginPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => subscribeAuth((nextUser) => {
    setUser(nextUser);
    setLoading(false);
    if (nextUser) {
      window.location.href = "/team";
    }
  }), []);

  async function handleGoogleSignIn() {
    setBusy(true);
    setError(null);
    try {
      const res = await signInWithGoogle();
      if (res) {
        window.location.href = "/team";
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleEmailAuth(isSignUp: boolean) {
    if (!email || !password) {
      setError("Please fill in email and password.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      if (isSignUp) {
        await createUserWithEmail(email, password);
      } else {
        await signInWithEmail(email, password);
      }
      window.location.href = "/team";
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Email auth failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <main className="p-6 text-sm text-slate-500">Loading...</main>;

  return (
    <main className="p-6 text-slate-900">
      <div className="mx-auto max-w-xl space-y-6">
        <h1 className="text-2xl font-bold">Poornima SIH Team Portal</h1>
        <p className="text-sm text-slate-600">
          Official SIH Team Management Portal for <strong>Poornima College</strong>. 
          Sign in using your official <strong>@poornima.org</strong> Google workspace email to manage team requests, members, and profile registration.
        </p>
        
        <div className="space-y-4">
          <button
            className="w-full border border-black bg-black px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            disabled={busy}
            onClick={handleGoogleSignIn}
            type="button"
          >
            Sign in with Poornima Google Account (@poornima.org)
          </button>

          {isDev ? (
            <div className="space-y-3 border-t border-slate-200 pt-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Dev Email Auth</p>
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                onChange={(e) => setEmail(e.target.value)}
                placeholder="developer@poornima.org"
                type="email"
                value={email}
              />
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                type="password"
                value={password}
              />
              <div className="flex gap-2">
                <button
                  className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  disabled={busy}
                  onClick={() => handleEmailAuth(false)}
                  type="button"
                >
                  Sign In (Email)
                </button>
                <button
                  className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  disabled={busy}
                  onClick={() => handleEmailAuth(true)}
                  type="button"
                >
                  Register
                </button>
              </div>
            </div>
          ) : null}

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>
      </div>
    </main>
  );
}

