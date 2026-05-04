# Firestore Structure & CRUD Alignment Audit
> Generated: 2026-05-03 | Branch: `rbac-backend-architecture` | DB: `gongcha-ver001`

---

## 1. Firestore Collections — Live Structure

> Dibaca langsung dari Firestore via Admin SDK. Count = jumlah dokumen aktual.

### `activity_log_days` (6 docs)
| Field | Type |
|-------|------|
| `date` | string (`YYYY-MM-DD`) |
| `createdAt` | Timestamp |
| `updatedAt` | Timestamp |

**Subcollection: `events`** (3 docs per sample day)
| Field | Type |
|-------|------|
| `actorUid` | string |
| `actorName` | string |
| `actorEmail` | string |
| `actorRole` | string |
| `action` | string |
| `targetType` | string |
| `targetId` | string |
| `targetLabel` | string |
| `summary` | string |
| `status` | string |
| `source` | string |
| `metadata` | map |
| `isManual` | boolean |
| `createdAt` | Timestamp |
| `deletedAt` | Timestamp (nullable) |
| `isDeleted` | boolean |
| `deleteReason` | string (nullable) |
| `deletedBy` | string (nullable) |

---

### `admin_users` (2 docs)
| Field | Type |
|-------|------|
| `uid` | string |
| `name` | string |
| `email` | string |
| `role` | string |
| `isActive` | boolean |
| `assignedStoreId` | string \| null |
| `cashiers` | Array\<map\> |
| `createdAt` | string |
| `updatedAt` | string |

---

### `daily_stats` (4 docs)
| Field | Type |
|-------|------|
| `date` | string |
| `storeId` | string |
| `type` | string (`GLOBAL` \| `STORE`) |
| `totalRevenue` | number |
| `totalTransactions` | number |
| `totalProductSold` | number |
| `visitedMemberIds` | Array\<string\> |
| `updatedAt` | Timestamp |

---

### `global_promos` (3 docs)
| Field | Type |
|-------|------|
| `title` | string |
| `description` | string |
| `imageUrl` | string |
| `isActive` | boolean |
| `createdAt` | Timestamp |
| `updatedAt` | Timestamp |

---

### `notifications` (3 docs) — ROOT LEVEL
| Field | Type |
|-------|------|
| `userId` | string |
| `type` | string |
| `title` | string |
| `body` | string |
| `isRead` | boolean |
| `createdAt` | string |
| `data` | map |

---

### `notifications_log` (8 docs)
| Field | Type |
|-------|------|
| `type` | string |
| `title` | string |
| `body` | string |
| `targetType` | string (`all` \| `user`) |
| `targetUid` | string (nullable) |
| `targetName` | string (nullable) |
| `sentAt` | string |
| `sentBy` | string |
| `recipientCount` | number |

---

### `products` (2 docs)
| Field | Type |
|-------|------|
| `name` | string |
| `category` | string |
| `basePrice` | number |
| `description` | string |
| `imageUrl` | string |
| `isAvailable` | boolean |
| `isHotAvailable` | boolean |
| `isLargeAvailable` | boolean |
| `createdAt` | Timestamp |
| `updatedAt` | Timestamp |

---

### `rewards_catalog` (2 docs)
| Field | Type |
|-------|------|
| `title` | string |
| `description` | string |
| `pointsrequired` | number (lowercase 'r') |
| `imageUrl` | string |
| `isActive` | boolean |
| `isRedeemable` | boolean |
| `createdAt` | Timestamp |
| `updatedAt` | Timestamp |

---

### `settings` (1 doc)
| Field | Type |
|-------|------|
| `minimumTransaction` | number |
| `pointsPerThousand` | number |
| `pointsExpiry` | string |
| `tiers` | map |
| `notifications` | map |
| `updatedBy` | string |
| `updatedAt` | string |

---

### `stores` (2 docs)
| Field | Type |
|-------|------|
| `name` | string |
| `address` | string |
| `location` | map (`lat`, `lng`) |
| `operationalHours` | map (`open`, `close`) |
| `isForceClosed` | boolean |
| `isActive` | boolean |
| `isAvailable` | boolean |
| `createdAt` | Timestamp |
| `updatedAt` | Timestamp |

---

