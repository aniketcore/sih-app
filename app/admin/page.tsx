"use client";

import { useEffect, useState } from "react";
import { subscribeAuth, type AuthUser } from "../../lib/auth";
import { teamStore, type UserProfile, type Team } from "../../lib/team-store";

type AdminTeam = Team & {
  createdAt: number;
  members: Array<{
    email: string;
    name: string | null;
    phone: string | null;
    regNo: string | null;
    gender: string | null;
    branch: string | null;
  }>;
};

export default function AdminDashboardPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [teams, setTeams] = useState<AdminTeam[]>([]);
  const [tab, setTab] = useState<"teams" | "users">("teams");

  async function loadAdminData() {
    try {
      const data = await teamStore.getAdminOverview();
      if (data) {
        setUsers(data.users);
        setTeams(data.teams as AdminTeam[]);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Admin access denied");
    }
  }

  useEffect(() => {
    return subscribeAuth((nextUser) => {
      setUser(nextUser);
      if (!nextUser) {
        window.location.href = "/login";
      } else {
        loadAdminData().finally(() => setLoading(false));
      }
    });
  }, []);

  if (loading) {
    return <main className="p-6 text-sm text-slate-500">Loading admin dashboard...</main>;
  }

  if (error) {
    return (
      <main className="p-6 text-slate-900">
        <div className="mx-auto max-w-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <h2 className="font-bold">Access Restricted</h2>
          <p className="mt-1">{error}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="p-6 text-slate-900">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <div>
            <h1 className="text-2xl font-bold">Admin Portal</h1>
            <p className="text-xs text-slate-500">Poornima SIH Dashboard Overview</p>
          </div>
          <div className="flex gap-2">
            <button
              className={`border px-3 py-1 text-xs font-semibold ${
                tab === "teams" ? "border-black bg-black text-white" : "border-slate-300 text-slate-700"
              }`}
              onClick={() => setTab("teams")}
              type="button"
            >
              Teams ({teams.length})
            </button>
            <button
              className={`border px-3 py-1 text-xs font-semibold ${
                tab === "users" ? "border-black bg-black text-white" : "border-slate-300 text-slate-700"
              }`}
              onClick={() => setTab("users")}
              type="button"
            >
              Registered Users ({users.length})
            </button>
          </div>
        </div>

        {tab === "teams" ? (
          <div className="space-y-4">
            {teams.length === 0 ? (
              <div className="border border-slate-200 p-6 text-center text-sm text-slate-400">
                No registered teams found.
              </div>
            ) : (
              teams.map((t) => {
                const hasFemale = t.members.some((m) => m.gender?.toLowerCase() === "female");

                return (
                  <div key={t.id} className="border border-slate-200 p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <div>
                        <h3 className="font-bold text-base">{t.name}</h3>
                        <p className="text-xs text-slate-500">Leader: {t.ownerEmail}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs px-2 py-0.5 border font-semibold ${
                            hasFemale
                              ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                              : "border-amber-300 bg-amber-50 text-amber-800"
                          }`}
                        >
                          {hasFemale ? "✓ SIH Female Requirement Met" : "⚠️ Female Member Missing"}
                        </span>
                        <span className="text-xs border border-slate-200 px-2 py-0.5 text-slate-600 font-medium">
                          {t.members.length} / 6 Members
                        </span>
                      </div>
                    </div>

                    <div className="divide-y divide-slate-100 text-xs">
                      {t.members.map((m, idx) => (
                        <div key={m.email || idx} className="py-2 flex items-center justify-between">
                          <div>
                            <span className="font-medium text-slate-900">{m.name ?? "N/A"}</span>{" "}
                            <span className="text-slate-500">({m.email})</span>
                          </div>
                          <div className="flex gap-4 text-slate-600">
                            <span>Reg: {m.regNo ?? "N/A"}</span>
                            <span>Branch: {m.branch ?? "N/A"}</span>
                            <span>Gender: {m.gender ?? "N/A"}</span>
                            <span>Phone: {m.phone ?? "N/A"}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : (
          <div className="border border-slate-200 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 uppercase text-slate-500">
                <tr>
                  <th className="p-3 font-semibold">Name</th>
                  <th className="p-3 font-semibold">Email</th>
                  <th className="p-3 font-semibold">Phone</th>
                  <th className="p-3 font-semibold">Reg No.</th>
                  <th className="p-3 font-semibold">Branch</th>
                  <th className="p-3 font-semibold">Gender</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="p-3 font-medium text-slate-900">{u.name ?? "N/A"}</td>
                    <td className="p-3 text-slate-600">{u.email}</td>
                    <td className="p-3 text-slate-600">{u.phone ?? "N/A"}</td>
                    <td className="p-3 text-slate-600">{u.regNo ?? "N/A"}</td>
                    <td className="p-3 text-slate-600">{u.branch ?? "N/A"}</td>
                    <td className="p-3 text-slate-600">{u.gender ?? "N/A"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
