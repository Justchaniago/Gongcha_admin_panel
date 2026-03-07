"use client";

import { useEffect, useState, useMemo } from "react";
import { useAdminAuth } from "@/components/AuthProvider";
import {
  collection, onSnapshot, query, orderBy, limit,
  where, Timestamp,
} from "firebase/firestore";
import { db } from "../../lib/firebaseClient";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Transaction {
  docId?: string;
  docPath?: string;
  transactionId: string;
  memberName: string;
  amount: number;
  potentialPoints?: number;
  type?: "earn" | "redeem"; // earn = purchase, redeem = voucher redemption
  status: "COMPLETED" | "NEEDS_REVIEW" | "FRAUD" | "FLAGGED" | "REFUNDED" | "verified" | "pending" | "rejected";
  createdAt: string | null;
  storeId?: string;
  storeName?: string; // store name to display
}

interface Member { uid: string; tier: string; currentPoints: number; lifetimePoints: number; }
interface Store  { uid: string; name: string; isActive: boolean; }

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  bg: '#F4F6FB', white: '#FFFFFF', border: '#EAECF2', border2: '#F0F2F7',
  tx1: '#0F1117', tx2: '#4A5065', tx3: '#9299B0', tx4: '#BCC1D3',
  blue: '#4361EE', blueL: '#EEF2FF', blueD: '#3A0CA3',
  green: '#12B76A', greenBg: '#ECFDF3',
  amber: '#F79009', amberBg: '#FFFAEB',
  red: '#C8102E', redBg: '#FEF3F2',
  shadow: '0 1px 3px rgba(16,24,40,.06), 0 1px 2px rgba(16,24,40,.04)',
  shadowMd: '0 4px 16px rgba(16,24,40,.08), 0 2px 4px rgba(16,24,40,.04)',
} as const;

const font = "'Plus Jakarta Sans', system-ui, sans-serif";
const card: React.CSSProperties = {
  background: C.white, border: `1px solid ${C.border}`,
  borderRadius: 18, boxShadow: C.shadow,
};

