"use client";

import { useEffect, useState } from "react";
import { subscribeAuth, type AuthUser } from "../lib/auth";
import { auth } from "../lib/firebase";
import { signOut } from "firebase/auth";
import { teamStore, type UserProfile } from "../lib/team-store";
import { TeamBoard } from "./team-board";
import { ProfileOnboardingModal } from "./profile-modal";
import { FirstYearWarningBanner } from "./year-warning";

export function AuthPanel() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isFrozen, setIsFrozen] = useState(false);
  const [isLeadersOnlyLogin, setIsLeadersOnlyLogin] = useState(false);
  const [isLeader, setIsLeader] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function checkProfile() {
    try {
      const res = await teamStore.getUserProfile();
      const p = res.user;
      setProfile(p);
      setIsFrozen(res.isFrozen);
      setIsLeadersOnlyLogin(res.isLeadersOnlyLogin);
      setIsLeader(res.isLeader);
    } catch (cause) {
      console.error(cause);
    }
  }

  useEffect(() => subscribeAuth((nextUser) => {
    setUser(nextUser);
    if (!nextUser) {
      window.location.href = "/login";
    } else {
      checkProfile().finally(() => setLoading(false));
    }
  }), []);

  async function handleSignOut() {
    setBusy(true);
    try {
      await signOut(auth);
      setUser(null);
      window.location.href = "/login";
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sign-out failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading || !user) return <p className="text-sm text-slate-500">Loading...</p>;

  const isProfileComplete = Boolean(profile?.isComplete);

  const isSenior = Boolean(user.email && !user.email.trim().toLowerCase().startsWith("2026") && !profile?.isAdmin);

  if (isLeadersOnlyLogin && !isLeader && !profile?.isAdmin) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between text-sm mb-4 border-b border-slate-200 pb-2">
          <span>{user.email}</span>
          <button
            className="text-xs text-slate-500 underline disabled:opacity-50"
            disabled={busy}
            onClick={handleSignOut}
            type="button"
          >
            Sign out
          </button>
        </div>
        <div className="flex flex-col items-center justify-center p-8 bg-red-50 border border-red-200 rounded text-center space-y-4">
          <span className="text-4xl">🚧</span>
          <h2 className="text-xl font-bold text-red-900">Restricted Access</h2>
          <p className="text-sm text-red-800">
            The portal is currently restricted to <strong>team leaders only</strong>.
            If you are a member of a team, your team leader will handle all necessary configurations.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <FirstYearWarningBanner email={user.email} isAdmin={profile?.isAdmin} />

      {!isProfileComplete && !isSenior ? (
        <ProfileOnboardingModal profile={profile} onComplete={checkProfile} />
      ) : null}

      <div className={`space-y-4 ${!isProfileComplete || isSenior ? "pointer-events-none opacity-40 grayscale select-none" : ""}`}>
        <div className="flex items-center justify-between text-sm">
        <span>{user.email}</span>
        <button
          className="text-xs text-slate-500 underline disabled:opacity-50"
          disabled={busy}
          onClick={handleSignOut}
          type="button"
        >
          Sign out
        </button>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      
      <div className={!isProfileComplete ? "pointer-events-none opacity-40 select-none" : ""}>
        <TeamBoard user={user} isFrozen={isFrozen} />
      </div>
    </div>
    </div>
  );
}