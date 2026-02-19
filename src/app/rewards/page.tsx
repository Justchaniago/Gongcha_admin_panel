import { adminDb } from "@/lib/firebaseServer";
import { Reward } from "@/types/firestore";

async function getRewards(): Promise<Array<{ id: string } & Reward>> {
  const snap = await adminDb.collection("rewards_catalog").get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as { id: string } & Reward));
}

const CAT: Record<string, { bg: string; color: string; emoji: string }> = {
  Drink:    { bg: "#DBEAFE", color: "#2563EB", emoji: "🧋" },
  Topping:  { bg: "#EDE9FE", color: "#6D28D9", emoji: "🧁" },
  Discount: { bg: "#D1FAE5", color: "#059669", emoji: "🎟️" },
};

export default async function RewardsPage() {
  let rewards: Array<{ id: string } & Reward> = [];
  try { rewards = await getRewards(); } catch { /* not configured */ }

  const active   = rewards.filter(r => r.isActive).length;
  const inactive = rewards.filter(r => !r.isActive).length;

  return (
    <div className="p-8 max-w-[1400px]">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-2xl font-bold text-tx1">Rewards Catalog</h1>
          <p className="text-sm text-tx2 mt-1">Kelola voucher dan biaya poin yang bisa di-redeem member.</p>
        </div>
        <button className="px-4 py-2.5 rounded-xl text-white text-sm font-semibold shadow-card-blue" style={{ background: "linear-gradient(135deg,#4361EE,#3A0CA3)" }}>
          + Tambah Voucher
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Reward",  value: rewards.length },
          { label: "Aktif",         value: active,   color: "#059669" },
          { label: "Nonaktif",      value: inactive,  color: "#DC2626" },
          { label: "Drink",         value: rewards.filter(r => r.category === "Drink").length, color: "#2563EB" },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-2xl border border-border shadow-card p-5">
            <p className="text-xs text-tx2 mb-1">{c.label}</p>
            <p className="font-display text-3xl font-bold" style={{ color: c.color ?? "#4361EE" }}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Grid */}
      {rewards.length === 0 ? (
        <div className="bg-white rounded-2xl border border-border shadow-card py-20 text-center">
          <p className="text-tx2 text-base font-medium">Belum ada rewards.</p>
          <p className="text-xs text-tx3 mt-1">Jalankan <code>npm run seed:rewards</code> untuk mengisi katalog.</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {rewards.map((r) => {
            const cat = CAT[r.category] ?? CAT.Drink;
            return (
              <div key={r.id} className="bg-white rounded-2xl border border-border shadow-card p-5 hover:shadow-card-md transition-all group">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl" style={{ background: cat.bg }}>
                    {cat.emoji}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: r.isActive ? "#D1FAE5" : "#F1F5F9", color: r.isActive ? "#059669" : "#94A3B8" }}>
                      {r.isActive ? "Aktif" : "Nonaktif"}
                    </span>
                    <code className="text-[10px] text-tx3">{r.id}</code>
                  </div>
                </div>
                <p className="font-display font-bold text-tx1 text-sm mb-1">{r.title}</p>
                <p className="text-xs text-tx2 mb-4">{r.description}</p>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-tx3">Biaya Poin</p>
                    <p className="font-display font-bold text-blue1 text-lg">
                      {r.pointsCost === 0 ? "Gratis" : `${r.pointsCost.toLocaleString("id")} pts`}
                    </p>
                  </div>
                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ background: cat.bg, color: cat.color }}>{r.category}</span>
                </div>
                <div className="flex gap-2 mt-4 pt-4" style={{ borderTop: "1px solid #F1F5F9" }}>
                  <button className="flex-1 py-2 border border-border rounded-xl text-xs text-tx2 hover:border-blue1 hover:text-blue1 transition-all">Edit</button>
                  <button className={`px-3 py-2 rounded-xl text-xs transition-all ${r.isActive ? "text-red-500 border border-red-200 hover:bg-red-50" : "text-success border border-green-200 hover:bg-green-50"}`}>
                    {r.isActive ? "Nonaktif" : "Aktifkan"}
                  </button>
                </div>
              </div>
            );
          })}

          {/* Add card */}
          <div className="border-2 border-dashed border-border rounded-2xl flex flex-col items-center justify-center min-h-[200px] cursor-pointer hover:border-blue1 hover:bg-blueLight transition-all group">
            <div className="w-10 h-10 rounded-xl bg-blueLight flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#4361EE" strokeWidth={2}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </div>
            <p className="text-sm font-medium text-tx3">Tambah Voucher</p>
          </div>
        </div>
      )}
    </div>
  );
}
