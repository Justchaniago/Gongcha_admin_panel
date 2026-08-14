"use client";
// src/app/transactions/TransactionsClient.tsx

import { useState, useMemo, useEffect, useCallback } from "react";
import {
  Tx, TxStatus, C, font, fmtRp, fmtDate, StatusBadge,
  Toast, ConfirmModal, CsvPanel, PendingPanel, ReviewModal,
  getAmount, getReceiptNumber, getStoreLabel, getUserRef,
} from "./tx-helpers";
import { GcButton, GcEmptyState, GcPage, GcPageHeader, GcPanel } from "@/components/ui/gc";
import { useAuth } from "@/context/AuthContext";
import { CheckCircle2, Eye, Trash2, X as XIcon } from "lucide-react";
import { FastApiAdminGateway } from "@/lib/api/FastApiAdminGateway";

type SyncStatus   = "idle"|"loading"|"live"|"error";
type FilterStatus = "all"|TxStatus;

interface TransactionsClientProps {
  initialTransactions?: Tx[];
  initialRole: string;
}

export default function TransactionsClient({ initialTransactions = [], initialRole }: TransactionsClientProps) {
  const { user, can } = useAuth();
  const [txs,            setTxs]            = useState<Tx[]>(initialTransactions);
  const [syncStatus,     setSyncStatus]     = useState<SyncStatus>("idle");
  const [search,         setSearch]         = useState("");
  const [filterStatus,   setFilterStatus]   = useState<FilterStatus>("all");
  const [loadingId,      setLoadingId]      = useState<string|null>(null);
  const [toast,          setToast]          = useState<{msg:string;type:"success"|"error"}|null>(null);
  const [confirm,        setConfirm]        = useState<{
    title:string; message:string; confirmLabel:string; confirmColor:string;
    onConfirm:()=>Promise<void>;
  }|null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [searchFocus,    setSearchFocus]    = useState(false);
  const [selectedDocPaths, setSelectedDocPaths] = useState<string[]>([]);
  const [reviewTx,         setReviewTx]         = useState<Tx | null>(null);
  const [reviewLoading,    setReviewLoading]    = useState(false);

  const isAdmin = can("transaction.delete");

  const showToast = useCallback((msg: string, type: "success"|"error" = "success") => {
    setToast({ msg, type });
  }, []);

  // ── Fetch ───────────────────────────────────────────────────────────────────
  const fetchTxs = useCallback(async () => {
    setSyncStatus("loading");
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
      setSelectedDocPaths([]);
      setSyncStatus("live");
    } catch (e: any) {
      setSyncStatus("error");
      showToast(e.message ?? "Failed to load transactions", "error");
    }
  }, [showToast]);

  useEffect(() => { fetchTxs(); }, [fetchTxs]);

  // ── Derived ─────────────────────────────────────────────────────────────────
  const pending   = useMemo(() => txs.filter(t => t.status === "PENDING"), [txs]);
  const completed = useMemo(() => txs.filter(t => t.status === "COMPLETED"), [txs]);
  const cancelled = useMemo(() => txs.filter(t => t.status === "CANCELLED"), [txs]);
  const refunded  = useMemo(() => txs.filter(t => t.status === "REFUNDED"), [txs]);
  const totalPendingPts = useMemo(() => pending.reduce((a, t) => a + (t.potentialPoints ?? 0), 0), [pending]);
  const uniqueStores = useMemo(
    () => [...new Set(txs.map((t) => getStoreLabel(t)).filter((value) => value && value !== "-"))].sort(),
    [txs]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return txs.filter(tx => {
      const ms = !q ||
        tx.memberName.toLowerCase().includes(q) ||
        getReceiptNumber(tx).toLowerCase().includes(q) ||
        getStoreLabel(tx).toLowerCase().includes(q) ||
        getUserRef(tx).toLowerCase().includes(q);
      const mf = filterStatus === "all" || tx.status === filterStatus;
      return ms && mf;
    });
  }, [txs, search, filterStatus]);

  const filteredDocPaths = useMemo(
    () => filtered.map((tx) => tx.docPath),
    [filtered]
  );

  const selectedVisibleCount = useMemo(
    () => filteredDocPaths.filter((docPath) => selectedDocPaths.includes(docPath)).length,
    [filteredDocPaths, selectedDocPaths]
  );

  const allVisibleSelected =
    filteredDocPaths.length > 0 && selectedVisibleCount === filteredDocPaths.length;

  function toggleSelectOne(docPath: string, checked: boolean) {
    setSelectedDocPaths((prev) => {
      if (checked) {
        if (prev.includes(docPath)) return prev;
        return [...prev, docPath];
      }
      return prev.filter((p) => p !== docPath);
    });
  }

  function toggleSelectAllVisible(checked: boolean) {
    setSelectedDocPaths((prev) => {
      const set = new Set(prev);
      if (checked) {
        filteredDocPaths.forEach((p) => set.add(p));
      } else {
        filteredDocPaths.forEach((p) => set.delete(p));
      }
      return Array.from(set);
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

  function handleDeleteSelected() {
    if (!isAdmin || selectedDocPaths.length === 0) return;
    const pathsToDelete = [...selectedDocPaths];
    setConfirm({
      title: "Delete selected transactions?",
      message: `You are about to delete ${pathsToDelete.length} transaction(s). This action cannot be undone.`,
      confirmLabel: `Delete ${pathsToDelete.length}`,
      confirmColor: C.red,
      onConfirm: async () => {
        const data = await deleteTransactions(pathsToDelete);
        showToast(`Deleted ${data.successCount} transaction(s).`, "success");
        const deleted = new Set(pathsToDelete);
        setTxs(prev => prev.filter(t => !deleted.has(t.docPath)));
        setSelectedDocPaths([]);
      },
    });
  }

  function handleDeleteSingle(tx: Tx) {
    if (!isAdmin) return;
    setConfirm({
      title: "Delete this transaction?",
      message: `Transaction ${getReceiptNumber(tx) || tx.docId} will be permanently deleted. This action cannot be undone.`,
      confirmLabel: "Delete Transaction",
      confirmColor: C.red,
      onConfirm: async () => {
        const data = await deleteTransactions([tx.docPath]);
        if (!data.successCount) throw new Error("Transaction was not deleted.");
        showToast("Transaction deleted.", "success");
        setTxs(prev => prev.filter(t => t.docPath !== tx.docPath));
        setSelectedDocPaths(prev => prev.filter(p => p !== tx.docPath));
      },
    });
  }

  // ── Single action ───────────────────────────────────────────────────────────
  async function handleAction(tx: Tx, action: "verify"|"reject") {
    setLoadingId(tx.docId);
    try {
      const res = await fetch("/api/transactions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docPath: tx.docPath, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Failed");
      showToast(
        action === "verify"
          ? `✓ Verified! Released ${tx.potentialPoints ?? 0} pending pts for ${tx.memberName}`
          : "Transaction rejected.",
        action === "verify" ? "success" : "error"
      );
      const newStatus: TxStatus = action === "verify" ? "COMPLETED" : "CANCELLED";
      setTxs(prev => prev.map(t => t.docPath === tx.docPath
        ? { ...t, status: newStatus, verifiedAt: new Date().toISOString() }
        : t
      ));
    } catch (e: any) {
      showToast(e.message ?? "Failed to process", "error");
    } finally {
      setLoadingId(null);
    }
  }

  // ── Verify all pending ──────────────────────────────────────────────────────
  function handleVerifyAll() {
    if (pending.length === 0) return;
    setConfirm({
      title:        "Verify All Pending?",
      message:      `You will verify ${pending.length} transactions and release a total of ${totalPendingPts.toLocaleString("id")} pending points to members. This action cannot be undone.`,
      confirmLabel: `✓ Verify ${pending.length} Transactions`,
      confirmColor: C.green,
      onConfirm: async () => {
        const pendingPaths = new Set(pending.map(t => t.docPath));
        const res = await fetch("/api/transactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ docPaths: [...pendingPaths], action: "verify" }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message ?? "Failed");
        showToast(`✓ ${data.successCount} transactions verified and pending points released!`, "success");
        const now = new Date().toISOString();
        setTxs(prev => prev.map(t => pendingPaths.has(t.docPath)
          ? { ...t, status: "COMPLETED" as TxStatus, verifiedAt: now }
          : t
        ));
      },
    });
  }

  // ── Manual review (CANCELLED → admin approve or confirm reject) ─────────────
  async function handleManualReview(tx: Tx, action: "approve" | "confirm_reject") {
    setReviewLoading(true);
    try {
      const res = await fetch("/api/transactions/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docPath: tx.docPath, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Review failed");
      showToast(
        action === "approve"
          ? `✓ Approved! ${tx.potentialPoints ?? 0} pts dikreditkan ke ${tx.memberName}`
          : `Rejection confirmed for ${getReceiptNumber(tx)}`,
        action === "approve" ? "success" : "error"
      );
      setReviewTx(null);
      setTxs(prev => prev.map(t => t.docPath === tx.docPath
        ? { ...t,
            status: (action === "approve" ? "COMPLETED" : "CANCELLED") as TxStatus,
            manualReviewDone: true,
            ...(action === "approve" ? { verifiedAt: new Date().toISOString() } : {}),
          }
        : t
      ));
    } catch (e: any) {
      showToast(e.message ?? "Review failed", "error");
    } finally {
      setReviewLoading(false);
    }
  }

  // ── CSV match verify (using new /api/transactions/verify endpoint) ────────
  async function handleMatchVerify(matchedRows: Array<{ tx: Tx; posData: { receiptNumber: string; amount: number; date: string } }>) {
    if (matchedRows.length === 0) return;
    
    let successCount = 0;
    let rejectedCount = 0;
    const errors: string[] = [];

    for (const { tx, posData } of matchedRows) {
      try {
        const res = await fetch("/api/transactions/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            receiptNumber: posData.receiptNumber,
            posAmount: posData.amount,
            posDate: posData.date,
          }),
        });
        
        const data = await res.json();
        
        if (!res.ok) {
          errors.push(`${getReceiptNumber(tx)}: ${data.message ?? "Failed verification"}`);
          continue;
        }

        if (data.status === "COMPLETED") {
          successCount++;
        } else if (data.status === "CANCELLED") {
          rejectedCount++;
        }
      } catch (e: any) {
        errors.push(`${getReceiptNumber(tx)}: ${e.message}`);
      }
    }

    if (errors.length > 0) {
      showToast(`⚠ ${successCount} verified, ${rejectedCount} rejected, ${errors.length} error`, "error");
    } else {
      showToast(
        rejectedCount > 0
          ? `✓ ${successCount} verified, ${rejectedCount} rejected due to POS mismatch`
          : `✓ ${successCount} verified, all pending points released`,
        "success",
      );
    }
    
    await fetchTxs();
  }

  // ── Export CSV ──────────────────────────────────────────────────────────────
  function handleExport() {
    const headers = ["docId", "receiptNumber", "memberName", "userId", "storeName", "totalAmount", "potentialPoints", "status", "createdAt", "verifiedAt"];
    const rows = filtered.map(tx => [
      tx.docId,
      getReceiptNumber(tx),
      tx.memberName,
      getUserRef(tx),
      getStoreLabel(tx),
      getAmount(tx),
      tx.potentialPoints ?? 0,
      tx.status,
      tx.createdAt ?? "",
      tx.verifiedAt ?? "",
    ]);
    const csv  = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url;
    a.download = `transactions_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Confirm handler ─────────────────────────────────────────────────────────
  async function runConfirm() {
    if (!confirm) return;
    setConfirmLoading(true);
    try {
      await confirm.onConfirm();
      setConfirm(null);
    } catch (e: any) {
      showToast(e.message ?? "Failed", "error");
    } finally {
      setConfirmLoading(false);
    }
  }

  // ── Sync badge ──────────────────────────────────────────────────────────────
  const syncCfg = {
    idle:    { color: C.tx3,    label: "Idle" },
    loading: { color: C.orange, label: "Loading…" },
    live:    { color: C.green,  label: "Live" },
    error:   { color: C.red,    label: "Error" },
  }[syncStatus];

  const summaryCards = [
    { label:"Pending",  count:pending.length,  pts:totalPendingPts, chipBg:"#FFF7ED", chipColor:"#9A3412", chipBorder:"rgba(154,52,18,.18)" },
    { label:"Completed", count:completed.length, pts:null,           chipBg:"#F0FDF4", chipColor:"#166534", chipBorder:"rgba(22,101,52,.18)" },
    { label:"Cancelled", count:cancelled.length, pts:null,           chipBg:"#FEF2F2", chipColor:"#991B1B", chipBorder:"rgba(153,27,27,.18)" },
    { label:"Refunded",  count:refunded.length,  pts:null,           chipBg:"#F8FAFC", chipColor:"#334155", chipBorder:"rgba(51,65,85,.15)" },
  ];

  const filterTabs: { key: FilterStatus; label: string }[] = [
    { key:"all",      label:`All (${txs.length})` },
    { key:"PENDING",   label:`Pending (${pending.length})` },
    { key:"COMPLETED", label:`Completed (${completed.length})` },
    { key:"CANCELLED", label:`Cancelled (${cancelled.length})` },
    { key:"REFUNDED",  label:`Refunded (${refunded.length})` },
  ];

  // ── Shared inline styles ────────────────────────────────────────────────────
  const TH: React.CSSProperties = {
    textAlign: "left", fontSize: 10.5, fontWeight: 600, color: C.tx3,
    textTransform: "uppercase", letterSpacing: ".07em", padding: "9px 14px", whiteSpace: "nowrap",
  };
  const TD: React.CSSProperties = { padding: "10px 14px", verticalAlign: "middle" };

  return (
    <>
      <GcPage style={{ background: C.bg }}>

        {/* ── Header ── */}
        <GcPageHeader
          title="Transaction Audit & CSV Sync"
          description="Upload POS CSV files, reconcile receipts, then verify transactions and member point distribution in one unified workflow."
          actions={
            <>
              <span style={{ display:"inline-flex", alignItems:"center", gap:5, fontSize:11, fontWeight:600, color:syncCfg.color }}>
                <span style={{ width:6, height:6, borderRadius:"50%", background:syncCfg.color, flexShrink:0 }}/>
                {syncCfg.label}
              </span>
              <GcButton variant="ghost" onClick={fetchTxs}>Refresh</GcButton>
              <GcButton variant="blue" onClick={handleExport}>Export CSV</GcButton>
            </>
          }
        />

        {/* ── Summary cards ── */}
        <div className="gc-grid-4" style={{ marginBottom:24 }}>
          {summaryCards.map(c => (
            <GcPanel key={c.label} style={{ borderRadius:16, border:'1px solid rgba(15,17,23,.08)', boxShadow:'0 1px 2px rgba(15,17,23,.04)', padding:"16px 20px", background:'rgba(255,255,255,.86)' }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
                <p style={{ fontSize:11, letterSpacing:'.04em', textTransform:'uppercase', fontWeight:600, color:C.tx3, margin:0 }}>{c.label}</p>
                <span style={{ fontSize:10, fontWeight:600, padding:"2px 8px", borderRadius:99, background:c.chipBg, color:c.chipColor, border:`1px solid ${c.chipBorder}` }}>{c.label}</span>
              </div>
              <p style={{ fontSize:30, fontWeight:700, color:C.tx1, margin:0, lineHeight:1 }}>{c.count}</p>
              {c.pts !== null && (
                <p style={{ fontSize:11, color:C.tx3, marginTop:6, marginBottom:0 }}>{c.pts.toLocaleString("id")} pts on hold</p>
              )}
            </GcPanel>
          ))}
        </div>

        {/* ── Realtime ESB Verification Banner ── */}
        <GcPanel style={{ borderRadius: 16, padding: "16px 20px", marginBottom: 16, background: "linear-gradient(135deg, #EFF6FF 0%, #EEF2FF 100%)", border: "1px solid #DBEAFE" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "#3B82F6", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 16 }}>
              ⚡
            </div>
            <div>
              <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#1E3A8A" }}>Automated Real-Time ESB & POS Verification Active</h4>
              <p style={{ margin: "2px 0 0", fontSize: 11.5, color: "#3B82F6" }}>
                Transactions are now verified and processed automatically in real time directly at the POS via Enterprise Service Bus (ESB). Manual verification is no longer required.
              </p>
            </div>
          </div>
        </GcPanel>

        {/* ── Full history table ── */}
        <GcPanel style={{ borderRadius:18, overflow:"hidden" }}>

          {/* Toolbar */}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"11px 20px", borderBottom:`1px solid ${C.border2}`, background:'rgba(255,255,255,.92)', backdropFilter:'saturate(160%) blur(8px)', gap:12, flexWrap:"wrap" }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
              <h2 style={{ fontSize:14, fontWeight:700, color:C.tx1, margin:0, whiteSpace:"nowrap" }}>
                Complete History
                <span style={{ marginLeft:7, fontSize:12, fontWeight:400, color:C.tx3 }}>({filtered.length})</span>
              </h2>
              {isAdmin && filtered.length > 0 && (
                <label style={{ display:"inline-flex", alignItems:"center", gap:6, height:28, background:"#F8FAFC", border:`1px solid ${C.border}`, borderRadius:6, padding:"0 10px", fontSize:11.5, color:C.tx2, cursor:"pointer", userSelect:"none", whiteSpace:"nowrap" }}>
                  <input type="checkbox" style={{ width:12, height:12, accentColor:C.tx1, cursor:"pointer" }} checked={allVisibleSelected} onChange={e => toggleSelectAllVisible(e.target.checked)}/>
                  Select all
                </label>
              )}
              {isAdmin && selectedDocPaths.length > 0 && (
                <>
                  <span style={{ fontSize:11.5, color:C.tx3 }}>{selectedDocPaths.length} selected</span>
                  <button
                    onClick={handleDeleteSelected}
                    style={{ height:28, padding:"0 10px", borderRadius:6, border:`1px solid #FECACA`, background:"#FFF5F5", color:C.red, fontFamily:font, fontSize:11.5, fontWeight:600, cursor:"pointer", display:"inline-flex", alignItems:"center", gap:5 }}
                  >
                    <Trash2 size={12}/> Delete
                  </button>
                </>
              )}
            </div>

            {/* Search */}
            <div style={{ display:"inline-flex", alignItems:"center", gap:7, height:34, padding:"0 11px", background:C.white, border:`1.5px solid ${searchFocus?"rgba(59,130,246,.5)":C.border}`, borderRadius:8, boxShadow:searchFocus?"0 0 0 3px rgba(59,130,246,.08)":"none", transition:"all .15s", minWidth:220, flexShrink:0 }}>
              <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke={searchFocus?C.blue:C.tx2} strokeWidth={2} style={{ flexShrink:0, transition:"stroke .15s" }}>
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input
                style={{ flex:1, border:"none", background:"transparent", outline:"none", fontFamily:font, fontSize:12, color:C.tx1 }}
                placeholder="Search member, receipt, outlet…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onFocus={() => setSearchFocus(true)}
                onBlur={() => setSearchFocus(false)}
              />
              {search && (
                <button onClick={() => setSearch("")} style={{ background:"none", border:"none", cursor:"pointer", color:C.tx3, display:"flex", alignItems:"center", padding:1 }}>
                  <XIcon size={13}/>
                </button>
              )}
            </div>
          </div>

          {/* Filter tabs */}
          <div style={{ display:"flex", padding:"0 20px", borderBottom:`1px solid ${C.border2}`, background:"#FCFDFF", overflowX:"auto" }}>
            {filterTabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setFilterStatus(tab.key)}
                style={{
                  height:36, padding:"0 14px", border:"none", background:"transparent", whiteSpace:"nowrap",
                  fontFamily:font, fontSize:12, fontWeight:filterStatus===tab.key?600:400,
                  color:filterStatus===tab.key?C.tx1:C.tx3, cursor:"pointer",
                  borderBottom:filterStatus===tab.key?`2px solid ${C.tx1}`:"2px solid transparent",
                  transition:"color .12s, border-color .12s",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Table */}
          {filtered.length === 0 ? (
            <GcEmptyState icon="📭" title="No transactions" description={search ? `No results for "${search}"` : "No transaction data yet."}/>
          ) : (
            <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse" }}>
                <thead>
                  <tr style={{ background:"#F8FAFC", borderBottom:`1px solid ${C.border2}` }}>
                    {isAdmin && <th style={{ width:38, padding:"9px 0 9px 16px" }}/>}
                    <th style={TH}>Receipt</th>
                    <th style={TH}>Member</th>
                    <th style={TH}>Outlet</th>
                    <th style={TH}>Date</th>
                    <th style={{ ...TH, textAlign:"right" }}>Amount</th>
                    <th style={TH}>Points</th>
                    <th style={TH}>Status</th>
                    <th style={{ ...TH, textAlign:"right" as const, width:1 }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(tx => (
                    <tr
                      key={tx.docId}
                      style={{ borderBottom:`1px solid ${C.border2}`, transition:"background .1s" }}
                      onMouseEnter={e => (e.currentTarget.style.background="#F8FAFB")}
                      onMouseLeave={e => (e.currentTarget.style.background="transparent")}
                    >
                      {/* Checkbox */}
                      {isAdmin && (
                        <td style={{ width:38, padding:"10px 0 10px 16px", textAlign:"center", verticalAlign:"middle" }}>
                          <input
                            type="checkbox"
                            style={{ width:13, height:13, accentColor:C.tx1, cursor:"pointer", display:"block", margin:"0 auto" }}
                            checked={selectedDocPaths.includes(tx.docPath)}
                            onChange={e => toggleSelectOne(tx.docPath, e.target.checked)}
                            aria-label={`Select ${getReceiptNumber(tx) || tx.docId}`}
                          />
                        </td>
                      )}

                      {/* Receipt ID */}
                      <td style={TD}>
                        <code style={{ fontSize:10, fontFamily:"'Menlo','Monaco','Consolas',monospace", color:"#475569", background:"#F1F5F9", border:"1px solid #E2E8F0", padding:"2px 6px", borderRadius:5 }}>
                          {getReceiptNumber(tx) || "—"}
                        </code>
                      </td>

                      {/* Member */}
                      <td style={TD}>
                        <p style={{ fontSize:12.5, fontWeight:600, color:C.tx1, margin:0, whiteSpace:"nowrap" }}>{tx.memberName}</p>
                        {getUserRef(tx) && (
                          <p style={{ fontSize:10, color:C.tx3, margin:"1px 0 0", fontFamily:"monospace" }}>{getUserRef(tx)}</p>
                        )}
                      </td>

                      {/* Outlet */}
                      <td style={{ ...TD, fontSize:12, color:C.tx2, maxWidth:180 }}>
                        <span style={{ display:"block", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                          {getStoreLabel(tx)}
                        </span>
                      </td>

                      {/* Date — created + verified sub-line */}
                      <td style={{ ...TD, whiteSpace:"nowrap" }}>
                        <p style={{ fontSize:12, color:C.tx2, margin:0 }}>{fmtDate(tx.createdAt)}</p>
                        {tx.verifiedAt && tx.status !== "PENDING" && (
                          <p style={{ fontSize:10, color:C.tx3, margin:"2px 0 0", display:"flex", alignItems:"center", gap:3 }}>
                            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><polyline points="20 6 9 17 4 12"/></svg>
                            {fmtDate(tx.verifiedAt)}
                          </p>
                        )}
                      </td>

                      {/* Amount */}
                      <td style={{ ...TD, textAlign:"right", whiteSpace:"nowrap" }}>
                        <span style={{ fontSize:12.5, fontWeight:600, color:C.tx1, fontVariantNumeric:"tabular-nums" }}>{fmtRp(getAmount(tx))}</span>
                      </td>

                      {/* Points */}
                      <td style={TD}>
                        <span style={{ fontSize:11, fontWeight:600, color:"#1D4ED8", background:"#EFF6FF", border:"1px solid #BFDBFE", borderRadius:99, padding:"2px 8px", whiteSpace:"nowrap" }}>
                          {(tx.potentialPoints ?? 0).toLocaleString()} pts
                        </span>
                      </td>

                      {/* Status */}
                      <td style={TD}>
                        <StatusBadge status={tx.status}/>
                      </td>

                      {/* Action */}
                      <td style={{ ...TD, textAlign:"right" }}>
                        <div style={{ display:"inline-flex", gap:4, alignItems:"center" }}>
                          {tx.status === "PENDING" ? (
                            <>
                              <button
                                onClick={() => handleAction(tx, "verify")}
                                disabled={loadingId === tx.docId}
                                style={{ height:28, padding:"0 11px", borderRadius:6, border:"none", background:loadingId===tx.docId?"#E5E7EB":"#0F172A", color:loadingId===tx.docId?C.tx3:"#fff", fontFamily:font, fontSize:11.5, fontWeight:600, cursor:loadingId===tx.docId?"not-allowed":"pointer", display:"inline-flex", alignItems:"center", gap:5, transition:"opacity .12s", opacity:loadingId===tx.docId?.5:1, whiteSpace:"nowrap" }}
                              >
                                {loadingId !== tx.docId && <CheckCircle2 size={12}/>}
                                {loadingId === tx.docId ? "…" : "Verify"}
                              </button>
                              <button
                                onClick={() => handleAction(tx, "reject")}
                                disabled={loadingId === tx.docId}
                                style={{ height:28, padding:"0 11px", borderRadius:6, border:"1px solid #FECACA", background:"#FFF5F5", color:C.red, fontFamily:font, fontSize:11.5, fontWeight:600, cursor:loadingId===tx.docId?"not-allowed":"pointer", display:"inline-flex", alignItems:"center", gap:5, opacity:loadingId===tx.docId?.4:1, whiteSpace:"nowrap" }}
                              >
                                {loadingId !== tx.docId && <XIcon size={12}/>}
                                Reject
                              </button>
                            </>
                          ) : (
                            <>
                              {tx.status === "CANCELLED" && tx.needsManualReview && !tx.manualReviewDone && (
                                <button
                                  onClick={() => setReviewTx(tx)}
                                  style={{ height:26, padding:"0 10px", borderRadius:6, border:"1px solid #BFDBFE", background:"#EFF6FF", color:"#1D4ED8", fontFamily:font, fontSize:11, fontWeight:600, cursor:"pointer", display:"inline-flex", alignItems:"center", gap:4, whiteSpace:"nowrap" }}
                                >
                                  <Eye size={11}/> Review
                                </button>
                              )}
                              {tx.status === "CANCELLED" && tx.manualReviewDone && (
                                <span style={{ fontSize:10, fontWeight:500, color:C.tx3, background:"#F8FAFC", border:`1px solid ${C.border}`, borderRadius:99, padding:"2px 8px", whiteSpace:"nowrap" }}>Reviewed</span>
                              )}
                            </>
                          )}
                          {isAdmin && (
                            <button
                              onClick={() => handleDeleteSingle(tx)}
                              disabled={loadingId === tx.docId}
                              title="Delete transaction"
                              style={{ width:28, height:28, borderRadius:6, border:`1px solid ${C.border}`, background:"transparent", color:"#9CA3AF", cursor:loadingId===tx.docId?"not-allowed":"pointer", display:"inline-flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"all .12s", opacity:loadingId===tx.docId?.4:1 }}
                              onMouseEnter={e => { if (loadingId !== tx.docId) { e.currentTarget.style.background="#FFF5F5"; e.currentTarget.style.color=C.red; e.currentTarget.style.borderColor="#FECACA"; } }}
                              onMouseLeave={e => { e.currentTarget.style.background="transparent"; e.currentTarget.style.color="#9CA3AF"; e.currentTarget.style.borderColor=C.border; }}
                            >
                              <Trash2 size={13}/>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </GcPanel>
      </GcPage>

      {/* ── Toast ── */}
      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)}/>}

      {/* ── Review Modal ── */}
      {reviewTx && (
        <ReviewModal
          tx={reviewTx}
          onApprove={() => handleManualReview(reviewTx, "approve")}
          onConfirmReject={() => handleManualReview(reviewTx, "confirm_reject")}
          onClose={() => !reviewLoading && setReviewTx(null)}
          loading={reviewLoading}
        />
      )}

      {/* ── Confirm Modal ── */}
      {confirm && (
        <ConfirmModal
          title={confirm.title}
          message={confirm.message}
          confirmLabel={confirm.confirmLabel}
          confirmColor={confirm.confirmColor}
          onConfirm={runConfirm}
          onClose={() => setConfirm(null)}
          loading={confirmLoading}
        />
      )}
    </>
  );
}
