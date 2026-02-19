import { adminDb } from "@/lib/firebaseServer";
import { Store } from "@/types/firestore";

async function getStores(): Promise<Store[]> {
  const snap = await adminDb.collection("stores").get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Store));
}

const STATUS_MAP = {
  open:         { label: "Aktif",      bg: "#D1FAE5", color: "#059669" },
  almost_close: { label: "Mau Tutup", bg: "#FEF3C7", color: "#D97706" },
  closed:       { label: "Tutup",     bg: "#FEE2E2", color: "#DC2626" },
};

export default async function StoresPage() {
  let stores: Store[] = [];
  try { stores = await getStores(); } catch { /* Firebase not configured */ }

  const active   = stores.filter(s => s.isActive).length;
  const inactive = stores.length - active;

  return (
    <div className="p-8 max-w-[1400px]">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-2xl font-bold text-tx1">Store Management</h1>
          <p className="text-sm text-tx2 mt-1">Kelola outlet, koordinat, jam operasional, dan status.</p>
        </div>
        <button className="px-4 py-2.5 rounded-xl text-white text-sm font-semibold shadow-card-blue transition-all hover:opacity-90" style={{ background: "linear-gradient(135deg,#4361EE,#3A0CA3)" }}>
          + Tambah Outlet
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Total Outlet", value: stores.length, color: "#4361EE", bg: "#EEF2FF" },
          { label: "Aktif",        value: active,        color: "#059669", bg: "#D1FAE5" },
          { label: "Tidak Aktif",  value: inactive,      color: "#DC2626", bg: "#FEE2E2" },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-2xl border border-border shadow-card p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: c.bg }}>
              <span className="font-display font-bold text-xl" style={{ color: c.color }}>{c.value}</span>
            </div>
            <div>
              <p className="text-xs text-tx2">{c.label}</p>
              <p className="font-display font-bold text-tx1 text-lg">{c.value} outlet</p>
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-border shadow-card overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid #F1F5F9" }}>
          <h2 className="font-display font-bold text-tx1">Daftar Outlet {stores.length > 0 && `(${stores.length})`}</h2>
          <div className="flex items-center gap-2 bg-s2 border border-border rounded-xl px-3 py-2 w-52">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#94A3B8" strokeWidth={2}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input className="flex-1 text-sm outline-none text-tx2 bg-transparent placeholder:text-tx3" placeholder="Cari outlet..." />
          </div>
        </div>

        {stores.length === 0 ? (
          <div className="py-20 text-center text-tx3">
            <p className="text-base font-medium">Belum ada outlet.</p>
            <p className="text-sm mt-1">Tambah outlet pertama atau jalankan seeder.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead style={{ background: "#F8FAFF" }}>
              <tr>
                {["Outlet", "Alamat", "Jam Buka", "Koordinat", "Status", "Aksi"].map(h => (
                  <th key={h} className="text-left text-[11px] font-semibold text-tx3 uppercase tracking-wide px-6 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stores.map((s) => {
                const sm = STATUS_MAP[s.statusOverride as keyof typeof STATUS_MAP] ?? STATUS_MAP.open;
                return (
                  <tr key={s.id} className="hover:bg-s2 transition-colors" style={{ borderTop: "1px solid #F1F5F9" }}>
                    <td className="px-6 py-4">
                      <p className="text-sm font-semibold text-tx1">{s.name}</p>
                      <code className="text-[10px] text-blue1">{s.id}</code>
                    </td>
                    <td className="px-6 py-4 text-xs text-tx2 max-w-[180px]">{s.address}</td>
                    <td className="px-6 py-4 text-sm text-tx1">{s.openHours}</td>
                    <td className="px-6 py-4">
                      <span className="text-[10px] font-mono bg-blueLight text-blue1 px-2 py-1 rounded-lg">
                        {s.latitude.toFixed(4)}, {s.longitude.toFixed(4)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ background: sm.bg, color: sm.color }}>{sm.label}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button className="text-xs px-3 py-1.5 border border-border rounded-lg text-tx2 hover:border-blue1 hover:text-blue1 transition-all">Edit</button>
                        <button className={`text-xs px-3 py-1.5 rounded-lg transition-all ${s.isActive ? "text-red-500 border border-red-200 hover:bg-red-50" : "text-success border border-green-200 hover:bg-green-50"}`}>
                          {s.isActive ? "Tutup" : "Buka"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
