# 🧋 Gong Cha Admin Panel

Pusat kendali sistem loyalitas Gong Cha Indonesia. Dibangun dengan Next.js 14 App Router + Tailwind CSS + Firebase.

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

- **Authentication**: Seluruh sistem kini menggunakan **Firebase Admin Session Cookies** untuk autentikasi dan otorisasi. Session cookie disimpan secara aman di browser, diverifikasi di setiap request server (API & Server Actions), dan role user selalu diambil fresh dari Firestore (users/staff) untuk memastikan RBAC (Role-Based Access Control) yang kuat dan up-to-date.
- **RBAC**: Hanya user dengan role `admin` atau `master` yang dapat mengakses fitur administrasi sensitif (CRUD Stores, Users, Rewards, Settings, dll). Semua pengecekan role dilakukan di server, bukan di client.

## 🛠 Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS
- **Database**: Firebase Firestore
- **Auth**: Firebase Auth + Firebase Admin Session Cookies
- **Seeder**: Firebase Admin SDK + ts-node

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