// ── Sub-components ────────────────────────────────────────────────────────────
function LiveBadge({ status }: { status: "connecting" | "live" | "error" }) {
  const cfg = {
    connecting: { color: C.amber,  dot: C.amber,  label: "Connecting…" },
    live:       { color: C.green,  dot: C.green,  label: "Live"        },
    error:      { color: C.red,    dot: C.red,    label: "Error"       },
  }[status];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, color: cfg.color }}>
      <span style={{
        width: 7, height: 7, borderRadius: "50%", background: cfg.dot,
        boxShadow: status === "live" ? `0 0 0 3px rgba(18,183,106,.2)` : "none",
        animation: status === "connecting" ? "pulse .9s infinite" : "none",
      }}/>
      {cfg.label}
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.25}}`}</style>
    </span>
  );
}

function TrendBadge({ value }: { value: number }) {
  const isUp = value >= 0;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 3,
      padding: "2px 8px", borderRadius: 99,
      background: isUp ? "rgba(18,183,106,.14)" : "rgba(240,68,56,.14)",
      color: isUp ? "#027A48" : "#B42318",
      fontSize: 11, fontWeight: 700,
    }}>
      <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
        {isUp
          ? <path d="M5 8V2M2 5l3-3 3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          : <path d="M5 2v6M2 5l3 3 3-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        }
      </svg>
      {isUp ? "+" : ""}{Math.abs(value).toFixed(1)}%
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; dot: string }> = {
    // Canonical statuses
    COMPLETED:    { bg: "#ECFDF3", color: "#027A48", dot: "#12B76A" },
    NEEDS_REVIEW: { bg: "#FFFAEB", color: "#B54708", dot: "#F79009" },
    FRAUD:        { bg: "#FEF3F2", color: "#B42318", dot: "#F04438" },
    FLAGGED:      { bg: "#F5F3FF", color: "#5B21B6", dot: "#7C3AED" },
    REFUNDED:     { bg: "#F0F9FF", color: "#0369A1", dot: "#0EA5E9" },
    // Legacy fallbacks (transitional)
    verified: { bg: "#ECFDF3", color: "#027A48", dot: "#12B76A" },
    pending:  { bg: "#FFFAEB", color: "#B54708", dot: "#F79009" },
    rejected: { bg: "#FEF3F2", color: "#B42318", dot: "#F04438" },
  };
  const s = map[status] ?? map.NEEDS_REVIEW;
  const labelMap: Record<string, string> = {
    // Canonical
    COMPLETED:    "Completed",
    NEEDS_REVIEW: "Needs Review",
    FRAUD:        "Fraud",
    FLAGGED:      "Flagged",
    REFUNDED:     "Refunded",
    // Legacy fallbacks
    verified: "Verified",
    pending:  "Pending",
    rejected: "Rejected",
  };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "3px 10px", borderRadius: 99,
      background: s.bg, color: s.color,
      fontSize: 11, fontWeight: 700, letterSpacing: ".04em",
      textTransform: "uppercase",
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: s.dot }}/>
      {labelMap[status] ?? status}
    </span>
  );
}

function TransactionTypeBadge({ type }: { type?: string }) {
  if (!type) return null;
  const isRedeem = type === "redeem";
  const isEarn = type === "earn";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 8px", borderRadius: 6,
      background: isRedeem ? "#F3F0FF" : "#EEF2FF",
      color: isRedeem ? "#5B21B6" : "#4361EE",
      fontSize: 10, fontWeight: 700, letterSpacing: ".06em",
      textTransform: "uppercase",
    }}>
      {isRedeem ? "🎁 Redeem" : isEarn ? "💳 Purchase" : type}
    </span>
  );
}

function StatCard({ label, value, trend, trendLabel, iconBg, iconColor, icon, borderOverride }: {
  label: string; value: string; trend: number; trendLabel: string;
  iconBg: string; iconColor: string; icon: React.ReactNode; borderOverride?: string;
}) {
  return (
    <div style={{ ...card, border: borderOverride ?? card.border, padding: "22px 24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: C.tx3 }}>{label}</span>
        <div style={{ width: 32, height: 32, borderRadius: 9, background: iconBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke={iconColor} strokeWidth={2}>{icon}</svg>
        </div>
      </div>
      <p style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-.025em", color: C.tx1, lineHeight: 1, marginBottom: 10 }}>{value}</p>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <TrendBadge value={trend}/>
        <span style={{ fontSize: 11.5, color: C.tx3 }}>{trendLabel}</span>
      </div>
    </div>
  );
}


// Props interface for initial data from server
interface DashboardProps {
  initialRole: string;
  initialTransactions: any[];
  initialUsers: any[];
  initialStores: any[];
}

export default function DashboardClient({ initialRole, initialTransactions, initialUsers, initialStores }: DashboardProps) {
  const [mode, setMode] = useState<"realtime" | "range">("realtime");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedStoreId, setSelectedStoreId] = useState<string>("all"); // Store filter for admin
  // Use initial data from server as default state
  const [transactions, setTransactions] = useState<any[]>(initialTransactions);
  // Keep using state members and stores for legacy logic to continue working
  const [members, setMembers] = useState<any[]>(initialUsers);
  const [stores, setStores] = useState<any[]>(initialStores);
  // All-time pending & rejected counts (not affected by date picker)
  const [allTimePendingCount, setAllTimePendingCount] = useState(0);
  const [allTimeRejectedCount, setAllTimeRejectedCount] = useState(0);
  const [txStatus,     setTxStatus]     = useState<"connecting"|"live"|"error">("connecting");
  const [memberStatus, setMemberStatus] = useState<"connecting"|"live"|"error">("connecting");
  const [selectedTxDocPaths, setSelectedTxDocPaths] = useState<string[]>([]);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState<string | null>(null);

  // Greeting
  const { user } = useAdminAuth();
  const now      = new Date();
  const hr       = now.getHours();
  const greeting = hr < 12 ? "Good morning" : hr < 17 ? "Good afternoon" : "Good evening";
  const dateStr  = now.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const userName = user?.name || user?.email?.split("@")[0] || "Admin";

  // Check if user has limited access (cashier or store_manager)
  const isLimitedAccess = initialRole === "cashier" || initialRole === "store_manager";
  const isSuperAdmin = initialRole === "SUPER_ADMIN";
  const canDeleteTransactions = initialRole === "SUPER_ADMIN" || initialRole === "admin";

  // Get assigned store ID for cashier/store manager
  const userAssignedStoreId = (user as any)?.storeId || (user as any)?.assignedStoreId || null;
  
  // Determine effective store filter
  const effectiveStoreFilter = isLimitedAccess && userAssignedStoreId ? userAssignedStoreId : selectedStoreId;

  // Helper: resolve store name from storeId
  const getStoreName = (storeId?: string) => {
    if (!storeId) return "—";
    const store = stores.find(s => s.uid === storeId || s.id === storeId);
    return store?.name || storeId;
  };

  const getTxDocPath = (tx: any) => tx?.docPath ?? (tx?.docId ? `transactions/${tx.docId}` : "");

  // ── Firestore listeners ──────────────────────────────────────────────────
  useEffect(() => {
    let unsubTx: (() => void) | null = null;
    let ignore = false;

    async function fetchRange() {
      setTxStatus("connecting");
      try {
        const { getDocs, collection, query, orderBy, where, Timestamp, limit } = await import("firebase/firestore");
        let q = query(collection(db, "transactions"), orderBy("createdAt", "desc"), limit(100));
        if (dateFrom && dateTo) {
          const from = Timestamp.fromDate(new Date(dateFrom + "T00:00:00"));
          const to = Timestamp.fromDate(new Date(dateTo + "T23:59:59"));
          q = query(collection(db, "transactions"),
            orderBy("createdAt", "desc"),
            where("createdAt", ">=", from),
            where("createdAt", "<=", to),
            limit(100)
          );
        }
        const snap = await getDocs(q);
        if (!ignore) {
          let txList = snap.docs.map(d => {
            const data = d.data();
            const storeId = data.storeId ?? data.storeLocation ?? "";
            const type = data.type ?? "earn"; // Default to earn (purchase) if not specified
            return {
              docId:         d.id,
              docPath:       d.ref.path,
              transactionId: data.posTransactionId ?? data.transactionId ?? "",
              memberName:    data.memberName    ?? data.userName ?? "—",
              amount:        data.amount        ?? data.totalAmount ?? 0,
              potentialPoints: data.potentialPoints ?? 0,
              type:          type,
              status:        data.status        ?? "pending",
              createdAt:     data.createdAt?.toDate?.()?.toISOString?.() ?? data.createdAt ?? null,
              storeId:       storeId,
              storeName:     getStoreName(storeId),
            } as Transaction;
          });
          
          // Filter by store if needed (client-side)
          if (effectiveStoreFilter && effectiveStoreFilter !== "all") {
            txList = txList.filter(t => t.storeId === effectiveStoreFilter);
          }
          
          setTransactions(txList);
          setTxStatus("live");
        }
      } catch {
        if (!ignore) setTxStatus("error");
      }
    }

    if (mode === "realtime") {
      const txQ = query(collection(db, "transactions"), orderBy("createdAt", "desc"), limit(50));
      unsubTx = onSnapshot(txQ,
        (snap) => {
          let txList = snap.docs.map(d => {
            const data = d.data();
            const storeId = data.storeId ?? data.storeLocation ?? "";
            const type = data.type ?? "earn"; // Default to earn (purchase) if not specified
            return {
              docId:         d.id,
              docPath:       d.ref.path,
              transactionId: data.posTransactionId ?? data.transactionId ?? "",
              memberName:    data.memberName    ?? data.userName ?? "—",
              amount:        data.amount        ?? data.totalAmount ?? 0,
              potentialPoints: data.potentialPoints ?? 0,
              type:          type,
              status:        data.status        ?? "pending",
              createdAt:     data.createdAt?.toDate?.()?.toISOString?.() ?? data.createdAt ?? null,
              storeId:       storeId,
              storeName:     getStoreName(storeId),
            } as Transaction;
          });
          
          // Filter by store if needed (client-side)
          if (effectiveStoreFilter && effectiveStoreFilter !== "all") {
            txList = txList.filter(t => t.storeId === effectiveStoreFilter);
          }
          
          setTransactions(txList);
          setTxStatus("live");
        },
        () => setTxStatus("error"),
      );
    } else {
      fetchRange();
    }

    // Members (limit untuk efisiensi biaya Firestore)
    const memQ = query(collection(db, "users"), limit(500));
    const unsubMem = onSnapshot(memQ,
      (snap) => {
        setMembers(snap.docs.map(d => ({ uid: d.id, ...d.data() } as Member)));
        setMemberStatus("live");
      },
      () => setMemberStatus("error"),
    );

    // Stores (limit untuk efisiensi biaya Firestore)
    const storeQ = query(collection(db, "stores"), limit(100));
    const unsubStore = onSnapshot(storeQ,
      (snap) => {
        setStores(snap.docs.map(d => ({ uid: d.id, ...d.data() } as Store)));
      },
      (err) => {
        console.error("[stores] error:", err);
      }
    );

    // All-time pending count (not affected by date picker) — canonical NEEDS_REVIEW
    const pendingQ = query(collection(db, "transactions"), where("status", "==", "NEEDS_REVIEW"), limit(500));
    const unsubPending = onSnapshot(pendingQ,
      (snap) => {
        setAllTimePendingCount(snap.size);
      },
      (err) => {
        console.error("[pending] error:", err);
      }
    );

    // All-time rejected count (not affected by date picker) — canonical FRAUD
    const rejectedQ = query(collection(db, "transactions"), where("status", "==", "FRAUD"), limit(500));
    const unsubRejected = onSnapshot(rejectedQ,
      (snap) => {
        setAllTimeRejectedCount(snap.size);
      },
      (err) => {
        console.error("[rejected] error:", err);
      }
    );

    return () => { if (unsubTx) unsubTx(); ignore = true; unsubMem(); unsubStore(); unsubPending(); unsubRejected(); };
  }, [mode, dateFrom, dateTo, effectiveStoreFilter, stores.length]); // Re-run when store filter or stores change

  // ── Derived stats ────────────────────────────────────────────────────────
  // ALL TIME (tidak terpengaruh date picker):
  const totalMembers  = members.length;
  const totalStores   = stores.length;
  const pendingCount  = allTimePendingCount; // ALL TIME pending claims
  const rejectedCount = allTimeRejectedCount; // ALL TIME rejected claims
  const claimsNeedingReview = pendingCount + rejectedCount; // Pending + Rejected
  
  // FILTERED BY DATE (affected by date picker):
  // ✅ FIX GAP #10: Terima "COMPLETED" (canonical) + "verified" (legacy) — transitional
  const verifiedCount = transactions.filter(t => t.status === "COMPLETED" || t.status === "verified").length;
  const totalRevenue  = transactions.filter(t => t.status === "COMPLETED" || t.status === "verified").reduce((a, t) => a + t.amount, 0);
  const avgTrx        = transactions.length > 0 ? Math.round(transactions.reduce((a, t) => a + t.amount, 0) / transactions.length) : 0;
  const totalXP       = transactions
    .filter(t => t.status === "COMPLETED" || t.status === "verified")
    .reduce((a, t) => a + (t.potentialPoints ?? 0), 0); // XP issued in date range
  const recentTrx     = transactions.slice(0, 10);

  useEffect(() => {
    setSelectedTxDocPaths((prev) => prev.filter((p) => transactions.some((tx) => getTxDocPath(tx) === p)));
  }, [transactions]);

  const selectedRecentCount = recentTrx.reduce((count, trx) => {
    const p = getTxDocPath(trx);
    if (!p) return count;
    return selectedTxDocPaths.includes(p) ? count + 1 : count;
  }, 0);

  function toggleSelectTx(docPath: string, checked: boolean) {
    setSelectedTxDocPaths((prev) => {
      if (checked) {
        if (prev.includes(docPath)) return prev;
        return [...prev, docPath];
      }
      return prev.filter((p) => p !== docPath);
    });
  }

  async function deleteTransactions(docPaths: string[]) {
    const res = await fetch("/api/transactions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ docPaths }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message ?? "Failed to delete transactions");
    return data;
  }

  async function handleDeleteDashboard(docPaths: string[]) {
    if (!canDeleteTransactions || docPaths.length === 0) return;
    const confirmed = window.confirm(
      `Delete ${docPaths.length} transaction(s)? This action cannot be undone.`
    );
    if (!confirmed) return;

    setDeleteBusy(true);
    setDeleteMessage(null);
    try {
      const data = await deleteTransactions(docPaths);
      const deletedSet = new Set(docPaths);
      setTransactions((prev) => prev.filter((tx) => !deletedSet.has(getTxDocPath(tx))));
      setSelectedTxDocPaths((prev) => prev.filter((p) => !deletedSet.has(p)));
      setDeleteMessage(`Deleted ${data.successCount ?? 0} transaction(s).`);
    } catch (e: any) {
      setDeleteMessage(e.message ?? "Failed to delete transactions.");
    } finally {
      setDeleteBusy(false);
    }
  }

  const tierCounts = useMemo(() => ({
    Platinum: members.filter(m => m.tier === "Platinum").length,
    Gold:     members.filter(m => m.tier === "Gold").length,
    Silver:   members.filter(m => m.tier === "Silver").length,
  }), [members]);

  const overallStatus = txStatus === "live" && memberStatus === "live" ? "live"
    : txStatus === "error" || memberStatus === "error" ? "error" : "connecting";

  // Store transaction breakdown
  const storeStats = useMemo(() => {
    const map: Record<string, number> = {};
    transactions.forEach(t => { if (t.storeId) map[t.storeId] = (map[t.storeId] ?? 0) + 1; });
    const total = transactions.length || 1;
    return Object.entries(map)
      .map(([id, count]) => ({ name: id, pct: Math.round(count / total * 100) }))
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 4);
  }, [transactions]);

  const barColors = [C.blue, "#7C3AED", C.green, C.amber];

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1400, fontFamily: font, WebkitFontSmoothing: "antialiased" }}>

      {/* ── TOP BAR ── */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <p style={{ fontSize: 13, color: C.tx3, marginBottom: 4 }}>{dateStr}</p>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-.025em", color: C.tx1, lineHeight: 1.1, margin: 0 }}>
            {greeting}, {userName}! 👋
          </h1>
          <p style={{ fontSize: 14, color: C.tx2, marginTop: 5, display: "flex", alignItems: "center", gap: 10 }}>
            {isLimitedAccess ? (
              <>
                Your {initialRole === "cashier" ? "Cashier" : "Store Manager"} dashboard.
                <LiveBadge status={overallStatus}/>
              </>
            ) : (
              <>
                Here's what's happening at Gong Cha today.
                <LiveBadge status={overallStatus}/>
              </>
            )}
          </p>
        </div>
        <div style={{ display: "flex", flex: 1, justifyContent: "flex-end", gap: 10, alignItems: "center" }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <select
              value={mode}
              onChange={e => setMode(e.target.value as "realtime" | "range")}
              style={{ padding: "7px 14px", borderRadius: 8, border: "1.5px solid " + C.blueL, background: C.white, fontWeight: 600, color: C.tx1, fontSize: 13 }}
            >
              <option value="realtime">Real-time</option>
              <option value="range">Date Range</option>
            </select>
            {mode === "range" && (
              <>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                  style={{ padding: "7px 10px", borderRadius: 8, border: "1.5px solid " + C.border, background: C.white, fontSize: 13, color: C.tx1 }}
                />
                <span style={{ color: C.tx3, fontWeight: 600 }}>to</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                  style={{ padding: "7px 10px", borderRadius: 8, border: "1.5px solid " + C.border, background: C.white, fontSize: 13, color: C.tx1 }}
                />
              </>
            )}
            {/* Store Filter (Admin only) */}
            {!isLimitedAccess && stores.length > 0 && (
              <select
                value={selectedStoreId}
                onChange={e => setSelectedStoreId(e.target.value)}
                style={{ padding: "7px 14px", borderRadius: 8, border: "1.5px solid " + C.border, background: C.white, fontWeight: 600, color: C.tx1, fontSize: 13, minWidth: 150 }}
              >
                <option value="all">🏪 All Stores</option>
                {stores.map(store => (
                  <option key={store.uid || store.id} value={store.uid || store.id}>
                    {store.name}
                  </option>
                ))}
              </select>
            )}
            {mode === "realtime" && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, background: C.white, border: "1.5px solid " + C.border, borderRadius: 10, padding: "8px 16px", boxShadow: C.shadow }}>
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke={C.tx3} strokeWidth={2}>
                  <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
                </svg>
                <span style={{ fontSize: 13, fontWeight: 600, color: C.tx1 }}>Real-time</span>
              </div>
            )}
          </div>
        </div>
        
      </div>

      {/* ── BENTO ROW 1: Conditional based on role ── */}
      {isLimitedAccess ? (
        // LIMITED ACCESS: Claims Needing Review (+ Revenue untuk SUPER_ADMIN)
        <div style={{ display: "grid", gridTemplateColumns: isSuperAdmin ? "1.5fr 1fr" : "1fr", gap: 14, marginBottom: 14 }}>
          {/* Hero — Revenue (SUPER_ADMIN only) */}
          {isSuperAdmin && <div style={{
            background: `linear-gradient(135deg, ${C.blue} 0%, ${C.blueD} 100%)`,
            border: "none", padding: "24px 26px", borderRadius: 18,
            boxShadow: "0 8px 32px rgba(67,97,238,.28)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "rgba(255,255,255,.65)" }}>
                Total Revenue
              </span>
              <div style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(255,255,255,.18)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}>
                  <path d="M7 17L17 7M17 7H7M17 7v10"/>
                </svg>
              </div>
            </div>
            <p style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-.025em", color: "#fff", lineHeight: 1, marginBottom: 14 }}>
              Rp {totalRevenue.toLocaleString("id-ID")}
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 9px", borderRadius: 99, fontSize: 11, fontWeight: 700, background: "rgba(18,183,106,.22)", color: "#6EE7B7" }}>
                ↑ COMPLETED only
              </span>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,.55)" }}>
                {verifiedCount} transactions {mode === "range" && dateFrom && dateTo ? "(filtered)" : ""}
              </span>
            </div>
          </div>}

          <StatCard
            label="Claims Needing Review" value={String(claimsNeedingReview)}
            trend={claimsNeedingReview > 0 ? -claimsNeedingReview : 0} trendLabel={`${pendingCount} pending • ${rejectedCount} rejected`}
            iconBg="#FEF3F2" iconColor="#F04438"
            borderOverride={claimsNeedingReview > 0 ? "1.5px solid #FEE2E2" : undefined}
            icon={<><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>}
          />
        </div>
      ) : (
        // FULL ACCESS: Stat cards (Revenue khusus SUPER_ADMIN)
        <div style={{ display: "grid", gridTemplateColumns: isSuperAdmin ? "1.35fr 1fr 1fr 1fr" : "repeat(3, 1fr)", gap: 14, marginBottom: 14 }}>
          {/* Hero — Revenue (SUPER_ADMIN only) */}
          {isSuperAdmin && <div style={{
            background: `linear-gradient(135deg, ${C.blue} 0%, ${C.blueD} 100%)`,
            border: "none", padding: "24px 26px", borderRadius: 18,
            boxShadow: "0 8px 32px rgba(67,97,238,.28)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "rgba(255,255,255,.65)" }}>
                Total Revenue
              </span>
              <div style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(255,255,255,.18)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}>
                  <path d="M7 17L17 7M17 7H7M17 7v10"/>
                </svg>
              </div>
            </div>
            <p style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-.025em", color: "#fff", lineHeight: 1, marginBottom: 14 }}>
              Rp {totalRevenue.toLocaleString("id-ID")}
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 9px", borderRadius: 99, fontSize: 11, fontWeight: 700, background: "rgba(18,183,106,.22)", color: "#6EE7B7" }}>
                ↑ COMPLETED only
              </span>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,.55)" }}>
                {verifiedCount} transactions {mode === "range" && dateFrom && dateTo ? "(filtered)" : ""}
              </span>
            </div>
          </div>}

          <StatCard
            label="Active Members" value={totalMembers.toLocaleString()}
            trend={5.1} trendLabel="All time"
            iconBg={C.blueL} iconColor={C.blue}
            icon={<><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></>}
          />
          <StatCard
            label="Total Stores" value={String(totalStores)}
            trend={0} trendLabel="All time"
            iconBg="#F3F0FF" iconColor="#7C3AED"
            icon={<path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>}
          />
          <StatCard
            label="Claims Needing Review" value={String(claimsNeedingReview)}
            trend={claimsNeedingReview > 0 ? -claimsNeedingReview : 0} trendLabel={`${pendingCount} pending • ${rejectedCount} rejected`}
            iconBg="#FEF3F2" iconColor="#F04438"
            borderOverride={claimsNeedingReview > 0 ? "1.5px solid #FEE2E2" : undefined}
            icon={<><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>}
          />
        </div>
      )}

      {/* ── BENTO ROW 2: 3 mini cards (Same for all roles) ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 20 }}>
        {[
          {
            label: mode === "range" && dateFrom && dateTo ? `Total XP (${dateFrom} - ${dateTo})` : "Total XP Issued", 
            iconBg: C.blueL, iconColor: C.blue,
            value: `${totalXP.toLocaleString("id-ID")} pts`,
            icon: <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>,
          },
          {
            label: mode === "range" && dateFrom && dateTo ? "Completed Transactions (filtered)" : "Completed Transactions", 
            iconBg: C.greenBg, iconColor: C.green,
            value: `${verifiedCount} / ${transactions.length}`,
            icon: <path d="M20 6L9 17l-5-5"/>,
          },
          {
            label: mode === "range" && dateFrom && dateTo ? "Avg. Transaction (filtered)" : "Avg. Transaction", 
            iconBg: C.amberBg, iconColor: C.amber,
            value: `Rp ${avgTrx.toLocaleString("id-ID")}`,
            icon: <><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></>,
          },
        ].map((s, i) => (
          <div key={i} style={{ ...card, padding: "18px 22px", display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 46, height: 46, borderRadius: 13, background: s.iconBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke={s.iconColor} strokeWidth={2}>{s.icon}</svg>
            </div>
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: C.tx3, marginBottom: 5 }}>{s.label}</p>
              <p style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-.02em", color: C.tx1, lineHeight: 1 }}>{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── BOTTOM: Table + Sidebar ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 310px", gap: 14 }}>

        {/* Transactions table */}
        <div style={{ ...card, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px 16px", borderBottom: `1px solid ${C.border2}` }}>
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: C.tx3, marginBottom: 3 }}>Activity</p>
              <h2 style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-.01em", color: C.tx1, margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
                Recent Transactions
                <LiveBadge status={txStatus}/>
              </h2>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {canDeleteTransactions && selectedTxDocPaths.length > 0 && (
                <button
                  onClick={() => handleDeleteDashboard(selectedTxDocPaths)}
                  disabled={deleteBusy}
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: C.red,
                    background: "#FFF5F5",
                    border: "1px solid #FCA5A5",
                    borderRadius: 8,
                    padding: "7px 12px",
                    cursor: deleteBusy ? "not-allowed" : "pointer",
                  }}
                >
                  {deleteBusy ? "Deleting…" : `🗑 Delete Selected (${selectedTxDocPaths.length})`}
                </button>
              )}
              <a href="/transactions" style={{ fontSize: 13, fontWeight: 600, color: C.blue, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 14px", borderRadius: 8, border: `1.5px solid ${C.blueL}`, background: C.blueL }}>
              View all
              <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path d="M7 17L17 7M17 7H7M17 7v10"/>
              </svg>
            </a>
            </div>
          </div>

          {deleteMessage && (
            <div style={{ padding: "10px 24px", fontSize: 12.5, color: deleteMessage.startsWith("Deleted") ? "#027A48" : C.red, borderBottom: `1px solid ${C.border2}`, background: deleteMessage.startsWith("Deleted") ? "#ECFDF3" : "#FEF3F2" }}>
              {deleteMessage}
            </div>
          )}

          {recentTrx.length === 0 ? (
            <div style={{ padding: "52px 24px", textAlign: "center", color: C.tx3, fontSize: 13.5 }}>
              {txStatus === "connecting" ? "Loading transactions…" : "No transactions yet."}
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#F8F9FC" }}>
                  {[canDeleteTransactions && "Select", "Transaction ID", "Type", "Member", "Amount", !isLimitedAccess && "Store", "Status", "Date", canDeleteTransactions && "Action"]
                    .filter(Boolean)
                    .map(h => (
                      <th key={h as string} style={{ padding: "10px 20px", textAlign: "left", fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: C.tx3, borderBottom: `1px solid ${C.border2}` }}>{h}</th>
                    ))}
                </tr>
              </thead>
              <tbody>
                {recentTrx.map((trx, i) => (
                  <tr key={trx.docId ?? trx.transactionId ?? String(i)} style={{ borderBottom: i < recentTrx.length - 1 ? `1px solid ${C.border2}` : "none" }}>
                    {canDeleteTransactions && (
                      <td style={{ padding: "14px 20px" }}>
                        <input
                          type="checkbox"
                          checked={selectedTxDocPaths.includes(getTxDocPath(trx))}
                          onChange={(e) => toggleSelectTx(getTxDocPath(trx), e.target.checked)}
                          disabled={!getTxDocPath(trx) || deleteBusy}
                          aria-label={`Select ${trx.transactionId || trx.docId || "transaction"}`}
                        />
                      </td>
                    )}
                    <td style={{ padding: "14px 20px" }}>
                      <code style={{ fontSize: 12, background: C.blueL, padding: "3px 9px", borderRadius: 6, color: C.blue, border: `1px solid rgba(67,97,238,.15)` }}>
                        {trx.transactionId || "—"}
                      </code>
                    </td>
                    <td style={{ padding: "14px 20px" }}>
                      <TransactionTypeBadge type={trx.type} />
                    </td>
                    <td style={{ padding: "14px 20px", fontSize: 13.5, fontWeight: 600, color: C.tx1 }}>{trx.memberName}</td>
                    <td style={{ padding: "14px 20px", fontSize: 14, fontWeight: 700, color: C.tx1 }}>
                      {trx.type === "redeem" ? (
                        <span style={{ color: "#7C3AED" }}>— (Redeem)</span>
                      ) : (
                        `Rp ${trx.amount.toLocaleString("id-ID")}`
                      )}
                    </td>
                    {!isLimitedAccess && (
                      <td style={{ padding: "14px 20px", fontSize: 12.5, fontWeight: 600, color: C.tx2 }}>
                        {trx.storeName || "—"}
                      </td>
                    )}
                    <td style={{ padding: "14px 20px" }}><StatusBadge status={trx.status}/></td>
                    <td style={{ padding: "14px 20px", fontSize: 12.5, color: C.tx3 }}>
                      {trx.createdAt ? new Date(trx.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                    </td>
                    {canDeleteTransactions && (
                      <td style={{ padding: "14px 20px" }}>
                        <button
                          onClick={() => handleDeleteDashboard([getTxDocPath(trx)].filter(Boolean))}
                          disabled={!getTxDocPath(trx) || deleteBusy}
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: C.red,
                            background: "#FFF5F5",
                            border: "1px solid #FCA5A5",
                            borderRadius: 7,
                            padding: "5px 10px",
                            cursor: (!getTxDocPath(trx) || deleteBusy) ? "not-allowed" : "pointer",
                          }}
                        >
                          🗑 Delete
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div style={{ padding: "12px 24px", borderTop: `1px solid ${C.border2}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: C.tx3 }}>
              Showing <strong style={{ color: C.tx2 }}>{recentTrx.length}</strong> most recent
            </span>
            {canDeleteTransactions && (
              <span style={{ fontSize: 12, color: C.tx3 }}>
                Selected <strong style={{ color: C.tx2 }}>{selectedRecentCount}</strong> in this table
              </span>
            )}
          </div>
        </div>

        {/* Right sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Top Stores — Only for Admin */}
          {!isLimitedAccess && (
            <div style={{ ...card, padding: "20px 22px" }}>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: C.tx3, marginBottom: 3 }}>Performance</p>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: C.tx1, marginBottom: 18, letterSpacing: "-.01em" }}>Top Stores</h2>
              {storeStats.length === 0 ? (
                <p style={{ fontSize: 13, color: C.tx3, textAlign: "center", padding: "20px 0" }}>Loading data…</p>
              ) : storeStats.map((s, i) => (
                <div key={s.name} style={{ marginBottom: i < storeStats.length - 1 ? 14 : 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: C.tx1 }}>{s.name}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: barColors[i] }}>{s.pct}%</span>
                  </div>
                  <div style={{ height: 5, borderRadius: 99, background: C.border2 }}>
                    <div style={{ height: "100%", borderRadius: 99, width: `${s.pct}%`, background: barColors[i], transition: "width .5s ease" }}/>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Tier Breakdown — Visible for all roles */}
          <div style={{ ...card, padding: "20px 22px" }}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: C.tx3, marginBottom: 3 }}>Members</p>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: C.tx1, marginBottom: 16, letterSpacing: "-.01em" }}>Tier Breakdown</h2>
            {[
              { label: "Platinum", color: "#5B21B6", bg: "#F3F0FF", ring: "#DDD6FE", count: tierCounts.Platinum },
              { label: "Gold",     color: "#92400E", bg: "#FFFBEB", ring: "#FDE68A", count: tierCounts.Gold     },
              { label: "Silver",   color: "#475569", bg: "#F8FAFC", ring: "#E2E8F0", count: tierCounts.Silver   },
            ].map((t, i) => {
              const pct = totalMembers > 0 ? Math.round(t.count / totalMembers * 100) : 0;
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 13px", borderRadius: 10, background: t.bg, border: `1px solid ${t.ring}`, marginBottom: i < 2 ? 8 : 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 7, height: 7, borderRadius: "50%", background: t.color }}/>
                    <span style={{ fontSize: 13, fontWeight: 600, color: t.color }}>{t.label}</span>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: t.color }}>{t.count.toLocaleString()}</span>
                    <span style={{ fontSize: 10.5, color: t.color, opacity: .6, marginLeft: 4 }}>{pct}%</span>
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      </div>
    </div>
  );
}