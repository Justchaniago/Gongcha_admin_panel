"use client";

import { useEffect, useState, useMemo } from "react";
import { useAdminAuth } from "@/components/AuthProvider";
import {
  collection, onSnapshot, query, orderBy, limit,
  where, Timestamp, getDocs,
} from "firebase/firestore";
import { db } from "../../lib/firebaseClient";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Transaction {
  docId:          string;
  docPath:        string;
  transactionId:  string;
  memberName:     string;
  memberId:       string;
  amount:         number;
  potentialPoints?: number;
  status:         "NEEDS_REVIEW" | "COMPLETED" | "FRAUD" | "FLAGGED" | "REFUNDED";
  storeId:        string;
  createdAt:      string | null;
  type:           string;
}
interface Member { uid: string; name?: string; fullName?: string; tier?: string; currentPoints?: number; }
interface Store  { uid: string; name?: string; isActive?: boolean; }

interface DashboardProps {
  initialRole:         string;
  initialTransactions: Transaction[];
  initialUsers:        Member[];
  initialStores:       Store[];
}

// ── Helper: normalise legacy status ──────────────────────────────────────────
function normaliseStatus(raw: string | undefined): Transaction["status"] {
  switch (raw) {
    case "verified":  return "COMPLETED";
    case "rejected":  return "FRAUD";
    case "pending":   return "NEEDS_REVIEW";
    case "COMPLETED":
    case "FRAUD":
    case "NEEDS_REVIEW":
    case "FLAGGED":
    case "REFUNDED":  return raw as Transaction["status"];
    default:          return "NEEDS_REVIEW";
  }
}

// ── Design tokens (preserved from original) ───────────────────────────────────
const C = {
  bg: '#F4F6FB', white: '#FFFFFF', border: '#EAECF2', border2: '#F0F2F7',
  tx1: '#0F1117', tx2: '#4A5065', tx3: '#9299B0', tx4: '#BCC1D3',
  blue: '#4361EE', blueL: '#EEF2FF', blueD: '#3A0CA3',
  green: '#12B76A', greenL: '#ECFDF3', red: '#F04438', redL: '#FEF3F2',
  yellow: '#F79009', yellowL: '#FFFAEB', purple: '#7C3AED', purpleL: '#F5F3FF',
};
const font = "'Plus Jakarta Sans', system-ui, sans-serif";
const fmtRp = (n: number) => "Rp " + n.toLocaleString("id-ID");