### `transactions` (10 docs)
| Field | Type |
|-------|------|
| `receiptNumber` | string |
| `posTransactionId` | string |
| `totalAmount` | number |
| `potentialPoints` | number |
| `pointsEarned` | number |
| `memberName` | string |
| `staffId` | string |
| `cashierName` | string |
| `storeId` | string |
| `storeName` | string |
| `status` | string (`PENDING` \| `COMPLETED` \| `CANCELLED`) |
| `type` | string (`earn` \| `redeem`) |
| `uid` | string (nullable) |
| `userId` | string (nullable) |
| `memberId` | string (nullable) |
| `pointsState` | string |
| `createdAt` | Timestamp |
| `verifiedAt` | string (nullable) |
| `verifiedBy` | string (nullable) |

---

### `users` (1 doc) — Member collection
| Field | Type |
|-------|------|
| `uid` | string |
| `name` | string |
| `nameLower` | string |
| `email` | string |
| `phoneNumber` | string |
| `dateOfBirth` | string |
| `photoURL` | string |
| `role` | string |
| `emailVerified` | boolean |
| `profileComplete` | boolean |
| `tier` | string |
| `points` | number (legacy alias) |
| `currentPoints` | number |
| `pendingPoints` | number |
| `lifetimePoints` | number |
| `tierXp` | number |
| `xp` | number |
| `xpHistory` | Array\<map\> |
| `totalEarned` | number |
| `vouchers` | Array\<map\> |
| `activeVouchers` | Array\<map\> |
| `lastRewardTransactionId` | string |
| `pointsLastUpdatedBy` | string |
| `pointsLastUpdatedAt` | string |
| `lastPointsUpdate` | Timestamp |
| `securityPinHash` | string |
| `securityPinSalt` | string |
| `securityPinUpdatedAt` | string |
| `joinedDate` | string |
| `updatedAt` | string |

**Subcollection: `users/{uid}/notifications`** (5 docs per user)
| Field | Type |
|-------|------|
| `type` | string |
| `title` | string |
| `body` | string |
| `isRead` | boolean |
| `createdAt` | Timestamp |
| `expireAt` | Timestamp |
| `data` | map |

---

## 2. CRUD Coverage Map

> Legend: ✅ Aligned | ⚠️ Partial / Issue | ❌ Not covered | 🔴 Violation

### Per Collection

| Collection | Read | Write (C/U) | Delete | Backend Layer | Notes |
|------------|------|------------|--------|---------------|-------|
| `activity_log_days/events` | ✅ `/api/activity-logs` | ✅ `lib/activityLog.ts` | ✅ soft-delete via `isDeleted` | API Route | |
| `admin_users` | ✅ `/api/admin-users`, `/api/auth/session` | ✅ `userStaffActions.ts`, `/api/setup-user` | ⚠️ Hard delete | Server Action | Hard delete inconsistent |
| `daily_stats` | ✅ `/api/dashboard` | ❌ No admin write path | — | API Route | Written by Cashier App / external process |
| `global_promos` | ❌ No GET endpoint | ✅ `/api/notifications` (POST broadcast) | ❌ No delete path | API Route | No dedicated management UI |
| `notifications` (root) | ❌ | ❌ | ❌ | — | **Legacy / orphaned** — not written by current code |
| `notifications_log` | ✅ via `/api/notifications` log | ✅ `/api/notifications` | — | API Route | Read-only log, append-only |
| `products` | ⚠️ Direct `onSnapshot` in UI | ✅ `menuActions.ts` | ✅ Soft-delete | Server Action | Read still direct (Tier 2) |
| `rewards_catalog` | ⚠️ Direct `onSnapshot` in UI | ✅ `rewardActions.ts`, `/api/rewards` | ✅ Soft-delete | Both | Read still direct (Tier 2) |
| `settings` | ✅ `/api/settings` | ✅ `/api/settings` | — | API Route | |
| `stores` | ⚠️ Direct `onSnapshot` in UI | ✅ `storeActions.ts`, `/api/stores` | ✅ Soft-delete | Both | Read still direct (Tier 2) |
| `transactions` | ✅ `/api/transactions` | ✅ `/api/transactions/verify` | ✅ `/api/transactions` DELETE | API Route | ⚠️ Dashboard hybrid (see §3) |
| `users` | ✅ `/api/members` | ✅ `memberActions.ts`, `/api/members/[uid]/points` | ✅ `userStaffActions.ts` | Both | |
| `users/{uid}/notifications` | — | ✅ `memberActions.ts`, `/api/notifications` | — | Both | |

---

## 3. Issues & Misalignments

### 🔴 Issue #1 — Dashboard Hybrid Read (Phase B Incomplete)

**File:** `src/app/dashboard/DashboardDesktop.tsx` line 441, `DashboardMobile.tsx` line 370

