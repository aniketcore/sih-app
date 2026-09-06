"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { subscribeAuth, type AuthUser } from "../lib/auth";
import { teamStore, type UserProfile } from "../lib/team-store";
import { ProfileOnboardingModal } from "../components/profile-modal";
import { EditProfileModal } from "../components/edit-profile-modal";

export default function ProfilePage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);

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

  if (loading || !user) return <main className="min-h-screen bg-white p-6 text-sm text-slate-500">Loading...</main>;

  const isProfileComplete = Boolean(profile?.isComplete);

  return (
    <main className="min-h-screen bg-white p-6 text-slate-900">
      {!isProfileComplete ? (
        <ProfileOnboardingModal profile={profile} onComplete={checkProfile} />
      ) : null}

      {isEditing ? (
        <EditProfileModal
          profile={profile}
          onClose={() => setIsEditing(false)}
          onUpdated={checkProfile}
        />
      ) : null}

      <div className={`mx-auto max-w-xl space-y-4 ${!isProfileComplete ? "pointer-events-none opacity-40 select-none" : ""}`}>
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <h1 className="text-xl font-bold">Profile</h1>
          <button
            className="border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
            onClick={() => setIsEditing(true)}
            type="button"
          >
            Edit Profile
          </button>
        </div>

        <div className="border border-slate-200 p-4 space-y-3 text-sm">
          <div className="flex justify-between border-b border-slate-100 pb-2">
            <span className="text-slate-500">Name</span>
            <span className="font-medium text-slate-900">{profile?.name ?? "N/A"}</span>
          </div>
          <div className="flex justify-between border-b border-slate-100 pb-2">
            <span className="text-slate-500">Email</span>
            <span className="font-medium text-slate-900">{user.email}</span>
          </div>
          <div className="flex justify-between border-b border-slate-100 pb-2">
            <span className="text-slate-500">Phone</span>
            <span className="font-medium text-slate-900">{profile?.phone ?? "N/A"}</span>
          </div>
          <div className="flex justify-between border-b border-slate-100 pb-2">
            <span className="text-slate-500">Registration No.</span>
            <span className="font-medium text-slate-900">{profile?.regNo ?? "N/A"}</span>
          </div>
          <div className="flex justify-between border-b border-slate-100 pb-2">
            <span className="text-slate-500">Branch</span>
            <span className="font-medium text-slate-900">{profile?.branch ?? "N/A"}</span>
          </div>
          <div className="flex justify-between border-b border-slate-100 pb-2">
            <span className="text-slate-500">Gender</span>
            <span className="font-medium text-slate-900">{profile?.gender ?? "N/A"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">User ID</span>
            <span className="font-mono text-xs text-slate-600">{user.uid}</span>
          </div>
        </div>

        <div className="pt-2">
          <Link
            className="inline-block border border-slate-300 bg-slate-50 px-4 py-2 text-xs font-medium text-slate-800 hover:bg-slate-100"
            href="/team"
          >
            Go to Team Dashboard →
          </Link>
        </div>
      </div>
    </main>
  );
}



