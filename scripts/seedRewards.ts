import { adminDb } from "../src/lib/firebaseAdmin";
import { Reward } from "../src/types/firestore";

// ─────────────────────────────────────────────────────────────────────────────
// SEED DATA — rewards_catalog/{rewardId}
// Path: rewards_catalog/r1, rewards_catalog/r2, etc.
// ─────────────────────────────────────────────────────────────────────────────

const rewards: Array<{ id: string } & Reward> = [
  {
    id: "r1",
    title: "Free Brown Sugar Milk Tea",
    description: "Medium size. Signature bestseller dengan brown sugar fresh.",
    pointsCost: 1000,
    imageURL: "https://placehold.co/400x400/c8a96e/0a0a0f?text=BST",
    category: "Drink",
    type: "catalog",
    isActive: true,
  },
  {
    id: "r2",
    title: "Free Taro Milk Tea",
    description: "Medium size. Creamy taro with milk tea base.",
    pointsCost: 1000,
    imageURL: "https://placehold.co/400x400/c8a96e/0a0a0f?text=Taro",
    category: "Drink",
    type: "catalog",
    isActive: true,
  },
  {
    id: "r3",
    title: "Free Classic Milk Tea",
    description: "Medium size. The original Gong Cha classic.",
    pointsCost: 800,
    imageURL: "https://placehold.co/400x400/c8a96e/0a0a0f?text=CMT",
    category: "Drink",
    type: "catalog",
    isActive: true,
  },
  {
    id: "r4",
    title: "Diskon 20%",
    description: "Diskon 20% untuk pembelian apapun. Min. transaksi Rp 50.000.",
    pointsCost: 500,
    imageURL: "https://placehold.co/400x400/c8a96e/0a0a0f?text=20%25",
    category: "Discount",
    type: "catalog",
    isActive: true,
  },
  {
    id: "r5",
    title: "Diskon 50%",
    description: "Diskon 50% untuk 1 minuman. Min. transaksi Rp 100.000.",
    pointsCost: 1500,
    imageURL: "https://placehold.co/400x400/c8a96e/0a0a0f?text=50%25",
    category: "Discount",
    type: "catalog",
    isActive: true,
  },
  {
    id: "r6",
    title: "Extra Pearl Topping",
    description: "Tambahan topping pearl gratis untuk 1 minuman.",
    pointsCost: 200,
    imageURL: "https://placehold.co/400x400/c8a96e/0a0a0f?text=Pearl",
    category: "Topping",
    type: "catalog",
    isActive: true,
  },
  {
    id: "r7",
    title: "Extra Pudding Topping",
    description: "Tambahan topping pudding gratis untuk 1 minuman.",
    pointsCost: 200,
    imageURL: "https://placehold.co/400x400/c8a96e/0a0a0f?text=Pudding",
    category: "Topping",
    type: "catalog",
    isActive: true,
  },
  {
    id: "r8",
    title: "Birthday Free Drink",
    description: "1 minuman gratis ukuran Medium. Khusus bulan ulang tahun. Auto-granted.",
    pointsCost: 0,
    imageURL: "https://placehold.co/400x400/c8a96e/0a0a0f?text=🎂",
    category: "Drink",
    type: "catalog",
    isActive: true,
  },
];

async function seedRewards() {
  console.log("🎁 Seeding rewards_catalog...\n");
  const batch = adminDb.batch();

  for (const reward of rewards) {
    const { id, ...data } = reward;
    // Path: rewards_catalog/{rewardId}
    const ref = adminDb.collection("rewards_catalog").doc(id);
    batch.set(ref, data);
    console.log(`  ✅ rewards_catalog/${id} → ${reward.title} (${reward.pointsCost} pts)`);
  }

  await batch.commit();
  console.log(`\n✨ Done! ${rewards.length} rewards seeded.`);
}

seedRewards().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
