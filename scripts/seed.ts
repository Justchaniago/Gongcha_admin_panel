import { adminDb } from "../src/lib/firebaseAdmin";
import { Store } from "../src/types/firestore";

// ─────────────────────────────────────────────────────────────────────────────
// MASTER SEEDER — jalankan semua seeder sekaligus
// Usage: npm run seed
//
// Urutan: stores → rewards_catalog → staff → users
// (stores harus duluan karena staff & transactions reference ke stores.id)
// ─────────────────────────────────────────────────────────────────────────────

async function runAll() {
  console.log("🚀 Gong Cha Admin — Master Seeder\n");
  console.log("=".repeat(50));

  // Dynamic import to run each seeder in sequence
  const seeders = [
    { name: "Stores", path: "./seedStores" },
    { name: "Rewards Catalog", path: "./seedRewards" },
    { name: "Staff", path: "./seedStaff" },
    { name: "Users", path: "./seedUsers" },
  ];

  for (const seeder of seeders) {
    console.log(`\n${"─".repeat(50)}`);
    console.log(`▶ Running: ${seeder.name}`);
    console.log("─".repeat(50));
    // Each seeder is self-contained and runs independently
    await import(seeder.path);
    // Small delay between batches
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log("\n" + "=".repeat(50));
  console.log("🎉 All seeders completed!");
  console.log("\n📋 Summary of Firestore paths seeded:");
  console.log("   stores/{storeId}                     → 5 stores");
  console.log("   rewards_catalog/{rewardId}            → 8 rewards");
  console.log("   staff/{UID}                           → 9 staff");
  console.log("   users/{UID}                           → 4 users");
  console.log("\n⚠️  Remember to replace REPLACE_WITH_AUTH_UID_* with real Firebase Auth UIDs!");
  process.exit(0);
}

runAll().catch((err) => {
  console.error("❌ Master seed failed:", err);
  process.exit(1);
});
