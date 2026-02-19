import { adminDb } from "../src/lib/firebaseAdmin";
import { Store } from "../src/types/firestore";

// ─────────────────────────────────────────────────────────────────────────────
// SEED DATA — stores/{storeId}
// Path: stores/store_tp6, stores/store_mbg, etc.
// ─────────────────────────────────────────────────────────────────────────────

const stores: Store[] = [
  {
    id: "store_tp6",
    name: "Gong Cha Tunjungan Plaza 6",
    address: "Tunjungan Plaza 6, Lantai 4, Jl. Basuki Rahmat No.8-12, Surabaya",
    latitude: -7.262512,
    longitude: 112.741618,
    openHours: "10:00 - 22:00",
    isActive: true,
    statusOverride: "open",
  },
  {
    id: "store_mbg",
    name: "Gong Cha Mall Bali Galeria, Kuta",
    address: "Jl. Bypass Ngurah Rai, Kec. Kuta, Kabupaten Badung, Bali",
    latitude: -8.722934939224709,
    longitude: 115.18326666263233,
    openHours: "10:00 - 21:45",
    isActive: true,
    statusOverride: "open",
  },
  {
    id: "store_pms",
    name: "Gong Cha Pakuwon Mall Surabaya",
    address: "Pakuwon Mall, Jl. Puncak Indah Lontar No.2, Surabaya",
    latitude: -7.278964,
    longitude: 112.660271,
    openHours: "10:00 - 22:00",
    isActive: true,
    statusOverride: "open",
  },
  {
    id: "store_gsc",
    name: "Gong Cha Grand City Surabaya",
    address: "Grand City Mall, Jl. Walikota Mustajab, Surabaya",
    latitude: -7.249123,
    longitude: 112.752488,
    openHours: "10:00 - 21:00",
    isActive: true,
    statusOverride: "almost_close",
  },
  {
    id: "store_csc",
    name: "Gong Cha Ciputra World Surabaya",
    address: "Ciputra World, Jl. Mayjend Sungkono No.89, Surabaya",
    latitude: -7.291023,
    longitude: 112.718933,
    openHours: "10:00 - 22:00",
    isActive: false,
    statusOverride: "closed",
  },
];

async function seedStores() {
  console.log("🏪 Seeding stores...\n");
  const batch = adminDb.batch();

  for (const store of stores) {
    // Path: stores/{storeId}
    const ref = adminDb.collection("stores").doc(store.id);
    batch.set(ref, store);
    console.log(`  ✅ stores/${store.id} → ${store.name}`);
  }

  await batch.commit();
  console.log(`\n✨ Done! ${stores.length} stores seeded.`);
}

seedStores().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
