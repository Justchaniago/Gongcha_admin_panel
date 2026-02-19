import { adminDb } from "@/lib/firebaseServer";

interface Tx {
  docId: string;
  transactionId: string;
  memberName: string;
  memberId: string;
  staffId: string;
  storeLocation: string;
  amount: number;
  potentialPoints: number;
  status: string;
  createdAt: string;
  verifiedAt: string | null;
}

async function getTransactions(): Promise<Tx[]> {
  const snap = await adminDb
    .collectionGroup("transactions")
    .orderBy("createdAt", "desc")
    .limit(50)
    .get();
  return snap.docs.map(d => {
    const data = d.data();
    return {
      docId: d.id,
      transactionId: data.transactionId ?? "",
      memberName: data.memberName ?? "-",
      memberId: data.memberId ?? "",
      staffId: data.staffId ?? "",
      storeLocation: data.storeLocation ?? "-",
      amount: data.amount ?? 0,
      potentialPoints: data.potentialPoints ?? 0,
      status: data.status ?? "pending",
      createdAt: data.createdAt?.toDate?.()?.toLocaleDateString("id-ID") ?? "-",
      verifiedAt: data.verifiedAt?.toDate?.()?.toLocaleDateString("id-ID") ?? null,
    };
  });
}

const STATUS = {
  pending:  { label: "Pending",  bg: "#FEF3C7", color: "#D97706" },
  verified: { label: "Verified", bg: "#D1FAE5", color: "#059669" },
  rejected: { label: "Rejected", bg: "#FEE2E2", color: "#DC2626" },
};

function formatRp(n: number) { return "Rp " + n.toLocaleString("id-ID"); }

