"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useMobileSidebar } from "@/components/layout/AdminShell";
import {
  collection, query, orderBy, onSnapshot, doc,
  where, limit,
} from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { useAuth } from "@/context/AuthContext";
import { DailyStat, dailyStatConverter } from "@/types/firestore";
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from "framer-motion";
import {
  Menu, LayoutDashboard, Clock, Receipt, BarChart2,
  SlidersHorizontal, ChevronDown, Calendar,
  CheckCircle2, XCircle, AlertCircle, ArrowUpRight,
  Activity, FileText, Zap, CreditCard, Users, Store,
} from "lucide-react";

// ── TYPES ──────────────────────────────────────────────────────────────────
interface DashboardProps {
  initialRole: string;
  initialTransactions: any[];
  initialUsers: any[];
  initialStores: any[];
}
type TxStatus = "PENDING" | "COMPLETED" | "CANCELLED" | "REFUNDED";
interface Transaction {
  docId?: string;
  docPath?: string;
  receiptNumber: string;
  memberName: string;
  amount: number;
  totalAmount?: number;
  potentialPoints?: number;
  type?: string;
  status: TxStatus;
  createdAt: string | null;
  storeId?: string;
  storeName?: string;
  userId?: string | null;
  memberId?: string | null;
}
interface Member    { uid: string; tier: string; currentPoints: number; lifetimePoints: number; }
interface StoreItem { uid?: string; id?: string; name: string; isActive: boolean; }

// ── HELPERS ────────────────────────────────────────────────────────────────
const fmt = (n: number) => "Rp\u00A0" + Math.round(n).toLocaleString("id-ID");

