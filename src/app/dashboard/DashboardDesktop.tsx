"use client";

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { GcButton, GcEmptyState, GcInput, GcModalShell, GcPage, GcPageHeader, GcPanel, GcSelect } from "@/components/ui/gc";
import {
  doc,
  collection, onSnapshot, query, orderBy, limit,
  where,
} from "firebase/firestore";
import { db } from "../../lib/firebaseClient";
import { DailyStat, dailyStatConverter } from "@/types/firestore";

// ── Types ─────────────────────────────────────────────────────────────────────
type TransactionStatus = "PENDING" | "COMPLETED" | "CANCELLED" | "REFUNDED";

interface Transaction {
  docId?: string;
  docPath?: string;
  receiptNumber: string;
  transactionId?: string;
  memberName: string;
  amount: number;
  potentialPoints?: number;
  type?: "earn" | "redeem"; // earn = purchase, redeem = voucher redemption
  status: TransactionStatus;
  createdAt: string | null;
  storeId?: string;
  storeName?: string; // store name to display
}

interface Member { uid: string; tier: string; currentPoints: number; lifetimePoints: number; }
interface Store  { uid?: string; id?: string; name: string; isActive: boolean; }

function normalizeTransactionStatus(status: unknown): TransactionStatus {
  switch (String(status ?? "").toUpperCase()) {
    case "COMPLETED":
    case "VERIFIED":
      return "COMPLETED";
    case "CANCELLED":
    case "REJECTED":
      return "CANCELLED";
    case "REFUNDED":
      return "REFUNDED";
    case "PENDING":
    default:
      return "PENDING";
  }
}

function resolveStoreName(stores: Store[], storeId?: string, fallbackName?: string | null): string {
  if (fallbackName) return fallbackName;
  if (!storeId) return "—";
  const store = stores.find((item) => item.uid === storeId || item.id === storeId);
  return store?.name || storeId;
}

function normalizeTransaction(raw: any, stores: Store[]): Transaction {
  const receiptNumber = String(raw.receiptNumber ?? raw.posTransactionId ?? raw.transactionId ?? "");
  const storeId = String(raw.storeId ?? "");
  const storeName = resolveStoreName(stores, storeId, raw.storeName ?? raw.storeLocation ?? null);
  return {
    docId: raw.docId ?? raw.id,
    docPath: raw.docPath ?? (raw.docId ? `transactions/${raw.docId}` : undefined),
    receiptNumber,
    transactionId: receiptNumber,
    memberName: raw.memberName ?? raw.userName ?? "—",
    amount: Number(raw.totalAmount ?? raw.amount ?? 0),
    potentialPoints: Number(raw.potentialPoints ?? 0),
    type: raw.type ?? "earn",
    status: normalizeTransactionStatus(raw.status),
    createdAt: raw.createdAt?.toDate?.()?.toISOString?.() ?? raw.createdAt ?? null,
    storeId,
    storeName,
  };
}

function getTodayString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function asNumber(value: unknown, fallback = 0): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  bg: '#F9FAFB', white: '#FFFFFF', border: '#E5E7EB', border2: '#F3F4F6',
  tx1: '#111827', tx2: '#374151', tx3: '#6B7280', tx4: '#9CA3AF',
  blue: '#3B82F6', blueL: '#DBEAFE', blueD: '#1D4ED8',
  green: '#059669', greenBg: '#D1FAE5',
  amber: '#D97706', amberBg: '#FEF3C7',
  red: '#DC2626', redBg: '#FEE2E2',
  shadow: '0 1px 3px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.04)',
  shadowMd: '0 4px 12px rgba(0,0,0,.10)',
} as const;

