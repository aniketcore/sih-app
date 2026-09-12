import { auth } from "./firebase";
import { normalizeEmail } from "./invite-state";

export type TeamMember = {
  email: string;
  photoUrl?: string;
  gender?: string;
};

export type Team = {
  id: string;
  name: string;
  ownerEmail: string;
  members: TeamMember[];
};

export type Invite = {
  id: string;
  teamId: string;
  teamName: string;
  fromEmail: string;
  toEmail: string;
  status: string;
};

export type UserProfile = {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  regNo: string | null;
  gender: string | null;
  branch: string | null;
  photoUrl: string | null;
  isComplete: boolean;
  isAdmin?: boolean;
};

export type TeamStore = {
  watchOwnedTeams: (userId: string, onChange: (teams: Team[]) => void, options?: { disablePolling?: boolean }) => Unsubscribe;
  watchInvites: (email: string, onChange: (invites: Invite[]) => void, options?: { disablePolling?: boolean }) => Unsubscribe;
  watchOutgoingInvites: (teamId: string, onChange: (invites: Invite[]) => void, options?: { disablePolling?: boolean }) => Unsubscribe;
  getUserProfile: () => Promise<{ isFrozen: boolean; isLeadersOnlyLogin: boolean; isLeader: boolean; claimedPs: string | null; user: UserProfile | null }>;
  getAdminOverview: () => Promise<{ isFrozen: boolean; users: UserProfile[]; teams: Array<Team & { createdAt: number }> } | null>;
  saveUserProfile: (input: { name: string; phone: string; regNo: string; gender: string; branch: string }) => Promise<void>;
  syncUser: (input: { uid: string; email: string; photoUrl?: string | null }) => Promise<void>;
  createTeam: (input: { name: string; ownerUid: string; ownerEmail: string }) => Promise<void>;
  updateTeamName: (teamId: string, name: string) => Promise<void>;
  deleteTeam: (teamId: string) => Promise<void>;
  kickMember: (teamId: string, targetEmail: string) => Promise<void>;
  createInvite: (input: { teamId: string; teamName: string; fromUid: string; fromEmail: string; toEmail: string }) => Promise<void>;
  acceptInvite: (input: { inviteId: string; userId: string; userEmail: string }) => Promise<void>;
  cancelInvite: (inviteId: string) => Promise<void>;
};

type Unsubscribe = () => void;

const pollIntervalMs = 30000;

async function getAuthToken() {
  const user = auth.currentUser;

  if (!user) {
    throw new Error("Not authenticated");
  }

  return user.getIdToken();
}

async function requestJson<T>(input: RequestInfo, init?: RequestInit) {
  const token = await getAuthToken();
  const response = await fetch(input, {
    cache: "no-store",
    ...init,
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });

  const payload = (await response.json()) as T & { error?: string };

  if (!response.ok) {
    throw new Error(payload.error ?? `Request failed with ${response.status}`);
  }

  return payload;
}

function watchList<T>(urlFactory: () => string, key: string, onChange: (items: T[]) => void, options?: { disablePolling?: boolean }): Unsubscribe {
  let cancelled = false;

  async function refresh() {
    try {
      const payload = await requestJson<Record<string, T[]>>(urlFactory());
      if (!cancelled) onChange(payload[key] ?? []);
    } catch (cause) {
      if (!cancelled) console.error(cause);
    }
  }

  void refresh();

  let interval: number | undefined;
  if (!options?.disablePolling) {
    interval = window.setInterval(refresh, pollIntervalMs);
  }

  return () => {
    cancelled = true;
    if (interval !== undefined) window.clearInterval(interval);
  };
}

export const teamStore: TeamStore = {
  watchOwnedTeams(userId, onChange, options) {
    return watchList<Team>(() => `/api/teams?userId=${encodeURIComponent(userId)}`, "teams", onChange, options);
  },

  watchInvites(email, onChange, options) {
    return watchList<Invite>(() => `/api/invites?email=${encodeURIComponent(normalizeEmail(email))}`, "invites", onChange, options);
  },

  watchOutgoingInvites(teamId, onChange, options) {
    return watchList<Invite>(() => `/api/invites?teamId=${encodeURIComponent(teamId)}`, "outgoingInvites", onChange, options);
  },

  async getUserProfile() {
    const res = await requestJson<{ isFrozen: boolean; isLeadersOnlyLogin: boolean; isLeader: boolean; claimedPs: string | null; user: UserProfile | null }>("/api/users");
    return res;
  },

  async getAdminOverview() {
    const res = await requestJson<{ isFrozen: boolean; users: UserProfile[]; teams: Array<Team & { createdAt: number }> }>("/api/admin");
    return res;
  },

  async saveUserProfile(input) {
    const user = auth.currentUser;
    if (!user) throw new Error("Not authenticated");
    await requestJson<{ ok: true }>("/api/users", {
      method: "POST",
      body: JSON.stringify({
        uid: user.uid,
        email: normalizeEmail(user.email ?? ""),
        name: input.name,
        phone: input.phone,
        regNo: input.regNo,
        gender: input.gender,
        branch: input.branch,
      }),
    });
  },

  async syncUser(input) {
    await requestJson<{ ok: true }>("/api/users", {
      method: "POST",
      body: JSON.stringify({
        uid: input.uid,
        email: normalizeEmail(input.email),
        photoUrl: input.photoUrl ?? null,
      }),
    });
  },

  async createTeam(input) {
    await requestJson<{ ok: true }>("/api/teams", {
      method: "POST",
      body: JSON.stringify({
        name: input.name,
        ownerUid: input.ownerUid,
        ownerEmail: input.ownerEmail,
      }),
    });
  },

  async updateTeamName(teamId, name) {
    await requestJson<{ ok: true }>("/api/teams", {
      method: "PATCH",
      body: JSON.stringify({
        teamId,
        name,
      }),
    });
  },

  async deleteTeam(teamId) {
    await requestJson<{ ok: true }>(`/api/teams?teamId=${encodeURIComponent(teamId)}`, {
      method: "DELETE",
    });
  },

  async kickMember(teamId, targetEmail) {
    await requestJson<{ ok: true }>(`/api/teams?teamId=${encodeURIComponent(teamId)}&targetEmail=${encodeURIComponent(normalizeEmail(targetEmail))}`, {
      method: "DELETE",
    });
  },

  async createInvite(input) {
    await requestJson<{ ok: true }>("/api/invites", {
      method: "POST",
      body: JSON.stringify({
        teamId: input.teamId,
        teamName: input.teamName,
        fromUid: input.fromUid,
        fromEmail: input.fromEmail,
        toEmail: normalizeEmail(input.toEmail),
      }),
    });
  },

  async acceptInvite(input) {
    await requestJson<{ ok: true }>("/api/invites", {
      method: "PATCH",
      body: JSON.stringify({
        inviteId: input.inviteId,
        userId: input.userId,
        userEmail: input.userEmail,
      }),
    });
  },

  async cancelInvite(inviteId) {
    await requestJson<{ ok: true }>(`/api/invites?inviteId=${encodeURIComponent(inviteId)}`, {
      method: "DELETE",
    });
  },
};

