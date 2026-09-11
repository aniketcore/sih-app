"use client";

import { useEffect, useMemo, useState } from "react";
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

function AdminTeamCard({ t }: { t: AdminTeam }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasFemale = t.members.some((m) => m.gender?.toLowerCase() === "female");

  return (
    <div className="border border-slate-200 bg-white">
      <div 
        className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 gap-2 cursor-pointer hover:bg-slate-50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-xs">{isExpanded ? "▼" : "▶"}</span>
            <h3 className="font-bold text-sm sm:text-base leading-tight">{t.name}</h3>
          </div>
          <p className="text-xs text-slate-500 break-all ml-4">Leader: {t.ownerEmail}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 ml-4 sm:ml-0">
          <span
            className={`text-[11px] sm:text-xs px-2 py-0.5 border font-semibold ${
              hasFemale
                ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                : "border-amber-300 bg-amber-50 text-amber-800"
            }`}
          >
            {hasFemale ? "✓ SIH Female Requirement Met" : "⚠️ Female Member Missing"}
          </span>
          <span className="text-[11px] sm:text-xs border border-slate-200 px-2 py-0.5 text-slate-600 font-medium bg-slate-50">
            {t.members.length} / 6 Members
          </span>
        </div>
      </div>

      {isExpanded && (
        <div className="divide-y divide-slate-100 text-xs border-t border-slate-100 px-3 sm:px-4 pb-1">
          {t.members.map((m, idx) => (
            <div key={m.email || idx} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-2 pl-4">
              <div className="break-all">
                <span className="font-semibold text-slate-900">{m.name ?? "N/A"}</span>{" "}
                <span className="text-slate-500">({m.email})</span>
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-600">
                <span>Reg: {m.regNo ?? "N/A"}</span>
                <span>Branch: {m.branch ?? "N/A"}</span>
                <span>Gender: {m.gender ?? "N/A"}</span>
                <span>Phone: {m.phone ?? "N/A"}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminDashboardPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [teams, setTeams] = useState<AdminTeam[]>([]);
  const [mainTab, setMainTab] = useState<"teams" | "users">("teams");
  const [userTab, setUserTab] = useState<string>("all");
  const [teamTab, setTeamTab] = useState<string>("all");
  const [search, setSearch] = useState("");

  const KNOWN_SECTIONS = ["IT","ME","CY","CR","CE","CA", "AD", "EC", "EE", "CS"];

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

  // Compute set of emails that belong to any team
  const assignedEmailsSet = useMemo(() => {
    const set = new Set<string>();
    teams.forEach((t) => {
      set.add(t.ownerEmail.toLowerCase());
      t.members.forEach((m) => {
        if (m.email) set.add(m.email.toLowerCase());
      });
    });
    return set;
  }, [teams]);

  // Derived filtered lists
  const unassignedUsers = useMemo(() => {
    return users.filter((u) => !assignedEmailsSet.has(u.email.toLowerCase()));
  }, [users, assignedEmailsSet]);

  const incompleteProfileUsers = useMemo(() => {
    return users.filter((u) => {
      if (typeof u.isComplete === "boolean") return !u.isComplete;
      return !u.name?.trim() || !u.phone?.trim() || !u.regNo?.trim() || !u.gender?.trim() || !u.branch?.trim();
    });
  }, [users]);

  function getSection(email: string) {
    const normalized = email.trim().toLowerCase();
    if (normalized.startsWith("2026pcea")) {
      const section = normalized.substring(8, 10).toUpperCase();
      if (KNOWN_SECTIONS.includes(section)) return section;
    }
    return "OTHER";
  }

  const counts = useMemo(() => {
    const c: Record<string, number> = {
      all: users.length,
      unassigned: unassignedUsers.length,
      incomplete: incompleteProfileUsers.length,
      OTHER: 0,
    };
    KNOWN_SECTIONS.forEach((s) => (c[s] = 0));
    users.forEach((u) => {
      const sec = getSection(u.email);
      if (c[sec] !== undefined) c[sec]++;
      else c["OTHER"]++;
    });
    return c;
  }, [users, unassignedUsers, incompleteProfileUsers]);

  const teamCounts = useMemo(() => {
    let complete = 0;
    let incomplete = 0;
    let valid = 0;
    let invalid = 0;
    let multipleFemales = 0;

    teams.forEach((t) => {
      let femaleCount = 0;
      t.members.forEach((m) => {
        if (m.gender?.toLowerCase() === "female") femaleCount++;
      });
      
      const hasFemale = femaleCount > 0;
      if (t.members.length >= 6) complete++;
      else incomplete++;

      if (hasFemale) valid++;
      else invalid++;
      
      if (femaleCount > 1) multipleFemales++;
    });

    return {
      all: teams.length,
      complete,
      incomplete,
      valid,
      invalid,
      multipleFemales,
    };
  }, [teams]);

  // Search filter
  const filteredUsers = useMemo(() => {
    let list = users;
    if (userTab === "unassigned") list = unassignedUsers;
    else if (userTab === "incomplete") list = incompleteProfileUsers;
    else if (userTab !== "all") list = users.filter((u) => getSection(u.email) === userTab);
    
    if (!search.trim()) return list;
    const q = search.toLowerCase().trim();
    return list.filter(
      (u) =>
        u.email.toLowerCase().includes(q) ||
        u.name?.toLowerCase().includes(q) ||
        u.regNo?.toLowerCase().includes(q) ||
        u.phone?.toLowerCase().includes(q) ||
        u.branch?.toLowerCase().includes(q),
    );
  }, [users, unassignedUsers, incompleteProfileUsers, userTab, search]);

  const filteredTeams = useMemo(() => {
    let list = teams;
    if (teamTab === "complete") list = teams.filter((t) => t.members.length >= 6);
    else if (teamTab === "incomplete") list = teams.filter((t) => t.members.length < 6);
    else if (teamTab === "valid") list = teams.filter((t) => t.members.some((m) => m.gender?.toLowerCase() === "female"));
    else if (teamTab === "invalid") list = teams.filter((t) => !t.members.some((m) => m.gender?.toLowerCase() === "female"));
    else if (teamTab === "multipleFemales") list = teams.filter((t) => t.members.filter(m => m.gender?.toLowerCase() === "female").length > 1);

    if (!search.trim()) return list;
    const q = search.toLowerCase().trim();
    return list.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.ownerEmail.toLowerCase().includes(q) ||
        t.members.some(
          (m) =>
            m.email.toLowerCase().includes(q) ||
            m.name?.toLowerCase().includes(q) ||
            m.regNo?.toLowerCase().includes(q),
        ),
    );
  }, [teams, teamTab, search]);

  function exportCSV() {
    const headers = ["Name", "Email", "Phone", "Reg No", "Branch", "Gender", "Profile Complete", "Team Assigned"];
    const rows = users.map((u) => [
      `"${u.name ?? ""}"`,
      `"${u.email}"`,
      `"${u.phone ?? ""}"`,
      `"${u.regNo ?? ""}"`,
      `"${u.branch ?? ""}"`,
      `"${u.gender ?? ""}"`,
      u.isComplete ? "Yes" : "No",
      assignedEmailsSet.has(u.email.toLowerCase()) ? "Yes" : "No",
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `sih_users_report_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  if (loading) {
    return <main className="p-4 sm:p-6 text-sm text-slate-500">Loading admin dashboard...</main>;
  }

  if (error) {
    return (
      <main className="p-4 sm:p-6 text-slate-900">
        <div className="mx-auto max-w-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <h2 className="font-bold">Access Restricted</h2>
          <p className="mt-1">{error}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="p-3 sm:p-6 text-slate-900 min-h-screen bg-slate-50/30">
      <div className="mx-auto max-w-4xl space-y-4 sm:space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 pb-3 gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">Admin Portal</h1>
            <p className="text-xs text-slate-500">Poornima SIH Directory & Compliance Supervision</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportCSV}
              type="button"
              className="w-full sm:w-auto border border-slate-300 hover:border-black text-xs font-semibold px-3 py-2 sm:py-1.5 bg-white text-slate-800 transition-colors text-center"
            >
              📥 Export CSV
            </button>
          </div>
        </div>

        {/* Overview Stat Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          <div className="border border-slate-200 p-2.5 sm:p-3 bg-white">
            <div className="text-[10px] sm:text-xs text-slate-500 uppercase font-medium truncate">Total Registered</div>
            <div className="text-lg sm:text-xl font-bold mt-0.5 text-slate-900">{users.length}</div>
          </div>
          <div className="border border-slate-200 p-2.5 sm:p-3 bg-white">
            <div className="text-[10px] sm:text-xs text-slate-500 uppercase font-medium truncate">Active Teams</div>
            <div className="text-lg sm:text-xl font-bold mt-0.5 text-slate-900">{teams.length}</div>
          </div>
          <div className="border border-amber-200 p-2.5 sm:p-3 bg-amber-50/50">
            <div className="text-[10px] sm:text-xs text-amber-800 uppercase font-medium truncate">Unassigned Users</div>
            <div className="text-lg sm:text-xl font-bold mt-0.5 text-amber-900">{unassignedUsers.length}</div>
          </div>
          <div className="border border-red-200 p-2.5 sm:p-3 bg-red-50/50">
            <div className="text-[10px] sm:text-xs text-red-800 uppercase font-medium truncate">Incomplete Profiles</div>
            <div className="text-lg sm:text-xl font-bold mt-0.5 text-red-900">{incompleteProfileUsers.length}</div>
          </div>
        </div>

        {/* Main Tabs */}
        <div className="flex items-center gap-4 border-b border-slate-200">
          <button
            className={`pb-3 pt-1 px-1 text-sm font-semibold transition-colors border-b-2 ${
              mainTab === "teams" ? "border-black text-black" : "border-transparent text-slate-500 hover:text-black"
            }`}
            onClick={() => setMainTab("teams")}
            type="button"
          >
            Teams ({teams.length})
          </button>
          <button
            className={`pb-3 pt-1 px-1 text-sm font-semibold transition-colors border-b-2 ${
              mainTab === "users" ? "border-black text-black" : "border-transparent text-slate-500 hover:text-black"
            }`}
            onClick={() => setMainTab("users")}
            type="button"
          >
            Users Directory ({users.length})
          </button>
        </div>

        {/* Search Controls */}
        <div className="flex flex-col gap-3 pb-2">
          <input
            type="text"
            placeholder="Search name, email, reg no, phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border border-slate-300 text-xs px-3 py-2 outline-none focus:border-black bg-white shadow-sm"
          />

          {mainTab === "users" && (
            <div className="flex flex-col gap-2 pt-1">
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: "all", label: "All Users" },
                  { id: "unassigned", label: "Unassigned" },
                  { id: "incomplete", label: "Incomplete" },
                ].map((tab) => {
                  const isActive = userTab === tab.id;
                  let activeClasses = "border-black bg-black text-white";
                  if (isActive && tab.id === "unassigned") activeClasses = "border-amber-600 bg-amber-600 text-white";
                  if (isActive && tab.id === "incomplete") activeClasses = "border-red-600 bg-red-600 text-white";

                  return (
                    <button
                      key={tab.id}
                      className={`border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                        isActive ? activeClasses : "border-slate-300 text-slate-600 hover:bg-slate-50 bg-white"
                      }`}
                      onClick={() => setUserTab(tab.id)}
                      type="button"
                    >
                      {tab.label} ({counts[tab.id] || 0})
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[
                  ...KNOWN_SECTIONS.map((sec) => ({ id: sec, label: sec })),
                  { id: "OTHER", label: "Other" },
                ].map((tab) => {
                  const isActive = userTab === tab.id;
                  const activeClasses = "border-black bg-black text-white";

                  return (
                    <button
                      key={tab.id}
                      className={`border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                        isActive ? activeClasses : "border-slate-300 text-slate-600 hover:bg-slate-50 bg-white"
                      }`}
                      onClick={() => setUserTab(tab.id)}
                      type="button"
                    >
                      {tab.label} ({counts[tab.id] || 0})
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {mainTab === "teams" && (
            <div className="flex flex-col gap-2 pt-1">
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: "all", label: "All Teams" },
                  { id: "complete", label: "Complete (6 Members)" },
                  { id: "incomplete", label: "Incomplete (<6 Members)" },
                ].map((tab) => {
                  const isActive = teamTab === tab.id;
                  let activeClasses = "border-black bg-black text-white";
                  if (isActive && tab.id === "incomplete") activeClasses = "border-amber-600 bg-amber-600 text-white";
                  if (isActive && tab.id === "complete") activeClasses = "border-emerald-600 bg-emerald-600 text-white";

                  return (
                    <button
                      key={tab.id}
                      className={`border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                        isActive ? activeClasses : "border-slate-300 text-slate-600 hover:bg-slate-50 bg-white"
                      }`}
                      onClick={() => setTeamTab(tab.id)}
                      type="button"
                    >
                      {tab.label} ({(teamCounts as any)[tab.id] || 0})
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: "valid", label: "Valid (Has Female)" },
                  { id: "invalid", label: "Invalid (No Female)" },
                  { id: "multipleFemales", label: "Multiple Females" },
                ].map((tab) => {
                  const isActive = teamTab === tab.id;
                  let activeClasses = "border-black bg-black text-white";
                  if (isActive && tab.id === "invalid") activeClasses = "border-amber-600 bg-amber-600 text-white";
                  if (isActive && (tab.id === "valid" || tab.id === "multipleFemales")) activeClasses = "border-emerald-600 bg-emerald-600 text-white";

                  return (
                    <button
                      key={tab.id}
                      className={`border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                        isActive ? activeClasses : "border-slate-300 text-slate-600 hover:bg-slate-50 bg-white"
                      }`}
                      onClick={() => setTeamTab(tab.id)}
                      type="button"
                    >
                      {tab.label} ({(teamCounts as any)[tab.id] || 0})
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Content Section */}
        {mainTab === "teams" ? (
          <div className="space-y-3">
            {filteredTeams.length === 0 ? (
              <div className="border border-slate-200 p-6 text-center text-xs text-slate-400 bg-white">
                No matching teams found.
              </div>
            ) : (
              filteredTeams.map((t) => (
                <AdminTeamCard key={t.id} t={t} />
              ))
            )}
          </div>
        ) : (
          <div>
            {/* Mobile View: Clean Responsive Card List */}
            <div className="block sm:hidden space-y-2.5">
              {filteredUsers.length === 0 ? (
                <div className="border border-slate-200 p-6 text-center text-xs text-slate-400 bg-white">
                  No matching users found.
                </div>
              ) : (
                filteredUsers.map((u) => {
                  const isAssigned = assignedEmailsSet.has(u.email.toLowerCase());

                  return (
                    <div key={u.id} className="border border-slate-200 p-3 bg-white space-y-1.5 text-xs">
                      <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-1.5">
                        <div>
                          <div className="font-bold text-slate-900">{u.name ?? "Name Pending"}</div>
                          <div className="text-slate-500 text-[11px] break-all">{u.email}</div>
                          <div className="mt-0.5 inline-block bg-slate-100 text-slate-600 px-1.5 py-0.5 text-[9px] font-bold rounded-sm border border-slate-200">{getSection(u.email)}</div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          {!u.isComplete && (
                            <span className="bg-red-50 text-red-700 border border-red-200 text-[10px] px-1.5 py-0.5 font-medium whitespace-nowrap">
                              Incomplete Info
                            </span>
                          )}
                          {!isAssigned ? (
                            <span className="bg-amber-50 text-amber-800 border border-amber-200 text-[10px] px-1.5 py-0.5 font-medium whitespace-nowrap">
                              No Team
                            </span>
                          ) : (
                            <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] px-1.5 py-0.5 font-medium whitespace-nowrap">
                              In Team
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] text-slate-600">
                        <div><span className="text-slate-400">Reg No:</span> {u.regNo ?? "N/A"}</div>
                        <div><span className="text-slate-400">Branch:</span> {u.branch ?? "N/A"}</div>
                        <div><span className="text-slate-400">Gender:</span> {u.gender ?? "N/A"}</div>
                        <div><span className="text-slate-400">Phone:</span> {u.phone ?? "N/A"}</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Desktop View: Full Data Table */}
            <div className="hidden sm:block border border-slate-200 overflow-x-auto bg-white">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 uppercase text-slate-500">
                  <tr>
                    <th className="p-3 font-semibold">Name</th>
                    <th className="p-3 font-semibold">Email</th>
                    <th className="p-3 font-semibold">Section</th>
                    <th className="p-3 font-semibold">Phone</th>
                    <th className="p-3 font-semibold">Reg No.</th>
                    <th className="p-3 font-semibold">Branch</th>
                    <th className="p-3 font-semibold">Gender</th>
                    <th className="p-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-slate-400">
                        No matching users found.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => {
                      const isAssigned = assignedEmailsSet.has(u.email.toLowerCase());

                      return (
                        <tr key={u.id}>
                          <td className="p-3 font-medium text-slate-900">{u.name ?? "N/A"}</td>
                          <td className="p-3 text-slate-600">{u.email}</td>
                          <td className="p-3 text-slate-600"><span className="bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded-sm font-bold text-[10px]">{getSection(u.email)}</span></td>
                          <td className="p-3 text-slate-600">{u.phone ?? "N/A"}</td>
                          <td className="p-3 text-slate-600">{u.regNo ?? "N/A"}</td>
                          <td className="p-3 text-slate-600">{u.branch ?? "N/A"}</td>
                          <td className="p-3 text-slate-600">{u.gender ?? "N/A"}</td>
                          <td className="p-3">
                            <div className="flex items-center gap-1.5">
                              {!u.isComplete && (
                                <span className="bg-red-50 text-red-700 border border-red-200 text-[10px] px-1.5 py-0.5 font-medium">
                                  Incomplete Info
                                </span>
                              )}
                              {!isAssigned && (
                                <span className="bg-amber-50 text-amber-800 border border-amber-200 text-[10px] px-1.5 py-0.5 font-medium">
                                  No Team
                                </span>
                              )}
                              {isAssigned && (
                                <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] px-1.5 py-0.5 font-medium">
                                  In Team
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
