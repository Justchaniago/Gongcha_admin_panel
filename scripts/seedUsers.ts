import { adminDb, Timestamp } from "../src/lib/firebaseAdmin";
import { User } from "../src/types/firestore";

// ─────────────────────────────────────────────────────────────────────────────
// SEED DATA — users/{UID}
// Path: users/{userUID}
//
// ⚠️  Document ID harus pakai UID dari Firebase Auth (member app).
//     Ganti `id` dengan UID asli setelah user register via app.
//
//     xpHistory & vouchers disimpan sebagai ARRAY di dalam dokumen user
//     (bukan subcollection) — sesuai skema yang sudah didefinisikan.
// ─────────────────────────────────────────────────────────────────────────────

const users: Array<{ id: string } & User> = [
  // ── Platinum Member ────────────────────────────────────────────────────────
  {
    id: "REPLACE_WITH_AUTH_UID_USER_FERRY",
    name: "Ferry Rusly Chaniago",
    phoneNumber: "081234567890",
    email: "ferry@example.com",
    photoURL: "https://placehold.co/200x200/c8a96e/0a0a0f?text=F",
    role: "master",
    tier: "Platinum",
    currentPoints: 2500,
    lifetimePoints: 15500,
    joinedDate: "2025-01-24T10:00:00Z",
    xpHistory: [
      {
        id: "20260219-100866",
        date: "2026-02-19T05:30:00Z",
        amount: 960,
        type: "earn",
        status: "pending",
        context: "Pembelian di Gong Cha TP6",
        location: "store_tp6",           // matches stores.id
        transactionId: "100866",         // matches Transaction.transactionId
      },
      {
        id: "20260210-098712",
        date: "2026-02-10T14:20:00Z",
        amount: 1200,
        type: "earn",
        status: "verified",
        context: "Pembelian di Gong Cha TP6",
        location: "store_tp6",
        transactionId: "098712",
      },
      {
        id: "20260201-redeem-r4",
        date: "2026-02-01T11:00:00Z",
        amount: 500,
        type: "redeem",
        status: "verified",
        context: "Redeem Diskon 20%",
        location: "store_tp6",
        transactionId: "",
      },
    ],
    vouchers: [
      {
        id: "v_1740000001",
        rewardId: "r1",                  // ref ke rewards_catalog/r1
        title: "Free Brown Sugar Milk Tea",
        code: "GC-FERRY01",
        isUsed: false,
        expiresAt: "2026-03-19T10:00:00Z",
      },
    ],
  },

  // ── Gold Member ────────────────────────────────────────────────────────────
  {
    id: "REPLACE_WITH_AUTH_UID_USER_SINTA",
    name: "Sinta Maharani",
    phoneNumber: "082298765432",
    email: "sinta.m@email.com",
    photoURL: "https://placehold.co/200x200/c8a96e/0a0a0f?text=S",
    role: "member",
    tier: "Gold",
    currentPoints: 8920,
    lifetimePoints: 10500,
    joinedDate: "2025-03-15T08:00:00Z",
    xpHistory: [
      {
        id: "20260218-099123",
        date: "2026-02-18T16:45:00Z",
        amount: 1100,
        type: "earn",
        status: "verified",
        context: "Pembelian di Gong Cha Pakuwon",
        location: "store_pms",
        transactionId: "099123",
      },
      {
        id: "20260215-097800",
        date: "2026-02-15T12:30:00Z",
        amount: 800,
        type: "earn",
        status: "verified",
        context: "Pembelian di Gong Cha Pakuwon",
        location: "store_pms",
        transactionId: "097800",
      },
    ],
    vouchers: [
      {
        id: "v_1740000002",
        rewardId: "r4",
        title: "Diskon 20%",
        code: "GC-SINTA01",
        isUsed: true,
        expiresAt: "2026-02-28T23:59:00Z",
      },
    ],
  },

  // ── Silver Member ──────────────────────────────────────────────────────────
  {
    id: "REPLACE_WITH_AUTH_UID_USER_BUDI",
    name: "Budi Kusuma",
    phoneNumber: "085611223344",
    email: "budi.k@yahoo.com",
    photoURL: "https://placehold.co/200x200/94a3b8/0a0a0f?text=B",
    role: "member",
    tier: "Silver",
    currentPoints: 3210,
    lifetimePoints: 4800,
    joinedDate: "2025-06-20T09:00:00Z",
    xpHistory: [
      {
        id: "20260217-100500",
        date: "2026-02-17T10:00:00Z",
        amount: 650,
        type: "earn",
        status: "pending",
        context: "Pembelian di Gong Cha Bali Galeria",
        location: "store_mbg",
        transactionId: "100500",
      },
    ],
    vouchers: [],
  },

  // ── Silver Member (baru) ───────────────────────────────────────────────────
  {
    id: "REPLACE_WITH_AUTH_UID_USER_DEWI",
    name: "Dewi Rahayu",
    phoneNumber: "089977665544",
    email: "dewi.r@gmail.com",
    photoURL: "https://placehold.co/200x200/94a3b8/0a0a0f?text=D",
    role: "member",
    tier: "Silver",
    currentPoints: 1850,
    lifetimePoints: 2300,
    joinedDate: "2025-09-10T14:00:00Z",
    xpHistory: [
      {
        id: "20260214-100123",
        date: "2026-02-14T13:20:00Z",
        amount: 950,
        type: "earn",
        status: "verified",
        context: "Pembelian di Gong Cha Grand City",
        location: "store_gsc",
        transactionId: "100123",
      },
    ],
    vouchers: [],
  },
];

async function seedUsers() {
  console.log("👤 Seeding users...\n");
  const batch = adminDb.batch();

  for (const user of users) {
    const { id, ...data } = user;
    // Path: users/{UID}
    const ref = adminDb.collection("users").doc(id);
    batch.set(ref, data);
    console.log(`  ✅ users/${id} → ${user.name} (${user.tier}, ${user.currentPoints} pts)`);
  }

  await batch.commit();
  console.log(`\n✨ Done! ${users.length} users seeded.`);
  console.log(`\n⚠️  Jangan lupa ganti semua "REPLACE_WITH_AUTH_UID_*" dengan UID Firebase Auth yang asli!`);
}

seedUsers().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
