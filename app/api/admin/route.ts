import { env } from "cloudflare:workers";
import { NextRequest } from "next/server";
import { ensureSchema, getVerifiedUser, isAdmin, json } from "../db";

export async function GET(request: NextRequest) {
  try {
    await ensureSchema();
    const user = await getVerifiedUser(request);

    if (!user) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminCheck = await isAdmin(user.email);
    if (!adminCheck) {
      return json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    // Fetch all users
    const usersResult = await env.sih_app_db
      .prepare("SELECT id, email, name, phone, reg_no, gender, branch, photo_url, created_at FROM users ORDER BY created_at DESC")
      .all<{
        id: string;
        email: string;
        name: string | null;
        phone: string | null;
        reg_no: string | null;
        gender: string | null;
        branch: string | null;
        photo_url: string | null;
        created_at: number;
      }>();

    // Fetch all teams with member details
    const teamsResult = await env.sih_app_db
      .prepare("SELECT id, name, owner_uid, owner_email, created_at FROM teams ORDER BY created_at DESC")
      .all<{ id: string; name: string; owner_uid: string; owner_email: string; created_at: number }>();

    const teams = await Promise.all(
      teamsResult.results.map(async (t) => {
        const membersResult = await env.sih_app_db
          .prepare(
            `SELECT tm.email, tm.photo_url, u.name, u.phone, u.reg_no, u.gender, u.branch
             FROM team_members tm
             LEFT JOIN users u ON u.id = tm.user_id
             WHERE tm.team_id = ?
             ORDER BY tm.joined_at ASC`,
          )
          .bind(t.id)
          .all<{
            email: string;
            photo_url: string | null;
            name: string | null;
            phone: string | null;
            reg_no: string | null;
            gender: string | null;
            branch: string | null;
          }>();

        return {
          id: t.id,
          name: t.name,
          ownerEmail: t.owner_email,
          createdAt: t.created_at,
          members: membersResult.results.map((m) => ({
            email: m.email,
            name: m.name ?? null,
            phone: m.phone ?? null,
            regNo: m.reg_no ?? null,
            gender: m.gender ?? null,
            branch: m.branch ?? null,
          })),
        };
      }),
    );

    return json({
      users: usersResult.results.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name ?? null,
        phone: u.phone ?? null,
        regNo: u.reg_no ?? null,
        gender: u.gender ?? null,
        branch: u.branch ?? null,
        createdAt: u.created_at,
      })),
      teams,
    });
  } catch (cause) {
    console.error("[GET /api/admin error]", cause);
    return json({ error: "Failed to fetch admin data" }, { status: 500 });
  }
}