export default function DashboardClient({
  initialRole, initialTransactions, initialUsers, initialStores
}: DashboardProps) {
  const { user } = useAdminAuth();
  const role = user?.role ?? initialRole;
  const isSuperAdmin = role === "SUPER_ADMIN";

  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions);
  const [members,      setMembers]      = useState<Member[]>(initialUsers);
  const [stores,       setStores]       = useState<Store[]>(initialStores);

  const [txStatus,     setTxStatus]     = useState<"connecting"|"live"|"error">("connecting");
  const [memberStatus, setMemberStatus] = useState<"connecting"|"live"|"error">("connecting");

  const [mode,     setMode]     = useState<"realtime"|"range">("realtime");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo,   setDateTo]   = useState("");

  // ── Firestore realtime listeners ────────────────────────────────────────────
  useEffect(() => {
    // Track all unsubscribe functions untuk cleanup
    const unsubs: Array<() => void> = [];
    let ignore = false;

    // ─── Helper: map Firestore doc ke Transaction object ──────────────────────
    function mapTx(d: any, id: string, path: string): Transaction {
      const data = d;
      const storeId = (data.storeId ?? data.storeLocation ?? "") as string;
      return {
        docId:          id,
        docPath:        path,
        transactionId:  (data.posTransactionId ?? data.transactionId ?? id) as string,
        memberName:     (data.memberName ?? "-") as string,
        memberId:       (data.memberId ?? "") as string,
        amount:         (data.amount ?? 0) as number,
        potentialPoints:(data.potentialPoints ?? 0) as number,
        // ✅ Normalise semua status ke canonical schema
        status:         normaliseStatus(data.status),
        storeId,
        createdAt:      data.createdAt?.toDate?.()?.toISOString?.() ?? null,
        type:           (data.type ?? "earn") as string,
      };
    }

    async function fetchRange() {
      setTxStatus("connecting");
      try {
        let q = query(
          collection(db, "transactions"),
          orderBy("createdAt", "desc"),
          limit(100)
        );

        if (dateFrom && dateTo) {
          const from = Timestamp.fromDate(new Date(dateFrom + "T00:00:00"));
          const to   = Timestamp.fromDate(new Date(dateTo   + "T23:59:59"));
          q = query(
            collection(db, "transactions"),
            orderBy("createdAt", "desc"),
            where("createdAt", ">=", from),
            where("createdAt", "<=", to),
            limit(100)
          );
        }

        const snap = await getDocs(q);
        if (!ignore) {
          setTransactions(snap.docs.map(d => mapTx(d.data(), d.id, d.ref.path)));
          setTxStatus("live");
        }
      } catch (err) {
        console.error("[fetchRange]", err);
        if (!ignore) setTxStatus("error");
      }
    }

    if (mode === "realtime") {
      // ── Realtime: transactions (flat collection, limit 50) ─────────────────
      const txQ    = query(collection(db, "transactions"), orderBy("createdAt", "desc"), limit(50));
      const unsubTx = onSnapshot(
        txQ,
        (snap) => {
          setTransactions(snap.docs.map(d => mapTx(d.data(), d.id, d.ref.path)));
          setTxStatus("live");
        },
        (err) => {
          console.error("[transactions] onSnapshot error:", err);
          setTxStatus("error");
        }
      );
      unsubs.push(unsubTx);
    } else {
      fetchRange();
    }

    // ── Members (users collection) ─────────────────────────────────────────────
    const memQ     = query(collection(db, "users"), limit(500));
    const unsubMem = onSnapshot(
      memQ,
      (snap) => {
        setMembers(snap.docs.map(d => ({ uid: d.id, ...d.data() } as Member)));
        setMemberStatus("live");
      },
      (err) => {
        console.error("[members] onSnapshot error:", err);
        setMemberStatus("error");
      }
    );
    unsubs.push(unsubMem);

    // ── Stores ────────────────────────────────────────────────────────────────
    const storeQ     = query(collection(db, "stores"), limit(100));
    const unsubStore = onSnapshot(
      storeQ,
      (snap) => {
        setStores(snap.docs.map(d => ({ uid: d.id, ...d.data() } as Store)));
      },
      (err) => {
        console.error("[stores] onSnapshot error:", err);
      }
    );
    unsubs.push(unsubStore);

    // ✅ Cleanup: unsubscribe semua listener
    return () => {
      ignore = true;
      unsubs.forEach(fn => fn());
    };
  }, [mode, dateFrom, dateTo]);

  // ── Analytics (canonical COMPLETED/FRAUD/NEEDS_REVIEW) ───────────────────
  const analytics = useMemo(() => {
    const completedTx = transactions.filter(t => t.status === "COMPLETED");
    const pendingTx   = transactions.filter(t => t.status === "NEEDS_REVIEW");
    const fraudTx     = transactions.filter(t => t.status === "FRAUD");

    // ✅ Revenue: hanya COMPLETED (canonical)
    const totalRevenue = completedTx.reduce((sum, t) => sum + (t.amount ?? 0), 0);

    // ✅ XP/Points issued: hanya COMPLETED
    const totalXPIssued = completedTx.reduce((sum, t) => sum + (t.potentialPoints ?? 0), 0);

    // ✅ Points held (pending): hanya NEEDS_REVIEW
    const pointsHeld = pendingTx.reduce((sum, t) => sum + (t.potentialPoints ?? 0), 0);

    // Count per status
    const completedCount  = completedTx.length;
    const pendingCount    = pendingTx.length;
    const fraudCount      = fraudTx.length;
    const totalTx         = transactions.length;

    // Per-store revenue breakdown (top 5)
    const storeRevMap: Record<string, number> = {};
    completedTx.forEach(t => {
      if (!storeRevMap[t.storeId]) storeRevMap[t.storeId] = 0;
      storeRevMap[t.storeId] += t.amount ?? 0;
    });
    const topStores = Object.entries(storeRevMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([storeId, revenue]) => ({
        storeId,
        name:    stores.find(s => s.uid === storeId)?.name ?? storeId,
        revenue,
      }));

    return {
      totalRevenue,
      totalXPIssued,
      pointsHeld,
      completedCount,
      pendingCount,
      fraudCount,
      totalTx,
      topStores,
      totalMembers: members.length,
      activeStores: stores.filter(s => s.isActive).length,
      totalStores:  stores.length,
    };
  }, [transactions, members, stores]);

  // ── Store name lookup helper ──────────────────────────────────────────────
  const getStoreName = (storeId: string) =>
    stores.find(s => s.uid === storeId)?.name ?? storeId;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: font, background: C.bg, minHeight: "100vh", padding: "24px 32px" }}>
      {/* ── Header ── */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: C.tx1, margin: 0 }}>Dashboard</h1>
        <p  style={{ fontSize: 13, color: C.tx3, margin: "4px 0 0" }}>
          Ringkasan operasional Gong Cha
          {txStatus === "live"       && <span style={{ color: C.green, marginLeft: 8 }}>● Live</span>}
          {txStatus === "connecting" && <span style={{ color: C.yellow, marginLeft: 8 }}>● Connecting…</span>}
          {txStatus === "error"      && <span style={{ color: C.red, marginLeft: 8 }}>● Error — check Firestore rules</span>}
        </p>
      </div>

      {/* ── Mode Toggle ── */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        {(["realtime", "range"] as const).map(m => (
          <button
            key={m}
            onClick={() => setMode(m)}
            style={{
              padding: "6px 16px", borderRadius: 8, border: "none", cursor: "pointer",
              fontSize: 13, fontWeight: 600,
              background: mode === m ? C.blue : C.white,
              color:      mode === m ? "#fff" : C.tx2,
            }}
          >
            {m === "realtime" ? "🔴 Realtime" : "📅 Range"}
          </button>
        ))}
        {mode === "range" && (
          <>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13 }} />
            <span style={{ alignSelf: "center", color: C.tx3 }}>–</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13 }} />
          </>
        )}
      </div>

      {/* ── Stat Cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 16, marginBottom: 28 }}>
        <StatCard label="Total Members"           value={analytics.totalMembers}                  color={C.blue} />
        <StatCard label="Stores (Active)"         value={`${analytics.activeStores}/${analytics.totalStores}`} color={C.green} />
        <StatCard label="Completed Transactions"  value={analytics.completedCount}                color={C.green} />
        <StatCard label="Pending Review"          value={analytics.pendingCount}                  color={C.yellow} />
        <StatCard label="Fraud Flagged"           value={analytics.fraudCount}                    color={C.red} />
        {isSuperAdmin && (
          <>
            <StatCard label="Total Revenue (COMPLETED)" value={fmtRp(analytics.totalRevenue)} color={C.purple} />
            <StatCard label="XP Issued"           value={analytics.totalXPIssued.toLocaleString()}  color={C.blue} />
            <StatCard label="Points Held (Review)" value={analytics.pointsHeld.toLocaleString()}    color={C.yellow} />
          </>
        )}
      </div>

      {/* ── Top Stores (Super Admin only) ── */}
      {isSuperAdmin && analytics.topStores.length > 0 && (
        <div style={{ background: C.white, borderRadius: 12, border: `1px solid ${C.border}`, padding: 20, marginBottom: 28 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 16px", color: C.tx1 }}>Top Stores by Revenue</h3>
          {analytics.topStores.map((s, i) => (
            <div key={s.storeId} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: i < analytics.topStores.length - 1 ? `1px solid ${C.border2}` : "none" }}>
              <span style={{ fontSize: 13, color: C.tx2 }}>{i + 1}. {s.name}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.green }}>{fmtRp(s.revenue)}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Recent Transactions ── */}
      <div style={{ background: C.white, borderRadius: 12, border: `1px solid ${C.border}`, padding: 20 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 16px", color: C.tx1 }}>
          Recent Transactions
          <span style={{ fontSize: 12, fontWeight: 400, color: C.tx3, marginLeft: 8 }}>
            (showing {Math.min(transactions.length, 50)} of {analytics.totalTx})
          </span>
        </h3>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                {["Tx ID", "Member", "Store", "Amount", "Status", "Date"].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "8px 12px", color: C.tx3, fontWeight: 600, borderBottom: `1px solid ${C.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {transactions.slice(0, 50).map(tx => (
                <tr key={tx.docId}>
                  <td style={{ padding: "8px 12px", color: C.tx2 }}>{tx.transactionId.slice(0, 12)}…</td>
                  <td style={{ padding: "8px 12px", color: C.tx1, fontWeight: 500 }}>{tx.memberName}</td>
                  <td style={{ padding: "8px 12px", color: C.tx2 }}>{getStoreName(tx.storeId)}</td>
                  <td style={{ padding: "8px 12px", color: C.tx1 }}>{fmtRp(tx.amount)}</td>
                  <td style={{ padding: "8px 12px" }}>
                    <StatusChip status={tx.status} />
                  </td>
                  <td style={{ padding: "8px 12px", color: C.tx3 }}>
                    {tx.createdAt ? new Date(tx.createdAt).toLocaleDateString("id-ID") : "-"}
                  </td>
                </tr>
              ))}
              {transactions.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: "24px", textAlign: "center", color: C.tx3 }}>
                    Tidak ada data transaksi
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────
function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div style={{
      background: "#fff", borderRadius: 12, padding: "16px 20px",
      border: `1px solid #EAECF2`,
    }}>
      <p style={{ fontSize: 12, color: "#9299B0", margin: "0 0 6px", fontWeight: 500 }}>{label}</p>
      <p style={{ fontSize: 22, fontWeight: 700, color, margin: 0 }}>{value}</p>
    </div>
  );
}

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  COMPLETED:    { bg: "#ECFDF3", color: "#027A48" },
  NEEDS_REVIEW: { bg: "#FFFAEB", color: "#B54708" },
  FRAUD:        { bg: "#FEF3F2", color: "#B42318" },
  FLAGGED:      { bg: "#F5F3FF", color: "#5B21B6" },
  REFUNDED:     { bg: "#F0F9FF", color: "#0369A1" },
};

function StatusChip({ status }: { status: string }) {
  const style = STATUS_STYLE[status] ?? { bg: "#F2F4F7", color: "#344054" };
  return (
    <span style={{
      display: "inline-block", padding: "2px 10px", borderRadius: 99,
      fontSize: 11, fontWeight: 700, background: style.bg, color: style.color,
    }}>
      {status}
    </span>
  );
}