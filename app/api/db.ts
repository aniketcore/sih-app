import { env } from "cloudflare:workers";
import { NextRequest } from "next/server";
import { normalizeEmail } from "@/lib/invite-state";

export async function getVerifiedUser(request: NextRequest) {
  const header = request.headers.get("authorization");
  if (!header || !header.startsWith("Bearer ")) return null;

  const token = header.slice("Bearer ".length).trim();
  if (!token) return null;

  const apiKey = process.env.VITE_FIREBASE_API_KEY ?? process.env.FIREBASE_API_KEY ?? "AIzaSyAW8NwxgKEdDHpUzNxRZ-y-aHuj7e44MS0";

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ idToken: token }),
    },
  );

  if (!response.ok) return null;

  const payload = (await response.json()) as { users?: Array<{ localId?: string; email?: string; photoUrl?: string }> };
  const user = payload.users?.[0];
  if (!user?.localId) return null;

  return {
    uid: user.localId,
    email: user.email ?? "",
    photoUrl: user.photoUrl ?? null,
  };
}

export async function checkRateLimit(request: NextRequest, identifier?: string): Promise<boolean> {
  try {
    const limiter = (env as any)?.RATE_LIMITER;
    if (limiter && typeof limiter.limit === "function") {
      const key = identifier || request.headers.get("cf-connecting-ip") || "global-client";
      const { success } = await limiter.limit({ key });
      return success;
    }
  } catch (cause) {
    // In local Miniflare dev mode, unsafe ratelimit binding can throw internal references if not supported by local worker runner
  }
  return true;
}

let schemaReady: Promise<void> | null = null;
let schemaInitialized = false;

export async function ensureSchema() {
  if (schemaInitialized) return;

  if (schemaReady) {
    try {
      await schemaReady;
      return;
    } catch {
      schemaReady = null;
    }
  }

  schemaReady = (async () => {
    try {
      await env.sih_app_db.batch([
        env.sih_app_db.prepare(`
          CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT NOT NULL UNIQUE,
            name TEXT,
            phone TEXT,
            reg_no TEXT,
            gender TEXT,
            branch TEXT,
            photo_url TEXT,
            created_at INTEGER NOT NULL
          )
        `),
        env.sih_app_db.prepare(`
          CREATE TABLE IF NOT EXISTS teams (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            owner_uid TEXT NOT NULL UNIQUE,
            owner_email TEXT NOT NULL,
            created_at INTEGER NOT NULL
          )
        `),
        env.sih_app_db.prepare(`
          CREATE TABLE IF NOT EXISTS team_invites (
            id TEXT PRIMARY KEY,
            team_id TEXT NOT NULL,
            team_name TEXT NOT NULL,
            from_uid TEXT NOT NULL,
            from_email TEXT NOT NULL,
            to_email TEXT NOT NULL,
            status TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            accepted_at INTEGER,
            accepted_by_uid TEXT,
            accepted_by_email TEXT
          )
        `),
        env.sih_app_db.prepare(`
          CREATE TABLE IF NOT EXISTS team_members (
            team_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            email TEXT NOT NULL,
            photo_url TEXT,
            joined_at INTEGER NOT NULL,
            PRIMARY KEY (team_id, user_id)
          )
        `),
        env.sih_app_db.prepare(`
          CREATE TABLE IF NOT EXISTS admins (
            email TEXT PRIMARY KEY,
            created_at INTEGER NOT NULL
          )
        `),
        env.sih_app_db.prepare(`
          CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
          )
        `),
        env.sih_app_db.prepare(`
          CREATE TABLE IF NOT EXISTS fcfs_claims (
            resource_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            claimed_at INTEGER NOT NULL,
            PRIMARY KEY (resource_id, user_id)
          )
        `),
        env.sih_app_db.prepare(`
          CREATE INDEX IF NOT EXISTS idx_fcfs_claims_user_id ON fcfs_claims(user_id)
        `),
      ]);

      try { await env.sih_app_db.prepare("INSERT OR IGNORE INTO admins (email, created_at) VALUES ('2025pceacsaniket25@poornima.org', 1700000000)").run(); } catch {}

      // Conditionally add columns if they don't exist to avoid Miniflare logging internal errors on ALTER TABLE
      const usersInfo = await env.sih_app_db.prepare("PRAGMA table_info(users)").all<{ name: string }>();
      const existingCols = new Set(usersInfo.results.map((c) => c.name));

      const alterStatements: string[] = [];
      if (!existingCols.has("name")) alterStatements.push("ALTER TABLE users ADD COLUMN name TEXT");
      if (!existingCols.has("phone")) alterStatements.push("ALTER TABLE users ADD COLUMN phone TEXT");
      if (!existingCols.has("reg_no")) alterStatements.push("ALTER TABLE users ADD COLUMN reg_no TEXT");
      if (!existingCols.has("gender")) alterStatements.push("ALTER TABLE users ADD COLUMN gender TEXT");
      if (!existingCols.has("branch")) alterStatements.push("ALTER TABLE users ADD COLUMN branch TEXT");

      for (const stmt of alterStatements) {
        try { await env.sih_app_db.prepare(stmt).run(); } catch {}
      }
      schemaInitialized = true;
    } catch (cause: any) {
      console.error("[DB Schema Error]", cause, cause?.cause);
      throw cause;
    }
  })();

  await schemaReady;
}

