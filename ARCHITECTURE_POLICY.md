# Architecture & Engineering Policy
# Gongcha Admin Panel — Living Document

> This document is the authoritative engineering policy for the Gongcha Admin Panel.
> It expands on `AGENTS.md` with current state, concrete patterns, and a phased migration roadmap.
> For RBAC specifics, see `RBAC_POLICY.md`.

---

## 1. System Overview

### Applications
| App | Stack | Role |
|-----|-------|------|
| **Admin Panel** | Next.js (this repo) | Manages system data; performs admin operations |
| **Member App** | React Native / Expo | End-user read-only interface for points, rewards, vouchers |
| **Cashier App** | POS system | Creates transactions; entry point for all business events |

All three apps share the same Firebase backend (Firestore, Auth, Storage).

### Architecture Goal
**Backend-centric.** UI presents data and triggers actions; backend owns all logic and data integrity.

```
Cashier App → Backend API: creates transactions, triggers points/tier pipeline
Member App  → Backend API: reads sensitive data; approved writes only (e.g. voucher redemption)
Admin Panel → Backend API: manages all entities via API Routes and Server Actions
Backend API → Firebase:    only layer allowed to write; single source of truth
```

### Ecosystem Role Boundaries
- **Admin Panel** — management authority; owns business logic, settings, and operational decisions
- **Backend API** — execution layer; validates and executes writes from all 3 apps *(introduced in Stage 2)*
- **Cashier App** — transaction entry point; delegates all business logic to Backend API
- **Member App** — read-first consumer; no business logic, no direct Firestore writes

For write ownership per domain → [`WRITE_GOVERNANCE.md`](WRITE_GOVERNANCE.md)
For the full 3-stage migration plan → [`IMPLEMENTATION_ROADMAP.md`](IMPLEMENTATION_ROADMAP.md)

---

## 2. Architecture Layers

### Layer Model
```
┌─────────────────────────────────────┐
│         Presentation Layer          │  src/app/**/*.tsx, src/components/
│   React components, pages, layout   │  No business logic. No Firebase writes.
├─────────────────────────────────────┤
│         Application Layer           │  src/actions/*.ts, src/app/api/*/route.ts
│  Server Actions, API Routes         │  Auth + RBAC + orchestration. Delegates to domain.
├─────────────────────────────────────┤
│          Domain Layer               │  src/lib/rbac.ts, memberPoints.ts, activityLog.ts
│   Business logic, rules, services   │  No HTTP, no Firebase imports (where possible).
├─────────────────────────────────────┤
│       Infrastructure Layer          │  src/lib/firebaseAdmin.ts, src/lib/firebaseClient.ts
│   Firebase SDK access only          │  All Firestore/Storage calls live here.
└─────────────────────────────────────┘
```

### Target Directory Structure
```
src/
├── app/              # Presentation layer — pages and API routes
├── actions/          # Application layer — Server Actions (command use-cases)
├── components/       # Presentation layer — shared UI components
├── context/          # Presentation layer — React contexts
├── hooks/            # Presentation layer — custom React hooks
├── domain/           # Domain layer — business services (target: extracted from lib/)
│   ├── transaction/  # Transaction rules, points math
│   ├── member/       # Member/loyalty domain
│   └── rbac/         # RBAC engine (currently src/lib/rbac.ts)
├── repositories/     # Infrastructure layer — Firestore data access interfaces + impls (future)
├── lib/              # Shared utilities (session, firebase init, cross-domain helpers)
└── types/            # Shared TypeScript types
```

### Current vs Target State
| Concern | Current Location | Target Location |
|---------|-----------------|----------------|
| RBAC engine | `src/lib/rbac.ts` ✅ | `src/domain/rbac/` |
| Points math | `src/lib/memberPoints.ts` ✅ | `src/domain/transaction/` |
| Activity log service | `src/lib/activityLog.ts` ✅ | `src/domain/audit/` |
| Firestore writes | `src/actions/*.ts` inline ✅ | `src/repositories/` (future) |
| Firestore reads | UI components ⚠️ | API Routes → `src/repositories/` |
| Firebase init (server) | `firebaseAdmin.ts` + `firebaseServer.ts` ⚠️ | Consolidate to `firebaseAdmin.ts` only |

---

## 3. RBAC Policy

RBAC migration is complete. See `RBAC_POLICY.md` for the full policy.

### Quick Reference
- **Backend enforcement:** Every API Route and Server Action calls `getAdminSession()` + `authorize(permission, resource?)`
- **UI gating:** Components use `can(permission)` from `useAuth()` — for UX only, never as a security boundary
- **42 permissions** across 11 domains: transaction, points, member, reward, voucher, store, menu, staff, settings, audit, notification, asset
- **7 access profiles:** ROOT, OPERATIONS, MARKETING, FINANCE, SUPPORT, STORE_MANAGER, READ_ONLY
- **Legacy compatibility:** SUPER_ADMIN → ROOT (global), STAFF → STORE_MANAGER (scoped)

