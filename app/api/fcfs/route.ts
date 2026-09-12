import { env } from "cloudflare:workers";
import { NextRequest } from "next/server";
import { ensureSchema, getVerifiedUser, getIsFCFSEnabled } from "../db";

export async function POST(request: NextRequest) {
  try {
    await ensureSchema();
    const user = await getVerifiedUser(request);

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isFCFSEnabled = await getIsFCFSEnabled();
    if (!isFCFSEnabled) {
      return Response.json({ error: "FCFS is currently disabled" }, { status: 403 });
    }

    const body = (await request.json().catch(() => ({}))) as { psNumber?: string };
    const psNumber = typeof body.psNumber === 'string' ? body.psNumber.trim() : "";

    if (!psNumber) {
      return Response.json({ error: "Missing Problem Statement ID" }, { status: 400 });
    }

    // Check if user is a team leader
    const isLeader = await env.sih_app_db
      .prepare("SELECT 1 FROM teams WHERE owner_uid = ? LIMIT 1")
      .bind(user.uid)
      .first();

    if (!isLeader) {
      return Response.json({ error: "Only Team Leaders can select PS" }, { status: 403 });
    }
    
    // ATOMIC INSERT WITH COUNT CHECK & TEAM LIMIT CHECK
    // Rule 1: Max 2 spots per PS
    // Rule 2: 1 PS claim per team leader
    const result = await env.sih_app_db
      .prepare(`
        INSERT INTO fcfs_claims (resource_id, user_id, claimed_at)
        SELECT ?, ?, ?
        WHERE (SELECT COUNT(*) FROM fcfs_claims WHERE resource_id = ?) < 2
          AND NOT EXISTS (SELECT 1 FROM fcfs_claims WHERE user_id = ?)
      `)
      .bind(psNumber, user.uid, Date.now(), psNumber, user.uid)
      .run();

    if (!result.success || result.meta.changes === 0) {
      // Failed. Let's find out why:
      const userClaims = await env.sih_app_db
        .prepare("SELECT resource_id FROM fcfs_claims WHERE user_id = ?")
        .bind(user.uid)
        .all<{ resource_id: string }>();

      if (userClaims.results.length > 0) {
        const claimed = userClaims.results[0].resource_id;
        return Response.json({ success: false, error: `You have already claimed ${claimed}!` }, { status: 400 });
      } else {
        return Response.json({ success: false, error: `${psNumber} is already full (2/2 spots claimed)!` }, { status: 400 });
      }
    }

    return Response.json({ 
      success: true, 
      message: `Successfully claimed ${psNumber}!` 
    }, { status: 200 });

  } catch (cause) {
    console.error("[POST /api/fcfs error]", cause);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