const font = "Inter, system-ui, sans-serif";
const monoFont = "ui-monospace, 'Cascadia Code', monospace";
const card: React.CSSProperties = {
  background: C.white, border: `1px solid ${C.border}`,
  borderRadius: 16, boxShadow: C.shadow,
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
    COMPLETED: { bg: "#ECFDF3", color: "#027A48", dot: "#12B76A" },
    PENDING:   { bg: "#FFFAEB", color: "#B54708", dot: "#F79009" },
    CANCELLED: { bg: "#FEF3F2", color: "#F04438", dot: "#F04438" },
    REFUNDED:  { bg: "#F2F4F7", color: "#667085", dot: "#667085" },
    verified:  { bg: "#ECFDF3", color: "#027A48", dot: "#12B76A" },
    pending:   { bg: "#FFFAEB", color: "#B54708", dot: "#F79009" },
    rejected:  { bg: "#FEF3F2", color: "#F04438", dot: "#F04438" },
  };
  const s = map[status] ?? map.PENDING;
  const labelMap: Record<string, string> = {
    COMPLETED: "Completed",
    PENDING: "Pending",
    CANCELLED: "Cancelled",
    REFUNDED: "Refunded",
    verified: "Verified",
    pending: "Pending",
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
      color: isRedeem ? "#5B21B6" : "#3B82F6",
      fontSize: 10, fontWeight: 700, letterSpacing: ".06em",
      textTransform: "uppercase",
    }}>
      {isRedeem ? "🎁 Redeem" : isEarn ? "💳 Purchase" : type}
    </span>
  );
}