export async function isAdmin(email: string): Promise<boolean> {
  try {
    const normalized = normalizeEmail(email);
    const result = await env.sih_app_db
      .prepare("SELECT 1 FROM admins WHERE LOWER(email) = LOWER(?) LIMIT 1")
      .bind(normalized)
      .first();
    return Boolean(result);
  } catch (cause: any) {
    console.error("[DB isAdmin Error]", cause, cause?.cause);
    return false;
  }
}

export async function getIsFrozen(): Promise<boolean> {
  const freezeKey = process.env.FREEZE_CONFIG_KEY || 'is_frozen';
  try {
    const result = await env.sih_app_db
      .prepare("SELECT value FROM settings WHERE key = ?")
      .bind(freezeKey)
      .first<{ value: string }>();
    return result?.value === "true";
  } catch (cause: any) {
    console.error("[DB getIsFrozen Error]", cause, cause?.cause);
    return false;
  }
}

export async function getIsLeadersOnlyLogin(): Promise<boolean> {
  try {
    const result = await env.sih_app_db
      .prepare("SELECT value FROM settings WHERE key = 'leaders_only_login'")
      .first<{ value: string }>();
    return result?.value === "true";
  } catch (cause: any) {
    console.error("[DB getIsLeadersOnlyLogin Error]", cause, cause?.cause);
    return false;
  }
}

export async function setIsFrozen(frozen: boolean): Promise<void> {
  const freezeKey = process.env.FREEZE_CONFIG_KEY || 'is_frozen';
  try {
    await env.sih_app_db
      .prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)")
      .bind(freezeKey, frozen ? "true" : "false")
      .run();
  } catch (cause: any) {
    console.error("[DB setIsFrozen Error]", cause, cause?.cause);
  }
}

export async function setIsLeadersOnlyLogin(leadersOnly: boolean): Promise<void> {
  try {
    await env.sih_app_db
      .prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('leaders_only_login', ?)")
      .bind(leadersOnly ? "true" : "false")
      .run();
  } catch (cause: any) {
    console.error("[DB setIsLeadersOnlyLogin Error]", cause, cause?.cause);
  }
}

export async function getIsFCFSEnabled(): Promise<boolean> {
  try {
    const result = await env.sih_app_db
      .prepare("SELECT value FROM settings WHERE key = 'fcfs_enabled'")
      .first<{ value: string }>();
    return result?.value === "true";
  } catch (cause: any) {
    console.error("[DB getIsFCFSEnabled Error]", cause, cause?.cause);
    return false;
  }
}

export async function setIsFCFSEnabled(enabled: boolean): Promise<void> {
  try {
    await env.sih_app_db
      .prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('fcfs_enabled', ?)")
      .bind(enabled ? "true" : "false")
      .run();
  } catch (cause: any) {
    console.error("[DB setIsFCFSEnabled Error]", cause, cause?.cause);
  }
}

export async function upsertUser(input: {
  uid: string;
  email: string;
  name?: string | null;
  phone?: string | null;
  regNo?: string | null;
  gender?: string | null;
  branch?: string | null;
  photoUrl?: string | null;
}) {
  try {
    const normalized = normalizeEmail(input.email);
    await env.sih_app_db
      .prepare(
        `INSERT INTO users (id, email, name, phone, reg_no, gender, branch, photo_url, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(email) DO UPDATE SET
           id = excluded.id,
           name = COALESCE(excluded.name, users.name),
           phone = COALESCE(excluded.phone, users.phone),
           reg_no = COALESCE(excluded.reg_no, users.reg_no),
           gender = COALESCE(excluded.gender, users.gender),
           branch = COALESCE(excluded.branch, users.branch),
           photo_url = COALESCE(excluded.photo_url, users.photo_url)`,
      )
      .bind(
        input.uid,
        normalized,
        input.name ?? null,
        input.phone ?? null,
        input.regNo ?? null,
        input.gender ?? null,
        input.branch ?? null,
        input.photoUrl ?? null,
        Date.now(),
      )
      .run();
  } catch (cause: any) {
    console.error("[DB upsertUser Error]", cause, cause?.cause);
  }
}

export async function upsertTeamMember(teamId: string, userId: string, email: string, photoUrl?: string | null) {
  try {
    await env.sih_app_db
      .prepare(
        `INSERT INTO team_members (team_id, user_id, email, photo_url, joined_at)
         SELECT ?, ?, ?, ?, ?
         WHERE (SELECT COUNT(*) FROM team_members WHERE team_id = ?) < 6
         ON CONFLICT(team_id, user_id) DO UPDATE SET email = excluded.email, photo_url = excluded.photo_url`,
      )
      .bind(teamId, userId, normalizeEmail(email), photoUrl ?? null, Date.now(), teamId)
      .run();
  } catch (cause: any) {
    console.error("[DB upsertTeamMember Error]", cause, cause?.cause);
  }
}