### Authorization Pattern
```ts
// Server Action or API Route — always both lines before any DB access:
const session = await getAdminSession();
await authorize(session, { permission: "domain.action", resource: { storeId } });
```

```tsx
// UI component — gating only:
const { can } = useAuth();
{can("reward.create") && <CreateButton />}
```

---

## 4. Write Path Policy

**Rule: ALL writes must go through the backend.**

### What counts as a write:
create, update, delete, approve, reject, verify, refund, redeem, issue, adjust, assign, revoke

### Allowed Write Patterns
| Operation | Pattern | File |
|-----------|---------|------|
| Entity mutations (stores, menus, rewards, staff) | Server Action | `src/actions/*.ts` |
| Transaction verification + points pipeline | API Route | `/api/transactions/verify` |
| Points manual adjustment | API Route | `/api/members/[uid]/points` |
| Voucher issuance | API Route | `/api/members/[uid]/vouchers` |
| Session create/revoke | API Route | `/api/auth/session` |
| Asset upload | API Route | `/api/assets` |
| Firebase Auth sign-in | Client SDK | Login page only |

### Forbidden
- `adminDb.*` called directly from a React component or hook
- `setDoc`, `updateDoc`, `addDoc`, `deleteDoc` called from any `src/app/**/*.tsx`
- Any business rule calculation (points, tier, eligibility) in a React component

---

## 5. Read Path Policy

### Tier 1 — Must go through backend (sensitive / operational)
These collections contain personal data, financial data, or data used in permission decisions.
Direct reads are **not allowed** from UI components.

| Collection | Reason | Target API |
|------------|--------|-----------|
| `transactions` | Business-critical financial data | `/api/transactions` GET |
| `users` (members) | Personal + financial data | `/api/members` GET (to create) |
| `admin_users` | Staff credentials + RBAC data | `/api/admin-users` GET (to create) |
| `daily_stats` | Operational metrics | `/api/dashboard` GET (to create) |
| `activity_logs` | Audit data | `/api/activity-logs` GET ✅ (exists) |
| Settings affecting business rules | Business logic dependency | `/api/settings` GET ✅ (exists) |

### Tier 2 — Should migrate (low risk but prefer backend)
These can remain as direct reads temporarily, but prefer migrating to backend read models
when making changes to those pages.

| Collection | Notes |
|------------|-------|
| `stores` | Display only; no business logic |
| `rewards_catalog` | Display only; no redemption logic in UI |
| `products` | Display only; no pricing logic in UI |

### Tier 3 — Acceptable direct reads
- `onAuthStateChanged` — Firebase Auth state (authentication, not data)
- Static config / non-sensitive display data

### Rules for Temporary Direct Reads (Tier 2)
1. Read-only — no business logic derived from the data
2. No permission decisions made from direct reads
3. Protected by Firestore security rules
4. No cross-app data dependency

---

## 6. Migration Roadmap

Work incrementally per phase. Never rewrite the entire system at once.
Run `npm run build` after every phase.

---

### Phase A — Infrastructure Cleanup *(Low effort, immediate)*

**Goal:** Eliminate dead code and standardize Firebase initialization.

**Tasks:**
1. In `src/app/api/transactions/route.ts`: replace `import { adminDb } from "@/lib/firebaseServer"` with `import { adminDb } from "@/lib/firebaseAdmin"`
2. In `src/app/api/notifications/route.ts`: same replacement
3. Delete `src/lib/firebaseServer.ts` after confirming no other references
4. Verify `npm run build` passes

**Files:**
- `src/app/api/transactions/route.ts`
- `src/app/api/notifications/route.ts`
- `src/lib/firebaseServer.ts` (delete)

---

### Phase B — Read Migration: Dashboard *(High priority — operational data)*

**Goal:** Remove direct Firestore reads for all dashboard metrics from UI components.

**Current issue:** `DashboardDesktop.tsx` and `DashboardMobile.tsx` use `onSnapshot` directly on
`daily_stats`, `transactions`, `users`, and `stores` — exposing all operational data to the browser
client without any RBAC enforcement.

**Tasks:**
1. Create `/api/dashboard` GET route that returns aggregated metrics (counts, daily_stats, recent transactions)
2. Enforce `authorize(session, { permission: "dashboard.read" })` (or existing `transaction.read`)
3. Update `DashboardDesktop.tsx` and `DashboardMobile.tsx` to poll `/api/dashboard` instead of `onSnapshot`
4. Remove `import { db } from "@/lib/firebaseClient"` from Dashboard components

**New files:**
- `src/app/api/dashboard/route.ts`

