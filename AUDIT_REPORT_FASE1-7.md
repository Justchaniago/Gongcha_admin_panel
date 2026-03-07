# 🔍 Audit Report: Gong Cha Admin Panel — Fase 1–7
**Tanggal Audit:** 7 Maret 2026
**Auditor:** GitHub Copilot (Internal Review)
**Branch:** feature/gemini-summary-export

---

## Tabel Ringkasan Status per Modul

| Modul | Pilar Keamanan | Pilar Integritas | Pilar Stabilitas | Pilar Efisiensi | Status |
|-------|---------------|-----------------|-----------------|----------------|--------|
| **Auth / Session** | ✅ | N/A | ✅ | N/A | ✅ MATCH |
| **Transactions** | ⚠️ GAP | ⚠️ GAP | ✅ | ⚠️ GAP | ⚠️ PARTIAL |
| **Stores** | ⚠️ GAP | ✅ | ✅ | ✅ | ⚠️ PARTIAL |
| **Staff / Users** | ✅ | ✅ | ✅ | ✅ | ✅ MATCH |
| **Menus** | ✅ | ⚠️ GAP | ✅ | ✅ | ⚠️ PARTIAL |
| **Rewards** | ⚠️ GAP | ✅ | ✅ | ✅ | ⚠️ PARTIAL |
| **Dashboard** | ✅ | N/A | ⚠️ GAP | ⚠️ GAP | ⚠️ PARTIAL |
| **Notifications** | ⚠️ GAP | ✅ | N/A | ⚠️ GAP | ⚠️ PARTIAL |
| **Settings** | ⚠️ GAP | N/A | N/A | N/A | ⚠️ PARTIAL |
| **Firestore Rules** | ✅ | ✅ | N/A | N/A | ✅ MATCH |

---

## 📋 Analisis Gap Detail

### Pilar 1 — Keamanan (Auth & RBAC)

---

#### 🔴 GAP #1 — Legacy Collection Reads Masih Ada di API Routes

File `src/app/api/stores/route.ts`, `src/app/api/notifications/route.ts`,
`src/app/api/settings/route.ts`, dan `src/app/api/rewards/route.ts`
masih menggunakan fungsi `validateSession` lama yang membaca koleksi `users` dan `staff`:

```typescript
// ❌ LEGACY — harus dihapus dari semua 4 file di atas
const userDoc  = await adminDb.collection("users").doc(uid).get();
const staffDoc = await adminDb.collection("staff").doc(uid).get();
```

**Fix yang diperlukan** — standardisasi semua `validateSession` ke pola canonical:

```typescript
// ✅ CORRECT — gunakan admin_users saja
const adminDoc = await adminDb.collection("admin_users").doc(uid).get();
if (!adminDoc.exists) return { error: "Access denied.", status: 403 };
const role: string = adminDoc.data()?.role ?? "";
```

**File yang terdampak:**
- `src/app/api/stores/route.ts`
- `src/app/api/notifications/route.ts`
- `src/app/api/settings/route.ts`
- `src/app/api/rewards/route.ts`

---

#### 🔴 GAP #2 — `AuthProvider` Client-Side Masih Membaca Koleksi `staff`

File `src/components/AuthProvider.tsx` melakukan client-side Firestore read ke koleksi legacy:

```typescript
// ❌ LEGACY reads di client-side
const userDoc  = await getDoc(doc(db, "users", firebaseUser.uid));
const staffDoc = await getDoc(doc(db, "staff", firebaseUser.uid));
```

Ini berbahaya karena koleksi `staff` sudah diarsip (Fase 7) dan Firestore Rules sudah menutupnya dengan `allow read, write: if false`. Artinya setelah arsip dijalankan, `AuthProvider` akan **selalu gagal memuat role** untuk user yang login.

**Fix yang diperlukan:**

```typescript
// ✅ CORRECT — baca hanya dari admin_users (client SDK)
const adminDoc = await getDoc(doc(db, "admin_users", firebaseUser.uid));
if (adminDoc.exists()) {
  setRole(adminDoc.data()?.role ?? null);
}
```

---

#### 🟡 GAP #3 — Role Check Terlalu Ketat di `/api/transactions/verify`

File `src/app/api/transactions/verify/route.ts` saat ini hanya mengizinkan `SUPER_ADMIN` untuk mem-verifikasi transaksi:

```typescript
if (!adminDoc.exists || adminDoc.data()?.role !== "SUPER_ADMIN") {
  return NextResponse.json({ message: "Forbidden" }, { status: 403 });
}
```

