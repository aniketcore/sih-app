# vinext app

This project was created with create-vinext-app.

## Firebase auth

The Firebase web app config is defined directly in [lib/firebase.ts](lib/firebase.ts) using the values Firebase gives you in the web app setup snippet.

The current implementation uses Firebase client auth in the browser with Google sign-in. Measurement ID is included for parity with the Firebase snippet but is optional.

Only accounts with emails ending in `@example.com` are allowed to stay signed in. Change the domain in [components/auth-panel.tsx](components/auth-panel.tsx) to update the allowlist.

## How it works

- The app initializes Firebase from the web app config in [lib/firebase.ts](lib/firebase.ts).
- The sign-in UI is client-side only and lives in [components/auth-panel.tsx](components/auth-panel.tsx).
- Auth state is read from Firebase directly in the browser; there is no server session yet.
- The home page remains edge-friendly and mostly static, so auth does not affect the page render path.

## Firebase checklist

1. Create a Firebase project.
2. Register a web app and copy the config values into [lib/firebase.ts](lib/firebase.ts).
3. Enable Email/Password in Authentication.
4. Enable Google if you want the popup sign-in button to work.
5. Restart the dev server after changing the config.

## Current scope

This first auth pass is intentionally minimal. It gives you Google sign-in and sign-out. The next step, if needed, is to persist the signed-in user on the backend and gate problem submissions or queue actions.

## Team flow

- Signed-in users can create one team and then send requests to other email addresses.
- Team and invite data is stored in Firestore through the client SDK.
- The team creator is the owner. Other users only receive requests.

## Firestore setup

1. Enable Firestore in the Firebase console for the same project.
2. Create collections named `teams` and `teamInvites` automatically by using the UI once.
3. Add Firestore security rules before real use.

## Scripts

- `pnpm run dev` starts the vinext dev server.
- `pnpm run build` builds the Cloudflare Worker output.
- `pnpm run start` starts the built Worker locally with Wrangler.
- `pnpm run deploy` deploys the Cloudflare Worker.