**Modified files:**
- `src/app/dashboard/DashboardDesktop.tsx`
- `src/app/dashboard/DashboardMobile.tsx`

---

### Phase C — Read Migration: Members & Admin Users *(High priority — personal data)*

**Goal:** Replace direct reads of `users` and `admin_users` collections from UI.

**Current issue:**
- `MembersDesktop/Mobile.tsx` use `getDocs`/`onSnapshot` on `users` (member personal data) and `admin_users` (staff RBAC data) directly
- `InjectVoucherModalForMember.tsx` uses `getDoc` on individual user documents

**Tasks:**
1. Create `/api/members` GET route with pagination, search, role filter; enforce `member.read`
2. Create `/api/admin-users` GET route returning staff list; enforce `staff.read`
3. Update `MembersDesktop/Mobile.tsx` to fetch from API routes
4. Update `InjectVoucherModalForMember.tsx` to use API routes
5. Remove client-side `getDocs`/`onSnapshot` calls for these collections

**New files:**
- `src/app/api/members/route.ts` (list with pagination)
- `src/app/api/admin-users/route.ts` (staff list)

---

### Phase D — Repository Interface Layer *(Medium effort, architectural)*

**Goal:** Introduce repository interfaces to decouple business logic from Firestore implementation.

**Pattern to introduce:**
```ts
// src/repositories/interfaces.ts
export interface TransactionRepository {
  findByStore(storeId: string, opts: PaginationOptions): Promise<Transaction[]>;
  findById(id: string): Promise<Transaction | null>;
  update(id: string, data: Partial<Transaction>): Promise<void>;
  delete(id: string): Promise<void>;
}

// src/repositories/firestore/transactionRepository.ts
export class FirestoreTransactionRepository implements TransactionRepository {
  constructor(private db: FirebaseFirestore.Firestore) {}
  async findByStore(storeId: string, opts: PaginationOptions) {
    // adminDb calls only here
  }
}
```

**Order of repository extraction (highest value first):**
1. `TransactionRepository` — most critical domain
2. `MemberRepository` — personal data, high query complexity
3. `StaffRepository` — RBAC + admin users
4. `RewardRepository` — reward catalog + voucher management
5. `StoreRepository` / `MenuRepository` — lowest complexity

---

### Phase E — Domain Layer Formalization *(Long-term)*

**Goal:** Move business logic out of `src/lib/` into a formal domain layer.

**Migrations:**
- `src/lib/rbac.ts` → `src/domain/rbac/`
- `src/lib/memberPoints.ts` → `src/domain/transaction/`
- `src/lib/activityLog.ts` → `src/domain/audit/`
- Points/tier business rules → `src/domain/loyalty/`

This phase is deferred until Phases A–D are complete.

---

## 7. Coding Patterns

### Server Action Template
```ts
"use server";
import { getAdminSession } from "@/lib/adminSession";
import { authorize } from "@/lib/rbac";
import { adminDb } from "@/lib/firebaseAdmin";
import { writeActivityLog } from "@/lib/activityLog";

export async function createEntityAction(params: CreateParams) {
  const session = await getAdminSession();
  await authorize(session, { permission: "domain.create" });

  const ref = adminDb.collection("entities").doc();
  await ref.set({ ...params, createdAt: new Date() });

  await writeActivityLog(session, {
    action: "entity.create",
    targetId: ref.id,
    details: params,
  });

  return { id: ref.id };
}
```

### API Route Template
```ts
import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/adminSession";
import { authorize } from "@/lib/rbac";
import { adminDb } from "@/lib/firebaseAdmin";

export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  await authorize(session, { permission: "domain.read" });

  const snapshot = await adminDb.collection("entities").get();
  const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

  return NextResponse.json({ data });
}
```

### UI Component Pattern (permission gating)
```tsx
"use client";
import { useAuth } from "@/context/AuthContext";

export function EntityPage() {
  const { can, loading } = useAuth();

  if (loading) return <LoadingState />;

  return (
    <div>
      {can("entity.create") && <CreateButton />}
      {can("entity.delete") && <DeleteButton />}
    </div>
  );
}
```

### UI Component Pattern (data fetching — target pattern)
```tsx
// Fetch from API route, not direct Firestore
const [data, setData] = useState([]);

useEffect(() => {
  fetch("/api/entities")
    .then((r) => r.json())
    .then((json) => setData(json.data));
}, []);
```

---

## 8. Naming Conventions

| Layer | Convention | Example |
|-------|-----------|---------|
| Server Actions | camelCase + `Action` suffix | `createRewardAction`, `updateMemberAction` |
| API Routes | RESTful path + HTTP verb | `GET /api/rewards`, `POST /api/transactions/verify` |
| Repository interfaces | PascalCase + `Repository` | `TransactionRepository` |
| Repository implementations | `Firestore` prefix + `Repository` | `FirestoreTransactionRepository` |
| Domain services | PascalCase + `Service` | `MemberPointsService` |
| Permission strings | `domain.action` dot notation | `transaction.verify`, `member.update` |

