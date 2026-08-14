"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useMobileSidebar } from "@/components/layout/AdminShell";
import { useAuth } from "@/context/AuthContext";
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from "framer-motion";
import {
  Tx, TxStatus, fmtRp, fmtDate, getAmount, getReceiptNumber,
  getStoreLabel, getUserRef, parseCSV, extractPosData,
} from "./tx-helpers";
import { FastApiAdminGateway } from "@/lib/api/FastApiAdminGateway";
import {
  LayoutList, Clock, FileText, Upload,
  CheckCircle2, XCircle, Activity, Search, X, Menu,
  Download, RefreshCw, Trash2, ChevronRight, AlertCircle, Eye,
} from "lucide-react";

// ── DESIGN TOKENS (identical to DashboardMobile) ───────────────────────────
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
  redB:    "#FECACA",
  green:   "#059669",
  greenL:  "#ECFDF5",
  greenB:  "#6EE7B7",
  tx1:     "#111827",
  tx2:     "#374151",
  tx3:     "#6B7280",
  tx4:     "#9CA3AF",
  border:  "#F3F4F6",
  border2: "#E5E7EB",
  r12: 12, r16: 16,
} as const;

type SyncStatus   = "idle" | "loading" | "live" | "error";
type FilterStatus = "all" | "PENDING" | "COMPLETED" | "CANCELLED" | "REFUNDED";
type TabId        = "summary" | "queue" | "history" | "csv";
type CsvMatch     = { tx: Tx; posData: { receiptNumber: string; amount: number; date: string } };
type CsvMismatch  = CsvMatch & { reasons: string[] };

interface Props { initialTransactions?: Tx[]; initialRole: string; }

// ── STATUS CHIP ────────────────────────────────────────────────────────────
const CHIPS: Record<string, { bg: string; color: string; label: string }> = {
  COMPLETED: { bg: T.greenL,  color: T.green, label: "Verified"  },
  PENDING:   { bg: T.amberL,  color: T.amber, label: "Pending"   },
  CANCELLED: { bg: T.redL,    color: T.red,   label: "Cancelled" },
  REFUNDED:  { bg: "#F9FAFB", color: T.tx3,   label: "Refunded"  },
};
const Chip = ({ status }: { status: string }) => {
  const c = CHIPS[status] ?? CHIPS.PENDING;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 99, background: c.bg, color: c.color, fontSize: 10, fontWeight: 700, letterSpacing: ".04em" }}>
      <span style={{ width: 4, height: 4, borderRadius: "50%", background: c.color, flexShrink: 0 }} />
      {c.label}
    </span>
  );
};

// ── SHARED SYMMETRIC HEADER ────────────────────────────────────────────────
const PageHeader = ({ left, title, subtitle, right }: { left: React.ReactNode; title: string; subtitle?: React.ReactNode; right: React.ReactNode }) => (
  <div style={{ flexShrink: 0, background: T.surface, borderBottom: `1px solid ${T.border}`, padding: `calc(env(safe-area-inset-top, 16px) + 16px) 16px 12px`, display: "flex", alignItems: "center", justifyContent: "space-between", zIndex: 30 }}>
    <div style={{ width: 36, flexShrink: 0 }}>{left}</div>
    <div style={{ flex: 1, textAlign: "center", padding: "0 8px" }}>
      <p style={{ fontSize: 14, fontWeight: 800, color: T.tx1, letterSpacing: "-.01em", lineHeight: 1 }}>{title}</p>
      {subtitle && <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5, marginTop: 4 }}>{subtitle}</div>}
    </div>
    <div style={{ width: 36, flexShrink: 0, display: "flex", justifyContent: "flex-end" }}>{right}</div>
  </div>
);

// ── TOAST ──────────────────────────────────────────────────────────────────
const MToast = ({ msg, type, onDone }: { msg: string; type: "success" | "error"; onDone: () => void }) => {
  useEffect(() => { const t = setTimeout(onDone, 3500); return () => clearTimeout(t); }, [onDone]);
  return (
    <motion.div initial={{ opacity: 0, y: 16, scale: .96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: .96 }} transition={{ duration: .2 }}
      style={{ position: "fixed", bottom: 100, left: "50%", transform: "translateX(-50%)", zIndex: 9999, padding: "12px 18px", borderRadius: 14, background: type === "success" ? T.navy2 : T.red, color: "#fff", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 8, boxShadow: "0 8px 24px rgba(0,0,0,.24)", whiteSpace: "nowrap" as const }}>
      {type === "success" ? <CheckCircle2 size={14} strokeWidth={2.5} /> : <AlertCircle size={14} strokeWidth={2.5} />}
      {msg}
    </motion.div>
  );
};

