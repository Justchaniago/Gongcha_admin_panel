import { getDashboardData } from "@/lib/dashboardQueries";

function formatRp(n: number) {
  if (n >= 1_000_000_000) return `Rp ${(n/1e9).toFixed(1)} M`;
  if (n >= 1_000_000)     return `Rp ${(n/1e6).toFixed(1)} Jt`;
  if (n >= 1_000)         return `Rp ${(n/1e3).toFixed(0)}rb`;
  return `Rp ${n}`;
}
function formatRpFull(n: number) {
  return "Rp " + n.toLocaleString("id-ID");
}

const STATUS: Record<string, { bg: string; color: string; label: string }> = {
  pending:  { bg: "#FEF3C7", color: "#D97706", label: "Pending" },
  verified: { bg: "#D1FAE5", color: "#059669", label: "Verified" },
  rejected: { bg: "#FEE2E2", color: "#DC2626", label: "Rejected" },
};

// Simple inline bar chart using divs (no external lib needed)
function MiniBarChart({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="flex items-end gap-[5px] h-24 w-full mt-2">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div className="w-full rounded-t-[4px] transition-all"
               style={{ height: `${Math.max(8, (d.value / max) * 80)}px`, background: i === data.length - 1 ? "#4361EE" : "#C7D2FE" }} />
          <span className="text-[9px] text-tx3 whitespace-nowrap overflow-hidden" style={{ maxWidth: "100%" }}>{d.label}</span>
        </div>
      ))}
    </div>
  );
}

