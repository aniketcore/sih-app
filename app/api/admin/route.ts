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

    // Fetch all teams
    const teamsResult = await env.sih_app_db
      .prepare("SELECT id, name, owner_uid, owner_email, created_at FROM teams ORDER BY created_at DESC")
      .all<{ id: string; name: string; owner_uid: string; owner_email: string; created_at: number }>();

    // Fetch all members in 1 single JOIN query instead of N+1 calls
    const allMembersResult = await env.sih_app_db
      .prepare(
        `SELECT tm.team_id, tm.email, tm.photo_url, u.name, u.phone, u.reg_no, u.gender, u.branch
         FROM team_members tm
         LEFT JOIN users u ON u.id = tm.user_id
         ORDER BY tm.joined_at ASC`,
      )
      .all<{
        team_id: string;
        email: string;
        photo_url: string | null;
        name: string | null;
        phone: string | null;
        reg_no: string | null;
        gender: string | null;
        branch: string | null;
      }>();

    const membersByTeamId = new Map<string, Array<{
      email: string;
      name: string | null;
      phone: string | null;
      regNo: string | null;
      gender: string | null;
      branch: string | null;
    }>>();

    for (const m of allMembersResult.results || []) {
      const list = membersByTeamId.get(m.team_id) || [];
      list.push({
        email: m.email,
        name: m.name ?? null,
        phone: m.phone ?? null,
        regNo: m.reg_no ?? null,
        gender: m.gender ?? null,
        branch: m.branch ?? null,
      });
      membersByTeamId.set(m.team_id, list);
    }

    const teams = (teamsResult.results || []).map((t) => ({
      id: t.id,
      name: t.name,
      ownerEmail: t.owner_email,
      createdAt: t.created_at,
      members: membersByTeamId.get(t.id) || [],
    }));

    return json({
      users: usersResult.results.map((u) => {
        const name = u.name?.trim() || null;
        const phone = u.phone?.trim() || null;
        const regNo = u.reg_no?.trim() || null;
        const gender = u.gender?.trim() || null;
        const branch = u.branch?.trim() || null;

        return {
          id: u.id,
          email: u.email,
          name,
          phone,
          regNo,
          gender,
          branch,
          createdAt: u.created_at,
          isComplete: Boolean(name && phone && regNo && gender && branch),
        };
      }),
      teams,
    });
  } catch (cause) {
    console.error("[GET /api/admin error]", cause);
    return json({ error: "Failed to fetch admin data" }, { status: 500 });
  }
}
