# SIH App — System Architecture & Developer Guide

`sih-app` is a lightweight, edge-native web application built with **Next.js (via `vinext`)**, deployed on **Cloudflare Workers**, backed by **Cloudflare D1 (SQLite)**, and authenticated using **Firebase Auth**.

---

## Codebase Map & File Structure

```text
sih-app/
├── app/
│   ├── api/
│   │   ├── db.ts               # Shared D1 helpers, schema auto-migration, & auth/rate-limit verification
│   │   ├── teams/route.ts      # REST API handlers for team creation, fetching, member kicking, and team deletion
│   │   ├── invites/route.ts    # REST API handlers for sending, listing, and accepting team invites
│   │   └── users/route.ts      # REST API handler for auto-upserting authenticated user profiles into D1
│   ├── login/
│   │   └── page.tsx            # Auth view (Google Sign-In + Dev Email/Password auth form)
│   ├── team/
│   │   └── page.tsx            # Main team management dashboard route
│   ├── layout.tsx              # Root HTML wrapper with Navbar component integration
│   ├── page.tsx                # User Profile route (redirects unauthenticated users to /login)
│   └── globals.css             # Tailwind CSS styles
├── components/
│   ├── navbar.tsx              # Dynamic top navigation header (hidden when logged out)
│   ├── auth-panel.tsx          # Client auth observer & wrapper for team dashboard
│   └── team-board.tsx         # Team creation, invite sending, member roster, & kick/leave UI
├── lib/
│   ├── auth.ts                 # Firebase Auth client SDK wrappers (Google popup, Email auth, auto-sync)
│   ├── auth-policy.ts          # Email domain filter (@poornima.org allowlist) & test mode flags
│   ├── firebase.ts             # Eager Firebase app & auth client initialization from env
│   ├── invite-state.ts         # Shared email normalization (`trim().toLowerCase()`) & invite utilities
│   └── team-store.ts           # Client store with HTTP fetch helpers & background polling logic
├── tests/
│   └── invite-lifecycle.test.mjs # Node.js unit tests for normalization and invite state rules
├── wrangler.jsonc              # Cloudflare Workers configuration (D1 database bindings & RATE_LIMITER)
└── worker-configuration.d.ts  # Wrangler TypeScript environment interface
```

---

## Core System Architecture & Workflows

### 1. Authentication & User Sync Flow
1. **Client Auth**: Managed in `lib/firebase.ts` and `lib/auth.ts`.
2. **Domain Policy**: Restricted to `@poornima.org` domain (configurable in `lib/auth-policy.ts`).
3. **Eager Sync (`subscribeAuth`)**: When `onAuthStateChanged` fires with a valid user, `lib/auth.ts` automatically triggers `POST /api/users` via `teamStore.syncUser()`.
4. **Server Verification (`getVerifiedUser`)**: REST endpoints verify incoming `Authorization: Bearer <token>` against Google Identity Toolkit API (`https://identitytoolkit.googleapis.com/v1/accounts:lookup`).

### 2. Team & Member Lifecycle
- **Single-Team Rule**: Accounts can own at most **1 active team** (`owner_uid UNIQUE` constraint in D1).
- **Creation**: `POST /api/teams` creates the team row and inserts the creator into `team_members` with an implicit **Admin/Leader** role (`owner_email === member.email`).
- **Invites**:
  - `POST /api/invites` verifies target email exists in `users`, recipient is not self, and target is not already a member or pending invitee.
  - `PATCH /api/invites` accepts an invite, adds recipient to `team_members`, and purges pending invite records.
- **Member Removal & Teardown**:
  - `DELETE /api/teams?teamId={id}`: Deletes the team, member roster, and pending invites (Leader only).
  - `DELETE /api/teams?teamId={id}&targetEmail={email}`: Kicks a member (Leader only) or leaves the team (Member only).
  - **Idempotent Handling**: Handlers return `200 OK` gracefully if a concurrent request already deleted the team/member.

---

## Database Architecture (Cloudflare D1 SQLite)

The schema is automatically migrated on-demand via `ensureSchema()` in `app/api/db.ts`:

```sql
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,           -- Firebase UID
  email TEXT NOT NULL UNIQUE,     -- Normalized lowercased email
  photo_url TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY,           -- UUID
  name TEXT NOT NULL,
  owner_uid TEXT NOT NULL UNIQUE, -- Ensures 1 team per owner
  owner_email TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS team_members (
  team_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  email TEXT NOT NULL,
  photo_url TEXT,
  joined_at INTEGER NOT NULL,
  PRIMARY KEY (team_id, user_id)
);

CREATE TABLE IF NOT EXISTS team_invites (
  id TEXT PRIMARY KEY,           -- UUID
  team_id TEXT NOT NULL,
  team_name TEXT NOT NULL,
  from_uid TEXT NOT NULL,
  from_email TEXT NOT NULL,
  to_email TEXT NOT NULL,
  status TEXT NOT NULL,          -- 'pending'
  created_at INTEGER NOT NULL
);
```

---

## REST API Specification

### Authentication
All requests require: `Authorization: Bearer <Firebase_ID_Token>`

| Route | Method | Description | Request Body / Query Params |
|---|---|---|---|
| `/api/teams` | `GET` | Fetch teams owned or joined by user | `?userId={uid}` |
| `/api/teams` | `POST` | Create a new team | `{ name, ownerUid, ownerEmail }` |
| `/api/teams` | `DELETE` | Delete team (Leader) or Remove/Leave member | `?teamId={id}[&targetEmail={email}]` |
| `/api/invites` | `GET` | Fetch pending invites for recipient | `?email={userEmail}` |
| `/api/invites` | `POST` | Send an invite to existing user | `{ teamId, teamName, fromUid, fromEmail, toEmail }` |
| `/api/invites` | `PATCH` | Accept a pending invite | `{ inviteId, userId, userEmail }` |
| `/api/users` | `POST` | Sync/Upsert user profile | `{ uid, email, photoUrl? }` |

---

## Edge Protection & Rate Limiting

- **Rate Limiting**: Configured in `wrangler.jsonc` via Cloudflare `RATE_LIMITER` binding (`60 requests / 60s`). Checked via `checkRateLimit(request)` in `app/api/db.ts`.
- **SQL Injection Prevention**: 100% of database calls use D1 prepared statements (`env.sih_app_db.prepare(...).bind(...)`).

---

## Development & Test Commands

```bash
# Start Vite / vinext dev server
npm run dev

# Run unit test suite
node --test tests/invite-lifecycle.test.mjs

# Build Cloudflare Worker production output
npm run build
```

