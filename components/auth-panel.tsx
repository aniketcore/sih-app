"use client";

import { useEffect, useState } from "react";
import { subscribeAuth, signOutUser, type AuthUser } from "../lib/auth";
import { teamStore, type UserProfile } from "../lib/team-store";
import { TeamBoard } from "./team-board";
import { ProfileOnboardingModal } from "./profile-modal";

export function AuthPanel() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function checkProfile() {
    try {
      const p = await teamStore.getUserProfile();
      setProfile(p);
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
      await signOutUser();
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

  return (
    <div className="space-y-4">
      {!isProfileComplete ? (
        <ProfileOnboardingModal profile={profile} onComplete={checkProfile} />
      ) : null}

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
        <TeamBoard user={user} />
      </div>
    </div>
  );
}