import { env } from "cloudflare:workers";
import { NextRequest } from "next/server";
import { checkRateLimit, ensureSchema, getVerifiedUser, json, upsertTeamMember, upsertUser } from "../db";
import { normalizeEmail } from "@/lib/invite-state";

export async function GET(request: NextRequest) {
  try {
    const isAllowed = await checkRateLimit(request);
    if (!isAllowed) {
      return json({ error: "Too many requests. Please slow down." }, { status: 429 });
    }

    await ensureSchema();
    const userId = request.nextUrl.searchParams.get("userId");

    if (!userId) {
      return json({ error: "Missing userId parameter" }, { status: 400 });
    }

    const user = await getVerifiedUser(request);
    if (!user || user.uid !== userId) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await env.sih_app_db
      .prepare(
        `
          SELECT t.id, t.name, t.owner_email, t.created_at
          FROM teams t
          WHERE t.owner_uid = ?

          UNION

          SELECT t.id, t.name, t.owner_email, t.created_at
          FROM team_members tm
          JOIN teams t ON t.id = tm.team_id
          WHERE tm.user_id = ?
          ORDER BY created_at DESC
        `,
      )
      .bind(userId, userId)
      .all<{ id: string; name: string; owner_email: string; created_at: number }>();

    const teams = await Promise.all(
      result.results.map(async (teamRow) => {
        const membersResult = await env.sih_app_db
          .prepare(
            `SELECT tm.email, tm.photo_url, u.gender
             FROM team_members tm
             LEFT JOIN users u ON u.id = tm.user_id
             WHERE tm.team_id = ?
             ORDER BY tm.joined_at ASC`,
          )
          .bind(teamRow.id)
          .all<{ email: string; photo_url?: string | null; gender?: string | null }>();

        return {
          id: teamRow.id,
          name: teamRow.name,
          ownerEmail: teamRow.owner_email,
          members: membersResult.results.map((m) => ({
            email: m.email,
            photoUrl: m.photo_url ?? undefined,
            gender: m.gender ?? undefined,
          })),
        };
      }),
    );

    return json({ teams });
  } catch (cause: any) {
    console.error("[GET /api/teams error]", cause, cause?.cause);
    return json({ error: "Failed to fetch teams" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureSchema();
    const user = await getVerifiedUser(request);

    if (!user) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as { name: string; ownerUid: string; ownerEmail: string };
    const name = body.name?.trim();

    if (!name) {
      return json({ error: "Team name is required" }, { status: 400 });
    }

    if (body.ownerUid !== user.uid || normalizeEmail(body.ownerEmail) !== normalizeEmail(user.email)) {
      return json({ error: "Forbidden" }, { status: 403 });
    }

    // Check if user already owns or belongs to a team
    const existingTeam = await env.sih_app_db
      .prepare(
        `SELECT 1 FROM teams WHERE owner_uid = ?
         UNION
         SELECT 1 FROM team_members WHERE user_id = ?
         LIMIT 1`,
      )
      .bind(user.uid, user.uid)
      .first();

    if (existingTeam) {
      return json({ error: "You are already part of a team" }, { status: 409 });
    }

    await upsertUser({ uid: user.uid, email: user.email, photoUrl: user.photoUrl });
    const newTeamId = crypto.randomUUID();

    await env.sih_app_db
      .prepare("INSERT INTO teams (id, name, owner_uid, owner_email, created_at) VALUES (?, ?, ?, ?, ?)")
      .bind(newTeamId, name, user.uid, user.email, Date.now())
      .run();

    await upsertTeamMember(newTeamId, user.uid, user.email, user.photoUrl);

    // Delete any pending invites received by this user now that they have created a team
    await env.sih_app_db
      .prepare("DELETE FROM team_invites WHERE to_email = ?")
      .bind(normalizeEmail(user.email))
      .run();

    return json({ ok: true, id: newTeamId }, { status: 201 });
  } catch (cause: any) {
    console.error("[POST /api/teams error]", cause, cause?.cause);
    return json({ error: "Failed to create team" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await ensureSchema();
    const user = await getVerifiedUser(request);

    if (!user) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as { teamId: string; name: string };
    const name = body.name?.trim();

    if (!name) {
      return json({ error: "Team name is required" }, { status: 400 });
    }

    if (!body.teamId) {
      return json({ error: "Missing teamId" }, { status: 400 });
    }

    // Verify sender is the team leader
    const team = await env.sih_app_db
      .prepare("SELECT id, owner_uid FROM teams WHERE id = ?")
      .bind(body.teamId)
      .first<{ id: string; owner_uid: string }>();

    if (!team || team.owner_uid !== user.uid) {
      return json({ error: "Forbidden: Only team leader can rename the team" }, { status: 403 });
    }

    // Update team name in teams table and team_invites table atomically
    await env.sih_app_db.batch([
      env.sih_app_db.prepare("UPDATE teams SET name = ? WHERE id = ?").bind(name, body.teamId),
      env.sih_app_db.prepare("UPDATE team_invites SET team_name = ? WHERE team_id = ?").bind(name, body.teamId),
    ]);

    return json({ ok: true });
  } catch (cause: any) {
    console.error("[PATCH /api/teams error]", cause, cause?.cause);
    return json({ error: "Failed to rename team" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await ensureSchema();
    const user = await getVerifiedUser(request);

    if (!user) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const teamId = request.nextUrl.searchParams.get("teamId");
    const targetEmail = request.nextUrl.searchParams.get("targetEmail");

    if (!teamId) {
      return json({ error: "Missing teamId parameter" }, { status: 400 });
    }

    const team = await env.sih_app_db
      .prepare("SELECT id, owner_uid, owner_email FROM teams WHERE id = ?")
      .bind(teamId)
      .first<{ id: string; owner_uid: string; owner_email: string }>();

    if (!team) {
      // Idempotent: If the team was already deleted concurrently by the leader, treat request as succeeded
      return json({ ok: true, action: "already_removed" });
    }

    const isOwner = team.owner_uid === user.uid;

    if (targetEmail) {
      const normalizedTarget = normalizeEmail(targetEmail);
      const isSelf = normalizedTarget === normalizeEmail(user.email);

      if (!isOwner && !isSelf) {
        return json({ error: "Forbidden: Only team leader can kick members" }, { status: 403 });
      }

      if (normalizedTarget === normalizeEmail(team.owner_email)) {
        return json({ error: "Cannot kick the team leader. Delete the team instead." }, { status: 400 });
      }

      const res = await env.sih_app_db.batch([
        env.sih_app_db.prepare("DELETE FROM team_members WHERE team_id = ? AND email = ?").bind(teamId, normalizedTarget),
        env.sih_app_db.prepare("DELETE FROM team_invites WHERE team_id = ? AND (to_email = ? OR from_email = ?)").bind(teamId, normalizedTarget, normalizedTarget),
      ]);

      const changes = res[0].meta.changes;
      return json({ ok: true, action: changes > 0 ? (isSelf ? "left" : "kicked") : "already_removed" });
    }

    if (!isOwner) {
      return json({ error: "Forbidden: Only the team leader can delete this team" }, { status: 403 });
    }

    await env.sih_app_db.batch([
      env.sih_app_db.prepare("DELETE FROM teams WHERE id = ?").bind(teamId),
      env.sih_app_db.prepare("DELETE FROM team_members WHERE team_id = ?").bind(teamId),
      env.sih_app_db.prepare("DELETE FROM team_invites WHERE team_id = ?").bind(teamId),
    ]);

    return json({ ok: true, action: "deleted" });

  } catch (cause: any) {
    console.error("[DELETE /api/teams error]", cause, cause?.cause);
    return json({ error: "Failed to delete team or remove member" }, { status: 500 });
  }
}
