"use client";

import { useEffect, useState } from "react";
import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
  type DocumentData,
} from "firebase/firestore";
import type { User } from "firebase/auth";
import { db } from "../lib/firebase";

type Team = {
  id: string;
  name: string;
  ownerEmail: string;
};

type Invite = {
  id: string;
  teamName: string;
  fromEmail: string;
  toEmail: string;
  status: string;
};

function mapDoc<T>(doc: DocumentData & { id: string }): T {
  return doc as T;
}

export function TeamBoard({ user }: { user: User }) {
  const [teamName, setTeamName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [teams, setTeams] = useState<Team[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const primaryTeam = teams[0] ?? null;

  useEffect(() => {
    const teamsQuery = query(collection(db, "teams"), where("ownerUid", "==", user.uid), orderBy("createdAt", "desc"));
    const invitesQuery = query(collection(db, "teamInvites"), where("toEmail", "==", user.email ?? ""), orderBy("createdAt", "desc"));

    const unsubscribeTeams = onSnapshot(teamsQuery, (snapshot) => {
      setTeams(snapshot.docs.map((doc) => mapDoc<Team>({ id: doc.id, ...doc.data() })));
    });

    const unsubscribeInvites = onSnapshot(invitesQuery, (snapshot) => {
      setInvites(snapshot.docs.map((doc) => mapDoc<Invite>({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubscribeTeams();
      unsubscribeInvites();
    };
  }, [user.email, user.uid]);

  async function createTeam() {
    if (!teamName.trim()) return;

    setBusy(true);
    setError(null);

    try {
      await addDoc(collection(db, "teams"), {
        name: teamName.trim(),
        ownerUid: user.uid,
        ownerEmail: user.email ?? "",
        createdAt: serverTimestamp(),
      });
      setTeamName("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Team creation failed");
    } finally {
      setBusy(false);
    }
  }

  async function sendInvite(team: Team) {
    if (!inviteEmail.trim()) return;

    setBusy(true);
    setError(null);

    try {
      await addDoc(collection(db, "teamInvites"), {
        teamId: team.id,
        teamName: team.name,
        fromUid: user.uid,
        fromEmail: user.email ?? "",
        toEmail: inviteEmail.trim().toLowerCase(),
        status: "pending",
        createdAt: serverTimestamp(),
      });
      setInviteEmail("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Invite failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-600">Team board</p>
        <h3 className="text-2xl font-semibold text-slate-950">Create one team and send requests</h3>
        <p className="text-sm text-slate-500">Each account can own one team. That creator then sends requests to others.</p>
      </div>

      {primaryTeam ? (
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <input
            className="rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-orange-500"
            onChange={(event) => setInviteEmail(event.target.value)}
            placeholder="invitee@example.com"
            value={inviteEmail}
          />
          <button
            className="rounded-full border border-orange-200 bg-orange-50 px-5 py-3 text-sm font-medium text-orange-700 disabled:opacity-50"
            disabled={busy}
            onClick={() => sendInvite(primaryTeam)}
            type="button"
          >
            Send request
          </button>
        </div>
      ) : (
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <input
            className="rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-orange-500"
            onChange={(event) => setTeamName(event.target.value)}
            placeholder="Team name"
            value={teamName}
          />
          <button
            className="rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white disabled:opacity-50"
            disabled={busy}
            onClick={createTeam}
            type="button"
          >
            Create team
          </button>
        </div>
      )}

      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <div>
          <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Your teams</h4>
          <div className="mt-3 space-y-3">
            {teams.length === 0 ? <p className="text-sm text-slate-500">No teams yet.</p> : null}
            {teams.map((team) => (
              <div key={team.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="font-medium text-slate-950">{team.name}</p>
                <p className="text-sm text-slate-500">Owner: {team.ownerEmail}</p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Pending requests</h4>
          <div className="mt-3 space-y-3">
            {invites.length === 0 ? <p className="text-sm text-slate-500">No requests yet.</p> : null}
            {invites.map((invite) => (
              <div key={invite.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="font-medium text-slate-950">{invite.teamName}</p>
                <p className="text-sm text-slate-500">From: {invite.fromEmail}</p>
                <p className="text-sm text-slate-500">Status: {invite.status}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}