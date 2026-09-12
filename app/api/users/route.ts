import { env } from "cloudflare:workers";
import { NextRequest } from "next/server";
import { ensureSchema, getVerifiedUser, upsertUser, isAdmin, getIsFrozen, getIsLeadersOnlyLogin } from "../db";
import { normalizeEmail } from "@/lib/invite-state";

export async function GET(request: NextRequest) {
  try {
    await ensureSchema();
    const user = await getVerifiedUser(request);

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [row, userIsAdmin, isLeadersOnlyLogin, isLeaderResult, claimResult] = await Promise.all([
      env.sih_app_db
        .prepare("SELECT id, email, name, phone, reg_no, gender, branch, photo_url FROM users WHERE id = ?")
        .bind(user.uid)
        .first<{ id: string; email: string; name?: string | null; phone?: string | null; reg_no?: string | null; gender?: string | null; branch?: string | null; photo_url?: string | null }>(),
      isAdmin(user.email),
      getIsLeadersOnlyLogin(),
      env.sih_app_db.prepare("SELECT 1 FROM teams WHERE owner_uid = ? LIMIT 1").bind(user.uid).first(),
      env.sih_app_db.prepare("SELECT resource_id FROM fcfs_claims WHERE user_id = ? LIMIT 1").bind(user.uid).first<{ resource_id: string }>(),
    ]);

    return Response.json({
      isFrozen: await getIsFrozen(),
      isLeadersOnlyLogin,
      isLeader: Boolean(isLeaderResult),
      claimedPs: claimResult?.resource_id || null,
      user: row
        ? {
            id: row.id,
            email: row.email,
            name: row.name ?? null,
            phone: row.phone ?? null,
            regNo: row.reg_no ?? null,
            gender: row.gender ?? null,
            branch: row.branch ?? null,
            photoUrl: row.photo_url ?? null,
            isComplete: Boolean(row.name && row.phone && row.reg_no && row.gender && row.branch),
            isAdmin: userIsAdmin,
          }
        : null,
    });
  } catch (cause) {
    console.error("[GET /api/users error]", cause);
    return Response.json({ error: "Failed to fetch user profile" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureSchema();
    const user = await getVerifiedUser(request);

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as {
      uid: string;
      email: string;
      name?: string;
      phone?: string;
      regNo?: string;
      gender?: string;
      branch?: string;
      photoUrl?: string | null;
    };

    if (body.uid !== user.uid || normalizeEmail(body.email) !== normalizeEmail(user.email)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    await upsertUser({
      uid: user.uid,
      email: user.email,
      name: body.name?.trim() || null,
      phone: body.phone?.trim() || null,
      regNo: body.regNo?.trim() || null,
      gender: body.gender?.trim() || null,
      branch: body.branch?.trim() || null,
      photoUrl: body.photoUrl ?? user.photoUrl,
    });

    return Response.json({ ok: true });
  } catch (cause) {
    console.error("[POST /api/users error]", cause);
    return Response.json({ error: "Failed to sync user" }, { status: 500 });
  }
}


