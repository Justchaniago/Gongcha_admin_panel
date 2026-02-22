# Fix: Infinite Login Redirect Loop

## Root Causes
- Bug 1: `jwtVerify` (JWS) used instead of `getToken` (JWE) for NextAuth session tokens
- Bug 2: Race condition in login page — `onAuthStateChanged` redirects before NextAuth cookie is set
- Bug 3: Duplicate middleware files causing deprecation warning

## Tasks

- [x] 1. Fix `src/middleware.ts` — replaced `jwtVerify` with `getToken` from `next-auth/jwt`
- [x] 2. Deleted root `middleware.ts` — duplicate file causing deprecation warning
- [x] 3. Fix `src/lib/apiAuth.ts` — replaced `jwtVerify` with `getToken` from `next-auth/jwt`
- [x] 4. Fix `src/app/login/page.tsx` — removed `onAuthStateChanged` race condition, now uses `useSession` + `nextAuthSignIn` only
- [x] 5. Updated `.env` — added `NEXTAUTH_URL=http://localhost:3000`
- [x] 6. Created `src/components/NextAuthProvider.tsx` — wraps app with `SessionProvider`
- [x] 7. Updated `src/app/layout.tsx` — added `NextAuthProvider` wrapping the app

## ⚠️ Action Required: Fill in real credentials in `.env`

The `.env` file still has placeholder values. Replace them with real values:

```
NEXTAUTH_SECRET=<run: openssl rand -base64 32>
NEXT_PUBLIC_FIREBASE_API_KEY=<your real Firebase API key>
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=<your-project.firebaseapp.com>
NEXT_PUBLIC_FIREBASE_PROJECT_ID=<your-project-id>
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=<your-project.appspot.com>
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=<your sender id>
NEXT_PUBLIC_FIREBASE_APP_ID=<your app id>
FIREBASE_SERVICE_ACCOUNT_JSON=<JSON string of serviceAccountKey.json>
NEXTAUTH_URL=http://localhost:3000