function normalizeStatus(s: unknown): TxStatus {
  switch (String(s ?? "").toUpperCase()) {
    case "COMPLETED": case "VERIFIED": return "COMPLETED";
    case "CANCELLED": case "REJECTED": return "CANCELLED";
    case "REFUNDED":                   return "REFUNDED";
    default:                           return "PENDING";
  }
}
function resolveStore(stores: StoreItem[], id?: string, fb?: string | null): string {
  if (fb) return fb;
  if (!id) return "—";
  return stores.find(s => s.uid === id || s.id === id)?.name ?? id;
}
function normTx(raw: any, stores: StoreItem[]): Transaction {
  const docId = raw.docId ?? raw.id;
  return {
    docId,
    docPath:         raw.docPath ?? (docId ? `transactions/${docId}` : undefined),
    receiptNumber:   String(raw.receiptNumber ?? raw.posTransactionId ?? raw.transactionId ?? ""),
    memberName:      raw.memberName ?? raw.userName ?? "—",
    amount:          Number(raw.totalAmount ?? raw.amount ?? 0),
    totalAmount:     Number(raw.totalAmount ?? raw.amount ?? 0),
    potentialPoints: Number(raw.potentialPoints ?? 0),
    type:            raw.type ?? "earn",
    status:          normalizeStatus(raw.status),
    createdAt:       raw.createdAt?.toDate?.()?.toISOString?.() ?? raw.createdAt ?? null,
    storeId:         String(raw.storeId ?? ""),
    storeName:       resolveStore(stores, String(raw.storeId ?? ""), raw.storeName ?? null),
    userId:          raw.userId ?? null,
    memberId:        raw.memberId ?? raw.userId ?? null,
  };
}
function todayStr() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}-${String(n.getDate()).padStart(2,"0")}`;
}
function asNumber(value: unknown, fallback = 0) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
function useCounter(target: number) {
  const [v, set] = useState(0);
  useEffect(() => {
    const c = animate(v, target, { duration: 0.5, ease: "easeOut", onUpdate: x => set(Math.round(x)) });
    return c.stop;
  }, [target]);
  return v;
}

// ── DESIGN TOKENS ──────────────────────────────────────────────────────────
const T = {
  bg:      "#F4F5F7",
  surface: "#FFFFFF",
  navy2:   "#1C2333",
  blue:    "#3B82F6",
  blueL:   "#EFF6FF",
  blueD:   "#1D4ED8",
  amber:   "#D97706",
  amberL:  "#FFFBEB",
  amberB:  "#FDE68A",
  red:     "#DC2626",
  redL:    "#FEF2F2",
  green:   "#059669",
  greenL:  "#ECFDF5",
  tx1:     "#111827",
  tx2:     "#374151",
  tx3:     "#6B7280",
  tx4:     "#9CA3AF",
  border:  "#F3F4F6",
  border2: "#E5E7EB",
  r12: 12, r16: 16,
} as const;

// ── STATUS CHIP ────────────────────────────────────────────────────────────
const chips: Record<string, { bg: string; color: string; label: string }> = {
  COMPLETED: { bg: T.greenL, color: T.green, label: "Verified"  },
  PENDING:   { bg: T.amberL, color: T.amber, label: "Pending"   },
  CANCELLED: { bg: T.redL,   color: T.red,   label: "Cancelled" },
  REFUNDED:  { bg: "#F9FAFB",color: T.tx3,   label: "Refunded"  },
};
const Chip = ({ status }: { status: string }) => {
  const c = chips[status] ?? chips.PENDING;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 7px", borderRadius: 99, background: c.bg, color: c.color, fontSize: 10, fontWeight: 700, letterSpacing: ".04em" }}>
      <span style={{ width: 4, height: 4, borderRadius: "50%", background: c.color, flexShrink: 0 }} />
      {c.label}
    </span>
  );
};

// ── FILTER SHEET ────────────────────────────────────────────────────────────
const FilterSheet = ({ open, onClose, mode, setMode, dateFrom, setDateFrom, dateTo, setDateTo, storeId, setStoreId, stores, isAdmin }: any) => (
  <AnimatePresence>
    {open && (
      <>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          style={{ position: "fixed", inset: 0, zIndex: 40, background: "rgba(0,0,0,.24)", backdropFilter: "blur(4px)" }}
          onClick={onClose} />
        <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
          transition={{ type: "spring", stiffness: 360, damping: 36 }}
          style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50, background: T.surface, borderRadius: "24px 24px 0 0", padding: "16px 20px 48px" }}
        >
          <div style={{ width: 36, height: 4, borderRadius: 99, background: T.border2, margin: "0 auto 20px" }} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <p style={{ fontSize: 15, fontWeight: 800, color: T.tx1 }}>Filters</p>
          </div>
          <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: ".16em", textTransform: "uppercase", color: T.tx4, marginBottom: 8 }}>Mode</p>
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            {[{ v: "realtime", label: "Real-time" }, { v: "range", label: "Date Range" }].map(({ v, label }) => (
              <button key={v} onClick={() => setMode(v)} style={{ flex: 1, padding: "10px", borderRadius: 12, border: `1.5px solid ${mode === v ? T.blue : T.border2}`, background: mode === v ? T.blueL : "#F9FAFB", color: mode === v ? T.blueD : T.tx3, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{label}</button>
            ))}
          </div>
          {mode === "range" && (
            <div style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: ".16em", textTransform: "uppercase", color: T.tx4, marginBottom: 8 }}>Date Range</p>
              <div style={{ display: "flex", gap: 8 }}>
                {[{ lbl: "From", val: dateFrom, set: setDateFrom }, { lbl: "To", val: dateTo, set: setDateTo }].map(({ lbl, val, set }) => (
                  <div key={lbl} style={{ flex: 1 }}>
                    <p style={{ fontSize: 10, color: T.tx4, fontWeight: 600, marginBottom: 4 }}>{lbl}</p>
                    <input type="date" value={val} onChange={e => set(e.target.value)} style={{ width: "100%", background: "#F9FAFB", border: `1px solid ${T.border2}`, borderRadius: 10, padding: "8px 10px", fontSize: 12, fontWeight: 500, color: T.tx1, boxSizing: "border-box" as const }} />
                  </div>
                ))}
              </div>
            </div>
          )}
          {isAdmin && stores.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: ".16em", textTransform: "uppercase", color: T.tx4, marginBottom: 8 }}>Store</p>
              <div style={{ position: "relative" }}>
                <select value={storeId} onChange={e => setStoreId(e.target.value)} style={{ width: "100%", appearance: "none" as const, background: "#F9FAFB", border: `1px solid ${T.border2}`, borderRadius: 10, padding: "10px 32px 10px 12px", fontSize: 12, fontWeight: 500, color: T.tx1 }}>
                  <option value="all">All Stores</option>
                  {stores.map((s: StoreItem) => <option key={s.uid ?? s.id} value={s.uid ?? s.id}>{s.name}</option>)}
                </select>
                <ChevronDown size={13} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: T.tx4, pointerEvents: "none" as const }} />
              </div>
            </div>
          )}
          <button onClick={onClose} style={{ width: "100%", padding: "14px", borderRadius: 14, border: "none", cursor: "pointer", background: T.navy2, color: "#fff", fontSize: 13, fontWeight: 800 }}>Apply</button>
        </motion.div>
      </>
    )}
  </AnimatePresence>
);

// ── QUEUE CARD ─────────────────────────────────────────────────────────────
const QueueCard = ({ tx, onApprove, onReject, idx }: { tx: any; onApprove: (tx: any) => Promise<void>; onReject: (tx: any) => Promise<void>; idx: number }) => {
  const [busy, setBusy] = useState(false);
  const x     = useMotionValue(0);
  const bg    = useTransform(x, [-120, 0, 120], ["#FFF1F2", T.surface, "#F0FDF4"]);
  const appOp = useTransform(x, [0, 60], [0, 1]);
  const rejOp = useTransform(x, [-60, 0], [1, 0]);
  const tilt  = useTransform(x, [-120, 120], [-1.5, 1.5]);
  const approve = async () => { setBusy(true); await onApprove(tx); };
  const reject  = async () => { setBusy(true); await onReject(tx); };
  const time = tx.createdAt?.toDate ? new Date(tx.createdAt.toDate()).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "—";

  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0, marginBottom: 0 }} transition={{ duration: 0.22, delay: idx * 0.05 }}
      style={{ position: "relative", marginBottom: 10, borderRadius: T.r16, overflow: "hidden" }}>
      <motion.div style={{ position: "absolute", inset: 0, background: bg, borderRadius: T.r16 }} />
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 18px", pointerEvents: "none" }}>
        <motion.div style={{ opacity: appOp, display: "flex", alignItems: "center", gap: 6, color: T.green }}><CheckCircle2 size={15} strokeWidth={2.5} /><span style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".08em" }}>APPROVE</span></motion.div>
        <motion.div style={{ opacity: rejOp, display: "flex", alignItems: "center", gap: 6, color: T.red }}><span style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".08em" }}>REJECT</span><XCircle size={15} strokeWidth={2.5} /></motion.div>
      </div>
      <motion.div drag={busy ? false : "x"} dragConstraints={{ left: 0, right: 0 }} dragElastic={0.08}
        style={{ x, rotateZ: tilt, position: "relative", zIndex: 1, background: T.surface, borderRadius: T.r16, border: `1px solid ${T.border}`, padding: "14px 14px 12px", cursor: busy ? "default" : "grab" }}
        onDragEnd={(_, { offset }) => { if (offset.x > 110) approve(); else if (offset.x < -110) reject(); else animate(x, 0, { type: "spring", stiffness: 500, damping: 38 }); }}>
        {busy ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "10px 0" }}>
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.9, ease: "linear" }}><Activity size={14} color={T.tx4} /></motion.div>
            <span style={{ fontSize: 11, fontWeight: 600, color: T.tx4, letterSpacing: ".08em", textTransform: "uppercase" }}>Processing</span>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 38, height: 38, borderRadius: "50%", background: T.blueL, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ color: T.blueD, fontSize: 13, fontWeight: 800 }}>{(tx.memberName || "?")[0].toUpperCase()}</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: T.tx1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tx.memberName || "Customer"}</p>
                <p style={{ fontSize: 10, color: T.tx4, marginTop: 2, display: "flex", alignItems: "center", gap: 3 }}><FileText size={9} />{tx.posTransactionId ?? tx.receiptNumber ?? "—"}</p>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 800, color: T.tx1 }}>{fmt(tx.totalAmount ?? tx.amount ?? 0)}</p>
                <p style={{ fontSize: 10, fontWeight: 700, color: T.green, marginTop: 2 }}>+{tx.potentialPoints ?? 0} pts</p>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10, paddingTop: 10, borderTop: `1px solid ${T.border}` }}>
              <span style={{ fontSize: 10, color: T.tx4 }}>{time}</span>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={reject} style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", borderRadius: 99, border: `1px solid ${T.border2}`, background: "transparent", fontSize: 10, fontWeight: 700, color: T.tx3, cursor: "pointer" }}><XCircle size={10} /> Reject</button>
                <button onClick={approve} style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", borderRadius: 99, border: "none", background: T.blue, fontSize: 10, fontWeight: 700, color: "#fff", cursor: "pointer" }}><CheckCircle2 size={10} /> Approve</button>
              </div>
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  );
};

// ── STAT CARD ──────────────────────────────────────────────────────────────
const StatCard = ({ label, value, valueColor, icon: Icon, iconBg, iconColor, badge, onClick, delay = 0 }: { label: string; value: string | number; valueColor?: string; icon: React.ElementType; iconBg: string; iconColor: string; badge?: string; onClick?: () => void; delay?: number }) => (
  <motion.button initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, delay }}
    onClick={onClick}
    style={{ display: "flex", flexDirection: "column", background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r16, padding: "14px", cursor: onClick ? "pointer" : "default", textAlign: "left", width: "100%" }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
      <div style={{ width: 30, height: 30, borderRadius: 9, background: iconBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon size={14} color={iconColor} strokeWidth={2.5} />
      </div>
      {badge && <span style={{ fontSize: 9, fontWeight: 800, padding: "2px 7px", borderRadius: 99, background: iconBg, color: iconColor, letterSpacing: ".04em" }}>{badge}</span>}
    </div>
    <p style={{ fontSize: 22, fontWeight: 900, color: valueColor ?? T.tx1, letterSpacing: "-.025em", lineHeight: 1 }}>{value}</p>
    <p style={{ fontSize: 9, fontWeight: 700, color: T.tx4, textTransform: "uppercase", letterSpacing: ".14em", marginTop: 6 }}>{label}</p>
  </motion.button>
);

// ── TABS CONFIG ────────────────────────────────────────────────────────────
type TabId = "overview" | "queue" | "transactions" | "analytics";
const TABS: { id: TabId; icon: React.ElementType; label: string }[] = [
  { id: "overview",     icon: LayoutDashboard, label: "Overview"     },
  { id: "queue",        icon: Clock,           label: "Queue"        },
  { id: "transactions", icon: CreditCard,      label: "Transactions" },
  { id: "analytics",    icon: BarChart2,       label: "Analytics"    },
];

// ── SHARED HEADER ──────────────────────────────────────────────────────────
// Reusable symmetric header used by both pages
const PageHeader = ({ left, title, subtitle, right }: { left: React.ReactNode; title: string; subtitle?: React.ReactNode; right: React.ReactNode }) => (
  <div style={{ flexShrink: 0, background: T.surface, borderBottom: `1px solid ${T.border}`, padding: `calc(env(safe-area-inset-top, 16px) + 16px) 16px 12px`, display: "flex", alignItems: "center", justifyContent: "space-between", zIndex: 30 }}>
    {/* Left slot — fixed 36px */}
    <div style={{ width: 36, flexShrink: 0 }}>{left}</div>
    {/* Center — flexible */}
    <div style={{ flex: 1, textAlign: "center", padding: "0 8px" }}>
      <p style={{ fontSize: 14, fontWeight: 800, color: T.tx1, letterSpacing: "-.01em", lineHeight: 1 }}>{title}</p>
      {subtitle && <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5, marginTop: 4 }}>{subtitle}</div>}
    </div>
    {/* Right slot — fixed 36px */}
    <div style={{ width: 36, flexShrink: 0, display: "flex", justifyContent: "flex-end" }}>{right}</div>
  </div>
);

// ── MAIN ───────────────────────────────────────────────────────────────────
export default function DashboardMobile({ initialRole, initialTransactions, initialUsers, initialStores }: DashboardProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { openDrawer } = useMobileSidebar();

  const role       = user?.role ?? (initialRole === "admin" ? "SUPER_ADMIN" : "STAFF");
  const isAdmin    = role === "SUPER_ADMIN";
  const assignedId = user?.assignedStoreId ?? null;
  const userName   = user?.name ?? user?.email?.split("@")[0] ?? "Admin";

  const [tab,        setTab]        = useState<TabId>("overview");
  const [stores,     setStores]     = useState<StoreItem[]>(initialStores);
  const [members,    setMembers]    = useState<Member[]>(initialUsers);
  const [allTx,      setAllTx]      = useState<Transaction[]>(() => initialTransactions.map(t => normTx(t, initialStores)));
  const [rawPending, setRawPending] = useState<any[]>([]);
  const [dailyStats, setDailyStats] = useState<DailyStat[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [filterOpen, setFilter]     = useState(false);
  const [mode,       setMode]       = useState<"realtime" | "range">("realtime");
  const [dfrom,      setDfrom]      = useState("");
  const [dto,        setDto]        = useState("");
  const [storeId,    setStoreId]    = useState("all");

  const effectiveStore = !isAdmin && assignedId ? assignedId : storeId;

  // Firestore
  useEffect(() => {
    const unTx = onSnapshot(query(collection(db, "transactions"), orderBy("createdAt", "desc"), limit(50)),
      snap => setAllTx(snap.docs.map(d => normTx({ docId: d.id, ...d.data() }, stores))), () => {});
    const unStore = onSnapshot(query(collection(db, "stores")),
      snap => setStores(snap.docs.map(d => ({ uid: d.id, ...d.data() } as StoreItem))), () => {});
    let unMem: (() => void) | null = null;
    if (isAdmin) unMem = onSnapshot(query(collection(db, "users")),
      snap => setMembers(snap.docs.map(d => ({ uid: d.id, ...d.data() } as Member))), () => {});
    const today = new Date(); today.setHours(0, 0, 0, 0);
    let pq = query(collection(db, "transactions"), where("createdAt", ">=", today), orderBy("createdAt", "desc"));
    if (!isAdmin && assignedId) pq = query(collection(db, "transactions"), where("storeId", "==", assignedId), where("createdAt", ">=", today), orderBy("createdAt", "desc"));
    const unPending = onSnapshot(pq, snap => { setRawPending(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false); }, () => setLoading(false));
    return () => { unTx(); unStore(); unMem?.(); unPending(); };
  }, [isAdmin, assignedId]);

  // Daily stats
  useEffect(() => {
    const today = todayStr();
    if (mode === "range") {
      if (!dfrom || !dto || dfrom > dto) { setDailyStats([]); return; }
      const cs: any[] = [where("date", ">=", dfrom), where("date", "<=", dto)];
      if (isAdmin) cs.push(effectiveStore === "all" ? where("type", "==", "GLOBAL") : where("storeId", "==", effectiveStore));
      else if (assignedId) cs.push(where("storeId", "==", assignedId));
      const u = onSnapshot(query(collection(db, "daily_stats").withConverter(dailyStatConverter), ...cs, orderBy("date", "asc")),
        snap => setDailyStats(snap.docs.map(d => d.data())), () => setDailyStats([]));
      return () => u();
    }
    const tid = isAdmin ? (effectiveStore === "all" ? `${today}_GLOBAL` : `${today}_${effectiveStore}`) : (assignedId ? `${today}_${assignedId}` : null);
    if (!tid) { setDailyStats([]); return; }
    const u = onSnapshot(doc(db, "daily_stats", tid).withConverter(dailyStatConverter),
      snap => setDailyStats(snap.exists() ? [snap.data()] : []), () => setDailyStats([]));
    return () => u();
  }, [mode, dfrom, dto, isAdmin, effectiveStore, assignedId]);

  // Derived
  const filteredTx = useMemo(() => effectiveStore === "all" ? allTx : allTx.filter(t => t.storeId === effectiveStore), [allTx, effectiveStore]);
  const pendingQueue = useMemo(() =>
    rawPending.filter(t => (t.type === "EARN" || t.type === "earn") && (t.status === "PENDING" || t.status === "pending"))
      .map(t => ({ ...t, potentialPoints: t.pointsEarned ?? t.potentialPoints ?? 0 }))
      .sort((a, b) => (a.createdAt?.toMillis?.() ?? 0) - (b.createdAt?.toMillis?.() ?? 0)), [rawPending]);

  const fallbackRevenue = useMemo(() => {
    const today = todayStr();
    return filteredTx.reduce((sum, tx) => {
      const createdDate = tx.createdAt ? tx.createdAt.slice(0, 10) : null;
      const inRange = mode === "range"
        ? Boolean(dfrom && dto && createdDate && createdDate >= dfrom && createdDate <= dto)
        : createdDate === today;
      if (!inRange) return sum;
      if (tx.status === "CANCELLED" || tx.status === "REFUNDED") return sum;
      return sum + asNumber(tx.amount ?? tx.totalAmount);
    }, 0);
  }, [filteredTx, mode, dfrom, dto]);

  const fallbackTransactionCount = useMemo(() => {
    const today = todayStr();
    return filteredTx.reduce((count, tx) => {
      const createdDate = tx.createdAt ? tx.createdAt.slice(0, 10) : null;
      const inRange = mode === "range"
        ? Boolean(dfrom && dto && createdDate && createdDate >= dfrom && createdDate <= dto)
        : createdDate === today;
      if (!inRange) return count;
      if (tx.status === "CANCELLED" || tx.status === "REFUNDED") return count;
      return count + 1;
    }, 0);
  }, [filteredTx, mode, dfrom, dto]);

  const revenueFromStats  = dailyStats.reduce((s, d) => s + asNumber(d.totalRevenue), 0);
  const totalTrxFromStats = dailyStats.reduce((s, d) => s + asNumber(d.totalTransactions), 0);
  const revenue           = revenueFromStats > 0 ? revenueFromStats : fallbackRevenue;
  const totalTrx          = totalTrxFromStats > 0 ? totalTrxFromStats : fallbackTransactionCount;
  const claimsCount = filteredTx.filter(t => t.status === "PENDING").length + filteredTx.filter(t => t.status === "CANCELLED").length;
  const totalXP     = filteredTx.filter(t => t.status === "COMPLETED").reduce((s, t) => s + (t.potentialPoints ?? 0), 0);
  const avgTrx      = filteredTx.length ? Math.round(filteredTx.reduce((s, t) => s + t.amount, 0) / filteredTx.length) : 0;
  const recentTrx   = filteredTx.slice(0, 10);
  const tierCounts  = useMemo(() => ({ Platinum: members.filter(m => m.tier === "Platinum").length, Gold: members.filter(m => m.tier === "Gold").length, Silver: members.filter(m => m.tier === "Silver").length }), [members]);
  const storePerf   = useMemo(() => {
    if (!dailyStats.length) return [];
    const safeStats = dailyStats.map(d => ({ ...d, totalRevenue: asNumber(d.totalRevenue) }));
    const max = Math.max(...safeStats.map(d => d.totalRevenue), 1);
    return [...safeStats].sort((a, b) => a.date.localeCompare(b.date)).slice(-5).map(d => ({ name: d.date, pct: Math.round((d.totalRevenue / max) * 100) }));
  }, [dailyStats]);

  const cRev     = useCounter(revenue);
  const cQueue   = useCounter(pendingQueue.length);
  const cClaims  = useCounter(claimsCount);
  const cMembers = useCounter(members.length);
  const cStores  = useCounter(stores.length);
  const cXP      = useCounter(totalXP);
  const cTrx     = useCounter(totalTrx);
  const cAvg     = useCounter(avgTrx);

  const handleApprove = async (tx: Transaction) => {
    try {
      const docPath = tx.docPath ?? (tx.docId ? `transactions/${tx.docId}` : "");
      if (!docPath) throw new Error("Missing transaction path.");
      const res = await fetch("/api/transactions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docPath, action: "verify" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Verification failed.");
    } catch (error: any) {
      alert(error?.message ?? "Verification failed. Check your connection.");
    }
  };
  const handleReject = async (tx: Transaction) => {
    try {
      const docPath = tx.docPath ?? (tx.docId ? `transactions/${tx.docId}` : "");
      if (!docPath) throw new Error("Missing transaction path.");
      const res = await fetch("/api/transactions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docPath, action: "reject" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Could not reject transaction.");
    } catch (error: any) {
      alert(error?.message ?? "Could not reject transaction.");
    }
  };

  const hr           = new Date().getHours();
  const greeting     = hr < 12 ? "Good morning" : hr < 17 ? "Good afternoon" : "Good evening";
  const filterActive = mode === "range" || storeId !== "all";
  const BAR_COLORS   = [T.blue, "#7C3AED", T.green, T.amber, "#EC4899"];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: T.bg, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', sans-serif", WebkitFontSmoothing: "antialiased", overflowX: "hidden" }}>

      <FilterSheet open={filterOpen} onClose={() => setFilter(false)} mode={mode} setMode={setMode} dateFrom={dfrom} setDateFrom={setDfrom} dateTo={dto} setDateTo={setDto} storeId={storeId} setStoreId={setStoreId} stores={stores} isAdmin={isAdmin} />

      {/* ── HEADER ── */}
      <PageHeader
        left={
          <button onClick={openDrawer} style={{ width: 36, height: 36, borderRadius: 11, border: `1px solid ${T.border2}`, background: T.surface, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <Menu size={18} color={T.tx1} strokeWidth={2} />
          </button>
        }
        title={`${greeting}, ${userName.split(" ")[0]}`}
        subtitle={
          <>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10B981", display: "block", animation: "livePulse 2s infinite" }} />
            <span style={{ fontSize: 9, fontWeight: 700, color: T.tx4, textTransform: "uppercase", letterSpacing: ".12em" }}>Live</span>
          </>
        }
        right={
          <button onClick={() => setFilter(true)} style={{ width: 36, height: 36, borderRadius: 11, border: `1px solid ${filterActive ? T.blue : T.border2}`, background: filterActive ? T.blueL : T.surface, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", position: "relative" }}>
            <SlidersHorizontal size={16} color={filterActive ? T.blue : T.tx3} strokeWidth={2} />
            {filterActive && <span style={{ position: "absolute", top: -3, right: -3, width: 8, height: 8, background: T.blue, borderRadius: "50%", border: `2px solid ${T.surface}` }} />}
          </button>
        }
      />

      {/* ── REVENUE HERO ── */}
      <button onClick={() => router.push("/transactions")}
        style={{ flexShrink: 0, width: "100%", padding: "14px 16px 16px", background: T.navy2, border: "none", cursor: "pointer", textAlign: "left" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
          <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: ".18em", textTransform: "uppercase", color: "rgba(255,255,255,.35)" }}>Total Revenue</p>
          <div style={{ width: 24, height: 24, borderRadius: 7, background: "rgba(255,255,255,.08)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ArrowUpRight size={12} color="rgba(255,255,255,.5)" />
          </div>
        </div>
        <p style={{ fontSize: 28, fontWeight: 900, color: "#fff", letterSpacing: "-.035em", lineHeight: 1 }}>{fmt(cRev)}</p>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
          <span style={{ fontSize: 9, fontWeight: 800, padding: "2px 8px", borderRadius: 99, background: "rgba(16,185,129,.18)", color: "#6EE7B7", border: "1px solid rgba(16,185,129,.25)" }}>↑ Verified only</span>
          <span style={{ fontSize: 10, color: "rgba(255,255,255,.25)" }}>{totalTrx} transactions</span>
          {(mode === "range" && dfrom && dto) && <span style={{ fontSize: 9, color: "rgba(255,255,255,.25)", display: "flex", alignItems: "center", gap: 3 }}><Calendar size={9} /> {dfrom} – {dto}</span>}
        </div>
      </button>

      {/* ── TAB CONTENT ── */}
      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}
            style={{ padding: "14px 14px 24px" }}>

            {/* OVERVIEW */}
            {tab === "overview" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <StatCard label="Queue" value={cQueue} valueColor={cQueue > 0 ? T.amber : undefined} icon={Clock} iconBg={cQueue > 0 ? T.amberL : "#F9FAFB"} iconColor={cQueue > 0 ? T.amber : T.tx3} badge={cQueue > 0 ? String(cQueue) : undefined} onClick={() => setTab("queue")} delay={0.04} />
                  <StatCard label="Needs Review" value={cClaims} valueColor={cClaims > 0 ? T.red : undefined} icon={AlertCircle} iconBg={cClaims > 0 ? T.redL : "#F9FAFB"} iconColor={cClaims > 0 ? T.red : T.tx3} onClick={() => router.push("/transactions")} delay={0.08} />
                  {isAdmin
                    ? <StatCard label="Members" value={cMembers.toLocaleString()} icon={Users} iconBg={T.blueL} iconColor={T.blue} onClick={() => router.push("/admin-users")} delay={0.12} />
                    : <StatCard label="XP Issued" value={`${cXP.toLocaleString()} pts`} icon={Zap} iconBg="#F5F3FF" iconColor="#7C3AED" onClick={() => router.push("/transactions")} delay={0.12} />}
                  {isAdmin
                    ? <StatCard label="Total Stores" value={cStores} icon={Store} iconBg={T.greenL} iconColor={T.green} onClick={() => router.push("/stores")} delay={0.16} />
                    : <StatCard label="Completed" value={filteredTx.filter(t => t.status === "COMPLETED").length} icon={CheckCircle2} iconBg={T.greenL} iconColor={T.green} delay={0.16} />}
                </div>
                {/* Recent Transactions */}
                <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r16, overflow: "hidden" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderBottom: `1px solid ${T.border}` }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: T.tx1 }}>Recent Transactions</p>
                    <button onClick={() => setTab("transactions")} style={{ fontSize: 10, fontWeight: 700, color: T.blue, background: "none", border: "none", cursor: "pointer" }}>See all</button>
                  </div>
                  {recentTrx.slice(0, 3).length === 0 ? (
                    <div style={{ padding: "20px 0", textAlign: "center" }}><p style={{ fontSize: 12, color: T.tx4 }}>No transactions yet</p></div>
                  ) : recentTrx.slice(0, 3).map((tx, i) => (
                    <div key={tx.docId ?? i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: i < 2 ? `1px solid ${T.border}` : "none" }}>
                      <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#F9FAFB", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: T.tx3 }}>{(tx.memberName || "?")[0].toUpperCase()}</span>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 12, fontWeight: 600, color: T.tx1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tx.memberName}</p>
                        <Chip status={tx.status} />
                      </div>
                      <p style={{ fontSize: 12, fontWeight: 800, color: T.tx1, flexShrink: 0 }}>
                        {tx.type === "redeem" ? <span style={{ color: "#7C3AED" }}>Redeem</span> : fmt(tx.amount)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* QUEUE */}
            {tab === "queue" && (
              <div>
                <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
                  style={{ display: "flex", alignItems: "center", gap: 10, background: T.blueL, border: `1px solid #BFDBFE`, borderRadius: 12, padding: "10px 12px", marginBottom: 12 }}>
                  <XCircle size={12} color={T.red} strokeWidth={2.5} />
                  <span style={{ fontSize: 10, fontWeight: 700, color: T.blueD }}>Swipe left to reject</span>
                  <span style={{ color: T.border2, fontSize: 10 }}>·</span>
                  <CheckCircle2 size={12} color={T.green} strokeWidth={2.5} />
                  <span style={{ fontSize: 10, fontWeight: 700, color: T.blueD }}>Swipe right to approve</span>
                </motion.div>
                {loading ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "48px 0", gap: 10 }}>
                    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}><Activity size={18} color={T.border2} /></motion.div>
                    <p style={{ fontSize: 10, fontWeight: 600, color: T.tx4, letterSpacing: ".1em", textTransform: "uppercase" }}>Loading</p>
                  </div>
                ) : (
                  <AnimatePresence mode="popLayout">
                    {pendingQueue.length > 0 ? (
                      <>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                          <p style={{ fontSize: 12, fontWeight: 700, color: T.tx1 }}>{pendingQueue.length} transaction{pendingQueue.length !== 1 ? "s" : ""} awaiting</p>
                          <span style={{ fontSize: 9, fontWeight: 800, padding: "2px 7px", borderRadius: 99, background: T.amberL, color: T.amber, border: `1px solid ${T.amberB}` }}>FIFO</span>
                        </div>
                        {pendingQueue.map((tx, i) => <QueueCard key={tx.id} tx={tx} idx={i} onApprove={handleApprove} onReject={handleReject} />)}
                      </>
                    ) : (
                      <motion.div key="empty" initial={{ opacity: 0, scale: .97 }} animate={{ opacity: 1, scale: 1 }}
                        style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "48px 0", background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r16 }}>
                        <div style={{ width: 44, height: 44, borderRadius: "50%", background: T.greenL, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
                          <CheckCircle2 size={22} color={T.green} strokeWidth={2} />
                        </div>
                        <p style={{ fontSize: 14, fontWeight: 700, color: T.tx1 }}>All clear</p>
                        <p style={{ fontSize: 11, color: T.tx4, marginTop: 4, textAlign: "center", padding: "0 24px" }}>No transactions awaiting verification.</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                )}
              </div>
            )}

            {/* TRANSACTIONS */}
            {tab === "transactions" && (
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: T.tx1 }}>Transaction History</p>
                  <button onClick={() => router.push("/transactions")} style={{ fontSize: 10, fontWeight: 700, color: T.blue, background: T.blueL, border: "none", borderRadius: 99, padding: "4px 10px", cursor: "pointer" }}>View all</button>
                </div>
                {(mode === "range" && dfrom && dto) && (
                  <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 10 }}>
                    <Calendar size={10} color={T.blue} />
                    <span style={{ fontSize: 10, fontWeight: 600, color: T.blue }}>{dfrom} – {dto}</span>
                  </div>
                )}
                <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r16, overflow: "hidden" }}>
                  {recentTrx.length === 0
                    ? <div style={{ padding: "40px 0", textAlign: "center" }}><p style={{ fontSize: 12, color: T.tx4 }}>No transactions found</p></div>
                    : recentTrx.map((tx, i) => {
                        const date = tx.createdAt ? new Date(tx.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—";
                        return (
                          <motion.div key={tx.docId ?? i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.025 }}
                            style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderBottom: i < recentTrx.length - 1 ? `1px solid ${T.border}` : "none" }}>
                            <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#F9FAFB", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                              <span style={{ fontSize: 11, fontWeight: 800, color: T.tx3 }}>{(tx.memberName || "?")[0].toUpperCase()}</span>
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontSize: 12, fontWeight: 600, color: T.tx1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tx.memberName}</p>
                              <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 3, flexWrap: "wrap" as const }}>
                                <Chip status={tx.status} />
                                {isAdmin && tx.storeName && <span style={{ fontSize: 9, color: T.tx4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 80 }}>{tx.storeName}</span>}
                              </div>
                            </div>
                            <div style={{ textAlign: "right", flexShrink: 0 }}>
                              <p style={{ fontSize: 12, fontWeight: 800, color: tx.type === "redeem" ? "#7C3AED" : T.tx1 }}>{tx.type === "redeem" ? "Redeem" : fmt(tx.amount)}</p>
                              <p style={{ fontSize: 9, color: T.tx4, marginTop: 2 }}>{date}</p>
                            </div>
                          </motion.div>
                        );
                      })}
                </div>
                <p style={{ fontSize: 10, color: T.tx4, textAlign: "center", marginTop: 8 }}>Showing {recentTrx.length} most recent</p>
              </div>
            )}

            {/* ANALYTICS */}
            {tab === "analytics" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                  {[
                    { label: mode === "range" && dfrom && dto ? "XP (range)" : "XP Issued",    value: `${cXP.toLocaleString()}`, sub: "pts", color: "#7C3AED", bg: "#F5F3FF" },
                    { label: mode === "range" && dfrom && dto ? "Trx (range)" : "Transactions", value: String(cTrx),              sub: "trx", color: T.green,   bg: T.greenL },
                    { label: mode === "range" && dfrom && dto ? "Avg (range)" : "Avg. Value",   value: `Rp ${cAvg.toLocaleString("id-ID")}`, sub: "", color: T.amber, bg: T.amberL },
                  ].map((k, i) => (
                    <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                      style={{ background: k.bg, borderRadius: T.r12, padding: "12px 10px" }}>
                      <p style={{ fontSize: 15, fontWeight: 900, color: k.color, letterSpacing: "-.02em", lineHeight: 1 }}>{k.value}<span style={{ fontSize: 10, fontWeight: 700, marginLeft: 2 }}>{k.sub}</span></p>
                      <p style={{ fontSize: 8, fontWeight: 800, color: k.color, opacity: .6, textTransform: "uppercase", letterSpacing: ".12em", marginTop: 5, lineHeight: 1.2 }}>{k.label}</p>
                    </motion.div>
                  ))}
                </div>
                {isAdmin && storePerf.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .1 }}
                    style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r16, padding: "14px" }}>
                    <p style={{ fontSize: 9, fontWeight: 700, color: T.tx4, textTransform: "uppercase", letterSpacing: ".14em", marginBottom: 4 }}>Performance</p>
                    <p style={{ fontSize: 13, fontWeight: 800, color: T.tx1, marginBottom: 14 }}>Store Breakdown</p>
                    {storePerf.map((s, i) => (
                      <div key={s.name} style={{ marginBottom: i < storePerf.length - 1 ? 12 : 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: T.tx2 }}>{s.name}</span>
                          <span style={{ fontSize: 11, fontWeight: 800, color: BAR_COLORS[i] }}>{s.pct}%</span>
                        </div>
                        <div style={{ height: 4, borderRadius: 99, background: T.border }}>
                          <motion.div initial={{ width: 0 }} animate={{ width: `${s.pct}%` }} transition={{ duration: 0.7, delay: 0.15 + i * 0.08, ease: "easeOut" }}
                            style={{ height: "100%", borderRadius: 99, background: BAR_COLORS[i] }} />
                        </div>
                      </div>
                    ))}
                  </motion.div>
                )}
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .15 }}
                  style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r16, padding: "14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                    <div>
                      <p style={{ fontSize: 9, fontWeight: 700, color: T.tx4, textTransform: "uppercase", letterSpacing: ".14em", marginBottom: 4 }}>Members</p>
                      <p style={{ fontSize: 13, fontWeight: 800, color: T.tx1 }}>Tier Breakdown</p>
                    </div>
                    {isAdmin && <button onClick={() => router.push("/admin-users")} style={{ fontSize: 10, fontWeight: 700, color: T.blue, background: T.blueL, border: "none", borderRadius: 99, padding: "4px 10px", cursor: "pointer" }}>View all</button>}
                  </div>
                  {[
                    { label: "Platinum", color: "#5B21B6", bg: "#F5F3FF", border: "#DDD6FE", count: tierCounts.Platinum },
                    { label: "Gold",     color: "#92400E", bg: "#FFFBEB", border: "#FDE68A", count: tierCounts.Gold     },
                    { label: "Silver",   color: "#475569", bg: "#F8FAFC", border: "#E2E8F0", count: tierCounts.Silver   },
                  ].map((t, i) => {
                    const pct = members.length ? Math.round(t.count / members.length * 100) : 0;
                    return (
                      <motion.div key={t.label} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: .2 + i * .06 }}
                        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 12px", borderRadius: 10, background: t.bg, border: `1px solid ${t.border}`, marginBottom: i < 2 ? 6 : 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ width: 7, height: 7, borderRadius: "50%", background: t.color, display: "block" }} />
                          <span style={{ fontSize: 13, fontWeight: 700, color: t.color }}>{t.label}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 60, height: 3, borderRadius: 99, background: "rgba(0,0,0,.06)", overflow: "hidden" }}>
                            <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6, delay: .3 + i * .08 }}
                              style={{ height: "100%", borderRadius: 99, background: t.color }} />
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 800, color: t.color }}>{t.count.toLocaleString()}</span>
                          <span style={{ fontSize: 10, color: t.color, opacity: .45 }}>{pct}%</span>
                        </div>
                      </motion.div>
                    );
                  })}
                </motion.div>
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── ISLAND TAB BAR ── */}
      <div style={{ flexShrink: 0, display: "flex", justifyContent: "center", padding: "8px 0 28px", background: T.bg }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4, background: T.navy2, borderRadius: 99, padding: "5px 6px", boxShadow: "0 8px 24px rgba(0,0,0,.22), 0 2px 8px rgba(0,0,0,.12)" }}>
          {TABS.map(({ id, icon: Icon, label }) => {
            const active    = tab === id;
            const hasBadge  = id === "queue" && pendingQueue.length > 0 && !active;
            return (
              <button key={id} onClick={() => setTab(id)}
                style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", gap: active ? 6 : 0, height: 36, padding: "0 14px", borderRadius: 99, border: "none", background: active ? T.blue : "transparent", cursor: "pointer", transition: "all .2s ease", overflow: "visible" }}>
                <Icon size={16} color={active ? "#fff" : "rgba(255,255,255,.4)"} strokeWidth={active ? 2.5 : 2} />
                {active && (
                  <motion.span initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: "auto" }}
                    style={{ fontSize: 11, fontWeight: 700, color: "#fff", whiteSpace: "nowrap", overflow: "hidden" }}>
                    {label}
                  </motion.span>
                )}
                {hasBadge && (
                  <span style={{ position: "absolute", top: 4, right: 8, minWidth: 14, height: 14, background: T.amber, borderRadius: 99, fontSize: 8, fontWeight: 900, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px", border: `2px solid ${T.navy2}` }}>
                    {pendingQueue.length > 9 ? "9+" : pendingQueue.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <style>{`@keyframes livePulse { 0%,100%{opacity:1} 50%{opacity:.35} }`}</style>
    </div>
  );
}