---

## 9. Domain Priority Order

1. **Transaction** — source of truth for all financial operations; highest blast radius
2. **Loyalty / Points** — derived from transactions; must remain consistent
3. **Rewards / Vouchers** — business-critical redemption logic
4. **Users / Members** — personal data sensitivity
5. **Staff / Admin Users** — RBAC + access control
6. **Stores** — display + operational data
7. **Menus** — low-risk product catalog

Any change to Transaction domain must verify compatibility across all three apps.

---

## 10. Testing Requirements

### After Every Change
- `npm run build` — must pass with zero errors
- `npm run typecheck` (if available) — no TypeScript errors

### Backend Authorization Tests
Every new API Route or Server Action must be verifiable via:
- ✅ Admin (ROOT) can access
- ✅ User with explicit permission can access
- ❌ User without permission receives 403
- ❌ STORE-scoped user denied access to another store's resource
- ❌ Inactive admin session rejected

### Read Path Migration Tests
When migrating a direct Firestore read to a backend API:
- Response shape matches what the component expects
- Pagination works (if applicable)
- RBAC: user without `domain.read` gets 403
- Legacy SUPER_ADMIN still gets data

---

## 11. Anti-Patterns — Never Do This

| Anti-Pattern | Why Forbidden | Correct Pattern |
|-------------|--------------|----------------|
| `setDoc(doc(db, "col", id), data)` in a component | Bypasses auth + RBAC + audit logging | Use Server Action |
| `getDocs(collection(db, "transactions"))` in a component | No RBAC, exposes financial data to browser | Use `/api/transactions` GET |
| `role === "SUPER_ADMIN"` in UI gating | Bypasses permission system | Use `can("permission")` |
| `role === "SUPER_ADMIN"` in API route | Role checks must use `authorize()` | Use `authorize(session, { permission })` |
| Business logic (points math, tier calc) in component | Duplicates domain logic, breaks single source of truth | Move to `src/lib/` or `src/domain/` |
| Calling `adminDb` directly in a component | Server-side SDK in client context | Only in `src/actions/`, `src/app/api/`, `src/lib/` |
| Skipping `writeActivityLog` after a mutation | Breaks audit trail | Always log after successful write |
| Duplicating `onSnapshot` logic in Desktop and Mobile variants | Logic drift between platforms | Extract to shared hook in `src/hooks/` |
| Rewriting entire system at once | Risk of regression, coordination failure | Use strangler pattern per domain |

---

## 12. Current Known Technical Debt

### High Priority
| Item | Location | Action |
|------|---------|--------|
| `firebaseServer.ts` duplicate | `src/lib/firebaseServer.ts` | Delete; update 2 importing routes to use `firebaseAdmin.ts` |
| Dashboard direct reads | `DashboardDesktop/Mobile.tsx` | Create `/api/dashboard` + migrate (Phase B) |
| Member list direct reads | `MembersDesktop/Mobile.tsx` | Create `/api/members` + migrate (Phase C) |
| Admin users direct reads | `MembersDesktop/Mobile.tsx` | Create `/api/admin-users` + migrate (Phase C) |

### Medium Priority
| Item | Location | Action |
|------|---------|--------|
| `InjectVoucherModal` direct `getDoc` | `InjectVoucherModalForMember.tsx` | Use `/api/members/[uid]` or members API |
| `AuthContext` fallback `getDoc` on `admin_users` | `src/context/AuthContext.tsx` | Remove fallback; rely on `/api/auth/session` |
| Duplicated `onSnapshot` in Desktop/Mobile pairs | All domain pages | Extract to shared hooks in `src/hooks/` |
| No repository interfaces | `src/actions/*.ts` | Phase D |

### Low Priority (Deferred)
| Item | Notes |
|------|-------|
| Stores direct reads | `onSnapshot → stores` is low-risk display data |
| Rewards/Menus direct reads | Low-risk catalog display; migrate during Phase D–E |
| Domain layer formalization | Phase E; deferred until Phases A–D complete |

---

## 13. Reference Documents

| Document | Purpose |
|----------|---------|
| `ARCHITECTURE_POLICY.md` | This document — engineering principles + coding patterns (Admin Panel) |
| `IMPLEMENTATION_ROADMAP.md` | 3-stage migration plan to production-ready ecosystem |
| `WRITE_GOVERNANCE.md` | Write ownership per domain across all 3 apps |
| `RBAC_POLICY.md` | Full RBAC role, permission, and scope specification |
| `RBAC_AUDIT.md` | RBAC migration audit log — historical record of what was changed |
| `AGENTS.md` | Original architectural principles brief |
