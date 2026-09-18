"use client";

import { useEffect, useMemo, useState } from "react";
import { subscribeAuth, type AuthUser } from "../../lib/auth";
import { teamStore, getTeamNumber, type UserProfile, type Team } from "../../lib/team-store";
import { problemStatements } from "../../lib/problem-statements";
import * as XLSX from "xlsx";

type AdminTeam = Omit<Team, "members"> & {
  createdAt: number;
  claimedPs?: string | null;
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
  const femaleCount = t.members.filter((m) => m.gender?.toLowerCase() === "female").length;
  const hasFemale = femaleCount > 0;

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
              t.claimedPs
                ? "border-purple-300 bg-purple-50 text-purple-700"
                : "border-slate-300 bg-slate-50 text-slate-500"
            }`}
          >
            {t.claimedPs ? `PS: ${t.claimedPs}` : "No PS"}
          </span>
          <span
            className={`text-[11px] sm:text-xs px-2 py-0.5 border font-semibold ${
              hasFemale
                ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                : "border-amber-300 bg-amber-50 text-amber-800"
            }`}
          >
            {hasFemale ? `✓ SIH Female Requirement Met (${femaleCount})` : "⚠️ Female Member Missing"}
          </span>
          <span className="text-[11px] sm:text-xs border border-slate-200 px-2 py-0.5 text-slate-600 font-medium bg-slate-50">
            {t.members.length} / 6 Members
          </span>
        </div>
      </div>

      {isExpanded && (
        <div className="divide-y divide-slate-100 text-xs border-t border-slate-100 px-3 sm:px-4 pb-1">
          {t.members.map((m, idx) => {
            const isFemale = m.gender?.toLowerCase() === "female";
            const isMale = m.gender?.toLowerCase() === "male";
            
            return (
              <div key={m.email || idx} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-2 pl-4">
                <div className="break-all flex items-center gap-2">
                  <span className={`flex-shrink-0 w-2 h-2 rounded-full ${isFemale ? 'bg-pink-400' : isMale ? 'bg-blue-400' : 'bg-slate-300'}`} title={m.gender ?? "Unknown"} />
                  <div>
                    <span className="font-semibold text-slate-900">{m.name ?? "N/A"}</span>{" "}
                    <span className="text-slate-500">({m.email})</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-600">
                  <span>Reg: {m.regNo ?? "N/A"}</span>
                  <span>Branch: {m.branch ?? "N/A"}</span>
                  <span className={isFemale ? 'text-pink-600 font-medium' : isMale ? 'text-blue-600 font-medium' : ''}>Gender: {m.gender ?? "N/A"}</span>
                  <span>Phone: {m.phone ?? "N/A"}</span>
                </div>
              </div>
            );
          })}
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
  const [userSectionFilter, setUserSectionFilter] = useState("all");
  const [userAssignmentFilter, setUserAssignmentFilter] = useState("all");
  const [userProfileFilter, setUserProfileFilter] = useState("all");
  const [userGenderFilter, setUserGenderFilter] = useState("all");
  const [teamSizeFilter, setTeamSizeFilter] = useState("all");
  const [teamGenderFilter, setTeamGenderFilter] = useState("all");
  const [teamPsFilter, setTeamPsFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [isFrozen, setIsFrozen] = useState(false);

  const KNOWN_SECTIONS = ["IT","ME","CY","CR","CE","CA", "AD", "EC", "EE", "CS"];

  async function loadAdminData() {
    try {
      const data = await teamStore.getAdminOverview();
      if (data) {
        setUsers(data.users);
        setTeams(data.teams as AdminTeam[]);
        setIsFrozen(data.isFrozen);
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
    return users.filter((u) => !assignedEmailsSet.has(u.email.toLowerCase()) && getSection(u.email) !== "OTHER");
  }, [users, assignedEmailsSet]);

  const unassignedGirls = useMemo(() => unassignedUsers.filter((u) => u.gender?.toLowerCase() === "female"), [unassignedUsers]);
  const unassignedBoys = useMemo(() => unassignedUsers.filter((u) => u.gender?.toLowerCase() === "male"), [unassignedUsers]);

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
      unassignedGirls: unassignedGirls.length,
      unassignedBoys: unassignedBoys.length,
      incomplete: incompleteProfileUsers.length,
      OTHER: 0,
      OTHER_unassigned: 0,
    };
    KNOWN_SECTIONS.forEach((s) => {
      c[s] = 0;
      c[`${s}_unassigned`] = 0;
    });
    users.forEach((u) => {
      const sec = getSection(u.email);
      const isUnassigned = !assignedEmailsSet.has(u.email.toLowerCase());

      if (c[sec] !== undefined) {
        c[sec]++;
        if (isUnassigned) c[`${sec}_unassigned`]++;
      } else {
        c["OTHER"]++;
        if (isUnassigned) c["OTHER_unassigned"]++;
      }
    });
    return c;
  }, [users, unassignedUsers, unassignedGirls, unassignedBoys, incompleteProfileUsers, assignedEmailsSet]);

  const teamCounts = useMemo(() => {
    let complete = 0;
    let incomplete = 0;
    let valid = 0;
    let invalid = 0;
    let multipleFemales = 0;
    let moreThan2Females = 0;
    let withPs = 0;
    let withoutPs = 0;
    let hardwarePs = 0;
    let softwarePs = 0;

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
      if (femaleCount > 2) moreThan2Females++;

      if (t.claimedPs) {
        withPs++;
        const psCategory = problemStatements.find((ps) => ps.ps_number === t.claimedPs)?.category;
        if (psCategory === "Hardware") hardwarePs++;
        else if (psCategory === "Software") softwarePs++;
      }
      else withoutPs++;
    });

    return {
      all: teams.length,
      complete,
      incomplete,
      valid,
      invalid,
      multipleFemales,
      moreThan2Females,
      withPs,
      withoutPs,
      hardwarePs,
      softwarePs,
    };
  }, [teams]);

  // Search filter
  const filteredUsers = useMemo(() => {
    let list = users;
    
    // Section filter
    if (userSectionFilter !== "all") {
      list = list.filter((u) => getSection(u.email) === userSectionFilter);
    }

    // Assignment filter
    if (userAssignmentFilter === "unassigned") {
      list = list.filter((u) => !assignedEmailsSet.has(u.email.toLowerCase()));
    } else if (userAssignmentFilter === "assigned") {
      list = list.filter((u) => assignedEmailsSet.has(u.email.toLowerCase()));
    }

    // Profile filter
    if (userProfileFilter === "complete") {
      list = list.filter((u) => {
        if (typeof u.isComplete === "boolean") return u.isComplete;
        return Boolean(u.name?.trim() && u.phone?.trim() && u.regNo?.trim() && u.gender?.trim() && u.branch?.trim());
      });
    } else if (userProfileFilter === "incomplete") {
      list = list.filter((u) => {
        if (typeof u.isComplete === "boolean") return !u.isComplete;
        return !u.name?.trim() || !u.phone?.trim() || !u.regNo?.trim() || !u.gender?.trim() || !u.branch?.trim();
      });
    }

    // Gender filter
    if (userGenderFilter === "female") {
      list = list.filter((u) => u.gender?.toLowerCase() === "female");
    } else if (userGenderFilter === "male") {
      list = list.filter((u) => u.gender?.toLowerCase() === "male");
    }
    
    // Sort by unassigned status first, then by the 2 or 3 digit roll number just before the '@' in the email
    list = [...list].sort((a, b) => {
      const aAssigned = assignedEmailsSet.has(a.email.toLowerCase());
      const bAssigned = assignedEmailsSet.has(b.email.toLowerCase());
      
      if (!aAssigned && bAssigned) return -1;
      if (aAssigned && !bAssigned) return 1;

      const getRollNum = (email: string) => {
        const match = email.match(/(\d+)@/);
        return match ? parseInt(match[1], 10) : 99999;
      };
      return getRollNum(a.email) - getRollNum(b.email);
    });

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
  }, [users, assignedEmailsSet, userSectionFilter, userAssignmentFilter, userProfileFilter, userGenderFilter, search]);

  const filteredTeams = useMemo(() => {
    let list = teams;
    if (teamSizeFilter === "complete") list = list.filter((t) => t.members.length >= 6);
    else if (teamSizeFilter === "incomplete") list = list.filter((t) => t.members.length < 6);

    if (teamGenderFilter === "valid") list = list.filter((t) => t.members.some((m) => m.gender?.toLowerCase() === "female"));
    else if (teamGenderFilter === "invalid") list = list.filter((t) => !t.members.some((m) => m.gender?.toLowerCase() === "female"));
    else if (teamGenderFilter === "multipleFemales") list = list.filter((t) => t.members.filter(m => m.gender?.toLowerCase() === "female").length > 1);
    else if (teamGenderFilter === "moreThan2Females") list = list.filter((t) => t.members.filter(m => m.gender?.toLowerCase() === "female").length > 2);

    if (teamPsFilter === "withPs") list = list.filter((t) => !!t.claimedPs);
    else if (teamPsFilter === "withoutPs") list = list.filter((t) => !t.claimedPs);
    else if (teamPsFilter === "hardwarePs") list = list.filter((t) => t.claimedPs && problemStatements.find(ps => ps.ps_number === t.claimedPs)?.category === "Hardware");
    else if (teamPsFilter === "softwarePs") list = list.filter((t) => t.claimedPs && problemStatements.find(ps => ps.ps_number === t.claimedPs)?.category === "Software");

    if (!search.trim()) return list;
    const q = search.toLowerCase().trim();
    return list.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q) ||
        t.members.some(m => m.email.toLowerCase().includes(q) || m.name?.toLowerCase().includes(q) || m.phone?.includes(q) || m.regNo?.toLowerCase().includes(q))
    );
  }, [teams, search, teamSizeFilter, teamGenderFilter, teamPsFilter, problemStatements]);



  function exportExcel() {
    const emailToTeam = new Map<string, AdminTeam>();
    teams.forEach(t => {
      t.members.forEach(m => emailToTeam.set(m.email.toLowerCase(), t));
    });

    const headers = [
      "Team Name", "Team Number", "PS ID", "Members Count", "Role", 
      "Name", "Email", "Phone", "Reg No", "Branch", "Gender", "Profile Complete"
    ];

    const colWidths = [
      { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 10 }, 
      { wch: 25 }, { wch: 35 }, { wch: 15 }, { wch: 20 }, 
      { wch: 10 }, { wch: 10 }, { wch: 15 }
    ];

    const applyStyles = (worksheet: any, rowData: any[][]) => {
      for (const key in worksheet) {
        if (key[0] === '!') continue;
        const colMatch = key.match(/[A-Z]+/);
        const rowMatch = key.match(/\d+/);
        if (!colMatch || !rowMatch) continue;

        const col = colMatch[0];
        const rowNum = parseInt(rowMatch[0], 10);
        let style: any = worksheet[key].s || {};

        if (['A', 'B', 'C', 'D'].includes(col)) {
          style.alignment = { vertical: "center", horizontal: "center", wrapText: true };
        }

        if (rowNum > 1) {
          const dataRow = rowData[rowNum - 2];
          if (dataRow && typeof dataRow[3] === 'number' && dataRow[3] > 0 && dataRow[3] <= 3) {
            style.fill = { fgColor: { rgb: "FFFFCCCC" } };
          }
        }

        if (Object.keys(style).length > 0) {
          worksheet[key].s = style;
        }
      }
    };

    const sectionToRows = new Map<string, any[][]>();
    const allRows: any[][] = [];
    const exportedEmails = new Set<string>();

    const userMap = new Map<string, UserProfile>();
    filteredUsers.forEach(u => userMap.set(u.email.toLowerCase(), u));

    const addRow = (u: UserProfile, team: AdminTeam | null, role: string) => {
      const row = [
        team ? team.name : "None",
        team ? getTeamNumber(team.id) : "None",
        team ? (team.claimedPs || "None") : "None",
        team ? team.members.length : 0,
        role,
        u.name ?? "",
        u.email,
        u.phone ?? "",
        u.regNo ?? "",
        u.branch ?? "",
        u.gender ?? "",
        u.isComplete ? "Yes" : "No",
        team ? team.id : "None"
      ];
      allRows.push(row);
      const sec = getSection(u.email);
      if (!sectionToRows.has(sec)) sectionToRows.set(sec, []);
      sectionToRows.get(sec)!.push(row);
    };

    teams.forEach(team => {
      team.members.forEach(m => {
        const u = userMap.get(m.email.toLowerCase());
        if (u) {
          const role = team.ownerEmail.toLowerCase() === u.email.toLowerCase() ? "Leader" : "Member";
          addRow(u, team, role);
          exportedEmails.add(u.email.toLowerCase());
        }
      });
    });

    filteredUsers.forEach((u) => {
      if (!exportedEmails.has(u.email.toLowerCase())) {
        addRow(u, null, "None");
      }
    });

    const wb = XLSX.utils.book_new();

    allRows.sort((a, b) => {
      const teamA = String(a[12]);
      const teamB = String(b[12]);
      if (teamA === "None" && teamB !== "None") return 1;
      if (teamA !== "None" && teamB === "None") return -1;
      return teamA.localeCompare(teamB);
    });

    const masterWs = XLSX.utils.aoa_to_sheet([headers, ...allRows.map(r => r.slice(0, 12))]);
    masterWs["!cols"] = colWidths;
    applyStyles(masterWs, allRows);
    const masterMerges: any[] = [];
    let masterStartRow = 1;
    let masterCurrentTeamId = allRows.length > 0 ? allRows[0][12] : null;

    for (let i = 1; i <= allRows.length; i++) {
      const teamId = i < allRows.length ? allRows[i][12] : null;
      if (teamId !== masterCurrentTeamId) {
        if (masterCurrentTeamId !== "None") {
          const endRow = i;
          if (endRow > masterStartRow) {
            masterMerges.push({ s: { r: masterStartRow, c: 0 }, e: { r: endRow, c: 0 } });
            masterMerges.push({ s: { r: masterStartRow, c: 1 }, e: { r: endRow, c: 1 } });
            masterMerges.push({ s: { r: masterStartRow, c: 2 }, e: { r: endRow, c: 2 } });
            masterMerges.push({ s: { r: masterStartRow, c: 3 }, e: { r: endRow, c: 3 } });
          }
        }
        masterStartRow = i + 1;
        masterCurrentTeamId = teamId;
      }
    }
    if (masterMerges.length > 0) masterWs["!merges"] = masterMerges;
    XLSX.utils.book_append_sheet(wb, masterWs, "All Data");

    // 2. Create individual Section Sheets
    const sections = Array.from(sectionToRows.keys()).sort();
    sections.forEach((sec) => {
      const rows = sectionToRows.get(sec)!;
      rows.sort((a, b) => {
        const teamA = String(a[12]);
        const teamB = String(b[12]);
        if (teamA === "None" && teamB !== "None") return 1;
        if (teamA !== "None" && teamB === "None") return -1;
        return teamA.localeCompare(teamB);
      });

      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows.map(r => r.slice(0, 12))]);
      ws["!cols"] = colWidths;
      applyStyles(ws, rows);

      const merges: any[] = [];
      let startRow = 1;
      let currentTeamId = rows.length > 0 ? rows[0][12] : null;

      for (let i = 1; i <= rows.length; i++) {
        const teamId = i < rows.length ? rows[i][12] : null;
        if (teamId !== currentTeamId) {
          if (currentTeamId !== "None") {
            const endRow = i;
            if (endRow > startRow) {
              merges.push({ s: { r: startRow, c: 0 }, e: { r: endRow, c: 0 } });
              merges.push({ s: { r: startRow, c: 1 }, e: { r: endRow, c: 1 } });
              merges.push({ s: { r: startRow, c: 2 }, e: { r: endRow, c: 2 } });
              merges.push({ s: { r: startRow, c: 3 }, e: { r: endRow, c: 3 } });
            }
          }
          startRow = i + 1;
          currentTeamId = teamId;
        }
      }

      if (merges.length > 0) {
        ws["!merges"] = merges;
      }
      XLSX.utils.book_append_sheet(wb, ws, sec === "OTHER" ? "OTHER" : `Section ${sec}`);
    });

    XLSX.writeFile(wb, "SIH_Admin_Data.xlsx");
  }

  function exportCompleteExcel() {
    const validTeams = teams.filter((t) => !!t.claimedPs);
    
    const emailToTeam = new Map<string, AdminTeam>();
    validTeams.forEach(t => {
      t.members.forEach(m => emailToTeam.set(m.email.toLowerCase(), t));
    });

    const validUsers = users.filter((u) => {
      const email = u.email.toLowerCase();
      return email.startsWith("2026pcea") && emailToTeam.has(email);
    });

    const headers = [
      "Team Name", "Team Number", "PS ID", "Members Count", "Role", 
      "Name", "Email", "Phone", "Reg No", "Branch", "Gender", "Profile Complete"
    ];

    const colWidths = [
      { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 10 }, 
      { wch: 25 }, { wch: 35 }, { wch: 15 }, { wch: 20 }, 
      { wch: 10 }, { wch: 10 }, { wch: 15 }
    ];

    const applyStyles = (worksheet: any, rowData: any[][]) => {
      for (const key in worksheet) {
        if (key[0] === '!') continue;
        const colMatch = key.match(/[A-Z]+/);
        const rowMatch = key.match(/\d+/);
        if (!colMatch || !rowMatch) continue;

        const col = colMatch[0];
        const rowNum = parseInt(rowMatch[0], 10);
        let style: any = worksheet[key].s || {};

        if (['A', 'B', 'C', 'D'].includes(col)) {
          style.alignment = { vertical: "center", horizontal: "center", wrapText: true };
        }

        if (rowNum > 1) {
          const dataRow = rowData[rowNum - 2];
          if (dataRow && typeof dataRow[3] === 'number' && dataRow[3] > 0 && dataRow[3] <= 3) {
            style.fill = { fgColor: { rgb: "FFFFCCCC" } };
          }
        }

        if (Object.keys(style).length > 0) {
          worksheet[key].s = style;
        }
      }
    };

    const sectionToRows = new Map<string, any[][]>();
    const allRows: any[][] = [];

    const userMap = new Map<string, UserProfile>();
    validUsers.forEach(u => userMap.set(u.email.toLowerCase(), u));

    const addRow = (u: UserProfile, team: AdminTeam, role: string) => {
      const row = [
        team.name,
        getTeamNumber(team.id),
        team.claimedPs || "None",
        team.members.length,
        role,
        u.name ?? "",
        u.email,
        u.phone ?? "",
        u.regNo ?? "",
        u.branch ?? "",
        u.gender ?? "",
        u.isComplete ? "Yes" : "No",
        team.id
      ];
      allRows.push(row);
      const sec = getSection(u.email);
      if (!sectionToRows.has(sec)) sectionToRows.set(sec, []);
      sectionToRows.get(sec)!.push(row);
    };

    validTeams.forEach(team => {
      team.members.forEach(m => {
        const u = userMap.get(m.email.toLowerCase());
        if (u) {
          const role = team.ownerEmail.toLowerCase() === u.email.toLowerCase() ? "Leader" : "Member";
          addRow(u, team, role);
        }
      });
    });

    const wb = XLSX.utils.book_new();

    allRows.sort((a, b) => String(a[12]).localeCompare(String(b[12])));

    const masterWs = XLSX.utils.aoa_to_sheet([headers, ...allRows.map(r => r.slice(0, 12))]);
    masterWs["!cols"] = colWidths;
    applyStyles(masterWs, allRows);
    const masterMerges: any[] = [];
    let masterStartRow = 1;
    let masterCurrentTeamId = allRows.length > 0 ? allRows[0][12] : null;

    for (let i = 1; i <= allRows.length; i++) {
      const teamId = i < allRows.length ? allRows[i][12] : null;
      if (teamId !== masterCurrentTeamId) {
        if (masterCurrentTeamId !== "None") {
          const endRow = i;
          if (endRow > masterStartRow) {
            masterMerges.push({ s: { r: masterStartRow, c: 0 }, e: { r: endRow, c: 0 } });
            masterMerges.push({ s: { r: masterStartRow, c: 1 }, e: { r: endRow, c: 1 } });
            masterMerges.push({ s: { r: masterStartRow, c: 2 }, e: { r: endRow, c: 2 } });
            masterMerges.push({ s: { r: masterStartRow, c: 3 }, e: { r: endRow, c: 3 } });
          }
        }
        masterStartRow = i + 1;
        masterCurrentTeamId = teamId;
      }
    }
    if (masterMerges.length > 0) masterWs["!merges"] = masterMerges;
    XLSX.utils.book_append_sheet(wb, masterWs, "All Data");

    // 2. Create individual Section Sheets
    const sections = Array.from(sectionToRows.keys()).sort();
    sections.forEach((sec) => {
      const rows = sectionToRows.get(sec)!;
      rows.sort((a, b) => String(a[12]).localeCompare(String(b[12])));

      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows.map(r => r.slice(0, 12))]);
      ws["!cols"] = colWidths;
      applyStyles(ws, rows);

      const merges: any[] = [];
      let startRow = 1;
      let currentTeamId = rows.length > 0 ? rows[0][12] : null;

      for (let i = 1; i <= rows.length; i++) {
        const teamId = i < rows.length ? rows[i][12] : null;
        if (teamId !== currentTeamId) {
          if (currentTeamId !== "None") {
            const endRow = i;
            if (endRow > startRow) {
              merges.push({ s: { r: startRow, c: 0 }, e: { r: endRow, c: 0 } });
              merges.push({ s: { r: startRow, c: 1 }, e: { r: endRow, c: 1 } });
              merges.push({ s: { r: startRow, c: 2 }, e: { r: endRow, c: 2 } });
              merges.push({ s: { r: startRow, c: 3 }, e: { r: endRow, c: 3 } });
            }
          }
          startRow = i + 1;
          currentTeamId = teamId;
        }
      }

      if (merges.length > 0) {
        ws["!merges"] = merges;
      }
      XLSX.utils.book_append_sheet(wb, ws, sec === "OTHER" ? "OTHER" : `Section ${sec}`);
    });

    XLSX.writeFile(wb, "SIH_Complete_Final_Data.xlsx");
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
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={exportExcel}
              type="button"
              className="w-full sm:w-auto border border-emerald-600 hover:bg-emerald-50 text-xs font-semibold px-3 py-2 sm:py-1.5 bg-white text-emerald-700 transition-colors text-center shadow-sm"
            >
              📊 Export Filtered View
            </button>
            <button
              onClick={exportCompleteExcel}
              type="button"
              className="w-full sm:w-auto border border-blue-600 hover:bg-blue-50 text-xs font-semibold px-3 py-2 sm:py-1.5 bg-white text-blue-700 transition-colors text-center shadow-sm"
            >
              📥 Download Complete Excel
            </button>
          </div>
        </div>

        {isFrozen && (
          <div className="border border-amber-200 bg-amber-50 p-3 text-amber-800 text-sm font-semibold rounded-sm flex items-center justify-center">
            ❄️ Team formation is currently frozen. No changes can be made by students.
          </div>
        )}

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
            <div className="flex flex-wrap gap-2 pt-1">
              <div className="flex items-center gap-1.5 border border-slate-300 bg-white px-2 shadow-sm rounded-sm">
                <span className="text-[10px] uppercase text-slate-500 font-bold">Section</span>
                <select
                  value={userSectionFilter}
                  onChange={(e) => setUserSectionFilter(e.target.value)}
                  className="text-xs py-1.5 outline-none bg-transparent"
                >
                  <option value="all">All ({counts.all || 0})</option>
                  {KNOWN_SECTIONS.map(sec => (
                    <option key={sec} value={sec}>
                      {sec} ({counts[sec] || 0}) {counts[`${sec}_unassigned`] ? `- ${counts[`${sec}_unassigned`]} no team` : ""}
                    </option>
                  ))}
                  <option value="OTHER">Other ({counts.OTHER || 0}) {counts.OTHER_unassigned ? `- ${counts.OTHER_unassigned} no team` : ""}</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5 border border-slate-300 bg-white px-2 shadow-sm rounded-sm">
                <span className="text-[10px] uppercase text-slate-500 font-bold">Team Status</span>
                <select
                  value={userAssignmentFilter}
                  onChange={(e) => setUserAssignmentFilter(e.target.value)}
                  className="text-xs py-1.5 outline-none bg-transparent"
                >
                  <option value="all">All</option>
                  <option value="unassigned">Unassigned / No Team ({counts.unassigned || 0})</option>
                  <option value="assigned">Assigned / Has Team</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5 border border-slate-300 bg-white px-2 shadow-sm rounded-sm">
                <span className="text-[10px] uppercase text-slate-500 font-bold">Profile</span>
                <select
                  value={userProfileFilter}
                  onChange={(e) => setUserProfileFilter(e.target.value)}
                  className="text-xs py-1.5 outline-none bg-transparent"
                >
                  <option value="all">All</option>
                  <option value="complete">Complete</option>
                  <option value="incomplete">Incomplete ({counts.incomplete || 0})</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5 border border-slate-300 bg-white px-2 shadow-sm rounded-sm">
                <span className="text-[10px] uppercase text-slate-500 font-bold">Gender</span>
                <select
                  value={userGenderFilter}
                  onChange={(e) => setUserGenderFilter(e.target.value)}
                  className="text-xs py-1.5 outline-none bg-transparent"
                >
                  <option value="all">All</option>
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                </select>
              </div>
            </div>
          )}

          {mainTab === "teams" && (
            <div className="flex flex-wrap gap-2 pt-1">
              <div className="flex items-center gap-1.5 border border-slate-300 bg-white px-2 shadow-sm rounded-sm">
                <span className="text-[10px] uppercase text-slate-500 font-bold">Size</span>
                <select
                  value={teamSizeFilter}
                  onChange={(e) => setTeamSizeFilter(e.target.value)}
                  className="text-xs py-1.5 outline-none bg-transparent"
                >
                  <option value="all">All Teams ({(teamCounts as any).all || 0})</option>
                  <option value="complete">Complete ({(teamCounts as any).complete || 0})</option>
                  <option value="incomplete">Incomplete ({(teamCounts as any).incomplete || 0})</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5 border border-slate-300 bg-white px-2 shadow-sm rounded-sm">
                <span className="text-[10px] uppercase text-slate-500 font-bold">Gender</span>
                <select
                  value={teamGenderFilter}
                  onChange={(e) => setTeamGenderFilter(e.target.value)}
                  className="text-xs py-1.5 outline-none bg-transparent"
                >
                  <option value="all">All ({(teamCounts as any).all || 0})</option>
                  <option value="valid">Valid / Has Female ({(teamCounts as any).valid || 0})</option>
                  <option value="invalid">Invalid / No Female ({(teamCounts as any).invalid || 0})</option>
                  <option value="multipleFemales">Multiple Females ({(teamCounts as any).multipleFemales || 0})</option>
                  <option value="moreThan2Females">More Than 2 Females ({(teamCounts as any).moreThan2Females || 0})</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5 border border-slate-300 bg-white px-2 shadow-sm rounded-sm">
                <span className="text-[10px] uppercase text-slate-500 font-bold">Problem Statement</span>
                <select
                  value={teamPsFilter}
                  onChange={(e) => setTeamPsFilter(e.target.value)}
                  className="text-xs py-1.5 outline-none bg-transparent"
                >
                  <option value="all">All ({(teamCounts as any).all || 0})</option>
                  <option value="withPs">Selected Any PS ({(teamCounts as any).withPs || 0})</option>
                  <option value="withoutPs">Not Selected ({(teamCounts as any).withoutPs || 0})</option>
                  <option value="hardwarePs">Hardware PS ({(teamCounts as any).hardwarePs || 0})</option>
                  <option value="softwarePs">Software PS ({(teamCounts as any).softwarePs || 0})</option>
                </select>
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
                          <div className="font-bold text-slate-900 flex items-center gap-1.5">
                            <span className={`flex-shrink-0 w-2 h-2 rounded-full ${u.gender?.toLowerCase() === 'female' ? 'bg-pink-400' : u.gender?.toLowerCase() === 'male' ? 'bg-blue-400' : 'bg-slate-300'}`} />
                            {u.name ?? "Name Pending"}
                          </div>
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
                        <div>
                          <span className="text-slate-400">Gender:</span>{" "}
                          <span className={u.gender?.toLowerCase() === 'female' ? 'text-pink-600 font-medium' : u.gender?.toLowerCase() === 'male' ? 'text-blue-600 font-medium' : ''}>
                            {u.gender ?? "N/A"}
                          </span>
                        </div>
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
                          <td className="p-3 font-medium text-slate-900">
                            <div className="flex items-center gap-1.5">
                              <span className={`flex-shrink-0 w-2 h-2 rounded-full ${u.gender?.toLowerCase() === 'female' ? 'bg-pink-400' : u.gender?.toLowerCase() === 'male' ? 'bg-blue-400' : 'bg-slate-300'}`} />
                              {u.name ?? "N/A"}
                            </div>
                          </td>
                          <td className="p-3 text-slate-600">{u.email}</td>
                          <td className="p-3 text-slate-600"><span className="bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded-sm font-bold text-[10px]">{getSection(u.email)}</span></td>
                          <td className="p-3 text-slate-600">{u.phone ?? "N/A"}</td>
                          <td className="p-3 text-slate-600">{u.regNo ?? "N/A"}</td>
                          <td className="p-3 text-slate-600">{u.branch ?? "N/A"}</td>
                          <td className={`p-3 ${u.gender?.toLowerCase() === 'female' ? 'text-pink-600 font-medium' : u.gender?.toLowerCase() === 'male' ? 'text-blue-600 font-medium' : 'text-slate-600'}`}>{u.gender ?? "N/A"}</td>
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