```
DashboardDesktop.tsx:441  collection(db, "transactions") → onSnapshot  ← DIRECT
DashboardDesktop.tsx:395  fetch("/api/dashboard")                       ← via API ✅
DashboardMobile.tsx:370   collection(db, "transactions") → onSnapshot  ← DIRECT
DashboardMobile.tsx:403   collection(db, "transactions") → onSnapshot  ← DIRECT (pending)
```

**Status:** Phase B (Dashboard read migration) diperlakukan selesai di memory, tapi di kode ada **hybrid** — stats utama sudah via `/api/dashboard`, tapi **real-time transaction list dan pending count masih pakai `onSnapshot` langsung** ke `transactions`. Ini **Tier 1 violation** karena `transactions` adalah data finansial sensitif.

**Fix required:** Pindahkan real-time transaction display ke polling `/api/transactions` atau SSE endpoint; hapus `collection(db, "transactions")` dari Dashboard components.

---

### ⚠️ Issue #2 — TypeScript Type Mismatches

#### `admin_users` — field `cashiers` tidak ada di `AdminUser` interface
Firestore menyimpan `cashiers: Array<map>` tapi `AdminUser` tidak punya field ini.
- Data ada di DB → tidak bisa dibaca via typed interface → **silent data loss**
- **Fix:** Tambahkan `cashiers?: CashierEntry[]` ke `AdminUser` atau hapus dari Firestore kalau sudah tidak dipakai.

#### `admin_users` — `createdAt` / `updatedAt` bertype `string` di Firestore
Berbeda dengan koleksi lain yang pakai `Timestamp`. Tidak ada di `AdminUser` interface.
- **Fix:** Tambahkan ke interface dan standardisasi ke `Timestamp`.

#### `Store` — field `isAvailable` tidak ada di TypeScript type
Firestore punya `isAvailable: boolean` tapi `Store` interface hanya punya `isActive` dan `isForceClosed`.
- **Fix:** Tambahkan `isAvailable?: boolean` ke `Store`.

#### `DailyStat` — `visitedMemberIds` dan `totalProductSold` tidak di type
Firestore punya keduanya, `DailyStat` interface tidak.
- **Fix:** Tambahkan ke `DailyStat` kalau dipakai di dashboard analytics.

#### `User` — banyak field Firestore tidak ada di TypeScript type
Field yang ada di Firestore tapi **tidak di `User` interface**:
- `securityPinHash`, `securityPinSalt`, `securityPinUpdatedAt`
- `totalEarned`, `pointsLastUpdatedBy`, `pointsLastUpdatedAt`, `lastRewardTransactionId`
- `profileComplete`, `dateOfBirth`, `emailVerified`

*Note: security pin fields sengaja tidak diekspos ke Admin Panel — ini aman. Tapi fields seperti `profileComplete` dan `totalEarned` mungkin berguna.*

---

### ⚠️ Issue #3 — `users` Dual Points Fields

Di Firestore ada **3 overlapping fields** untuk points:
- `points` (legacy)
- `currentPoints` (current)
- `pendingPoints`

`userConverter` sudah handle ini dengan fallback `safeNumber(data.currentPoints, safeNumber(data.points))` — **tidak breaking**, tapi `points` sebagai legacy alias sebaiknya di-deprecate dan dihapus dari Firestore setelah migrasi penuh.

---

### ⚠️ Issue #4 — `notifications` Root Collection Orphaned

Di Firestore ada top-level collection `notifications` (3 docs) dengan struktur `userId, type, title, body, isRead, createdAt, data`.

**Tidak ada kode yang menulis ke collection ini saat ini.** Semua notifikasi user ditulis ke `users/{uid}/notifications` (subcollection). Collection root ini kemungkinan **legacy dari implementasi lama**.

**Action required:** Verifikasi apakah collection ini masih dipakai oleh Cashier App atau Member App. Kalau tidak, dapat di-archive atau dihapus.

---

### ⚠️ Issue #5 — `global_promos` Tanpa Read/Delete Endpoint

`global_promos` hanya ditulis via `/api/notifications` ketika kirim broadcast — tapi tidak ada:
- `GET /api/notifications` yang return list promos
- Endpoint untuk hapus/edit promo yang sudah dikirim
- UI management khusus untuk promos

Ini acceptable kalau promos bersifat fire-and-forget, tapi perlu diputuskan apakah butuh CRUD management.

---

### ⚠️ Issue #6 — `admin_users` Hard Delete vs Soft Delete

`userStaffActions.ts`:
```ts
const targetRef = adminDb.collection(collection).doc(uid);
await targetRef.delete();  // ← HARD delete
```

