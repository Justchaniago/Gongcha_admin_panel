# Write Governance Policy
# Gongcha Ecosystem — All Applications

> Applies to: Admin Panel, Member App, Cashier App.
> All three apps share the same Firebase backend. This document defines who can write what, via which path.
> For migration stages, see `IMPLEMENTATION_ROADMAP.md`.

---

## Core Rule

**Every write operation must go through the Backend API. No app may write directly to Firestore.**

A "write" is any operation that changes data state:
create, update, delete, approve, reject, verify, refund, redeem, issue, adjust, assign, revoke, cancel

---

## Write Ownership by Domain

| Domain | Owner | Write Entry Point | Allowed Apps |
|--------|-------|-------------------|--------------|
| Transaction (create) | Cashier App | `POST /api/transactions` | Cashier App, Admin Panel |
| Transaction (verify/reject/delete) | Admin Panel | `/api/transactions/verify` + `/api/transactions` | Admin Panel only |
| Loyalty Points | Backend (auto) | Internal pipeline (triggered by transaction) | None — auto-derived |
| Points Manual Adjustment | Admin Panel | `/api/members/[uid]/points` | Admin Panel only |
| Rewards Catalog | Admin Panel | Server Actions + `/api/rewards` | Admin Panel only |
| Voucher Issuance | Admin Panel | `/api/members/[uid]/vouchers` | Admin Panel only |
| Voucher Redemption | Member App | Backend API endpoint *(to create — Stage 2)* | Member App |
| Member Profile | Admin Panel | Server Actions + `/api/members` | Admin Panel only |
| Store / Menu | Admin Panel | Server Actions | Admin Panel only |
| Staff / Admin Users | Admin Panel | Server Actions (`userStaffActions.ts`) | Admin Panel only |
| Settings | Admin Panel | `/api/settings` | Admin Panel only |
| Push Notifications | Admin Panel | `/api/notifications` | Admin Panel only |

---

## Why This Matters

If any app writes directly to Firestore:
- Business rules are not enforced (who validated the points calculation?)
- Audit trail is missing (no activity log)
- RBAC is bypassed (anyone with Firebase credentials can write)
- Logic duplication across 3 apps → drift over time
- Data inconsistency (e.g., points updated without a transaction record)

---

## Per-App Write Policy

### Admin Panel (Next.js) — *Management Authority*
- All mutations via Server Actions (`src/actions/`) or API Routes (`src/app/api/`)
- Every action calls `getAdminSession()` + `authorize()` before any DB write
- Every successful mutation writes an activity log via `writeActivityLog()`
- Status: ✅ COMPLETE

### Cashier App (POS) — *Transaction Entry Point*
- Only allowed to: **create transactions**
- All other domains: read-only
- Transaction creation must go through `POST /api/transactions` (Backend API — Stage 2)
- Must NOT directly update: points, tiers, vouchers, rewards (auto-derived from transaction pipeline)
- Status: 🔴 Not yet migrated — direct Firestore writes exist

### Member App (React Native) — *Read-First Consumer*
- Mostly read-only
- Allowed writes: voucher redemption, own profile update (when needed)
- All writes must go through Backend API — never direct Firestore
- No business logic calculations on client side
- Status: 🔴 Not yet migrated — direct Firestore writes exist

---

## Enforcement Layers

| Layer | Mechanism |
|-------|-----------|
| Admin Panel | `authorize()` in every Server Action + API Route |
| Cashier App | Validate token + restrict scope in Backend API endpoint |
| Member App | Validate Firebase Auth token in Backend API endpoint |
| Firebase | Firestore Security Rules: deny direct writes from client SDK |

**Firestore Security Rules** are the final backstop:
- Admin SDK (server-side): unrestricted access (for Backend API only)
- Client SDK (browser/mobile): read-only for most collections; Auth only for identity

---

## Audit Requirements

Every write must be traceable:

| Field | Description |
|-------|-------------|
| `who` | User ID + role + access profile |
| `what` | Action name + target entity ID |
| `when` | Server-side timestamp |
| `from` | Source app (Admin Panel / Cashier App / Member App) |
| `detail` | Key changed fields or payload summary |

In Admin Panel: `writeActivityLog()` in `src/lib/activityLog.ts` handles this.
In Backend API (Stage 2): same pattern must be implemented.

---

## When a Direct Write Is Found

If a direct Firestore write is discovered in any app:
1. Flag it in the relevant app's tech debt tracker
2. Identify the Backend API endpoint needed (or create one)
3. Migrate the caller to use the Backend API endpoint
4. Add a Firestore Security Rule to block the direct path
5. Verify no other callers depend on the direct write

---

## Reference Documents

| Document | Purpose |
|----------|---------|
| `ARCHITECTURE_POLICY.md` | Engineering principles + coding patterns (Admin Panel) |
| `IMPLEMENTATION_ROADMAP.md` | Phased migration plan across all 3 apps |
| `RBAC_POLICY.md` | Roles, permissions, scopes (Admin Panel RBAC) |
