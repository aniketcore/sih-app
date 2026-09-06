"use client";

import { useState } from "react";
import { teamStore, type UserProfile } from "../lib/team-store";
import { signOutUser } from "../lib/auth";

export function ProfileOnboardingModal({
  profile,
  onComplete,
}: {
  profile: UserProfile | null;
  onComplete: () => void;
}) {
  const [name, setName] = useState(profile?.name ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [regNo, setRegNo] = useState(profile?.regNo ?? "");
  const [branch, setBranch] = useState(profile?.branch ?? "CS");
  const [gender, setGender] = useState(profile?.gender ?? "Male");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignOut() {
    setBusy(true);
    try {
      await signOutUser();
      window.location.href = "/login";
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sign-out failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim() || !phone.trim() || !regNo.trim() || !branch.trim() || !gender.trim()) {
      setError("All fields (Name, Phone, Registration No., Branch, Gender) are required.");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      await teamStore.saveUserProfile({
        name: name.trim(),
        phone: phone.trim(),
        regNo: regNo.trim(),
        branch: branch.trim(),
        gender: gender.trim(),
      });
      onComplete();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to save profile.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md border border-slate-300 bg-white p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Complete Your Profile</h2>
            <p className="mt-1 text-sm text-slate-500">
              Please fill out your details to activate your account and use team features.
            </p>
          </div>
          <button
            className="text-xs text-slate-500 underline hover:text-slate-900 disabled:opacity-50"
            disabled={busy}
            onClick={handleSignOut}
            type="button"
          >
            Sign Out
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Full Name
            </label>
            <input
              className="w-full border border-slate-300 px-3 py-2 text-sm outline-none focus:border-black"
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Rahul Sharma"
              type="text"
              value={name}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Phone Number
            </label>
            <input
              className="w-full border border-slate-300 px-3 py-2 text-sm outline-none focus:border-black"
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. +91 9876543210"
              type="tel"
              value={phone}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Registration No.
            </label>
            <input
              className="w-full border border-slate-300 px-3 py-2 text-sm outline-none focus:border-black"
              onChange={(e) => setRegNo(e.target.value)}
              placeholder="e.g. 2024REG1092"
              type="text"
              value={regNo}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Branch / Department
            </label>
            <select
              className="w-full border border-slate-300 px-3 py-2 text-sm outline-none focus:border-black bg-white"
              onChange={(e) => setBranch(e.target.value)}
              value={branch}
            >
              <option value="CS">CS</option>
              <option value="CS-R">CS-R</option>
              <option value="CS-AI">CS-AI</option>
              <option value="CS-AIDS">CS-AIDS</option>
              <option value="CS-CYBER">CS-CYBER</option>
              <option value="IT">IT</option>
              <option value="ECE">ECE</option>
              <option value="EE">EE</option>
              <option value="ME">ME</option>
              <option value="CE">CE</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Gender
            </label>
            <select
              className="w-full border border-slate-300 px-3 py-2 text-sm outline-none focus:border-black bg-white"
              onChange={(e) => setGender(e.target.value)}
              value={gender}
            >
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>

          {error ? <p className="text-sm text-red-600 font-medium">{error}</p> : null}

          <button
            className="w-full border border-black bg-black py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            disabled={busy}
            type="submit"
          >
            {busy ? "Saving Profile..." : "Save Profile & Continue"}
          </button>
        </form>
      </div>
    </div>
  );
}