function StatCard({ label, value, trend, trendLabel, iconBg, iconColor, icon, borderOverride, onClick }: {
  label: string; value: string; trend: number; trendLabel: string;
  iconBg: string; iconColor: string; icon: React.ReactNode; borderOverride?: string;
  onClick?: () => void;
}) {
  const clickable = typeof onClick === "function";
  return (
    <div
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (!clickable) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.();
        }
      }}
      className={clickable ? "gc-bento-clickable" : undefined}
      style={{ ...card, border: borderOverride ?? card.border, padding: "22px 24px", cursor: clickable ? "pointer" : "default" }}
      aria-label={clickable ? `${label} details` : undefined}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: C.tx3 }}>{label}</span>
        <div style={{ width: 32, height: 32, borderRadius: 9, background: iconBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke={iconColor} strokeWidth={2}>{icon}</svg>
        </div>
      </div>
      <p style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-.025em", color: C.tx1, lineHeight: 1, marginBottom: 10 }}>{value}</p>
      <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <TrendBadge value={trend}/>
        <span style={{ fontSize: 11.5, color: C.tx3 }}>{trendLabel}</span>
        </div>
        {clickable && <span style={{ fontSize: 11, color: C.blue, fontWeight: 700 }}>Open →</span>}
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
  const router = useRouter();
  const [mode, setMode] = useState<"realtime" | "range">("realtime");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedStoreId, setSelectedStoreId] = useState<string>("all"); // Store filter for admin
  const [stores, setStores] = useState<Store[]>(initialStores);
  const storesRef = useRef<Store[]>(initialStores);
  // Use initial data from server as default state
  const [allTransactions, setAllTransactions] = useState<Transaction[]>(() => initialTransactions.map((tx) => normalizeTransaction(tx, initialStores)));
  // Keep using state members for legacy logic to continue working
  const [members, setMembers] = useState<Member[]>(initialUsers);
  const [txStatus,     setTxStatus]     = useState<"connecting"|"live"|"error">("connecting");
  const [memberStatus, setMemberStatus] = useState<"connecting"|"live"|"error">("connecting");
  const [dailyStatStatus, setDailyStatStatus] = useState<"connecting"|"live"|"error">("connecting");
  const [dailyStatsDocs, setDailyStatsDocs] = useState<DailyStat[]>([]);
  const [selectedTxDocPaths, setSelectedTxDocPaths] = useState<string[]>([]);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState<string | null>(null);
  const [deleteConfirmPaths, setDeleteConfirmPaths] = useState<string[] | null>(null);

  // Greeting
  const { user } = useAuth();
  const now      = new Date();
  const hr       = now.getHours();
  const greeting = hr < 12 ? "Good morning" : hr < 17 ? "Good afternoon" : "Good evening";
  const dateStr  = now.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const userName = user?.name || user?.email?.split("@")[0] || "Admin";
  const role = user?.role ?? (initialRole === "admin" ? "SUPER_ADMIN" : "STAFF");
  const goTo = useCallback((path: string) => router.push(path), [router]);

  // Check if user has limited access (cashier or store_manager)
  const isLimitedAccess = role === "STAFF";
  const canDeleteTransactions = role === "SUPER_ADMIN";

  // Get assigned store ID for cashier/store manager
  const userAssignedStoreId = user?.assignedStoreId ?? null;

  useEffect(() => {
    if (role === "STAFF") {
      if (userAssignedStoreId && selectedStoreId !== userAssignedStoreId) {
        setSelectedStoreId(userAssignedStoreId);
      }
      return;
    }

    if (!selectedStoreId) {
      setSelectedStoreId("all");
    }
  }, [role, userAssignedStoreId, selectedStoreId]);
  
  // Determine effective store filter
  const effectiveStoreFilter = isLimitedAccess && userAssignedStoreId ? userAssignedStoreId : selectedStoreId;

  const transactions = useMemo(() => {
    if (!effectiveStoreFilter || effectiveStoreFilter === "all") return allTransactions;
    return allTransactions.filter((t) => t.storeId === effectiveStoreFilter);
  }, [allTransactions, effectiveStoreFilter]);

  const fallbackRevenueFromTransactions = useMemo(() => {
    const today = getTodayString();
    return transactions.reduce((sum, tx) => {
      const createdDate = tx.createdAt ? tx.createdAt.slice(0, 10) : null;
      const inRange = mode === "range"
        ? Boolean(dateFrom && dateTo && createdDate && createdDate >= dateFrom && createdDate <= dateTo)
        : createdDate === today;
      if (!inRange) return sum;
      if (tx.status === "CANCELLED" || tx.status === "REFUNDED") return sum;
      return sum + asNumber(tx.amount);
    }, 0);
  }, [transactions, mode, dateFrom, dateTo]);

  const fallbackTransactionCount = useMemo(() => {
    const today = getTodayString();
    return transactions.reduce((count, tx) => {
      const createdDate = tx.createdAt ? tx.createdAt.slice(0, 10) : null;
      const inRange = mode === "range"
        ? Boolean(dateFrom && dateTo && createdDate && createdDate >= dateFrom && createdDate <= dateTo)
        : createdDate === today;
      if (!inRange) return count;
      if (tx.status === "CANCELLED" || tx.status === "REFUNDED") return count;
      return count + 1;
    }, 0);
  }, [transactions, mode, dateFrom, dateTo]);

  useEffect(() => {
    storesRef.current = stores;
  }, [stores]);

  // Helper: resolve store name from storeId
  const getStoreName = (storeId?: string, fallbackName?: string | null) => resolveStoreName(stores, storeId, fallbackName);

  const getTxDocPath = (tx: any) => tx?.docPath ?? (tx?.docId ? `transactions/${tx.docId}` : "");

  // ── Daily Stat (The God Document) ─────────────────────────────────────────
  useEffect(() => {
    setDailyStatStatus("connecting");

    if (mode === "range") {
      if (!dateFrom || !dateTo || dateFrom > dateTo) {
        setDailyStatsDocs([]);
        setDailyStatStatus("live");
        return;
      }

      const baseRef = collection(db, "daily_stats").withConverter(dailyStatConverter);
      const constraints: Parameters<typeof query>[1][] = [
        where("date", ">=", dateFrom),
        where("date", "<=", dateTo),
      ];

      if (role === "SUPER_ADMIN") {
        if (selectedStoreId === "all") {
          constraints.push(where("type", "==", "GLOBAL"));
        } else {
          constraints.push(where("storeId", "==", selectedStoreId));
        }
      } else {
        if (!userAssignedStoreId) {
          setDailyStatsDocs([]);
          setDailyStatStatus("error");
          return;
        }
        constraints.push(where("storeId", "==", userAssignedStoreId));
      }

      const rangeQ = query(baseRef, ...constraints, orderBy("date", "asc"));
      const unsub = onSnapshot(
        rangeQ,
        (snap) => {
          setDailyStatsDocs(snap.docs.map((d) => d.data()));
          setDailyStatStatus("live");
        },
        (err: any) => {
          setDailyStatsDocs([]);
          // If staff cannot read daily_stats directly, avoid red status and continue with tx-based widgets.
          setDailyStatStatus(err?.code === "permission-denied" ? "live" : "error");
        }
      );
      return () => unsub();
    }

    const today = getTodayString();
    const targetId = role === "SUPER_ADMIN"
      ? (selectedStoreId === "all" ? `${today}_GLOBAL` : `${today}_${selectedStoreId}`)
      : (userAssignedStoreId ? `${today}_${userAssignedStoreId}` : null);

    if (!targetId) {
      setDailyStatsDocs([]);
      setDailyStatStatus("error");
      return;
    }

    const dailyRef = doc(db, "daily_stats", targetId).withConverter(dailyStatConverter);
    const unsub = onSnapshot(
      dailyRef,
      (snap) => {
        setDailyStatsDocs(snap.exists() ? [snap.data()] : []);
        setDailyStatStatus("live");
      },
      (err: any) => {
        setDailyStatsDocs([]);
        setDailyStatStatus(err?.code === "permission-denied" ? "live" : "error");
      }
    );

    return () => unsub();
  }, [mode, dateFrom, dateTo, role, userAssignedStoreId, selectedStoreId]);

  // ── Firestore listeners ──────────────────────────────────────────────────
  useEffect(() => {
    const loadTransactionsFallback = async () => {
      try {
        const res = await fetch("/api/transactions", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as any[];
        const txList = data.map((d) => normalizeTransaction(d, storesRef.current));
        setAllTransactions(txList);
        setTxStatus("live");
      } catch {
        setTxStatus("error");
      }
    };

    const txQ = query(collection(db, "transactions"), orderBy("createdAt", "desc"), limit(50));
    const unsubTx = onSnapshot(txQ,
      (snap) => {
        const txList = snap.docs.map((d) =>
          normalizeTransaction({ docId: d.id, docPath: d.ref.path, ...d.data() }, storesRef.current)
        );

        setAllTransactions(txList);
        setTxStatus("live");
      },
      (err: any) => {
        if (err?.code === "permission-denied") {
          void loadTransactionsFallback();
          return;
        }
        setTxStatus("error");
      },
    );

    let unsubMem: (() => void) | null = null;
    if (!isLimitedAccess) {
      const memQ = query(collection(db, "users"));
      unsubMem = onSnapshot(memQ,
        (snap) => {
          setMembers(snap.docs.map(d => ({ uid: d.id, ...d.data() } as Member)));
          setMemberStatus("live");
        },
        () => setMemberStatus("error"),
      );
    } else {
      // Staff dashboard does not need full members stream.
      setMemberStatus("live");
      setMembers([]);
    }

    // Stores
    const storeQ = query(collection(db, "stores"));
    const unsubStore = onSnapshot(storeQ,
      (snap) => {
        setStores(snap.docs.map(d => ({ uid: d.id, ...d.data() } as Store)));
      },
      (err) => {
        console.error("[stores] error:", err);
      }
    );

    return () => {
      unsubTx();
      if (unsubMem) unsubMem();
      unsubStore();
    };
  }, [isLimitedAccess]); // Keep listeners stable to avoid watch-stream churn

  // ── Derived stats ────────────────────────────────────────────────────────
  // ALL TIME (tidak terpengaruh date picker):
  const totalMembers  = members.length;
  const totalStores   = stores.length;
  const pendingCount  = allTransactions.filter((t) => t.status === "PENDING").length;
  const cancelledCount = allTransactions.filter((t) => t.status === "CANCELLED").length;
  const claimsNeedingReview = pendingCount + cancelledCount; // Pending + Cancelled
  
  // DAILY STATS (The God Document):
  const totalRevenueFromStats = dailyStatsDocs.reduce((sum, d) => sum + asNumber(d.totalRevenue), 0);
  const totalTransactionsFromStats = dailyStatsDocs.reduce((sum, d) => sum + asNumber(d.totalTransactions), 0);
  const totalRevenue = totalRevenueFromStats > 0 ? totalRevenueFromStats : fallbackRevenueFromTransactions;
  const totalTransactions = totalTransactionsFromStats > 0 ? totalTransactionsFromStats : fallbackTransactionCount;
  const verifiedCount = totalTransactions;

  // Additional visuals still rely on transaction stream:
  const avgTrx        = transactions.length > 0 ? Math.round(transactions.reduce((a, t) => a + t.amount, 0) / transactions.length) : 0;
  const totalXP       = transactions.filter((t) => t.status === "COMPLETED").reduce((a, t) => a + (t.potentialPoints ?? 0), 0); // XP issued in date range
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
    setDeleteBusy(true);
    setDeleteMessage(null);
    try {
      const data = await deleteTransactions(docPaths);
      const deletedSet = new Set(docPaths);
      setAllTransactions((prev) => prev.filter((tx) => !deletedSet.has(getTxDocPath(tx))));
      setSelectedTxDocPaths((prev) => prev.filter((p) => !deletedSet.has(p)));
      setDeleteMessage(`Deleted ${data.successCount ?? 0} transaction(s).`);
    } catch (e: any) {
      setDeleteMessage(e.message ?? "Failed to delete transactions.");
    } finally {
      setDeleteBusy(false);
      setDeleteConfirmPaths(null);
    }
  }

  const tierCounts = useMemo(() => ({
    Platinum: members.filter(m => m.tier === "Platinum").length,
    Gold:     members.filter(m => m.tier === "Gold").length,
    Silver:   members.filter(m => m.tier === "Silver").length,
  }), [members]);

  const overallStatus = txStatus === "live" && memberStatus === "live" && dailyStatStatus === "live" ? "live"
    : txStatus === "error" || memberStatus === "error" || dailyStatStatus === "error" ? "error" : "connecting";

  // Store transaction breakdown
  const storeStats = useMemo(() => {
    if (dailyStatsDocs.length === 0) return [];

    const source = dailyStatsDocs.length > 0
      ? dailyStatsDocs.map((d) => ({ date: d.date, totalRevenue: asNumber(d.totalRevenue) }))
      : [];
    const maxRevenue = Math.max(...source.map((d) => d.totalRevenue), 1);
    return [...source]
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-4)
      .map((d) => ({
        name: d.date,
        pct: Math.max(0, Math.round((d.totalRevenue / maxRevenue) * 100)),
      }));
  }, [dailyStatsDocs]);

  const barColors = [C.blue, "#7C3AED", C.green, C.amber];

  return (
    <GcPage style={{ background: C.bg }}>
      <style>{`
        .gc-bento-clickable {
          transition: transform .16s ease, box-shadow .16s ease, border-color .16s ease;
          will-change: transform;
        }
        .gc-bento-clickable:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 26px rgba(17,24,39,.10), 0 2px 6px rgba(17,24,39,.06);
          border-color: #BFDBFE !important;
        }
        .gc-bento-clickable:active {
          transform: translateY(0) scale(.995);
        }
        .gc-bento-clickable:focus-visible {
          outline: 0;
          box-shadow: 0 0 0 3px rgba(59,130,246,.22), 0 6px 20px rgba(17,24,39,.08);
          border-color: #93C5FD !important;
        }
      `}</style>

      {/* ── TOP BAR ── */}
      <GcPageHeader
        title={`${greeting}, ${userName}`}
        description={isLimitedAccess
          ? `Operations dashboard for ${initialRole === "cashier" ? "cashier" : "store manager"} focused on transactions and claims that need review.`
          : "Daily operations overview across stores, transactions, members, and claims that require action."}
        meta={
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", fontSize: 12.5, color: C.tx2 }}>
            <span>{dateStr}</span>
          </div>
        }
        actions={
          <>
            <div style={{ minWidth: 96, display: "inline-flex", justifyContent: "center" }}>
              <LiveBadge status={overallStatus} />
            </div>
            <div style={{ minWidth: 140 }}>
              <GcSelect value={mode} onChange={e => setMode(e.target.value as "realtime" | "range")}>
                <option value="realtime">Real-time</option>
                <option value="range">Date Range</option>
              </GcSelect>
            </div>
            {mode === "range" && (
              <>
                <div style={{ width: 154 }}>
                  <GcInput type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                </div>
                <div style={{ width: 154 }}>
                  <GcInput type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
                </div>
              </>
            )}
            {!isLimitedAccess && stores.length > 0 && (
              <div style={{ minWidth: 200 }}>
                <GcSelect value={selectedStoreId} onChange={e => setSelectedStoreId(e.target.value)}>
                  <option value="all">Semua Toko</option>
                  {stores.map(store => (
                    <option key={store.uid || store.id} value={store.uid || store.id}>
                      {store.name}
                    </option>
                  ))}
                </GcSelect>
              </div>
            )}
            {mode === "realtime" && (
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: C.white, border: "1px solid " + C.border, borderRadius: 10, padding: "8px 14px", boxShadow: C.shadow }}>
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke={C.tx3} strokeWidth={2}>
                  <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
                </svg>
                <span style={{ fontSize: 13, fontWeight: 600, color: C.tx1 }}>Real-time</span>
              </div>
            )}
          </>
        }
      />

      {/* ── BENTO ROW 1: Conditional based on role ── */}
      {isLimitedAccess ? (
        // LIMITED ACCESS: Only Revenue + Pending Claims (2 columns)
        <div className="gc-grid-dashboard-limited" style={{ marginBottom: 14 }}>
          {/* Hero — Revenue */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => goTo("/transactions")}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                goTo("/transactions");
              }
            }}
            className="gc-bento-clickable"
            aria-label="Open transactions overview"
            style={{
            background: `linear-gradient(135deg, ${C.blue} 0%, ${C.blueD} 100%)`,
            border: "none", padding: "24px 26px", borderRadius: 18,
            boxShadow: "0 8px 32px rgba(67,97,238,.28)",
            cursor: "pointer",
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
                ↑ Verified only
              </span>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,.55)" }}>
                {totalTransactions} transactions {mode === "range" && dateFrom && dateTo ? "(filtered)" : ""}
              </span>
            </div>
          </div>

          <StatCard
            label="Claims Needing Review" value={String(claimsNeedingReview)}
            trend={claimsNeedingReview > 0 ? -claimsNeedingReview : 0} trendLabel={`${pendingCount} pending • ${cancelledCount} cancelled`}
            iconBg="#FEF3F2" iconColor="#F04438"
            borderOverride={claimsNeedingReview > 0 ? "1.5px solid #FEE2E2" : undefined}
            onClick={() => goTo("/transactions")}
            icon={<><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>}
          />
        </div>
      ) : (
        // FULL ACCESS (ADMIN): All 4 stat cards
        <div className="gc-grid-dashboard-full" style={{ marginBottom: 14 }}>
          {/* Hero — Revenue */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => goTo("/transactions")}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                goTo("/transactions");
              }
            }}
            className="gc-bento-clickable"
            aria-label="Open transactions overview"
            style={{
            background: `linear-gradient(135deg, ${C.blue} 0%, ${C.blueD} 100%)`,
            border: "none", padding: "24px 26px", borderRadius: 18,
            boxShadow: "0 8px 32px rgba(67,97,238,.28)",
            cursor: "pointer",
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
                ↑ Verified only
              </span>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,.55)" }}>
                {totalTransactions} transactions {mode === "range" && dateFrom && dateTo ? "(filtered)" : ""}
              </span>
            </div>
          </div>

          <StatCard
            label="Active Members" value={totalMembers.toLocaleString()}
            trend={5.1} trendLabel="All time"
            iconBg={C.blueL} iconColor={C.blue}
            onClick={() => goTo("/admin-users")}
            icon={<><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></>}
          />
          <StatCard
            label="Total Stores" value={String(totalStores)}
            trend={0} trendLabel="All time"
            iconBg="#F3F0FF" iconColor="#7C3AED"
            onClick={() => goTo("/stores")}
            icon={<path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>}
          />
          <StatCard
            label="Claims Needing Review" value={String(claimsNeedingReview)}
            trend={claimsNeedingReview > 0 ? -claimsNeedingReview : 0} trendLabel={`${pendingCount} pending • ${cancelledCount} cancelled`}
            iconBg="#FEF3F2" iconColor="#F04438"
            borderOverride={claimsNeedingReview > 0 ? "1.5px solid #FEE2E2" : undefined}
            onClick={() => goTo("/transactions")}
            icon={<><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>}
          />
        </div>
      )}

      {/* ── BENTO ROW 2: 3 mini cards (Same for all roles) ── */}
      <div className="gc-grid-3" style={{ marginBottom: 20 }}>
        {[
          {
            label: mode === "range" && dateFrom && dateTo ? `Total XP (${dateFrom} - ${dateTo})` : "Total XP Issued", 
            iconBg: C.blueL, iconColor: C.blue,
            value: `${totalXP.toLocaleString("id-ID")} pts`,
            href: "/transactions",
            icon: <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>,
          },
          {
            label: mode === "range" && dateFrom && dateTo ? "Total Transactions (filtered)" : "Total Transactions", 
            iconBg: C.greenBg, iconColor: C.green,
            value: `${totalTransactions}`,
            href: "/transactions",
            icon: <path d="M20 6L9 17l-5-5"/>,
          },
          {
            label: mode === "range" && dateFrom && dateTo ? "Avg. Transaction (filtered)" : "Avg. Transaction", 
            iconBg: C.amberBg, iconColor: C.amber,
            value: `Rp ${avgTrx.toLocaleString("id-ID")}`,
            href: "/transactions",
            icon: <><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></>,
          },
        ].map((s, i) => (
          <div
            key={i}
            role="button"
            tabIndex={0}
            onClick={() => goTo(s.href)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                goTo(s.href);
              }
            }}
            className="gc-bento-clickable"
            style={{ ...card, padding: "18px 22px", display: "flex", alignItems: "center", gap: 16, cursor: "pointer" }}
          >
            <div style={{ width: 46, height: 46, borderRadius: 13, background: s.iconBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke={s.iconColor} strokeWidth={2}>{s.icon}</svg>
            </div>
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: C.tx3, marginBottom: 5 }}>{s.label}</p>
              <p style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-.02em", color: C.tx1, lineHeight: 1 }}>{s.value}</p>
              <p style={{ fontSize: 11, color: C.blue, marginTop: 6, fontWeight: 700 }}>Open details →</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── BOTTOM: Table + Sidebar ── */}
      <div className="gc-grid-sidebar">

        {/* Transactions table */}
        <GcPanel style={{ borderRadius: 18, overflow: "hidden" }}>
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
                <GcButton
                  variant="danger"
                  size="sm"
                  onClick={() => setDeleteConfirmPaths(selectedTxDocPaths)}
                  disabled={deleteBusy}
                >
                  {deleteBusy ? "Deleting…" : `🗑 Delete Selected (${selectedTxDocPaths.length})`}
                </GcButton>
              )}
              <a href="/transactions" style={{ fontSize: 12, fontWeight: 700, color: C.blue, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 12px", height: 32, borderRadius: 7, border: `1px solid ${C.blueL}`, background: C.blueL }}>
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
            <GcEmptyState
              title={txStatus === "connecting" ? "Loading transactions" : "No transactions yet"}
              description={txStatus === "connecting" ? "Realtime stream sedang menghubungkan data transaksi." : "Belum ada transaksi yang bisa ditampilkan di dashboard."}
              icon={txStatus === "connecting" ? "⏳" : "📭"}
            />
          ) : (
            <div className="gc-table-wrap">
            <table style={{ width: "100%", minWidth: 860, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: C.bg }}>
                  {[canDeleteTransactions && "Select", "Transaction ID", "Type", "Member", "Amount", !isLimitedAccess && "Store", "Status", "Date", canDeleteTransactions && "Action"]
                    .filter(Boolean)
                    .map(h => (
                      <th key={h as string} style={{ padding: "10px 20px", textAlign: "left", fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: C.tx3, borderBottom: `1px solid ${C.border2}` }}>{h}</th>
                    ))}
                </tr>
              </thead>
              <tbody>
                {recentTrx.map((trx, i) => (
                  <tr key={trx.docId ?? trx.receiptNumber ?? String(i)} style={{ borderBottom: i < recentTrx.length - 1 ? `1px solid ${C.border2}` : "none" }}>
                    {canDeleteTransactions && (
                      <td style={{ padding: "14px 20px" }}>
                        <input
                          type="checkbox"
                          checked={selectedTxDocPaths.includes(getTxDocPath(trx))}
                          onChange={(e) => toggleSelectTx(getTxDocPath(trx), e.target.checked)}
                          disabled={!getTxDocPath(trx) || deleteBusy}
                          aria-label={`Select ${trx.receiptNumber || trx.docId || "transaction"}`}
                        />
                      </td>
                    )}
                    <td style={{ padding: "14px 20px" }}>
                      <code style={{ fontSize: 12, fontFamily: monoFont, background: C.blueL, padding: "3px 9px", borderRadius: 6, color: C.blue, border: `1px solid rgba(67,97,238,.15)` }}>
                        {trx.receiptNumber || "—"}
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
                        <GcButton
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteConfirmPaths([getTxDocPath(trx)].filter(Boolean))}
                          disabled={!getTxDocPath(trx) || deleteBusy}
                        >
                          🗑 Delete
                        </GcButton>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
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
        </GcPanel>

        {/* Right sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Top Stores — Only for Admin */}
          {!isLimitedAccess && (
            <GcPanel style={{ padding: "20px 22px" }}>
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
            </GcPanel>
          )}

          {/* Tier Breakdown — Visible for all roles */}
          <GcPanel style={{ padding: "20px 22px" }}>
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
          </GcPanel>

        </div>
      </div>
      {deleteConfirmPaths && (
        <GcModalShell
          onClose={() => !deleteBusy && setDeleteConfirmPaths(null)}
          title={`Delete ${deleteConfirmPaths.length} transaction${deleteConfirmPaths.length > 1 ? "s" : ""}?`}
          eyebrow="Danger Zone"
          description="Transaksi yang dihapus dari dashboard akan hilang permanen dari koleksi transaksi. Aksi ini tidak bisa dibatalkan."
          maxWidth={460}
          footer={
            <>
              <GcButton variant="ghost" size="lg" onClick={() => setDeleteConfirmPaths(null)} disabled={deleteBusy}>
                Batal
              </GcButton>
              <GcButton variant="danger" size="lg" onClick={() => handleDeleteDashboard(deleteConfirmPaths)} loading={deleteBusy}>
                Hapus Transaksi
              </GcButton>
            </>
          }
        >
          <div style={{ paddingTop: 2, color: C.tx2, fontSize: 13, lineHeight: 1.6 }}>
            Dokumen terpilih: <strong>{deleteConfirmPaths.length}</strong>
          </div>
        </GcModalShell>
      )}
    </GcPage>
  );
}
