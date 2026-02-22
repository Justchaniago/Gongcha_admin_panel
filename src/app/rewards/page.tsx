// src/app/dashboard/rewards/page.tsx
import { adminDb } from "@/lib/firebaseServer";
import { Reward } from "@/types/firestore";
import RewardsClient from "./RewardsClient";

async function getRewards(): Promise<Array<{ id: string } & Reward>> {
  const snap = await adminDb.collection("rewards_catalog").get();
  return snap.docs.map(d => {
    const data = d.data();
    return {
      id: d.id,
      title: data.title,
      description: data.description,
      pointsCost: data.pointsCost,
      imageURL: data.imageURL,
      category: data.category,
      isActive: data.isActive,
      updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : undefined,
      createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : undefined,
    };
  });
}

export default async function RewardsPage() {

  let rewards: Array<{ id: string } & Reward> = [];
  try { rewards = await getRewards(); } catch { /* Firebase not configured */ }
  // Filter hanya voucher katalog
  rewards = rewards.filter(r => r.type === 'catalog');
  const active   = rewards.filter(r => r.isActive).length;
  const inactive = rewards.filter(r => !r.isActive).length;

  return (
    <div style={{
      padding: '28px 32px',
      maxWidth: 1400,
      fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
      WebkitFontSmoothing: 'antialiased',
    }}>

      {/* ── PAGE HEADER ── */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: '#9299B0', marginBottom: 5 }}>
            Gong Cha Admin
          </p>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-.025em', color: '#0F1117', lineHeight: 1.1, margin: 0 }}>
            Rewards Catalog
          </h1>
          <p style={{ fontSize: 14, color: '#4A5065', marginTop: 5 }}>
            Kelola voucher dan biaya poin yang bisa di-redeem member.
          </p>
        </div>
        {/* Add button with live badge — rendered client-side */}
        <RewardsClient initialRewards={rewards} showAddTrigger />
      </div>

      {/* ── CONTENT (full client) ── */}
      <RewardsClient initialRewards={rewards} />
    </div>
  );
}