export default async function TransactionsPage() {
  let txs: Tx[] = [];
  try { txs = await getTransactions(); } catch { /* not configured */ }

  const pending  = txs.filter(t => t.status === "pending");
  const verified = txs.filter(t => t.status === "verified");
  const rejected = txs.filter(t => t.status === "rejected");
  const totalPendingPts = pending.reduce((a, t) => a + t.potentialPoints, 0);

  return (
    <div className="p-8 max-w-[1400px]">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-2xl font-bold text-tx1">Transaction Audit & CSV Sync</h1>
          <p className="text-sm text-tx2 mt-1">Upload CSV POS → Auto-match → Verifikasi → Cairkan poin member.</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Pending", count: pending.length, pts: totalPendingPts, bg: "#FEF3C7", color: "#D97706", borderColor: "#FDE68A" },
          { label: "Verified", count: verified.length, pts: null, bg: "#D1FAE5", color: "#059669", borderColor: "#6EE7B7" },
          { label: "Rejected", count: rejected.length, pts: null, bg: "#FEE2E2", color: "#DC2626", borderColor: "#FCA5A5" },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-2xl border shadow-card p-5" style={{ borderColor: c.borderColor }}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-tx2">{c.label}</p>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: c.bg, color: c.color }}>{c.label}</span>
            </div>
            <p className="font-display text-3xl font-bold" style={{ color: c.color }}>{c.count}</p>
            {c.pts !== null && <p className="text-xs text-tx3 mt-1">{c.pts.toLocaleString("id")} pts tertahan</p>}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-5 gap-4">
        {/* CSV Uploader */}
        <div className="col-span-2 bg-white rounded-2xl border border-border shadow-card p-5">
          <h2 className="font-display font-bold text-tx1 mb-4">Upload CSV dari POS</h2>
          <div className="border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all hover:border-blue1 hover:bg-blueLight group" style={{ borderColor: "#C7D2FE" }}>
            <div className="w-12 h-12 rounded-xl bg-blueLight flex items-center justify-center mx-auto mb-3 group-hover:scale-105 transition-transform">
              <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="#4361EE" strokeWidth={1.8}><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            </div>
            <p className="font-semibold text-sm text-tx1">Drag & Drop file CSV</p>
            <p className="text-xs text-tx3 mt-1">atau klik untuk pilih file</p>
            <p className="text-[10px] text-tx3 mt-2">Format: .csv dari mesin POS Gong Cha</p>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <p className="text-[11px] text-tx2 font-medium mb-1">Filter Outlet</p>
              <select className="w-full border border-border rounded-xl px-3 py-2 text-sm text-tx1 bg-s2 outline-none focus:border-blue1 transition-colors">
                <option>Semua Outlet</option>
              </select>
            </div>
            <div>
              <p className="text-[11px] text-tx2 font-medium mb-1">Tanggal</p>
              <input type="date" className="w-full border border-border rounded-xl px-3 py-2 text-sm text-tx1 bg-s2 outline-none focus:border-blue1 transition-colors" />
            </div>
          </div>
          <button className="mt-4 w-full py-2.5 rounded-xl text-white text-sm font-semibold transition-all hover:opacity-90" style={{ background: "linear-gradient(135deg,#4361EE,#3A0CA3)" }}>
            Auto-Match & Verifikasi Massal
          </button>
        </div>

        {/* Pending List */}
        <div className="col-span-3 bg-white rounded-2xl border border-border shadow-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-bold text-tx1">Pending ({pending.length})</h2>
            {pending.length > 0 && (
              <button className="text-xs font-semibold px-4 py-2 rounded-xl text-white" style={{ background: "#059669" }}>
                ✓ Verifikasi Semua
              </button>
            )}
          </div>
          <div className="flex flex-col gap-2 max-h-[380px] overflow-y-auto">
            {pending.length === 0 ? (
              <div className="py-12 text-center text-tx3 text-sm">Tidak ada transaksi pending. 🎉</div>
            ) : pending.map((tx) => (
              <div key={tx.docId} className="flex items-center gap-3 p-3 rounded-xl border border-border hover:border-blue1 hover:bg-s2 transition-all">
                <div className="flex-1 min-w-0">
                  <code className="text-[11px] text-blue1 font-mono">{tx.docId}</code>
                  <p className="text-xs text-tx2 mt-0.5">{tx.memberName} · {tx.storeLocation}</p>
                  <p className="text-xs font-semibold text-tx1 mt-0.5">{formatRp(tx.amount)} · {tx.potentialPoints} pts</p>
                </div>
                <div className="flex gap-1.5">
                  <button className="w-8 h-8 rounded-xl flex items-center justify-center text-success hover:bg-green-50 border border-green-200 transition-all text-sm font-bold">✓</button>
                  <button className="w-8 h-8 rounded-xl flex items-center justify-center text-danger hover:bg-red-50 border border-red-200 transition-all text-sm font-bold">✕</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Full table */}
      <div className="mt-4 bg-white rounded-2xl border border-border shadow-card overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid #F1F5F9" }}>
          <h2 className="font-display font-bold text-tx1">Riwayat Lengkap</h2>
          <div className="flex gap-2">
            <div className="flex items-center gap-2 bg-s2 border border-border rounded-xl px-3 py-2 w-48">
              <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="#94A3B8" strokeWidth={2}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <input className="flex-1 text-xs outline-none text-tx2 bg-transparent" placeholder="Cari ID..." />
            </div>
            <button className="text-xs px-3 py-2 border border-border rounded-xl text-tx2 hover:border-blue1 hover:text-blue1 transition-all">⬇ Export</button>
          </div>
        </div>
        {txs.length === 0 ? (
          <div className="py-16 text-center text-tx3 text-sm">Belum ada transaksi.</div>
        ) : (
          <table className="w-full">
            <thead style={{ background: "#F8FAFF" }}>
              <tr>
                {["", "Document ID", "Member", "Outlet", "Tanggal", "Jumlah", "Poin", "Status", "Aksi"].map(h => (
                  <th key={h} className="text-left text-[11px] font-semibold text-tx3 uppercase tracking-wide px-5 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {txs.slice(0, 20).map((tx) => {
                const s = STATUS[tx.status as keyof typeof STATUS] ?? STATUS.pending;
                return (
                  <tr key={tx.docId} className="hover:bg-s2 transition-colors" style={{ borderTop: "1px solid #F1F5F9" }}>
                    <td className="px-5 py-3"><input type="checkbox" className="rounded" /></td>
                    <td className="px-5 py-3"><code className="text-[11px] font-mono text-blue1 bg-blueLight px-2 py-0.5 rounded">{tx.docId}</code></td>
                    <td className="px-5 py-3 text-sm font-medium text-tx1">{tx.memberName}</td>
                    <td className="px-5 py-3 text-xs text-tx2">{tx.storeLocation}</td>
                    <td className="px-5 py-3 text-xs text-tx2">{tx.createdAt}</td>
                    <td className="px-5 py-3 text-sm font-semibold text-tx1">{formatRp(tx.amount)}</td>
                    <td className="px-5 py-3 text-xs font-semibold text-blue1">{tx.potentialPoints} pts</td>
                    <td className="px-5 py-3">
                      <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ background: s.bg, color: s.color }}>{s.label}</span>
                    </td>
                    <td className="px-5 py-3">
                      {tx.status === "pending" && (
                        <button className="text-[11px] font-semibold px-3 py-1.5 rounded-lg text-white" style={{ background: "#4361EE" }}>Verifikasi</button>
                      )}
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
