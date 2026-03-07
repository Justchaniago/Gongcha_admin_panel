# 🧋 Gong Cha Admin Panel - Enterprise Edition

Pusat kendali sistem loyalitas Gong Cha Indonesia. Re-architected sebagai platform enterprise dengan prinsip zero-trust, atomic transactions, dan cost-optimized Firestore integrations. Dibangun dengan Next.js 15 App Router + Tailwind CSS + Firebase.

---

## 🚀 Key Architectural Pillars

### 1. 🔒 Absolute Security (Zero-Trust UI & API)
* **Centralized RBAC:** Migrated from fragmented legacy roles to a single source of truth (`admin_users` collection).
* **Strict Role Gating:** Absolute division between `SUPER_ADMIN` and `STAFF`. UI components dynamically hide sensitive actions (Edit/Delete/Financials) from unauthorized users.
* **Database Lockdown:** Secured by default-deny `firestore.rules`. All database writes are enforced strictly through Server Actions (Admin SDK), neutralizing client-side manipulation.

### 2. 🛡️ Financial Integrity (EOD Audit System)
* **Atomic Transactions:** Powered by `adminDb.runTransaction` to prevent race conditions during End-of-Day (EOD) verifications.
* **Unified Status Schema:** Strict enforcement of canonical statuses (`NEEDS_REVIEW`, `COMPLETED`, `FRAUD`) across the entire ecosystem.
* **Immutable Audit Trail:** Automated server-side injection of `verifiedBy`, `verifiedAt`, and `lastToggledBy` for absolute accountability on every financial and operational state change.

### 3. ⚡ Maximum Stability (React Best Practices)
* **Anti-Memory Leak:** Comprehensive `unsubscribe` cleanup on all Firebase Realtime Listeners (`onSnapshot`) across all modules.
* **Self-Delete Protection:** Multi-layered defense (UI, State, and Server) preventing catastrophic admin lockout.

### 4. 💰 Cost-Efficient Scaling (Database Optimization)
* **Capped Reads:** Strict implementation of `.limit()` and `.orderBy()` on all dashboard and realtime queries to prevent massive billing spikes from full-table scans.
* **Transitional Grace:** Backward-compatible logic designed to safely bridge legacy data with the new unified architecture.

---

## 🚀 Setup & Instalasi

### 1. Install dependencies
```bash
npm install
```

### 2. Konfigurasi environment variables
```bash
cp .env.local.example .env.local
```
Isi nilai-nilai berikut di `.env.local`:
```env
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyCeSYZdPgERBcf0aKgd0F7wcATkfRt6_iY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=gongcha-app-4691f.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=gongcha-app-4691f
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=gongcha-app-4691f.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=808600152798
NEXT_PUBLIC_FIREBASE_APP_ID=1:808600152798:web:e3077ed59649703727b04f
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-QDQ205VH0G

FIREBASE_SERVICE_ACCOUNT_PATH=./serviceAccountKey.json
```

### 3. Download Service Account Key
1. Buka Firebase Console → Project Settings → Service Accounts
2. Klik **Generate new private key**
3. Save file JSON sebagai `serviceAccountKey.json` di root project
4. ⚠️ File ini sudah ada di `.gitignore` — jangan di-commit!

---

## 🌱 Seeder Scripts

Seeder menggunakan **Firebase Admin SDK** untuk menulis data langsung ke Firestore.

### Jalankan semua seeder sekaligus:
```bash
npm run seed
```

### Atau jalankan per collection:
```bash
npm run seed:stores    # → stores/{storeId}
npm run seed:rewards   # → rewards_catalog/{rewardId}
npm run seed:staff     # → staff/{UID}
npm run seed:users     # → users/{UID}
```

### ⚠️ PENTING: Ganti placeholder UID
File `scripts/seedStaff.ts` dan `scripts/seedUsers.ts` menggunakan placeholder ID:
```
REPLACE_WITH_AUTH_UID_MGR_TP6
REPLACE_WITH_AUTH_UID_USER_FERRY
```

Cara mendapatkan UID asli:
1. Buat akun di Firebase Auth Console (Email/Password)
2. Copy UID dari kolom "User UID"
3. Ganti placeholder di file seeder

---

## 📁 Firestore Schema

```
stores/{storeId}
  ├── id, name, address
  ├── latitude, longitude
  ├── openHours, isActive
  ├── statusOverride: "open" | "closed" | "almost_close"
  └── /transactions/{YYYYMMDD-POSID}  ← subcollection
        ├── transactionId, amount, potentialPoints
        ├── memberId, memberName, staffId
        ├── storeLocation, status
        └── createdAt, verifiedAt

users/{UID}
  ├── name, email, phoneNumber, photoURL
  ├── role: "master" | "trial" | "admin" | "member"
  ├── tier: "Silver" | "Gold" | "Platinum"
  ├── currentPoints, lifetimePoints, joinedDate
  ├── xpHistory[]  ← array (double-write dari transactions)
  └── vouchers[]   ← array

staff/{UID}
  ├── name, email
  ├── role: "cashier" | "store_manager" | "admin"
  ├── storeLocation → ref ke stores.id
  └── isActive

rewards_catalog/{rewardId}
  ├── title, description, pointsCost
  ├── imageURL, category: "Drink" | "Topping" | "Discount"
  └── isActive
```

---


## 🔒 Authentication & Security

- **Authentication**: Seluruh sistem menggunakan **Firebase Admin Session Cookies** — diverifikasi di setiap request server (API & Server Actions), role selalu diambil fresh dari Firestore.
- **Centralized RBAC**: Satu sumber kebenaran — koleksi `admin_users`. Role canonical: `SUPER_ADMIN` (akses penuh) dan `STAFF` (akses terbatas). Semua pengecekan dilakukan di server, bukan client.
- **Transaction Status Schema**: `NEEDS_REVIEW` | `COMPLETED` | `FRAUD` | `FLAGGED` | `REFUNDED` — enforced di seluruh API handlers dan UI.

## 🛠️ Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Database**: Firebase / Cloud Firestore (Admin SDK & Client SDK)
- **Styling**: Tailwind CSS + Lucide Icons
- **Language**: TypeScript
- **Auth**: Firebase Auth + Firebase Admin Session Cookies
- **Seeder**: Firebase Admin SDK + ts-node

---

## 📜 Maintenance Scripts

Located in `/scripts`:

| Script | Purpose | Command |
|--------|---------|---------|
| `unifyTransactionStatuses.js` | Migration script to canonize legacy transaction statuses | `node scripts/unifyTransactionStatuses.js --dry-run` |
| `archiveLegacyStaff.ts` | Safe batch-purging utility for legacy architecture deprecation | `npx ts-node scripts/archiveLegacyStaff.ts` |

> Always run with `--dry-run` first before executing live migration.

---

## 💻 Development

```bash
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000) — akan auto-redirect ke `/dashboard`.

---

## 📦 Deploy ke Vercel

```bash
npx vercel
```

Tambahkan semua `NEXT_PUBLIC_*` env vars di Vercel dashboard.
> `FIREBASE_SERVICE_ACCOUNT_PATH` hanya digunakan untuk seeder lokal, tidak perlu di-deploy.
