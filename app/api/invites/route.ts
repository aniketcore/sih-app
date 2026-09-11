import { env } from "cloudflare:workers";
import { NextRequest } from "next/server";
import { checkRateLimit, ensureSchema, getVerifiedUser, upsertTeamMember, upsertUser, getIsFrozen } from "../db";
import { normalizeEmail } from "@/lib/invite-state";

export async function GET(request: NextRequest) {
  try {
    const isAllowed = await checkRateLimit(request);
    if (!isAllowed) {
      return Response.json({ error: "Too many requests. Please slow down." }, { status: 429 });
    }

    await ensureSchema();
    const user = await getVerifiedUser(request);
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const email = request.nextUrl.searchParams.get("email");
    const teamId = request.nextUrl.searchParams.get("teamId");

    if (teamId) {
      // Outgoing invites for a team leader
      const isOwner = await env.sih_app_db
        .prepare("SELECT 1 FROM teams WHERE id = ? AND owner_uid = ? LIMIT 1")
        .bind(teamId, user.uid)
        .first();

      if (!isOwner) {
        return Response.json({ error: "Forbidden: Only team leader can view outgoing invites" }, { status: 403 });
      }

      const result = await env.sih_app_db
        .prepare("SELECT id, team_id, team_name, from_email, to_email, status, created_at FROM team_invites WHERE team_id = ? AND status = 'pending' ORDER BY created_at DESC")
        .bind(teamId)
        .all<{ id: string; team_id: string; team_name: string; from_email: string; to_email: string; status: string; created_at: number }>();

      return Response.json({
        outgoingInvites: result.results.map((row) => ({
          id: row.id,
          teamId: row.team_id,
          teamName: row.team_name,
          fromEmail: row.from_email,
          toEmail: row.to_email,
          status: row.status,
          createdAt: row.created_at,
        })),
      });
    }

    if (!email || normalizeEmail(email) !== normalizeEmail(user.email)) {
      return Response.json({ error: "Forbidden: Cannot view invites for another account" }, { status: 403 });
    }

    // If user is already part of a team (owner or member), they have no active incoming invites
    const inTeam = await env.sih_app_db
      .prepare(
        `SELECT 1 FROM teams WHERE owner_uid = ?
         UNION
         SELECT 1 FROM team_members WHERE user_id = ?
         LIMIT 1`,
      )
      .bind(user.uid, user.uid)
      .first();

    if (inTeam) {
      return Response.json({ invites: [] });
    }

    const result = await env.sih_app_db
      .prepare("SELECT id, team_id, team_name, from_email, to_email, status FROM team_invites WHERE to_email = ? AND status = 'pending' ORDER BY created_at DESC")
      .bind(normalizeEmail(email))
      .all<{ id: string; team_id: string; team_name: string; from_email: string; to_email: string; status: string }>();

    return Response.json({
      invites: result.results.map((row) => ({
        id: row.id,
        teamId: row.team_id,
        teamName: row.team_name,
        fromEmail: row.from_email,
        toEmail: row.to_email,
        status: row.status,
      })),
    });
  } catch (cause) {
    console.error("[GET /api/invites error]", cause);
    return Response.json({ error: "Failed to fetch invites" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await ensureSchema();
    if (await getIsFrozen()) {
      return Response.json({ error: "Team formation is currently frozen." }, { status: 403 });
    }
    const user = await getVerifiedUser(request);

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const inviteId = request.nextUrl.searchParams.get("inviteId");
    if (!inviteId) {
      return Response.json({ error: "Missing inviteId" }, { status: 400 });
    }

    const invite = await env.sih_app_db
      .prepare("SELECT id, team_id, from_uid FROM team_invites WHERE id = ?")
      .bind(inviteId)
      .first<{ id: string; team_id: string; from_uid: string }>();

    if (!invite || invite.from_uid !== user.uid) {
      return Response.json({ error: "Forbidden: Only the sender can cancel this invite" }, { status: 403 });
    }

    await env.sih_app_db
      .prepare("DELETE FROM team_invites WHERE id = ?")
      .bind(inviteId)
      .run();

    return Response.json({ ok: true });
  } catch (cause) {
    console.error("[DELETE /api/invites error]", cause);
    return Response.json({ error: "Failed to cancel invite" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureSchema();
    if (await getIsFrozen()) {
      return Response.json({ error: "Team formation is currently frozen." }, { status: 403 });
    }
    const user = await getVerifiedUser(request);

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.Response.json()) as {
      teamId: string;
      teamName: string;
      fromUid: string;
      fromEmail: string;
      toEmail: string;
    };

    if (body.fromUid !== user.uid || normalizeEmail(body.fromEmail) !== normalizeEmail(user.email)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    // Verify sender is the team owner (only leaders can invite)
    const isOwner = await env.sih_app_db
      .prepare("SELECT 1 FROM teams WHERE id = ? AND owner_uid = ? LIMIT 1")
      .bind(body.teamId, user.uid)
      .first();

    if (!isOwner) {
      return Response.json({ error: "Forbidden: Only the team leader can send invites" }, { status: 403 });
    }

    // Enforce team size limit (max 6 members including team leader)
    const memberCount = await env.sih_app_db
      .prepare("SELECT COUNT(*) as count FROM team_members WHERE team_id = ?")
      .bind(body.teamId)
      .first<{ count: number }>();

    const pendingCount = await env.sih_app_db
      .prepare("SELECT COUNT(*) as count FROM team_invites WHERE team_id = ? AND status = 'pending'")
      .bind(body.teamId)
      .first<{ count: number }>();

    const totalSpots = (memberCount?.count ?? 0) + (pendingCount?.count ?? 0);
    if (totalSpots >= 6) {
      return Response.json({ error: "Team size limit reached (maximum 6 members including leader)" }, { status: 400 });
    }

    const inviteEmail = normalizeEmail(body.toEmail);
    if (!inviteEmail || inviteEmail === normalizeEmail(user.email)) {
      return Response.json({ error: "Invalid target email" }, { status: 400 });
    }

    const targetUser = await env.sih_app_db
      .prepare("SELECT id FROM users WHERE LOWER(email) = LOWER(?)")
      .bind(inviteEmail)
      .first();

    if (!targetUser) {
      return Response.json({ error: "User does not exist in this app" }, { status: 400 });
    }

    const existingTeamMembership = await env.sih_app_db
      .prepare(
        `SELECT 1 FROM teams WHERE owner_uid = ?
         UNION
         SELECT 1 FROM team_members WHERE user_id = ?
         LIMIT 1`,
      )
      .bind(targetUser.id, targetUser.id)
      .first();

    if (existingTeamMembership) {
      return Response.json({ error: "User is already part of a team" }, { status: 409 });
    }

    const existingInvite = await env.sih_app_db
      .prepare("SELECT id FROM team_invites WHERE team_id = ? AND LOWER(to_email) = LOWER(?) AND status = 'pending' LIMIT 1")
      .bind(body.teamId, inviteEmail)
      .first();

    if (existingInvite) {
      return Response.json({ error: "Invite already pending" }, { status: 409 });
    }

    const inviteId = crypto.randomUUID();
    await env.sih_app_db
      .prepare(
        "INSERT INTO team_invites (id, team_id, team_name, from_uid, from_email, to_email, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)",
      )
      .bind(inviteId, body.teamId, body.teamName, body.fromUid, body.fromEmail, inviteEmail, Date.now())
      .run();

    return Response.json({ ok: true, id: inviteId }, { status: 201 });
  } catch (cause) {
    console.error("[POST /api/invites error]", cause);
    return Response.json({ error: "Failed to send invite" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await ensureSchema();
    if (await getIsFrozen()) {
      return Response.json({ error: "Team formation is currently frozen." }, { status: 403 });
    }
    const user = await getVerifiedUser(request);

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.Response.json()) as { inviteId: string; userId: string; userEmail: string };

    if (body.userId !== user.uid || normalizeEmail(body.userEmail) !== normalizeEmail(user.email)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const userProfile = await env.sih_app_db
      .prepare("SELECT name, phone, reg_no, gender, branch FROM users WHERE id = ?")
      .bind(user.uid)
      .first<{ name?: string | null; phone?: string | null; reg_no?: string | null; gender?: string | null; branch?: string | null }>();

    if (!userProfile || !userProfile.name || !userProfile.phone || !userProfile.reg_no || !userProfile.gender || !userProfile.branch) {
      return Response.json({ error: "You must complete your profile before accepting an invite." }, { status: 403 });
    }

    const invite = await env.sih_app_db
      .prepare("SELECT id, team_id, to_email, status FROM team_invites WHERE id = ?")
      .bind(body.inviteId)
      .first<{ id: string; team_id: string; to_email: string; status: string }>();

    if (!invite || invite.status !== "pending" || normalizeEmail(invite.to_email) !== normalizeEmail(user.email)) {
      return Response.json({ error: "Invalid invite" }, { status: 400 });
    }

    const existingTeamMembership = await env.sih_app_db
      .prepare(
        `SELECT 1 FROM teams WHERE owner_uid = ?
         UNION
         SELECT 1 FROM team_members WHERE user_id = ?
         LIMIT 1`,
      )
      .bind(user.uid, user.uid)
      .first();

    if (existingTeamMembership) {
      return Response.json({ error: "You are already part of a team" }, { status: 409 });
    }

    const currentMembers = await env.sih_app_db
      .prepare("SELECT COUNT(*) as count FROM team_members WHERE team_id = ?")
      .bind(invite.team_id)
      .first<{ count: number }>();

    if ((currentMembers?.count ?? 0) >= 6) {
      return Response.json({ error: "Team is already full (maximum 6 members)" }, { status: 400 });
    }

    // Atomic D1 batch: Add member and clear pending invites in one atomic execution
    await env.sih_app_db.batch([
      env.sih_app_db.prepare(
        "INSERT INTO team_members (team_id, user_id, email, photo_url, joined_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(team_id, user_id) DO UPDATE SET email = excluded.email, photo_url = excluded.photo_url",
      ).bind(invite.team_id, user.uid, normalizeEmail(user.email), user.photoUrl ?? null, Date.now()),
      env.sih_app_db.prepare("DELETE FROM team_invites WHERE to_email = ?").bind(normalizeEmail(user.email)),
    ]);

    return Response.json({ ok: true });
  } catch (cause: any) {
    console.error("[PATCH /api/invites error]", cause);
    if (cause?.message?.includes("Team is already full")) {
      return Response.json({ error: "Team is already full (maximum 6 members)" }, { status: 400 });
    }
    return Response.json({ error: "Failed to accept invite" }, { status: 500 });
  }
}

