"use client";

import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { teamStore, type Invite, type Team } from "../lib/team-store";

function getInitials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "U";
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function TeamBoard({ user, isFrozen = false }: { user: User; isFrozen?: boolean }) {
  const [teamName, setTeamName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [teams, setTeams] = useState<Team[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [outgoingInvites, setOutgoingInvites] = useState<Invite[]>([]);
  const [busy, setBusy] = useState(false);
  const [activeActionId, setActiveActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [ready, setReady] = useState({ teams: false, invites: false });

  const [isEditingName, setIsEditingName] = useState(false);
  const [editedTeamName, setEditedTeamName] = useState("");

  const primaryTeam = teams[0] ?? null;
  const isLeader = Boolean(
    primaryTeam && primaryTeam.ownerEmail.toLowerCase() === (user.email ?? "").toLowerCase(),
  );

  async function handleRenameTeam() {
    if (!primaryTeam) return;
    const nextName = editedTeamName.trim();
    if (!nextName) {
      setError("Please enter a valid team name.");
      return;
    }

    setBusy(true);
    setError(null);
    setStatus(null);

    try {
      await teamStore.updateTeamName(primaryTeam.id, nextName);
      setIsEditingName(false);
      setStatus("Team name updated successfully.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to rename team");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const unsubscribeTeams = teamStore.watchOwnedTeams(user.uid, (nextTeams) => {
      setTeams(nextTeams);
      setReady((current) => ({ ...current, teams: true }));
    });
    const unsubscribeInvites = teamStore.watchInvites(user.email ?? "", (nextInvites) => {
      setInvites(nextInvites);
      setReady((current) => ({ ...current, invites: true }));
    });

    return () => {
      unsubscribeTeams();
      unsubscribeInvites();
    };
  }, [user.email, user.uid]);

  useEffect(() => {
    if (!primaryTeam?.id || !isLeader) {
      setOutgoingInvites([]);
      return;
    }

    const unsubscribeOutgoing = teamStore.watchOutgoingInvites(primaryTeam.id, (nextOutgoing) => {
      setOutgoingInvites(nextOutgoing);
    });

    return () => {
      unsubscribeOutgoing();
    };
  }, [primaryTeam?.id, isLeader]);

  async function createTeam() {
    const nextName = teamName.trim();
    if (!nextName) {
      setError("Please enter a team name.");
      return;
    }

    setBusy(true);
    setError(null);
    setStatus(null);

    try {
      await teamStore.createTeam({ name: nextName, ownerUid: user.uid, ownerEmail: user.email ?? "" });
      setTeamName("");
      setStatus("Team created successfully.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Team creation failed");
    } finally {
      setBusy(false);
    }
  }

  async function sendInvite(team: Team) {
    const normalizedEmail = inviteEmail.trim();

    if (!normalizedEmail) {
      setError("Please enter an email address.");
      return;
    }

    if (!isValidEmail(normalizedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (normalizedEmail.toLowerCase() === (user.email ?? "").toLowerCase()) {
      setError("You cannot send a request to yourself.");
      return;
    }

    setBusy(true);
    setError(null);
    setStatus(null);

    try {
      await teamStore.createInvite({
        teamId: team.id,
        teamName: team.name,
        fromUid: user.uid,
        fromEmail: user.email ?? "",
        toEmail: normalizedEmail,
      });
      setInviteEmail("");
      setStatus(`Request sent to ${normalizedEmail}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Invite failed");
    } finally {
      setBusy(false);
    }
  }

  async function acceptInvite(invite: Invite) {
    setBusy(true);
    setActiveActionId(invite.id);
    setError(null);
    setStatus(null);

    try {
      await teamStore.acceptInvite({ inviteId: invite.id, userId: user.uid, userEmail: user.email ?? "" });
      setStatus(`Joined team "${invite.teamName}".`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Accept request failed");
    } finally {
      setBusy(false);
      setActiveActionId(null);
    }
  }

  const [dangerModal, setDangerModal] = useState<{
    isOpen: boolean;
    actionType: "delete" | "kick" | "leave";
    targetEmail?: string;
    teamId: string;
    teamName: string;
  } | null>(null);
  const [confirmInput, setConfirmInput] = useState("");

  function openDangerModal(actionType: "delete" | "kick" | "leave", teamId: string, teamName: string, targetEmail?: string) {
    setConfirmInput("");
    setDangerModal({ isOpen: true, actionType, teamId, teamName, targetEmail });
  }

  async function handleConfirmDangerAction() {
    if (!dangerModal) return;
    if (confirmInput.trim() !== dangerModal.teamName) return;

    const { actionType, teamId, teamName, targetEmail } = dangerModal;
    setDangerModal(null);
    setBusy(true);
    setError(null);
    setStatus(null);

    try {
      if (actionType === "delete") {
        setActiveActionId(teamId);
        await teamStore.deleteTeam(teamId);
        setStatus("Team deleted successfully.");
      } else if (actionType === "kick" || actionType === "leave") {
        if (!targetEmail) return;
        setActiveActionId(targetEmail);
        const isSelf = targetEmail.toLowerCase() === (user.email ?? "").toLowerCase();
        await teamStore.kickMember(teamId, targetEmail);
        setStatus(isSelf ? "You left the team." : `Removed ${targetEmail} from team.`);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Action failed");
    } finally {
      setBusy(false);
      setActiveActionId(null);
    }
  }

  async function cancelInvite(inviteId: string) {
    setBusy(true);
    setActiveActionId(inviteId);
    setError(null);
    setStatus(null);

    try {
      await teamStore.cancelInvite(inviteId);
      setStatus("Invite cancelled.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to cancel invite");
    } finally {
      setBusy(false);
      setActiveActionId(null);
    }
  }

  return (
    <div className="space-y-6">
      {!ready.teams ? (
        <div className="h-10 animate-pulse bg-slate-100" />
      ) : primaryTeam ? (
        primaryTeam.ownerEmail.toLowerCase() === (user.email ?? "").toLowerCase() ? (
          <div className="space-y-1">
            <div className="flex gap-2">
              <input
                className="flex-1 border border-slate-300 px-3 py-2 text-sm outline-none focus:border-black"
                onChange={(event) => setInviteEmail(event.target.value)}
                placeholder="Enter member's email address"
                value={inviteEmail}
              />
              <button
                className="bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 hover:bg-slate-800"
                disabled={busy || isFrozen}
                onClick={() => sendInvite(primaryTeam)}
                type="button"
              >
                {busy ? "Sending..." : "Send Invite"}
              </button>
            </div>
            <p className="text-xs text-slate-500">Only team leaders can send invites.</p>
          </div>
        ) : (
          <div className="border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            You are a member of <strong>{primaryTeam.name}</strong>. Only the team leader can send invitations.
          </div>
        )
      ) : (
        <div className="space-y-1">
          <div className="flex gap-2">
            <input
              className="flex-1 border border-slate-300 px-3 py-2 text-sm outline-none focus:border-black"
              onChange={(event) => setTeamName(event.target.value)}
              placeholder="Team name"
              value={teamName}
            />
            <button
              className="bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 hover:bg-slate-800"
              disabled={busy || isFrozen}
              onClick={createTeam}
              type="button"
            >
              {busy ? "Creating..." : "Create Team"}
            </button>
          </div>
          <p className="text-xs text-slate-500">Teams can have up to 6 members total.</p>
        </div>
      )}

      {isFrozen && (
        <div className="border border-red-200 bg-red-50 p-4 text-sm text-red-700 font-bold flex items-center justify-center">
          ❄️ Team formation is frozen. No further changes can be made.
        </div>
      )}

      {error ? (
        <div className="border border-red-200 bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      ) : null}

      {status ? (
        <div className="border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          {status}
        </div>
      ) : null}

      <div className="space-y-6">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Team Overview</h2>
          {!ready.teams ? (
            <div className="h-20 animate-pulse bg-slate-100" />
          ) : !primaryTeam ? (
            <div className="border border-slate-200 p-4 text-center text-sm text-slate-500">
              No team joined yet. Create a new team above or accept an invitation below.
            </div>
          ) : (
            <div className="border border-slate-200 bg-white">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 p-4 gap-2">
                <div>
                  {isEditingName ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editedTeamName}
                        onChange={(e) => setEditedTeamName(e.target.value)}
                        placeholder="Enter new team name"
                        className="border border-slate-300 px-2 py-1 text-sm outline-none focus:border-black"
                      />
                      <button
                        type="button"
                        disabled={busy || isFrozen}
                        onClick={handleRenameTeam}
                        className="bg-black text-white px-2.5 py-1 text-xs font-semibold hover:bg-slate-800 disabled:opacity-50"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsEditingName(false)}
                        className="border border-slate-300 text-slate-700 px-2.5 py-1 text-xs font-medium hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-slate-900">{primaryTeam.name}</h3>
                      {isLeader && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditedTeamName(primaryTeam.name);
                            setIsEditingName(true);
                          }}
                          disabled={isFrozen}
                          className="text-xs text-slate-500 hover:text-black underline font-medium disabled:opacity-50"
                        >
                          Rename
                        </button>
                      )}
                    </div>
                  )}
                  <p className="text-xs text-slate-500 mt-0.5">Leader: {primaryTeam.ownerEmail}</p>
                </div>
                <span className="text-xs font-semibold text-slate-600 border border-slate-200 px-2 py-1 self-start sm:self-auto">
                  {primaryTeam.members.length} / 6 Members
                </span>
              </div>

              {/* SIH Female Member Warning Banner */}
              {!primaryTeam.members.some((m) => m.gender?.toLowerCase() === "female") ? (
                <div className="border-b border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                  <strong>SIH Mandatory Requirement:</strong> Lack of female members in the team will result in disqualification in SIH. Please ensure at least one female member is in your team.
                </div>
              ) : null}

              {/* Members List */}
              <div className="p-4 space-y-2">
                <h4 className="text-xs font-bold uppercase text-slate-400">Members</h4>
                <div className="divide-y divide-slate-100 text-sm">
                  {/* Leader Row */}
                  {(() => {
                    const leader = primaryTeam.members.find(m => m.email === primaryTeam.ownerEmail);
                    const isFemale = leader?.gender?.toLowerCase() === "female";
                    const isMale = leader?.gender?.toLowerCase() === "male";
                    return (
                      <div className="flex items-center justify-between py-2">
                        <div className="flex items-center gap-2">
                          <span className={`flex-shrink-0 w-2 h-2 rounded-full ${isFemale ? 'bg-pink-400' : isMale ? 'bg-blue-400' : 'bg-slate-300'}`} title={leader?.gender ?? "Unknown"} />
                          <span className="font-medium text-slate-900">{primaryTeam.ownerEmail}</span>
                        </div>
                        <span className="text-xs font-bold text-slate-500 uppercase">Leader</span>
                      </div>
                    );
                  })()}

                  {/* Member Rows */}
                  {primaryTeam.members
                    .filter((m) => m.email !== primaryTeam.ownerEmail)
                    .map((m) => {
                      const isFemale = m.gender?.toLowerCase() === "female";
                      const isMale = m.gender?.toLowerCase() === "male";
                      return (
                        <div key={m.email} className="flex items-center justify-between py-2">
                          <div className="flex items-center gap-2">
                            <span className={`flex-shrink-0 w-2 h-2 rounded-full ${isFemale ? 'bg-pink-400' : isMale ? 'bg-blue-400' : 'bg-slate-300'}`} title={m.gender ?? "Unknown"} />
                            <span className="text-slate-800">{m.email}</span>
                          </div>
                          <span className="text-xs text-slate-400">Member</span>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Outgoing Invites Bar (Leader Dashboard) */}
        {isLeader ? (
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Sent Invitations</h2>
            {outgoingInvites.length === 0 ? (
              <div className="border border-slate-200 p-3 text-center text-xs text-slate-400">
                No active outgoing invitations.
              </div>
            ) : (
              <div className="space-y-2">
                {outgoingInvites.map((invite) => {
                  const isCancelling = activeActionId === invite.id;

                  return (
                    <div key={invite.id} className="flex items-center justify-between border border-slate-200 p-3 text-sm">
                      <div>
                        <span className="font-medium text-slate-900">{invite.toEmail}</span>
                        <span className="ml-2 text-xs text-slate-400">(Awaiting Response)</span>
                      </div>
                      <button
                        className="border border-red-200 px-3 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                        disabled={busy || isFrozen}
                        onClick={() => cancelInvite(invite.id)}
                        type="button"
                      >
                        {isCancelling ? "Cancelling..." : "Cancel Request"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : null}

        {/* Incoming Pending Invites (Only shown when not in a team) */}
        {!primaryTeam ? (
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Incoming Invites</h2>
            {!ready.invites ? (
              <div className="h-10 animate-pulse bg-slate-100" />
            ) : invites.length === 0 ? (
              <div className="border border-slate-200 p-3 text-center text-xs text-slate-400">
                No pending invitations received.
              </div>
            ) : (
              <div className="space-y-2">
                {invites.map((invite) => {
                  const isAccepting = activeActionId === invite.id;

                  return (
                    <div key={invite.id} className="flex items-center justify-between border border-slate-200 p-3 text-sm">
                      <div>
                        <span className="font-medium text-slate-900">{invite.teamName}</span>
                        <span className="ml-2 text-xs text-slate-500">from {invite.fromEmail}</span>
                      </div>
                      {invite.status === "pending" ? (
                        <button
                          className="bg-black px-3 py-1 text-xs text-white disabled:opacity-50 hover:bg-slate-800"
                          disabled={busy || isFrozen}
                          onClick={() => acceptInvite(invite)}
                          type="button"
                        >
                          {isAccepting ? "Accepting..." : "Accept Request"}
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : null}

        {/* Danger Zone at the Very Bottom */}
        {primaryTeam ? (
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Danger Zone</h2>
            <div className="border border-red-200 bg-red-50/20 p-4 space-y-3">
              <div className="space-y-2">
                {primaryTeam.members.some(
                  (m) =>
                    m.email.toLowerCase() === (user.email ?? "").toLowerCase() &&
                    m.email.toLowerCase() !== primaryTeam.ownerEmail.toLowerCase(),
                ) ? (
                  <div>
                    <button
                      className="border border-red-300 bg-white px-3 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                      disabled={busy || isFrozen}
                      onClick={() => openDangerModal("leave", primaryTeam.id, primaryTeam.name, user.email ?? "")}
                      type="button"
                    >
                      {activeActionId === user.email ? "Leaving..." : "Leave Team"}
                    </button>
                  </div>
                ) : null}

                {primaryTeam.ownerEmail.toLowerCase() === (user.email ?? "").toLowerCase()
                  ? primaryTeam.members
                      .filter((m) => m.email.toLowerCase() !== primaryTeam.ownerEmail.toLowerCase())
                      .map((m) => (
                        <div key={m.email}>
                          <button
                            className="border border-red-300 bg-white px-3 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50 text-left break-all"
                            disabled={busy || isFrozen}
                            onClick={() => openDangerModal("kick", primaryTeam.id, primaryTeam.name, m.email)}
                            type="button"
                          >
                            {activeActionId === m.email ? "Removing..." : `Remove ${m.email}`}
                          </button>
                        </div>
                      ))
                  : null}
              </div>

              {primaryTeam.ownerEmail.toLowerCase() === (user.email ?? "").toLowerCase() ? (
                <div className="pt-2 border-t border-red-200">
                  <button
                    className="bg-red-600 px-3 py-1.5 text-xs text-white hover:bg-red-700 disabled:opacity-50"
                    disabled={busy || isFrozen}
                    onClick={() => openDangerModal("delete", primaryTeam.id, primaryTeam.name)}
                    type="button"
                  >
                    {activeActionId === primaryTeam.id ? "Deleting..." : "Delete Team"}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      {/* Danger Confirmation Modal */}
      {dangerModal?.isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md bg-white p-5 space-y-4 border border-slate-300">
            <div className="flex justify-between items-start">
              <h3 className="font-bold text-slate-900 text-sm">
                {dangerModal.actionType === "delete"
                  ? "Delete Team"
                  : dangerModal.actionType === "leave"
                  ? "Leave Team"
                  : `Remove ${dangerModal.targetEmail}`}
              </h3>
              <button onClick={() => setDangerModal(null)} className="text-xs text-slate-400 hover:text-black">
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Type <strong className="font-mono">{dangerModal.teamName}</strong> to confirm:
            </p>

            <input
              className="w-full border border-slate-300 px-3 py-1.5 text-xs font-mono outline-none focus:border-red-500"
              onChange={(e) => setConfirmInput(e.target.value)}
              placeholder={dangerModal.teamName}
              type="text"
              value={confirmInput}
            />

            <div className="flex gap-2 justify-end pt-2">
              <button
                className="border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-slate-50"
                onClick={() => setDangerModal(null)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="bg-red-600 px-3 py-1 text-xs text-white hover:bg-red-700 disabled:opacity-40"
                disabled={confirmInput.trim() !== dangerModal.teamName || busy}
                onClick={handleConfirmDangerAction}
                type="button"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}