Ini **konsisten** dengan UI (TransactionsClient hanya menampilkan tombol verify ke SUPER_ADMIN), namun perlu konfirmasi Product Owner apakah STAFF level tertentu juga boleh verify. Jika ya, ubah ke:

```typescript
const allowedRoles = ["SUPER_ADMIN", "STAFF"];
if (!allowedRoles.includes(adminDoc.data()?.role)) { ... }
```

---

### Pilar 2 — Integritas (Anti-Fraud & Audit Trail)

---

#### 🔴 GAP #4 — Status Transaksi Tidak Konsisten (Dual Schema)

Ini adalah **bug paling kritis** yang ditemukan dalam audit ini.

`src/app/api/transactions/verify/route.ts` menyimpan:
```typescript
// ❌ Schema A — uppercase
const newStatus = action === "approve" ? "COMPLETED" : "FRAUD";
```

Sementara `src/app/api/transactions/route.ts` (GET handler) dan data Firestore yang ada menggunakan:
```typescript
// ❌ Schema B — lowercase
status: "verified" | "rejected" | "pending"
```

`TransactionsClient.tsx` memfilter dengan:
```typescript
// ❌ Mengikuti Schema A
filterStatus === "NEEDS_REVIEW" | "COMPLETED" | "FRAUD"
```

**Dampak:** Filter di UI tidak akan menemukan transaksi dengan status `"verified"` lama, dan sebaliknya. Data baru akan memiliki status berbeda dari data lama → **inkonsistensi permanen di database.**

**Fix yang diperlukan:** Pilih SATU schema dan standardisasi:
- Opsi A (recommended): `"pending"` → `"verified"` → `"rejected"` (lowercase, sesuai data existing)
- Opsi B: `"PENDING"` → `"COMPLETED"` → `"FRAUD"` (uppercase, lebih ekspresif)

Kemudian jalankan migration script untuk update semua dokumen lama ke schema yang dipilih.

---

#### 🟡 GAP #5 — Verifikasi Audit Trail di `updateMenu`

`src/actions/menuActions.ts` sudah memiliki logika untuk `isStatusOnlyUpdate`, namun perlu diverifikasi bahwa `lastToggledBy` dan `lastToggledAt` benar-benar tersimpan ke Firestore pada setiap toggle `isAvailable`:

```typescript
// ✅ Ada di kode — pastikan ini dieksekusi sebelum adminDb.update()
if (isStatusOnlyUpdate) {
  update.lastToggledBy = uid;
  update.lastToggledAt = FieldValue.serverTimestamp();
}
```

Jika sudah ada → **MATCH**. Yang perlu dipastikan adalah tidak ada `early return` sebelum field ini ditambahkan.

---

### Pilar 3 — Stabilitas (Performance & UX)

---

#### 🟡 GAP #6 — DashboardClient: Multiple `useEffect` Cleanup Perlu Diverifikasi

`src/app/dashboard/DashboardClient.tsx` memiliki beberapa listener `onSnapshot`. Pola yang sudah benar:

```typescript
// ✅ Pola yang benar
useEffect(() => {
  const unsubTx = onSnapshot(txQ, ...);
  return () => unsubTx();
}, []);
```

Yang perlu diperiksa manual: jika ada `useEffect` yang me-register **lebih dari satu** listener, pastikan semua di-cleanup:

```typescript
// ✅ Multi-listener cleanup yang benar
return () => {
  unsubTx();
  unsubMembers();
};
```

Jika ada `useEffect` yang hanya me-return cleanup untuk satu dari dua listener → **memory leak**.

---

#### ✅ MATCH — `MembersClient` / `users-staff` Cleanup

`src/app/users-staff/MembersClient.tsx` sudah benar:

```typescript
return () => { unsubUsers(); unsubStaff(); }; // ✅ Semua listener di-cleanup
```

---

### Pilar 4 — Efisiensi (Firestore Cost Management)

---

#### 🔴 GAP #7 — `dashboardQueries.ts`: `recentSnap` Query Tanpa `.limit()`

`src/lib/dashboardQueries.ts` memiliki query yang berpotensi membaca **seluruh koleksi** tanpa batas:

```typescript
// ❌ TIDAK ADA .limit() — bisa baca ribuan dokumen
const recentSnap = await adminDb.collectionGroup("transactions").get();
```

Sementara query pertama di file yang sama sudah benar:

```typescript
// ✅ Ada limit
const snap = await adminDb.collectionGroup("transactions").limit(500).get();
```