export default async function DashboardPage() {
  let data;
  try {
    data = await getDashboardData();
  } catch (e) {
    console.error("DASHBOARD ERROR:", e); // ← tambah ini
    return (
      <div className="p-8 text-center text-tx2">
        <p className="text-lg font-semibold">Firebase belum dikonfigurasi.</p>
        <p className="text-sm mt-1">Tambahkan <code>serviceAccountKey.json</code> dan isi <code>.env.local</code> untuk memulai.</p>
        <pre className="text-xs text-red-500 mt-4 text-left">{String(e)}</pre>  {/* ← dan ini */}
      </div>
    );
  }

  const inactive = data.totalStores - data.activeStores;
  const topMax = data.topStores[0]?.totalRevenue ?? 1;

  // Prepare bar chart data from topStores
  const chartData = data.topStores.slice(0, 6).map(s => ({
    label: s.storeName.split(" ").slice(-1)[0], // last word of name
    value: s.totalRevenue,
  }));

  const today = new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="p-8 max-w-[1400px]">

      {/* Top bar */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-2xl font-bold text-tx1">Selamat datang, Ferry! 👋</h1>
          <p className="text-sm text-tx2 mt-1">{today}</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="flex items-center gap-2 bg-white border border-border rounded-xl px-3 py-2 shadow-card w-52">
            <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="#94A3B8" strokeWidth={2}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input className="flex-1 text-sm outline-none text-tx2 bg-transparent placeholder:text-tx3" placeholder="Cari..." />
          </div>
          {/* Bell */}
          <button className="relative w-10 h-10 bg-white rounded-xl border border-border flex items-center justify-center shadow-card hover:bg-blueLight transition-colors">
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#64748B" strokeWidth={1.8}><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/></svg>
            {data.pendingCount > 0 && <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full" />}
          </button>
        </div>
      </div>

      {/* Pending alert — hanya muncul jika ada */}
      {data.pendingCount > 0 && (
        <div className="mb-6 flex items-center gap-4 px-5 py-4 rounded-2xl border border-orange-200 bg-orange-50">
          <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#D97706" strokeWidth={2}><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-orange-800">{data.pendingCount} transaksi menunggu verifikasi</p>
            <p className="text-xs text-orange-600 mt-0.5">{data.pendingPointsHeld.toLocaleString("id")} poin member tertahan — upload CSV POS untuk mencairkan.</p>
          </div>
          <a href="/transactions" className="text-xs font-semibold px-4 py-2 rounded-xl text-white transition-all" style={{ background: "#D97706" }}>
            Upload CSV →
          </a>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {/* Revenue - blue gradient card */}
        <div className="rounded-2xl p-5 text-white relative overflow-hidden shadow-card-blue col-span-1"
             style={{ background: "linear-gradient(135deg,#4361EE,#3A0CA3)" }}>
          <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full opacity-10 bg-white" />
          <div className="absolute -right-2 -bottom-6 w-32 h-32 rounded-full opacity-10 bg-white" />
          <p className="text-xs font-medium opacity-80 mb-3">Total Revenue</p>
          <p className="font-display text-2xl font-bold">{formatRp(data.totalRevenue)}</p>
          <p className="text-xs opacity-70 mt-2">Dari transaksi verified</p>
          <div className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}><polyline points="18 15 12 9 6 15"/></svg>
          </div>
        </div>

        {/* Members */}
        <div className="rounded-2xl p-5 bg-white border border-border shadow-card">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-tx2 font-medium">Total Member</p>
            <div className="w-8 h-8 rounded-xl bg-blueLight flex items-center justify-center">
              <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="#4361EE" strokeWidth={2}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
            </div>
          </div>
          <p className="font-display text-2xl font-bold text-tx1">{data.totalMembers.toLocaleString("id")}</p>
          <p className="text-xs text-tx3 mt-2">Member terdaftar</p>
        </div>

        {/* Outlets */}
        <div className="rounded-2xl p-5 bg-white border border-border shadow-card">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-tx2 font-medium">Outlet Aktif</p>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "#D1FAE5" }}>
              <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="#059669" strokeWidth={2}><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/></svg>
            </div>
          </div>
          <p className="font-display text-2xl font-bold text-tx1">{data.activeStores}<span className="text-base text-tx3 font-medium">/{data.totalStores}</span></p>
          <p className={`text-xs mt-2 ${inactive > 0 ? "text-red-500" : "text-success"}`}>
            {inactive > 0 ? `${inactive} outlet tutup sementara` : "Semua outlet aktif"}
          </p>
        </div>

        {/* Pending */}
        <div className="rounded-2xl p-5 bg-white border border-border shadow-card">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-tx2 font-medium">Pending Verifikasi</p>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: data.pendingCount > 0 ? "#FEE2E2" : "#D1FAE5" }}>
              <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke={data.pendingCount > 0 ? "#DC2626" : "#059669"} strokeWidth={2}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
          </div>
          <p className={`font-display text-2xl font-bold ${data.pendingCount > 0 ? "text-red-500" : "text-success"}`}>{data.pendingCount}</p>
          <p className="text-xs text-tx3 mt-2">{data.pendingPointsHeld.toLocaleString("id")} pts tertahan</p>
        </div>
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-3 gap-4">

        {/* Recent Transactions — spans 2 cols */}
        <div className="col-span-2 bg-white rounded-2xl border border-border shadow-card p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-display font-bold text-tx1 text-base">Transaksi Terbaru</h2>
              <p className="text-xs text-tx3 mt-0.5">Dari semua outlet</p>
            </div>
            <a href="/transactions" className="text-xs font-medium px-3 py-1.5 rounded-lg border border-border text-tx2 hover:border-blue1 hover:text-blue1 transition-all" style={{ borderColor: "#E2E8F0" }}>
              Lihat semua →
            </a>
          </div>

          {data.recentTransactions.length === 0 ? (
            <div className="py-12 text-center text-tx3 text-sm">Belum ada transaksi.</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "1px solid #F1F5F9" }}>
                  {["Document ID", "Member", "Outlet", "Jumlah", "Status"].map(h => (
                    <th key={h} className="pb-3 text-left text-[11px] font-semibold text-tx3 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.recentTransactions.map((tx) => {
                  const s = STATUS[tx.status] ?? STATUS.pending;
                  return (
                    <tr key={tx.docId} className="hover:bg-s2 transition-colors" style={{ borderBottom: "1px solid #F8FAFF" }}>
                      <td className="py-3 pr-3">
                        <code className="text-[11px] font-mono text-blue1 bg-blueLight px-2 py-0.5 rounded-md">{tx.docId}</code>
                      </td>
                      <td className="py-3 pr-3 text-sm font-medium text-tx1">{tx.memberName}</td>
                      <td className="py-3 pr-3 text-xs text-tx2">{tx.storeLocation}</td>
                      <td className="py-3 pr-3 text-sm font-semibold text-tx1">{formatRpFull(tx.amount)}</td>
                      <td className="py-3">
                        <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
                              style={{ background: s.bg, color: s.color }}>{s.label}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Top Outlets */}
        <div className="bg-white rounded-2xl border border-border shadow-card p-5">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-display font-bold text-tx1 text-base">Top Outlets</h2>
            <span className="text-xs text-tx3">by Revenue</span>
          </div>

          {/* Mini bar chart */}
          {chartData.length > 0 ? (
            <MiniBarChart data={chartData} />
          ) : (
            <div className="py-6 text-center text-tx3 text-xs">Belum ada data.</div>
          )}

          {/* Ranked list */}
          <div className="flex flex-col gap-3 mt-4">
            {data.topStores.map((s, i) => (
              <div key={s.storeId} className="flex items-center gap-3">
                <span className="font-display font-bold text-sm w-5 flex-shrink-0" style={{ color: i === 0 ? "#4361EE" : i === 1 ? "#7C3AED" : "#94A3B8" }}>
                  #{i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-tx1 truncate">{s.storeName}</p>
                  <div className="h-1.5 rounded-full mt-1 overflow-hidden" style={{ background: "#EEF2FF" }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${Math.round((s.totalRevenue / topMax) * 100)}%`, background: i === 0 ? "#4361EE" : "#A5B4FC" }} />
                  </div>
                </div>
                <span className="text-[11px] font-semibold text-tx2 flex-shrink-0">{formatRp(s.totalRevenue)}</span>
              </div>
            ))}
            {data.topStores.length === 0 && <p className="text-xs text-tx3 text-center py-4">Belum ada transaksi.</p>}
          </div>
        </div>

      </div>
    </div>
  );
}
