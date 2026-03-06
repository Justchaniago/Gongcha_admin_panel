import { adminDb } from "../src/lib/firebaseAdmin";
import { Staff } from "../src/types/firestore";

// ─────────────────────────────────────────────────────────────────────────────
// SEED DATA — staff/{UID}
// Path: staff/{staffUID}
//
// ⚠️  PENTING: Document ID harus pakai UID dari Firebase Auth.
//     Untuk seeder ini kita pakai placeholder ID yang bisa kamu ganti
//     dengan UID asli setelah buat akun di Firebase Auth Console.
//
//     Cara ganti:
//     1. Buat akun staff di Firebase Auth Console (Email/Password)
//     2. Copy UID-nya
//     3. Ganti nilai `id` di bawah dengan UID asli
// ─────────────────────────────────────────────────────────────────────────────

const staffMembers: Array<{ id: string } & Staff> = [
  // ── Store Managers ─────────────────────────────────────────────────────────
  {
    id: "REPLACE_WITH_AUTH_UID_MGR_TP6",   // ← ganti dengan UID Auth
    name: "Rina Kusumawati",
    email: "rina.mgr@gongcha.id",
    role: "store_manager",
    storeLocations: ["store_tp6"],            // ref ke stores/store_tp6
    isActive: true,
  },
  {
    id: "REPLACE_WITH_AUTH_UID_MGR_MBG",
    name: "Benny Santoso",
    email: "benny.mgr@gongcha.id",
    role: "store_manager",
    storeLocations: ["store_mbg"],
    isActive: true,
  },
  {
    id: "REPLACE_WITH_AUTH_UID_MGR_PMS",
    name: "Citra Dewi",
    email: "citra.mgr@gongcha.id",
    role: "store_manager",
    storeLocations: ["store_pms"],
    isActive: true,
  },

  // ── Kasir / Cashier ────────────────────────────────────────────────────────
  {
    id: "REPLACE_WITH_AUTH_UID_CSH_TP6_1",
    name: "Aldi Pratama",
    email: "aldi.kasir@gongcha.id",
    role: "cashier",
    storeLocations: ["store_tp6"],
    isActive: true,
  },
  {
    id: "REPLACE_WITH_AUTH_UID_CSH_TP6_2",
    name: "Siti Rahayu",
    email: "siti.kasir@gongcha.id",
    role: "cashier",
    storeLocations: ["store_tp6"],
    isActive: true,
  },
  {
    id: "REPLACE_WITH_AUTH_UID_CSH_MBG_1",
    name: "Made Surya",
    email: "made.kasir@gongcha.id",
    role: "cashier",
    storeLocations: ["store_mbg"],
    isActive: true,
  },
  {
    id: "REPLACE_WITH_AUTH_UID_CSH_PMS_1",
    name: "Dian Anggraeni",
    email: "dian.kasir@gongcha.id",
    role: "cashier",
    storeLocations: ["store_pms"],
    isActive: true,
  },
  {
    id: "REPLACE_WITH_AUTH_UID_CSH_GSC_1",
    name: "Reza Firmansyah",
    email: "reza.kasir@gongcha.id",
    role: "cashier",
    storeLocations: ["store_gsc"],
    isActive: false,  // outlet sedang tutup
  },

  // ── Admin ──────────────────────────────────────────────────────────────────
  {
    id: "REPLACE_WITH_AUTH_UID_ADMIN",
    name: "Ferry Rusly Chaniago",
    email: "ferry@gongcha.id",
    role: "admin",
    storeLocations: ["store_tp6"],           // home base admin
    isActive: true,
  },
];

async function seedStaff() {
  console.log("👥 Seeding staff...\n");
  const batch = adminDb.batch();

  for (const member of staffMembers) {
    const { id, ...data } = member;
    // Path: staff/{UID}
    const ref = adminDb.collection("staff").doc(id);
    batch.set(ref, data);
    const storeLabel = member.storeLocations?.join(", ") || "—";
    console.log(`  ✅ staff/${id} → ${member.name} (${member.role} @ ${storeLabel})`);
  }

  await batch.commit();
  console.log(`\n✨ Done! ${staffMembers.length} staff seeded.`);
  console.log(`\n⚠️  Jangan lupa ganti semua "REPLACE_WITH_AUTH_UID_*" dengan UID Firebase Auth yang asli!`);
}

seedStaff().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
