# Implementation Roadmap
# Gongcha Ecosystem — Path to Production-Ready Architecture

> This document tracks the incremental migration to a fully backend-centric, future-proof architecture.
> For engineering principles, see `ARCHITECTURE_POLICY.md`.
> For write ownership rules, see `WRITE_GOVERNANCE.md`.

---

## End State

When all stages are complete:
- No app writes directly to Firestore
- Backend API is the single validation + business logic layer
- Admin Panel is the management authority (brain)
- Member App and Cashier App are thin clients (approved reads + minimal writes)
- No business logic is duplicated across apps

```
Admin Panel ──────────────────────────────────────┐
(management UI)                                    │
                                                   ↓
Cashier App → POST /transactions ──→  Backend API ──→ Firebase
Member App  → POST /vouchers/redeem ─↗  (validation +   (data layer)
             GET  /members/me ───────↗   audit + RBAC)
```

---

## Stage 1: Admin Panel Backend-Centric

**Status:** 🔄 In Progress
**Goal:** Admin Panel reads and writes fully via server layer. No direct Firestore from UI.

### Phase A — Infrastructure Cleanup ✅ *(Done 2026-05-02)*

| Task | File | Status |
|------|------|--------|
| Replace `firebaseServer` import | `src/app/api/transactions/route.ts` | ✅ |
| Replace `firebaseServer` import | `src/app/api/notifications/route.ts` | ✅ |
| Replace `firebaseServer` import | `src/app/admin-users/UsersStaffClient.tsx` | ✅ *(bonus find)* |
| Delete dead file | `src/lib/firebaseServer.ts` | ✅ deleted |
| Build verification | `npm run build` | ✅ 26 routes, no errors |

> **Note:** `UsersStaffClient.tsx` reads `users`, `admin_users`, `stores` via `adminDb` without `authorize()`. Flagged for Phase C — migrate to `/api/admin-users` with RBAC.

### Phase B — Read Migration: Dashboard ✅ *(Done 2026-05-02)*

| Task | File | Status |
|------|------|--------|
| Create dashboard API | `src/app/api/dashboard/route.ts` | ✅ |
| Migrate reads | `src/app/dashboard/DashboardDesktop.tsx` | ✅ |
| Migrate reads | `src/app/dashboard/DashboardMobile.tsx` | ✅ |

### Phase C — Read Migration: Members & Admin Users ✅ *(Done 2026-05-02)*

| Task | File | Status |
|------|------|--------|
| Create members list API | `src/app/api/members/route.ts` | ✅ |
| Create admin users API | `src/app/api/admin-users/route.ts` | ✅ |
| Add `authorize()` | `src/app/admin-users/UsersStaffClient.tsx` | ✅ |
| Migrate reads | `src/app/admin-users/MembersDesktop.tsx` | ✅ |
| Migrate reads | `src/app/admin-users/MembersMobile.tsx` | ✅ |
| Remove `getDoc` on users | `src/app/admin-users/InjectVoucherModalForMember.tsx` | ✅ |
| Remove `getDoc` on users | `src/app/admin-users/InjectVoucherModalForMember.tsx` | ✅ |
| Remove fallback | `src/context/AuthContext.tsx` — remove `getDoc` on `admin_users` fallback | ✅ |
| Case-insensitive search | Add `nameLower` field + backfill script | ✅ |

Exit: No `getDocs`/`onSnapshot` on `users` or `admin_users` from any UI component. ✅

### Phase D — Repository Interface Layer *(Medium, ~1–2 weeks)*

Introduce `src/repositories/` with interfaces + Firestore implementations.
Order: TransactionRepository → MemberRepository → StaffRepository → RewardRepository.

### Phase E — Domain Layer Formalization *(Long-term, after Stage 2)*

Move business services from `src/lib/` to `src/domain/`:
- `rbac.ts` → `src/domain/rbac/`
- `memberPoints.ts` → `src/domain/transaction/`
- `activityLog.ts` → `src/domain/audit/`

**Stage 1 Complete Criteria:**
- [x] Phase A: `firebaseServer.ts` deleted
- [x] Phase B: Dashboard reads via `/api/dashboard`
- [x] Phase C: Members/admin-users reads via API
- [x] `npm run build` passes (✅ 29 routes, 0 errors as of 2026-05-02)

---

## Stage 2: Backend API Layer

**Status:** 🔴 Not Started
**Prerequisite:** Stage 1 Phase A–C complete
**Goal:** Introduce a lightweight Backend API that validates and executes writes from all 3 apps

### Decision: Where to Host

