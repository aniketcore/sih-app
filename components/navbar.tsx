"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { subscribeAuth, type AuthUser } from "../lib/auth";
import { auth } from "../lib/firebase";
import { signOut } from "firebase/auth";

export function Navbar() {
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => subscribeAuth((nextUser) => setUser(nextUser)), []);

  if (!user) return null;

  return (
    <header className="border-b border-slate-200 bg-white px-6 py-3">
      <div className="mx-auto flex max-w-xl items-center justify-between">
        <span className="font-bold">SIH PCE</span>
        <nav className="flex items-center gap-4 text-sm font-medium">
          <Link className="text-slate-600 hover:text-black" href="/">
            Profile
          </Link>
          <Link className="text-slate-600 hover:text-black" href="/team">
            Team
          </Link>
          <Link className="text-slate-600 hover:text-black" href="/admin">
            Admin
          </Link>
          <button
            className="text-xs text-slate-500 underline hover:text-slate-800"
            onClick={() => signOut(auth)}
            type="button"
          >
            Sign out
          </button>
        </nav>
      </div>
    </header>
  );
}