**Fix:**
```typescript
// ✅
const recentSnap = await adminDb
  .collectionGroup("transactions")
  .orderBy("createdAt", "desc")
  .limit(50)
  .get();
```

---

#### 🟡 GAP #8 — `TransactionsClient`: Field `timestamp` vs `createdAt`

`src/app/transactions/TransactionsClient.tsx` menggunakan `orderBy("timestamp")`:

```typescript
// ⚠️ Field name mismatch — Firestore menyimpan sebagai "createdAt"
const q = query(
  collection(db, "transactions"),
  orderBy("timestamp", "desc"),
  limit(100)
);
```

Sedangkan Firestore index di `firestore.indexes.json` dan API routes menggunakan `createdAt`. Jika field `timestamp` tidak ada di dokumen, query ini akan **selalu return 0 hasil**.

**Fix:**
```typescript
orderBy("createdAt", "desc"),
```

---

#### 🟡 GAP #9 — `NotificationsClient`: Query Fetch Tanpa Pagination

`src/app/notifications/NotificationsClient.tsx` memanggil ulang data via `fetch()` setelah send, namun endpoint `/api/notifications` (GET) tidak memiliki pagination — mengembalikan semua log sekaligus. Untuk volume tinggi ini akan menjadi masalah.

**Fix yang disarankan:** Tambahkan `?limit=50` di query parameter GET `/api/notifications`.

---

## 🧾 Daftar File dengan `.limit()` yang Sudah Diterapkan

| File | Query | limit() | orderBy() |
|------|-------|---------|-----------|
| `DashboardClient.tsx` | members | ✅ limit(500) | ❌ |
| `DashboardClient.tsx` | stores | ✅ limit(100) | ❌ |
| `DashboardClient.tsx` | pending tx | ✅ limit(500) | ✅ |
| `DashboardClient.tsx` | rejected tx | ✅ limit(500) | ✅ |
| `DashboardClient.tsx` | recent tx | ✅ limit(50) | ✅ |
| `dashboardQueries.ts` | stats snap | ✅ limit(500) | ❌ |
| `dashboardQueries.ts` | recentSnap | ❌ **MISSING** | ❌ |
| `TransactionsClient.tsx` | transactions | ✅ limit(100) | ⚠️ wrong field |
| `NotificationsClient.tsx` | via fetch() | ❌ no pagination | N/A |

---

## 🏁 Final Verdict

```
╔══════════════════════════════════════════════════════════════╗
║           VERDICT: ⚠️  NOT YET PRODUCTION-READY              ║
║                  Enterprise-Grade: PENDING                    ║
╚══════════════════════════════════════════════════════════════╝
```

### Prioritas Fix Sebelum Go-Live

| # | File | Issue | Severity |
|---|------|-------|----------|
| 1 | `src/components/AuthProvider.tsx` | Baca `staff` + `users` legacy → akan crash setelah arsip | 🔴 CRITICAL |
| 2 | 4 API routes (`stores`, `notifications`, `settings`, `rewards`) | `validateSession` masih baca `users`+`staff` | 🔴 CRITICAL |
| 3 | `src/app/api/transactions/verify/route.ts` + `TransactionsClient.tsx` | Dual status schema (`verified` vs `COMPLETED`) | 🔴 CRITICAL |
| 4 | `src/lib/dashboardQueries.ts` | `recentSnap` tanpa `.limit()` | 🟠 HIGH |
| 5 | `src/app/transactions/TransactionsClient.tsx` | `orderBy("timestamp")` → seharusnya `createdAt` | 🟠 HIGH |
| 6 | `src/app/notifications/NotificationsClient.tsx` | GET endpoint tanpa pagination | 🟡 MEDIUM |

### Yang Sudah Benar ✅

- Firestore Security Rules: Default DENY, `admin_users` schema, public read untuk `products`/`stores`
- `menuActions.ts`: Auth, RBAC, STAFF field restriction, audit trail
- `rewards/[id]/route.ts`: Auth via `admin_users`, STAFF restriction, audit trail
- `DashboardClient.tsx`: `isSuperAdmin`, query limits, Revenue card gated
- `NotificationsClient.tsx`: Send tab gated untuk STAFF
- `userStaffActions.ts`: Self-delete protection, RBAC
- `MembersClient.tsx`: Multi-listener cleanup benar
- `archiveLegacyStaff.ts`: Safe purge dengan batch 450 docs

---

*Laporan ini dibuat berdasarkan code review statis. Beberapa GAP (terutama #3 dan #6) perlu runtime testing untuk konfirmasi final.*
