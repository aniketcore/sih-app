import { env } from "cloudflare:workers";
import { NextRequest } from "next/server";
import { ensureSchema, getVerifiedUser, isAdmin, json } from "../../db";

export async function POST(request: NextRequest) {
  try {
    await ensureSchema();
    const currentUser = await getVerifiedUser(request);

    if (!currentUser) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminCheck = await isAdmin(currentUser.email);
    if (!adminCheck) {
      return json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    const body = (await request.json()) as { purgePrefix?: string };
    const prefix = (body.purgePrefix || "").trim().toLowerCase();

    if (!prefix) {
      return json({ error: "purgePrefix is required (e.g. '2025')" }, { status: 400 });
    }

    // 1. Identify users to delete from D1
    const targetUsersResult = await env.sih_app_db
      .prepare(`
        SELECT id, email FROM users 
        WHERE LOWER(email) LIKE ? || '%' 
        AND LOWER(email) NOT IN (SELECT LOWER(email) FROM admins)
      `)
      .bind(prefix)
      .all<{ id: string; email: string }>();

    const targetUsers = targetUsersResult.results || [];
    if (targetUsers.length === 0) {
      return json({ message: "No matching non-admin users found to purge.", purgedCount: 0 });
    }

    const userEmails = targetUsers.map((u) => u.email.toLowerCase());

    // 2. Clean D1 database safely maintaining cascades
    await env.sih_app_db
      .prepare(`
        DELETE FROM team_invites 
        WHERE (LOWER(inviter_email) LIKE ? || '%' OR LOWER(invitee_email) LIKE ? || '%')
        AND LOWER(inviter_email) NOT IN (SELECT LOWER(email) FROM admins)
        AND LOWER(invitee_email) NOT IN (SELECT LOWER(email) FROM admins)
      `)
      .bind(prefix, prefix)
      .run();

    for (const u of targetUsers) {
      await env.sih_app_db
        .prepare("DELETE FROM team_members WHERE user_id = ?")
        .bind(u.id)
        .run();
    }

    for (const u of targetUsers) {
      await env.sih_app_db
        .prepare("DELETE FROM teams WHERE LOWER(owner_email) = LOWER(?)")
        .bind(u.email)
        .run();
    }

    for (const u of targetUsers) {
      await env.sih_app_db
        .prepare("DELETE FROM users WHERE id = ?")
        .bind(u.id)
        .run();
    }

    return json({
      success: true,
      message: `Successfully purged ${targetUsers.length} users and their team data.`,
      purgedCount: targetUsers.length,
      purgedEmails: userEmails,
    });
  } catch (cause) {
    console.error("[POST /api/admin/purge error]", cause);
    return json({ error: "Failed to purge users" }, { status: 500 });
  }
}