// ── CONFIRM SHEET ──────────────────────────────────────────────────────────
const ConfirmSheet = ({ title, message, confirmLabel, danger, onConfirm, onClose, loading }: { title: string; message: string; confirmLabel: string; danger?: boolean; onConfirm: () => void; onClose: () => void; loading: boolean }) => (
  <AnimatePresence>
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,.32)", backdropFilter: "blur(4px)" }}
      onClick={() => !loading && onClose()} />
    <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 360, damping: 36 }}
      style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 61, background: T.surface, borderRadius: "24px 24px 0 0", padding: "16px 20px 48px" }}>
      <div style={{ width: 36, height: 4, borderRadius: 99, background: T.border2, margin: "0 auto 20px" }} />
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: danger ? T.redL : T.greenL, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
          {danger ? <AlertCircle size={18} color={T.red} strokeWidth={2} /> : <CheckCircle2 size={18} color={T.green} strokeWidth={2} />}
        </div>
        <div>
          <p style={{ fontSize: 15, fontWeight: 800, color: T.tx1, marginBottom: 4 }}>{title}</p>
          <p style={{ fontSize: 13, color: T.tx3, lineHeight: 1.5 }}>{message}</p>
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
        <button onClick={onClose} disabled={loading} style={{ flex: 1, padding: 14, borderRadius: 14, border: `1px solid ${T.border2}`, background: "transparent", fontSize: 13, fontWeight: 700, color: T.tx2, cursor: "pointer" }}>Cancel</button>
        <button onClick={onConfirm} disabled={loading} style={{ flex: 2, padding: 14, borderRadius: 14, border: "none", background: danger ? T.red : T.green, fontSize: 13, fontWeight: 800, color: "#fff", cursor: loading ? "default" : "pointer", opacity: loading ? .7 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          {loading ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: .9, ease: "linear" }}><Activity size={14} color="#fff" /></motion.div> : null}
          {loading ? "Processing…" : confirmLabel}
        </button>
      </div>
    </motion.div>
  </AnimatePresence>
);

// ── REVIEW SHEET ───────────────────────────────────────────────────────────
const ReviewSheet = ({ tx, onApprove, onConfirmReject, onClose, loading }: {
  tx: Tx; onApprove: () => void; onConfirmReject: () => void; onClose: () => void; loading: boolean;
}) => {
  const reasons = tx.reason ? tx.reason.split(" | ") : [];
  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,.32)", backdropFilter: "blur(4px)" }}
        onClick={() => !loading && onClose()} />
      <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 360, damping: 36 }}
        style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 61, background: T.surface, borderRadius: "24px 24px 0 0", padding: "16px 20px 48px", maxHeight: "80dvh", overflowY: "auto" }}>
        <div style={{ width: 36, height: 4, borderRadius: 99, background: T.border2, margin: "0 auto 20px" }} />

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: T.amberL, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Eye size={18} color={T.amber} strokeWidth={2} />
          </div>
          <div>
            <p style={{ fontSize: 15, fontWeight: 800, color: T.tx1, marginBottom: 2 }}>Manual Review</p>
            <p style={{ fontSize: 12, color: T.tx3 }}>{tx.memberName} · {getReceiptNumber(tx) || tx.docId}</p>
          </div>
        </div>

        {/* TX details */}
        <div style={{ background: T.bg, borderRadius: 12, padding: "12px 14px", marginBottom: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {[
            { label: "Amount",  value: fmtRp(getAmount(tx)) },
            { label: "Points",  value: `${tx.potentialPoints ?? 0} pts` },
            { label: "Store",   value: getStoreLabel(tx) !== "-" ? getStoreLabel(tx) : "—" },
            { label: "Date",    value: fmtDate(tx.createdAt) },
          ].map(({ label, value }) => (
            <div key={label}>
              <p style={{ fontSize: 9, fontWeight: 700, color: T.tx4, textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 2 }}>{label}</p>
              <p style={{ fontSize: 12, fontWeight: 700, color: T.tx1 }}>{value}</p>
            </div>
          ))}
        </div>

        {/* Rejection reason */}
        {reasons.length > 0 && (
          <div style={{ background: T.redL, border: `1px solid ${T.redB}`, borderRadius: 10, padding: "10px 12px", marginBottom: 12 }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: T.red, marginBottom: 4 }}>Rejection reason</p>
            {reasons.map((r, i) => (
              <p key={i} style={{ fontSize: 12, color: T.red, lineHeight: 1.5 }}>· {r}</p>
            ))}
          </div>
        )}

        {/* Warning */}
        <div style={{ background: T.amberL, border: `1px solid ${T.amberB}`, borderRadius: 10, padding: "8px 12px", marginBottom: 16, display: "flex", alignItems: "flex-start", gap: 8 }}>
          <AlertCircle size={13} color={T.amber} style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 11, color: T.amber, lineHeight: 1.4 }}>One-time review only — cannot be changed after this action.</p>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} disabled={loading}
            style={{ flex: 1, padding: 13, borderRadius: 12, border: `1px solid ${T.border2}`, background: "transparent", fontSize: 13, fontWeight: 700, color: T.tx2, cursor: "pointer" }}>
            Cancel
          </button>
          <button onClick={onConfirmReject} disabled={loading}
            style={{ flex: 1, padding: 13, borderRadius: 12, border: "none", background: T.redL, fontSize: 12, fontWeight: 800, color: T.red, cursor: loading ? "default" : "pointer", opacity: loading ? .7 : 1 }}>
            Keep Rejected
          </button>
          <button onClick={onApprove} disabled={loading}
            style={{ flex: 2, padding: 13, borderRadius: 12, border: "none", background: T.green, fontSize: 13, fontWeight: 800, color: "#fff", cursor: loading ? "default" : "pointer", opacity: loading ? .7 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            {loading
              ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: .9, ease: "linear" }}><Activity size={13} color="#fff" /></motion.div>
              : <CheckCircle2 size={13} strokeWidth={2.5} />}
            {loading ? "Processing…" : "Approve"}
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