| Option | Pros | Cons |
|--------|------|------|
| **Firebase Cloud Functions** | Native Firebase ecosystem, serverless, no infra | Cold starts, limited runtimes |
| **Next.js API Routes (Admin Panel)** | Already exists, zero setup | Couples backend lifecycle to Admin Panel deploy |
| **Node.js standalone** | Full flexibility | Needs hosting, more infra |

**Recommendation: Firebase Cloud Functions.**
- Keeps backend in Firebase ecosystem (consistent auth, Firestore access)
- Decoupled from Admin Panel deploy
- Scales automatically

### Minimum Viable Endpoints

Exact endpoints to be finalized after auditing Member App + Cashier App repos.

| Endpoint | Consumer | Purpose |
|----------|----------|---------|
| `POST /transactions` | Cashier App | Create transaction + trigger points pipeline |
| `GET /members/me` | Member App | Own profile + points balance |
| `GET /members/me/vouchers` | Member App | Active vouchers |
| `POST /vouchers/redeem` | Member App | Redeem a voucher |
| `GET /rewards` | Member App | Available reward catalog |

### Auth Pattern

| App | Auth Method |
|-----|------------|
| Cashier App | Firebase Auth (custom token with `cashier` claim) |
| Member App | Firebase Auth (user UID token — member-scoped) |
| Admin Panel | Existing session cookie + `getAdminSession()` |

Backend validates token type + enforces scope before any write.

### Business Logic Rules (Backend API must enforce)

- Transaction: calculate points = `amount × pointRate`, capped by tier rules
- Points: only increase from verified transactions or approved manual adjustment
- Vouchers: can only be redeemed once; check expiry before redemption
- Tier: derived from cumulative points; recalculate after every point change

All rules are owned here — never in Cashier App or Member App.

**Stage 2 Complete Criteria:**
- [ ] Cashier App transaction creation via Backend API endpoint
- [ ] Backend API writes to Firebase via Admin SDK
- [ ] Activity log written for every Backend API write
- [ ] Points pipeline triggered server-side after transaction
- [ ] Member App reads own data via `GET /members/me`

---

## Stage 3: Member App & Cashier App Compliance

**Status:** 🔴 Not Started
**Prerequisite:** Stage 2 complete
**Goal:** Eliminate all direct Firestore writes from Member App and Cashier App

### Step 1: Audit (before code changes)
- Jump into Cashier App repo → list all direct Firestore writes
- Jump into Member App repo → list all direct Firestore writes
- Classify each: can migrate to existing Backend API, or needs new endpoint

### Step 2: Cashier App Migration
- Replace all direct Firestore writes with Backend API calls
- Reads: keep direct Firebase where data is non-sensitive (store info, menu catalog)
- Sensitive reads (transaction history): move to Backend API

### Step 3: Member App Migration
- Replace all direct Firestore writes with Backend API calls
- Display reads: keep direct Firebase (rewards catalog, store info)
- Sensitive reads (own points, vouchers): already via `GET /members/me` (Stage 2)

### Step 4: Firestore Security Rules Lockdown
- Deny direct writes from client SDK to critical collections
- Collections to lock: `transactions`, `users`, `admin_users`, `activity_logs`, `settings`
- Collections to keep readable from client: `stores`, `products`, `rewards_catalog` (with auth)

**Stage 3 Complete Criteria:**
- [ ] No direct Firestore writes in Member App
- [ ] No direct Firestore writes in Cashier App
- [ ] Firestore Security Rules deny client writes to Tier 1 collections
- [ ] End-to-end test: Cashier creates transaction → points update in Member App

---

## Future Stages (Post-Production)

| Stage | Description |
|-------|-------------|
| 4 | Admin Panel Phase D–E (Repository + Domain layers) |
| 5 | Backend API: rate limiting, monitoring, error reporting |
| 6 | Migrate remaining Tier-2 reads (stores, rewards) to Backend API |
| 7 | Member App offline support + optimistic UI |

---

## Timeline Estimate

| Stage | Effort | Can Start |
|-------|--------|-----------|
| Stage 1 A–C | 2–3 weeks | Now |
| Stage 1 D–E | 3–5 weeks | After A–C |
| Stage 2 | 3–4 weeks | After Stage 1 A–C |
| Stage 3 | 4–6 weeks | After Stage 2 |

**Total to production-ready:** ~12–18 weeks (stages 1 A–C and 2 can overlap after Phase A)

---

## Reference Documents

| Document | Purpose |
|----------|---------|
| `ARCHITECTURE_POLICY.md` | Engineering principles + coding patterns |
| `WRITE_GOVERNANCE.md` | Write ownership per domain across all 3 apps |
| `RBAC_POLICY.md` | Roles, permissions, scopes |