Semua koleksi lain (`stores`, `products`, `rewards_catalog`) pakai soft-delete (`isActive: false` + timestamp). Tapi `admin_users` pakai hard delete. Ini **tidak konsisten** dan menghilangkan audit trail — kalau staff dihapus, tidak ada rekam jejak akun pernah ada.

**Fix:** Ganti ke soft-delete: `await targetRef.update({ isActive: false, deletedAt: new Date(), deletedBy: session.uid })`.

---

### ⚠️ Issue #7 — `AuthProvider.tsx` Legacy References

`src/components/AuthProvider.tsx` masih punya:
```ts
const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
const staffDoc = await getDoc(doc(db, "staff", firebaseUser.uid));
```

Collection `staff` **tidak ada di Firestore**. File ini tampaknya sudah tidak dipakai (digantikan `AuthContext.tsx`), tapi masih ada di codebase dan berisi referensi ke collection yang non-existent.

**Fix:** Verifikasi `AuthProvider.tsx` tidak di-import di mana pun, lalu hapus file.

---

### ⚠️ Issue #8 — Tier 2 Direct Reads Masih Aktif

Sesuai `ARCHITECTURE_POLICY.md` § 5, ini acceptable tapi noted:

| File | Collection | Pattern |
|------|-----------|---------|
| `StoresDesktop.tsx:413` | `stores` | `onSnapshot` |
| `StoresMobile.tsx:177` | `stores` | `onSnapshot` |
| `RewardsDesktop.tsx:438` | `rewards_catalog` | `onSnapshot` |
| `RewardsMobile.tsx:371` | `rewards_catalog` | `onSnapshot` |
| `MenusDesktop.tsx:668` | `products` | `onSnapshot` |
| `MenusMobile.tsx:360` | `products` | `onSnapshot` |
| `InjectVoucherModalForMember.tsx:37` | `rewards_catalog` | `getDocs` |

Semua ini adalah Tier 2 (display-only, no business logic) → **tidak memerlukan immediate action**, tapi target migrasi saat Phase D/E.

---

## 4. Overall Alignment Score

| Domain | Alignment | Status |
|--------|-----------|--------|
| Auth / Session | ✅ 100% | Via `/api/auth/session` only |
| Admin Users | ✅ 95% | Minor: hard delete, missing type fields |
| Members / Users | ✅ 95% | Minor: legacy points field, security pin fields |
| Transactions | ⚠️ 85% | Dashboard still has direct `onSnapshot` on `transactions` |
| Stores | ⚠️ 80% | Write via backend ✅; Read still direct Tier 2 |
| Menus / Products | ⚠️ 80% | Write via backend ✅; Read still direct Tier 2 |
| Rewards | ⚠️ 80% | Write via backend ✅; Read still direct Tier 2 |
| Settings | ✅ 100% | Fully via `/api/settings` |
| Dashboard | ⚠️ 75% | Stats via API ✅; real-time tx masih direct |
| Notifications | ✅ 90% | Root `notifications` collection orphaned |
| Activity Logs | ✅ 100% | Fully via API + `activityLog.ts` |
| Assets / Storage | ✅ 100% | Fully via `/api/assets` |

**Overall: ~88% aligned.** Stage 1 (Phase A–C) selesai dengan baik. Sisa gap ada di Dashboard (Tier 1 violation) dan beberapa type mismatches.

---

## 5. Action Items (Priority Order)

### 🔴 Critical (Tier 1 violation)
1. **Fix Dashboard direct reads** — hapus `onSnapshot(collection(db, "transactions"))` dari `DashboardDesktop.tsx` dan `DashboardMobile.tsx`; ganti dengan polling `/api/transactions` atau extend `/api/dashboard` response

### 🟠 High (Type safety / data integrity)
2. **Add `cashiers` field to `AdminUser` interface** atau konfirmasi tidak dipakai
3. **Add `isAvailable` to `Store` type**
4. **Change admin_users delete to soft-delete** di `userStaffActions.ts`
5. **Delete `AuthProvider.tsx`** setelah verifikasi tidak dipakai

### 🟡 Medium (Cleanup)
6. **Verify `notifications` root collection** — apakah masih dipakai oleh app lain; kalau tidak, hapus
7. **Add `visitedMemberIds` + `totalProductSold` to `DailyStat`** kalau dipakai di analytics
8. **Deprecate `users.points` legacy field** — sudah digantikan `currentPoints`
9. **Standardize `admin_users.createdAt/updatedAt` to Timestamp** (saat ini `string`)

### 🟢 Low (Phase D/E target)
10. Tier 2 direct reads → migrate ke backend saat Phase D/E
11. `global_promos` management UI kalau dibutuhkan