// ── QUEUE CARD ─────────────────────────────────────────────────────────────
const QueueCard = ({ tx, onVerify, onReject, loadingId, isAdmin, onDelete }: { tx: Tx; onVerify: (tx: Tx) => void; onReject: (tx: Tx) => void; loadingId: string | null; isAdmin: boolean; onDelete?: (tx: Tx) => void }) => {
  const busy   = loadingId === tx.docId;
  const x      = useMotionValue(0);
  const bg     = useTransform(x, [-120, 0, 120], ["#FFF1F2", T.surface, "#F0FDF4"]);
  const appOp  = useTransform(x, [0, 60], [0, 1]);
  const rejOp  = useTransform(x, [-60, 0], [1, 0]);
  const tilt   = useTransform(x, [-120, 120], [-1.5, 1.5]);
  const amount = getAmount(tx);
  const store  = getStoreLabel(tx);

  return (
    <div style={{ position: "relative", marginBottom: 10, borderRadius: T.r16, overflow: "hidden" }}>
      <motion.div style={{ position: "absolute", inset: 0, background: bg, borderRadius: T.r16 }} />
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 18px", pointerEvents: "none" }}>
        <motion.div style={{ opacity: appOp, display: "flex", alignItems: "center", gap: 6, color: T.green }}><CheckCircle2 size={15} strokeWidth={2.5} /><span style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".08em" }}>APPROVE</span></motion.div>
        <motion.div style={{ opacity: rejOp, display: "flex", alignItems: "center", gap: 6, color: T.red }}><span style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".08em" }}>REJECT</span><XCircle size={15} strokeWidth={2.5} /></motion.div>
      </div>
      <motion.div drag={busy ? false : "x"} dragConstraints={{ left: 0, right: 0 }} dragElastic={0.08}
        style={{ x, rotateZ: tilt, position: "relative", zIndex: 1, background: T.surface, borderRadius: T.r16, border: `1px solid ${T.border}`, padding: "14px 14px 12px", cursor: busy ? "default" : "grab" }}
        onDragEnd={(_, { offset }) => { if (offset.x > 110) onVerify(tx); else if (offset.x < -110) onReject(tx); else animate(x, 0, { type: "spring", stiffness: 500, damping: 38 }); }}>
        {busy ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "10px 0" }}>
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: .9, ease: "linear" }}><Activity size={14} color={T.tx4} /></motion.div>
            <span style={{ fontSize: 11, fontWeight: 600, color: T.tx4, letterSpacing: ".08em", textTransform: "uppercase" }}>Processing</span>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 38, height: 38, borderRadius: "50%", background: T.blueL, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ color: T.blueD, fontSize: 13, fontWeight: 800 }}>{(tx.memberName || "?")[0].toUpperCase()}</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: T.tx1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tx.memberName}</p>
                <p style={{ fontSize: 10, color: T.tx4, marginTop: 2, display: "flex", alignItems: "center", gap: 3 }}>
                  <FileText size={9} />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 120 }}>{getReceiptNumber(tx) || "—"}</span>
                  {store !== "-" && <><span>·</span><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 80 }}>{store}</span></>}
                </p>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 800, color: T.tx1 }}>{fmtRp(amount)}</p>
                <p style={{ fontSize: 10, fontWeight: 700, color: T.green, marginTop: 2 }}>+{tx.potentialPoints ?? 0} pts</p>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10, paddingTop: 10, borderTop: `1px solid ${T.border}` }}>
              <span style={{ fontSize: 10, color: T.tx4 }}>{fmtDate(tx.createdAt)}</span>
              <div style={{ display: "flex", gap: 6 }}>
                {isAdmin && onDelete && (
                  <button onClick={() => onDelete(tx)} style={{ width: 28, height: 28, borderRadius: 8, border: `1px solid ${T.border2}`, background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                    <Trash2 size={11} color={T.tx4} />
                  </button>
                )}
                <button onClick={() => onReject(tx)} style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", borderRadius: 99, border: `1px solid ${T.border2}`, background: "transparent", fontSize: 10, fontWeight: 700, color: T.tx3, cursor: "pointer" }}><XCircle size={10} /> Reject</button>
                <button onClick={() => onVerify(tx)} style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", borderRadius: 99, border: "none", background: T.blue, fontSize: 10, fontWeight: 700, color: "#fff", cursor: "pointer" }}><CheckCircle2 size={10} /> Verify</button>
              </div>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
};

// ── MAIN ───────────────────────────────────────────────────────────────────
export default function TransactionsMobile({ initialTransactions = [], initialRole }: Props) {
  const { user, can }   = useAuth();
  const { openDrawer }  = useMobileSidebar();
  const isAdmin         = can("transaction.delete") || initialRole === "admin" || initialRole === "SUPER_ADMIN";

  const [tab,           setTab]           = useState<TabId>("summary");
  const [txs,           setTxs]           = useState<Tx[]>(initialTransactions);
  const [syncStatus,    setSync]          = useState<SyncStatus>("idle");
  const [loadingId,     setLoadingId]     = useState<string | null>(null);
  const [search,        setSearch]        = useState("");
  const [filterSt,      setFilterSt]      = useState<FilterStatus>("all");
  const [toast,         setToast]         = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [confirm,       setConfirm]       = useState<{ title: string; message: string; confirmLabel: string; danger?: boolean; onConfirm: () => Promise<void> } | null>(null);
  const [confirmBusy,   setConfirmBusy]   = useState(false);
  const [searchOpen,    setSearchOpen]    = useState(false);
  const [csvFile,       setCsvFile]       = useState("");
  const [csvMatched,    setCsvMatched]    = useState<CsvMatch[]>([]);
  const [csvMismatched, setCsvMismatched] = useState<CsvMismatch[]>([]);
  const [csvUnmatched,  setCsvUnmatched]  = useState(0);
  const [csvLoading,    setCsvLoading]    = useState(false);
  const [reviewTx,      setReviewTx]      = useState<Tx | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const showToast = useCallback((msg: string, type: "success" | "error" = "success") => setToast({ msg, type }), []);

  // Fetch
  const fetchTxs = useCallback(async () => {
    setSync("loading");
    try {
      const fetchedTxs = await FastApiAdminGateway.getTransactions();
      setTxs(fetchedTxs.map((t: any) => ({
        docId: t.id,
        docPath: `transactions/${t.id}`,
        id: t.id,
        transactionId: t.id,
        receiptNumber: t.external_order_id,
        storeId: t.source_system,
        storeName: t.source_system,
        totalAmount: (t.total_minor || 0) / 100,
        amount: (t.total_minor || 0) / 100,
        memberId: t.member_id,
        userId: t.member_id,
        memberName: t.member_id ? `Member ${t.member_id.substring(0, 8)}` : "Guest",
        status: t.status,
        createdAt: t.occurred_at,
      } as any)));
      setSync("live");
    } catch (e: any) { setSync("error"); showToast(e.message ?? "Failed to load", "error"); }
  }, [showToast]);

  useEffect(() => { fetchTxs(); }, [fetchTxs]);

  // Derived
  const pending   = useMemo(() => txs.filter(t => t.status === "PENDING"),   [txs]);
  const completed = useMemo(() => txs.filter(t => t.status === "COMPLETED"), [txs]);
  const cancelled = useMemo(() => txs.filter(t => t.status === "CANCELLED"), [txs]);
  const refunded  = useMemo(() => txs.filter(t => t.status === "REFUNDED"),  [txs]);
  const totalPts  = useMemo(() => pending.reduce((a, t) => a + (t.potentialPoints ?? 0), 0), [pending]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return txs.filter(tx => {
      const ms = !q || tx.memberName.toLowerCase().includes(q) || getReceiptNumber(tx).toLowerCase().includes(q) || getStoreLabel(tx).toLowerCase().includes(q);
      return ms && (filterSt === "all" || tx.status === filterSt);
    });
  }, [txs, search, filterSt]);

  // Actions
  async function deleteApi(docPaths: string[]) {
    const res = await fetch("/api/transactions", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docPaths }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message ?? "Delete failed");
    return data;
  }

  async function handleAction(tx: Tx, action: "verify" | "reject") {
    setLoadingId(tx.docId);
    try {
      const res = await fetch("/api/transactions", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docPath: tx.docPath, action }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Failed");
      showToast(action === "verify" ? `Verified! Released ${tx.potentialPoints ?? 0} pending pts for ${tx.memberName}` : "Transaction rejected.", action === "verify" ? "success" : "error");
      const newStatus: TxStatus = action === "verify" ? "COMPLETED" : "CANCELLED";
      setTxs(prev => prev.map(t => t.docPath === tx.docPath
        ? { ...t, status: newStatus, ...(action === "verify" ? { verifiedAt: new Date().toISOString() } : {}) }
        : t));
    } catch (e: any) { showToast(e.message ?? "Failed", "error"); }
    finally { setLoadingId(null); }
  }

  function askVerifyAll() {
    if (!pending.length) return;
    const pendingSnapshot = [...pending];
    setConfirm({
      title: "Verify All Pending?",
      message: `Verify ${pending.length} transactions and release ${totalPts.toLocaleString("id")} pending pts to members. This cannot be undone.`,
      confirmLabel: `Verify ${pending.length} Transactions`,
      onConfirm: async () => {
        const res = await fetch("/api/transactions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docPaths: pendingSnapshot.map(t => t.docPath), action: "verify" }) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message ?? "Failed");
        showToast(`${data.successCount} transactions verified and pending points released!`);
        const paths = new Set(pendingSnapshot.map(t => t.docPath));
        const now = new Date().toISOString();
        setTxs(prev => prev.map(t => paths.has(t.docPath) ? { ...t, status: "COMPLETED" as TxStatus, verifiedAt: now } : t));
      },
    });
  }

  function askDelete(tx: Tx) {
    setConfirm({
      title: "Delete Transaction?",
      message: `${getReceiptNumber(tx) || tx.docId} will be permanently deleted.`,
      confirmLabel: "Delete",
      danger: true,
      onConfirm: async () => {
        const data = await deleteApi([tx.docPath]);
        if (!data.successCount) throw new Error("Not deleted.");
        showToast("Transaction deleted.");
        setTxs(prev => prev.filter(t => t.docPath !== tx.docPath));
      },
    });
  }

  async function handleManualReview(action: "approve" | "confirm_reject") {
    if (!reviewTx) return;
    setReviewLoading(true);
    try {
      const res = await fetch("/api/transactions/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docPath: reviewTx.docPath, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Review failed");
      showToast(action === "approve" ? "Transaction approved!" : "Rejection confirmed.");
      setTxs(prev => prev.map(t => t.docPath === reviewTx.docPath
        ? {
            ...t,
            status: (action === "approve" ? "COMPLETED" : "CANCELLED") as TxStatus,
            manualReviewDone: true,
            ...(action === "approve" ? { verifiedAt: new Date().toISOString() } : {}),
          }
        : t));
      setReviewTx(null);
    } catch (e: any) { showToast(e.message ?? "Review failed", "error"); }
    finally { setReviewLoading(false); }
  }

  async function runConfirm() {
    if (!confirm) return;
    setConfirmBusy(true);
    try { await confirm.onConfirm(); setConfirm(null); }
    catch (e: any) { showToast(e.message ?? "Failed", "error"); }
    finally { setConfirmBusy(false); }
  }

  // CSV
  function processCSV(file: File) {
    if (!file.name.endsWith(".csv")) { showToast("File must be .csv", "error"); return; }
    setCsvFile(file.name);
    const reader = new FileReader();
    reader.onload = e => {
      const rows = parseCSV(e.target?.result as string);
      const matched: CsvMatch[] = [];
      const mismatched: CsvMismatch[] = [];
      let unmatched = 0;
      rows.forEach(row => {
        const posData = extractPosData(row);
        if (!posData) { unmatched++; return; }
        const found = pending.find(tx => getReceiptNumber(tx).toLowerCase() === posData.receiptNumber.toLowerCase());
        if (!found) { unmatched++; return; }
        const reasons: string[] = [];
        const txAmount = getAmount(found);
        if (Math.abs(txAmount - posData.amount) > 0.01) reasons.push(`Amount: DB ${fmtRp(txAmount)} vs POS ${fmtRp(posData.amount)}`);
        const txDate = found.createdAt ? found.createdAt.slice(0, 10) : null;
        if (txDate && txDate !== posData.date) reasons.push(`Date: DB ${txDate} vs POS ${posData.date}`);
        if (reasons.length > 0) {
          mismatched.push({ tx: found, posData, reasons });
        } else {
          matched.push({ tx: found, posData });
        }
      });
      setCsvMatched(matched);
      setCsvMismatched(mismatched);
      setCsvUnmatched(unmatched);
    };
    reader.readAsText(file);
  }

  async function runCsvVerify() {
    const allItems = [...csvMatched, ...csvMismatched];
    if (!allItems.length) return;
    setCsvLoading(true); let ok = 0, bad = 0;
    for (const { posData } of allItems) {
      try {
        const res = await fetch("/api/transactions/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ receiptNumber: posData.receiptNumber, posAmount: posData.amount, posDate: posData.date }) });
        const data = await res.json();
        if (res.ok && data.status === "COMPLETED") ok++; else bad++;
      } catch { bad++; }
    }
    setCsvLoading(false);
    const msg = csvMismatched.length > 0
      ? `${ok} verified, ${bad} flagged — mismatched auto-rejected, review in history`
      : `${ok} verified, ${bad} flagged for review`;
    showToast(msg, ok > 0 ? "success" : "error");
    setCsvFile(""); setCsvMatched([]); setCsvMismatched([]); setCsvUnmatched(0);
    await fetchTxs();
  }

  function handleExport() {
    const headers = ["docId","receiptNumber","memberName","userId","storeName","totalAmount","potentialPoints","status","createdAt","verifiedAt"];
    const rows = filtered.map(tx => [tx.docId, getReceiptNumber(tx), tx.memberName, getUserRef(tx), getStoreLabel(tx), getAmount(tx), tx.potentialPoints ?? 0, tx.status, tx.createdAt ?? "", tx.verifiedAt ?? ""]);
    const url = URL.createObjectURL(new Blob([[headers, ...rows].map(r => r.join(",")).join("\n")], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = `transactions_${new Date().toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(url);
  }

  const syncDot   = { idle: T.tx4, loading: T.amber, live: T.green, error: T.red }[syncStatus];
  const syncLabel = { idle: "Idle", loading: "Loading", live: "Live", error: "Error" }[syncStatus];

  const TABS: { id: TabId; icon: React.ElementType; label: string; badge?: number }[] = [
    { id: "summary", icon: LayoutList, label: "Summary" },
    { id: "queue",   icon: Clock,      label: "Queue",   badge: pending.length },
    { id: "history", icon: FileText,   label: "History" },
    { id: "csv",     icon: Upload,     label: "CSV"      },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: T.bg, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', sans-serif", WebkitFontSmoothing: "antialiased", overflowX: "hidden" }}>

      {/* ── HEADER ── */}
      <PageHeader
        left={
          <button onClick={openDrawer} style={{ width: 36, height: 36, borderRadius: 11, border: `1px solid ${T.border2}`, background: T.surface, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <Menu size={18} color={T.tx1} strokeWidth={2} />
          </button>
        }
        title="Transactions"
        subtitle={
          <>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: syncDot, display: "block" }} />
            <span style={{ fontSize: 9, fontWeight: 700, color: T.tx4, textTransform: "uppercase", letterSpacing: ".12em" }}>{syncLabel}</span>
          </>
        }
        right={
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => setSearchOpen(v => !v)} style={{ width: 36, height: 36, borderRadius: 11, border: `1px solid ${searchOpen ? T.blue : T.border2}`, background: searchOpen ? T.blueL : T.surface, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              <Search size={15} color={searchOpen ? T.blue : T.tx3} strokeWidth={2} />
            </button>
          </div>
        }
      />

      {/* ── SEARCH BAR ── */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: .18 }}
            style={{ flexShrink: 0, background: T.surface, borderBottom: `1px solid ${T.border}`, overflow: "hidden" }}>
            <div style={{ padding: "8px 14px", display: "flex", alignItems: "center", gap: 8 }}>
              <Search size={14} color={T.tx4} strokeWidth={2} style={{ flexShrink: 0 }} />
              <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Search member, receipt, store…" style={{ flex: 1, border: "none", background: "transparent", outline: "none", fontSize: 13, color: T.tx1 }} />
              {search && <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}><X size={14} color={T.tx4} /></button>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── CONTENT ── */}
      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: .18 }}
            style={{ padding: "14px 14px 24px" }}>

            {/* SUMMARY */}
            {tab === "summary" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {[
                    { label: "Pending",   count: pending.length,   color: T.amber, bg: T.amberL, border: T.amberB,  sub: `${totalPts.toLocaleString("id")} pts on hold` },
                    { label: "Verified",  count: completed.length, color: T.green, bg: T.greenL, border: T.greenB,  sub: "completed" },
                    { label: "Cancelled", count: cancelled.length, color: T.red,   bg: T.redL,   border: T.redB,    sub: "rejected / cancelled" },
                    { label: "Refunded",  count: refunded.length,  color: T.tx3,   bg: "#F9FAFB", border: T.border2, sub: "refunded" },
                  ].map((s, i) => (
                    <motion.div key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * .05 }}
                      style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r16, padding: "14px" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                        <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: ".14em", textTransform: "uppercase", color: T.tx4 }}>{s.label}</span>
                        <span style={{ fontSize: 9, fontWeight: 800, padding: "2px 7px", borderRadius: 99, background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>{s.label}</span>
                      </div>
                      <p style={{ fontSize: 28, fontWeight: 900, color: s.color, letterSpacing: "-.03em", lineHeight: 1 }}>{s.count}</p>
                      <p style={{ fontSize: 10, color: T.tx4, marginTop: 5 }}>{s.sub}</p>
                    </motion.div>
                  ))}
                </div>
                {/* Total dark card */}
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .2 }}
                  style={{ background: T.navy2, borderRadius: T.r16, padding: "16px" }}>
                  <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: ".18em", textTransform: "uppercase", color: "rgba(255,255,255,.35)", marginBottom: 8 }}>Total Records</p>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <p style={{ fontSize: 30, fontWeight: 900, color: "#fff", letterSpacing: "-.03em", lineHeight: 1 }}>{txs.length}</p>
                    <span style={{ fontSize: 12, color: "rgba(255,255,255,.4)" }}>transactions</span>
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    <button onClick={() => setTab("queue")} style={{ flex: 1, padding: "8px 0", borderRadius: 10, border: "none", background: pending.length > 0 ? T.amber : "rgba(255,255,255,.08)", color: pending.length > 0 ? "#fff" : "rgba(255,255,255,.5)", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>{pending.length} Pending</button>
                    <button onClick={() => setTab("history")} style={{ flex: 1, padding: "8px 0", borderRadius: 10, border: "none", background: "rgba(255,255,255,.08)", color: "rgba(255,255,255,.6)", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>View History</button>
                    <button onClick={handleExport} style={{ flex: 1, padding: "8px 0", borderRadius: 10, border: "none", background: "rgba(255,255,255,.08)", color: "rgba(255,255,255,.6)", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Export CSV</button>
                  </div>
                </motion.div>
                {/* Quick pending list */}
                {pending.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .25 }}
                    style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r16, overflow: "hidden" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderBottom: `1px solid ${T.border}` }}>
                      <p style={{ fontSize: 12, fontWeight: 700, color: T.tx1 }}>Needs Attention</p>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <button onClick={askVerifyAll} style={{ fontSize: 10, fontWeight: 700, color: T.green, background: T.greenL, border: "none", borderRadius: 99, padding: "4px 10px", cursor: "pointer" }}>Verify All</button>
                        <button onClick={() => setTab("queue")} style={{ fontSize: 10, fontWeight: 700, color: T.blue, background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 2 }}>See all <ChevronRight size={11} /></button>
                      </div>
                    </div>
                    {pending.slice(0, 3).map((tx, i) => (
                      <div key={tx.docId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: i < Math.min(pending.length, 3) - 1 ? `1px solid ${T.border}` : "none" }}>
                        <div style={{ width: 32, height: 32, borderRadius: "50%", background: T.amberL, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <span style={{ fontSize: 11, fontWeight: 800, color: T.amber }}>{(tx.memberName || "?")[0].toUpperCase()}</span>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 12, fontWeight: 600, color: T.tx1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tx.memberName}</p>
                          <p style={{ fontSize: 10, color: T.tx4, marginTop: 1 }}>{fmtRp(getAmount(tx))} · +{tx.potentialPoints ?? 0} pts</p>
                        </div>
                        <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
                          <button onClick={() => handleAction(tx, "reject")} disabled={loadingId === tx.docId} style={{ width: 26, height: 26, borderRadius: 8, border: `1px solid ${T.redB}`, background: T.redL, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><XCircle size={11} color={T.red} /></button>
                          <button onClick={() => handleAction(tx, "verify")} disabled={loadingId === tx.docId} style={{ width: 26, height: 26, borderRadius: 8, border: "none", background: T.blue, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><CheckCircle2 size={11} color="#fff" /></button>
                        </div>
                      </div>
                    ))}
                  </motion.div>
                )}
              </div>
            )}

            {/* QUEUE */}
            {tab === "queue" && (
              <div>
                <div style={{ background: T.blueL, border: `1px solid #BFDBFE`, borderRadius: T.r16, padding: 16, marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                    <span style={{ fontSize: 18 }}>⚡</span>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: T.blueD }}>Real-Time ESB Active</p>
                  </div>
                  <p style={{ margin: 0, fontSize: 11, color: T.tx2, lineHeight: 1.4 }}>
                    Transactions are verified automatically in real-time at the POS. Manual queue verification is disabled.
                  </p>
                </div>
              </div>
            )}

            {/* HISTORY */}
            {tab === "history" && (
              <div>
                <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, marginBottom: 10 }}>
                  {(["all", "PENDING", "COMPLETED", "CANCELLED", "REFUNDED"] as FilterStatus[]).map(f => {
                    const counts: Record<string, number> = { all: txs.length, PENDING: pending.length, COMPLETED: completed.length, CANCELLED: cancelled.length, REFUNDED: refunded.length };
                    const active = filterSt === f;
                    return (
                      <button key={f} onClick={() => setFilterSt(f)} style={{ flexShrink: 0, padding: "5px 12px", borderRadius: 99, border: `1.5px solid ${active ? T.blue : T.border2}`, background: active ? T.blueL : T.surface, color: active ? T.blueD : T.tx3, fontSize: 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" as const }}>
                        {f === "all" ? "All" : f.charAt(0) + f.slice(1).toLowerCase()} ({counts[f]})
                      </button>
                    );
                  })}
                </div>
                {search && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, padding: "6px 10px", background: T.blueL, borderRadius: 8 }}>
                    <Search size={11} color={T.blue} />
                    <span style={{ fontSize: 11, color: T.blueD, fontWeight: 600 }}>"{search}"</span>
                    <span style={{ fontSize: 11, color: T.tx4 }}>— {filtered.length} results</span>
                    <button onClick={() => setSearch("")} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", padding: 0 }}><X size={11} color={T.tx4} /></button>
                  </div>
                )}
                <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r16, overflow: "hidden" }}>
                  {filtered.length === 0 ? (
                    <div style={{ padding: "40px 0", textAlign: "center" }}><p style={{ fontSize: 12, color: T.tx4 }}>{search ? `No results for "${search}"` : "No transactions found"}</p></div>
                  ) : filtered.map((tx, i) => {
                    const canReview = tx.status === "CANCELLED" && tx.needsManualReview && !tx.manualReviewDone;
                    const reviewed  = tx.status === "CANCELLED" && tx.manualReviewDone;
                    return (
                      <motion.div key={tx.docId} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * .02 }}
                        style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderBottom: i < filtered.length - 1 ? `1px solid ${T.border}` : "none" }}>
                        <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#F9FAFB", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <span style={{ fontSize: 11, fontWeight: 800, color: T.tx3 }}>{(tx.memberName || "?")[0].toUpperCase()}</span>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 12, fontWeight: 600, color: T.tx1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tx.memberName}</p>
                          <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 3, flexWrap: "wrap" as const }}>
                            <Chip status={tx.status} />
                            <span style={{ fontSize: 9, color: T.tx4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 80 }}>{getStoreLabel(tx) !== "-" ? getStoreLabel(tx) : getReceiptNumber(tx)}</span>
                          </div>
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <p style={{ fontSize: 12, fontWeight: 800, color: tx.type === "redeem" ? "#7C3AED" : T.tx1 }}>{tx.type === "redeem" ? "Redeem" : fmtRp(getAmount(tx))}</p>
                          <p style={{ fontSize: 9, color: T.tx4, marginTop: 2 }}>{fmtDate(tx.createdAt)}</p>
                        </div>
                        {/* Action buttons */}
                        {isAdmin && tx.status === "PENDING" && (
                          <button onClick={() => askDelete(tx)} style={{ width: 26, height: 26, borderRadius: 8, border: `1px solid ${T.border2}`, background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
                            <Trash2 size={11} color={T.tx4} />
                          </button>
                        )}
                        {canReview && (
                          <button onClick={() => setReviewTx(tx)}
                            style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 4, padding: "5px 8px", borderRadius: 8, border: `1px solid ${T.amberB}`, background: T.amberL, cursor: "pointer" }}>
                            <Eye size={11} color={T.amber} />
                            <span style={{ fontSize: 10, fontWeight: 700, color: T.amber }}>Review</span>
                          </button>
                        )}
                        {reviewed && (
                          <span style={{ flexShrink: 0, fontSize: 9, fontWeight: 700, color: T.tx4, background: T.bg, border: `1px solid ${T.border2}`, borderRadius: 6, padding: "3px 7px" }}>
                            Reviewed
                          </span>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
                {filtered.length > 0 && <p style={{ fontSize: 10, color: T.tx4, textAlign: "center", marginTop: 8 }}>Showing {filtered.length} transactions</p>}
              </div>
            )}

            {/* CSV */}
            {tab === "csv" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r16, padding: 18 }}>
                  <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: ".14em", textTransform: "uppercase", color: T.tx4, marginBottom: 10 }}>Upload POS CSV</p>
                  <div onClick={() => fileRef.current?.click()}
                    style={{ border: `2px dashed ${csvFile ? T.blue : T.border2}`, borderRadius: 14, padding: "28px 16px", textAlign: "center", cursor: "pointer", background: csvFile ? T.blueL : "#FAFAFA" }}>
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: T.blueL, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px" }}>
                      <Upload size={18} color={T.blue} strokeWidth={2} />
                    </div>
                    {csvFile ? <p style={{ fontSize: 13, fontWeight: 700, color: T.blue }}>{csvFile}</p> : <>
                      <p style={{ fontSize: 13, fontWeight: 700, color: T.tx1 }}>Tap to select CSV file</p>
                      <p style={{ fontSize: 11, color: T.tx4, marginTop: 4 }}>From Gong Cha POS machine</p>
                    </>}
                    <input ref={fileRef} type="file" accept=".csv" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) processCSV(f); }} />
                  </div>
                  {csvFile && (
                    <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                      {csvMatched.length > 0 && (
                        <div style={{ padding: "10px 12px", borderRadius: 10, background: T.greenL, border: `1px solid ${T.greenB}` }}>
                          <p style={{ fontSize: 12, fontWeight: 700, color: T.green }}>
                            {csvMatched.length} transaction{csvMatched.length !== 1 ? "s" : ""} matched
                          </p>
                        </div>
                      )}
                      {csvMismatched.length > 0 && (
                        <div style={{ padding: "10px 12px", borderRadius: 10, background: T.redL, border: `1px solid ${T.redB}` }}>
                          <p style={{ fontSize: 12, fontWeight: 700, color: T.red, marginBottom: 6 }}>
                            {csvMismatched.length} mismatch — will be auto-rejected
                          </p>
                          {csvMismatched.map((m, i) => (
                            <div key={i} style={{ marginBottom: i < csvMismatched.length - 1 ? 8 : 0, paddingBottom: i < csvMismatched.length - 1 ? 8 : 0, borderBottom: i < csvMismatched.length - 1 ? `1px solid ${T.redB}` : "none" }}>
                              <p style={{ fontSize: 11, fontWeight: 600, color: T.red }}>{getReceiptNumber(m.tx) || m.tx.docId}</p>
                              {m.reasons.map((r, j) => <p key={j} style={{ fontSize: 10, color: T.red, opacity: .8 }}>· {r}</p>)}
                            </div>
                          ))}
                        </div>
                      )}
                      {csvMatched.length === 0 && csvMismatched.length === 0 && (
                        <div style={{ padding: "10px 12px", borderRadius: 10, background: T.amberL, border: `1px solid ${T.amberB}` }}>
                          <p style={{ fontSize: 12, fontWeight: 700, color: T.amber }}>No matches found</p>
                        </div>
                      )}
                      {csvUnmatched > 0 && <p style={{ fontSize: 11, color: T.tx4 }}>{csvUnmatched} rows unmatched (not in pending queue).</p>}
                    </div>
                  )}
                  <button onClick={runCsvVerify} disabled={(!csvMatched.length && !csvMismatched.length) || csvLoading}
                    style={{ width: "100%", padding: "13px 0", borderRadius: 12, border: "none", marginTop: 12, background: (!csvMatched.length && !csvMismatched.length) ? "#F3F4F6" : T.green, color: (!csvMatched.length && !csvMismatched.length) ? T.tx4 : "#fff", fontSize: 13, fontWeight: 800, cursor: (!csvMatched.length && !csvMismatched.length) ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                    {csvLoading ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: .9, ease: "linear" }}><Activity size={14} color="#fff" /></motion.div> : <CheckCircle2 size={14} color={(!csvMatched.length && !csvMismatched.length) ? T.tx4 : "#fff"} />}
                    {csvLoading ? "Verifying…" : (csvMatched.length + csvMismatched.length) > 0 ? `Process ${csvMatched.length + csvMismatched.length} transactions` : "Verify & Match POS"}
                  </button>
                </motion.div>
                {/* Format hint */}
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .1 }}
                  style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r16, padding: "14px 16px" }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: T.tx2, marginBottom: 8 }}>Supported CSV format</p>
                  <div style={{ background: "#F8FAFC", borderRadius: 10, padding: "10px 12px" }}>
                    <code style={{ fontSize: 10, color: T.tx3, lineHeight: 1.8, display: "block", fontFamily: "ui-monospace, 'Cascadia Code', monospace" }}>
                      receiptNumber,amount,date<br />101384,61000,2026-03-01
                    </code>
                  </div>
                </motion.div>
                {/* Pending in CSV tab */}
                {pending.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .15 }}
                    style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r16, overflow: "hidden" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderBottom: `1px solid ${T.border}` }}>
                      <p style={{ fontSize: 12, fontWeight: 700, color: T.tx1 }}>Pending ({pending.length})</p>
                      <button onClick={askVerifyAll} style={{ fontSize: 10, fontWeight: 700, color: T.green, background: T.greenL, border: "none", borderRadius: 99, padding: "4px 10px", cursor: "pointer" }}>Verify All</button>
                    </div>
                    {pending.map((tx, i) => (
                      <div key={tx.docId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: i < pending.length - 1 ? `1px solid ${T.border}` : "none" }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 12, fontWeight: 600, color: T.tx1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tx.memberName}</p>
                          <p style={{ fontSize: 10, color: T.tx4, marginTop: 1 }}>
                            <code style={{ fontSize: 9, background: T.blueL, color: T.blue, padding: "1px 5px", borderRadius: 4 }}>{getReceiptNumber(tx) || "—"}</code>
                            {" · "}{fmtRp(getAmount(tx))} · +{tx.potentialPoints ?? 0} pts
                          </p>
                        </div>
                        <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
                          <button onClick={() => handleAction(tx, "reject")} disabled={loadingId === tx.docId} style={{ width: 28, height: 28, borderRadius: 8, border: `1px solid ${T.redB}`, background: T.redL, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><XCircle size={12} color={T.red} /></button>
                          <button onClick={() => handleAction(tx, "verify")} disabled={loadingId === tx.docId} style={{ width: 28, height: 28, borderRadius: 8, border: "none", background: T.blue, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                            {loadingId === tx.docId ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: .9, ease: "linear" }}><Activity size={12} color="#fff" /></motion.div> : <CheckCircle2 size={12} color="#fff" />}
                          </button>
                        </div>
                      </div>
                    ))}
                  </motion.div>
                )}
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── ISLAND TAB BAR ── */}
      <div style={{ flexShrink: 0, display: "flex", justifyContent: "center", padding: "8px 0 28px", background: T.bg }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4, background: T.navy2, borderRadius: 99, padding: "5px 6px", boxShadow: "0 8px 24px rgba(0,0,0,.22), 0 2px 8px rgba(0,0,0,.12)" }}>
          {TABS.map(({ id, icon: Icon, label, badge }) => {
            const active   = tab === id;
            const hasBadge = (badge ?? 0) > 0 && !active;
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
                    {(badge ?? 0) > 9 ? "9+" : badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── OVERLAYS ── */}
      <AnimatePresence>
        {toast && <MToast key="toast" msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
      </AnimatePresence>
      {confirm && <ConfirmSheet title={confirm.title} message={confirm.message} confirmLabel={confirm.confirmLabel} danger={confirm.danger} onConfirm={runConfirm} onClose={() => !confirmBusy && setConfirm(null)} loading={confirmBusy} />}
      {reviewTx && <ReviewSheet tx={reviewTx} onApprove={() => handleManualReview("approve")} onConfirmReject={() => handleManualReview("confirm_reject")} onClose={() => !reviewLoading && setReviewTx(null)} loading={reviewLoading} />}
    </div>
  );
}
