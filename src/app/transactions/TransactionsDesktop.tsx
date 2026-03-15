"use client";
// src/app/transactions/TransactionsClient.tsx

import { useState, useMemo, useEffect, useCallback } from "react";
import {
  Tx, TxStatus, C, font, fmtRp, fmtDate, StatusBadge,
  Toast, ConfirmModal, CsvPanel, PendingPanel,
  getAmount, getReceiptNumber, getStoreLabel, getUserRef,
} from "./tx-helpers";
import { GcButton, GcEmptyState, GcPage, GcPageHeader, GcPanel } from "@/components/ui/gc";
import { useAuth } from "@/context/AuthContext";

type SyncStatus   = "idle"|"loading"|"live"|"error";
type FilterStatus = "all"|TxStatus;

interface TransactionsClientProps {
  initialTransactions?: Tx[];
  initialRole: string;
}

export default function TransactionsClient({ initialTransactions = [], initialRole }: TransactionsClientProps) {
  const { user } = useAuth();
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

  const isAdmin = user?.role === "SUPER_ADMIN" || initialRole === "admin" || initialRole === "SUPER_ADMIN";

  const showToast = useCallback((msg: string, type: "success"|"error" = "success") => {
    setToast({ msg, type });
  }, []);

  // ── Fetch ───────────────────────────────────────────────────────────────────
  const fetchTxs = useCallback(async () => {
    setSyncStatus("loading");
    try {
      const res = await fetch("/api/transactions");
      if (!res.ok) throw new Error((await res.json()).message ?? "Failed to load data");
      setTxs(await res.json());
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
    setConfirm({
      title: "Delete selected transactions?",
      message: `You are about to delete ${selectedDocPaths.length} transaction(s). This action cannot be undone.`,
      confirmLabel: `Delete ${selectedDocPaths.length}`,
      confirmColor: C.red,
      onConfirm: async () => {
        const data = await deleteTransactions(selectedDocPaths);
        showToast(`Deleted ${data.successCount} transaction(s).`, "success");
        await fetchTxs();
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
        if (!data.successCount) {
          throw new Error("Transaction was not deleted.");
        }
        showToast("Transaction deleted.", "success");
        await fetchTxs();
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
          ? `✓ Verified! +${tx.potentialPoints ?? 0} pts for ${tx.memberName}`
          : "Transaction rejected.",
        action === "verify" ? "success" : "error"
      );
      await fetchTxs();
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
      message:      `You will verify ${pending.length} transactions and disburse a total of ${totalPendingPts.toLocaleString("id")} points to members. This action cannot be undone.`,
      confirmLabel: `✓ Verify ${pending.length} Transactions`,
      confirmColor: C.green,
      onConfirm: async () => {
        const res = await fetch("/api/transactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ docPaths: pending.map(t => t.docPath), action: "verify" }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message ?? "Failed");
        showToast(`✓ ${data.successCount} transactions successfully verified!`, "success");
        await fetchTxs();
      },
    });
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
      showToast(`✓ ${successCount} verified, ${rejectedCount} flagged for manual review`, "success");
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

  return (
    <>
      <GcPage style={{ background: C.bg }}>

        {/* ── Header ── */}
        <GcPageHeader
          title="Transaction Audit & CSV Sync"
          description="Upload POS CSV files, reconcile receipts, then verify transactions and member point distribution in one unified workflow."
          actions={
            <>
              <span style={{ minWidth: 96, display: "inline-flex", justifyContent: "center", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, color: syncCfg.color }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: syncCfg.color, display: "inline-block" }} />
                {syncCfg.label}
              </span>
              <GcButton variant="ghost" onClick={fetchTxs}>
                Refresh
              </GcButton>
              <GcButton variant="blue" onClick={handleExport}>
                Export CSV
              </GcButton>
            </>
          }
        />

        {/* ── Summary cards ── */}
        <div className="gc-grid-4" style={{ marginBottom:24 }}>
          {summaryCards.map(c => (
            <GcPanel key={c.label} style={{ borderRadius:16, border:'1px solid rgba(15,17,23,.08)', boxShadow:'0 1px 2px rgba(15,17,23,.04)', padding:"16px 20px", background:'rgba(255,255,255,.86)' }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
                <p style={{ fontSize:11, letterSpacing:'.04em', textTransform:'uppercase', fontWeight:600, color:C.tx3, margin:0 }}>{c.label}</p>
                <span style={{ fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:99, background:c.chipBg, color:c.chipColor, border:`1px solid ${c.chipBorder}` }}>{c.label}</span>
              </div>
              <p style={{ fontSize:31, fontWeight:700, color:C.tx1, margin:0, lineHeight:1 }}>{c.count}</p>
              {c.pts !== null && (
                <p style={{ fontSize:11, color:C.tx3, marginTop:6, marginBottom:0 }}>
                  {c.pts.toLocaleString("id")} pts on hold
                </p>
              )}
            </GcPanel>
          ))}
        </div>

        {/* ── CSV + Pending row ── */}
        <div className="gc-grid-split" style={{ marginBottom:16 }}>
          <CsvPanel
            pendingTxs={pending}
            stores={uniqueStores}
            onMatchVerify={handleMatchVerify}
            onToast={showToast}
          />
          <PendingPanel
            pending={pending}
            onVerify={tx => handleAction(tx, "verify")}
            onReject={tx => handleAction(tx, "reject")}
            onVerifyAll={handleVerifyAll}
            loadingId={loadingId}
          />
        </div>

        {/* ── Full history table ── */}
        <GcPanel style={{ borderRadius:18, overflow:"hidden" }}>

          {/* Table toolbar */}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 20px", borderBottom:`1px solid ${C.border2}`, background:'rgba(255,255,255,.72)', backdropFilter:'saturate(160%) blur(8px)' }}>
            <h2 style={{ fontSize:15, fontWeight:800, color:C.tx1, margin:0 }}>
              Complete History ({filtered.length})
            </h2>
            <div style={{ display:"flex", gap:8, alignItems:"center" }}>
              {isAdmin && selectedDocPaths.length > 0 && (
                <>
                  <span style={{ fontSize:12, color:C.tx2 }}>
                    {selectedDocPaths.length} selected
                  </span>
                  <GcButton
                    variant="danger"
                    size="sm"
                    onClick={handleDeleteSelected}
                  >
                    🗑 Delete Selected
                  </GcButton>
                </>
              )}
              {/* Search */}
              <div style={{ display:"flex", alignItems:"center", gap:8, height:38, padding:"0 12px", background:C.white, border:`1px solid ${searchFocus?'rgba(59,130,246,.48)':'rgba(15,17,23,.10)'}`, borderRadius:9, boxShadow:searchFocus?'0 0 0 3px rgba(59,130,246,.10)':'none', transition:"all .14s", minWidth:220 }}>
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke={C.tx3} strokeWidth={2}>
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
                <input
                  style={{ flex:1, border:"none", background:"transparent", outline:"none", fontFamily:font, fontSize:12.5, color:C.tx1 }}
                  placeholder="Search member, ID, outlet…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  onFocus={() => setSearchFocus(true)}
                  onBlur={() => setSearchFocus(false)}
                />
                {search && (
                  <button onClick={() => setSearch("")} style={{ background:"none", border:"none", cursor:"pointer", color:C.tx3, fontSize:14, padding:0 }}>✕</button>
                )}
              </div>
            </div>
          </div>

          {/* Filter tabs */}
          <div style={{ display:"flex", gap:0, padding:"0 20px", borderBottom:`1px solid ${C.border2}`, background:'#FCFDFF' }}>
            {filterTabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setFilterStatus(tab.key)}
                style={{
                  height:38, padding:"0 16px", border:"none", background:"transparent",
                  fontFamily:font, fontSize:12.5, fontWeight:filterStatus===tab.key?700:500,
                  color:filterStatus===tab.key?C.tx1:C.tx2, cursor:"pointer",
                  borderBottom:filterStatus===tab.key?'2px solid rgba(15,17,23,.75)':"2px solid transparent",
                  transition:"all .14s",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Table */}
          {filtered.length === 0 ? (
            <GcEmptyState
              icon="📭"
              title="No transactions"
              description={search ? `No results for "${search}"` : "No transaction data yet."}
            />
          ) : (
            <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse" }}>
                <thead style={{ background:'#FAFBFE' }}>
                  <tr>
                    {[
                      isAdmin ? "Select" : null,
                      "Transaction ID",
                      "Member",
                      "Outlet",
                      "Date",
                      "Amount",
                      "Points",
                      "Status",
                      "Action",
                    ].filter(Boolean).map(h => (
                      <th key={h} style={{ textAlign:"left", fontSize:11, fontWeight:700, color:C.tx3, textTransform:"uppercase", letterSpacing:".06em", padding:"10px 16px", whiteSpace:"nowrap" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(tx => (
                    <tr key={tx.docId} style={{ borderTop:`1px solid ${C.border2}`, transition:"background .12s" }}
                      onMouseEnter={e => (e.currentTarget.style.background="#FAFBFD")}
                      onMouseLeave={e => (e.currentTarget.style.background="transparent")}
                    >
                      {isAdmin && (
                        <td style={{ padding:"12px 16px", whiteSpace:"nowrap" }}>
                          <input
                            type="checkbox"
                            checked={selectedDocPaths.includes(tx.docPath)}
                            onChange={(e) => toggleSelectOne(tx.docPath, e.target.checked)}
                            aria-label={`Select ${getReceiptNumber(tx) || tx.docId}`}
                          />
                        </td>
                      )}
                      <td style={{ padding:"12px 16px" }}>
                        <code style={{ fontSize:10, fontFamily:"monospace", color:'#334155', background:'#EEF2F7', border:'1px solid rgba(51,65,85,.14)', padding:"2px 7px", borderRadius:6 }}>
                          {getReceiptNumber(tx) || "—"}
                        </code>
                      </td>
                      <td style={{ padding:"12px 16px" }}>
                        <p style={{ fontSize:13, fontWeight:600, color:C.tx1, margin:0 }}>{tx.memberName}</p>
                        <p style={{ fontSize:10.5, color:C.tx3, margin:0, marginTop:2 }}>{getUserRef(tx) || "-"}</p>
                      </td>
                      <td style={{ padding:"12px 16px", fontSize:12.5, color:C.tx2, whiteSpace:"nowrap" }}>{getStoreLabel(tx)}</td>
                      <td style={{ padding:"12px 16px", fontSize:12, color:C.tx2, whiteSpace:"nowrap" }}>{fmtDate(tx.createdAt)}</td>
                      <td style={{ padding:"12px 16px", fontSize:13, fontWeight:700, color:C.tx1, whiteSpace:"nowrap" }}>{fmtRp(getAmount(tx))}</td>
                      <td style={{ padding:"12px 16px" }}>
                        <span style={{ fontSize:12, fontWeight:700, color:C.blue }}>{tx.potentialPoints ?? 0} pts</span>
                      </td>
                      <td style={{ padding:"12px 16px" }}>
                        <StatusBadge status={tx.status}/>
                      </td>
                      <td style={{ padding:"12px 16px" }}>
                        {tx.status === "PENDING" && (
                          <div style={{ display:"flex", gap:6 }}>
                            <GcButton
                              variant="primary"
                              size="sm"
                              onClick={() => handleAction(tx, "verify")}
                              disabled={loadingId === tx.docId}
                            >
                              {loadingId === tx.docId ? "…" : "✓ Verifikasi"}
                            </GcButton>
                            <GcButton
                              variant="danger"
                              size="sm"
                              onClick={() => handleAction(tx, "reject")}
                              disabled={loadingId === tx.docId}
                            >
                              ✕ Tolak
                            </GcButton>
                            {isAdmin && (
                              <GcButton
                                onClick={() => handleDeleteSingle(tx)}
                                disabled={loadingId === tx.docId}
                                variant="ghost"
                                size="sm"
                              >
                                🗑 Delete
                              </GcButton>
                            )}
                          </div>
                        )}
                        {tx.status !== "PENDING" && (
                          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                            <span style={{ fontSize:11, color:C.tx3 }}>
                              {fmtDate(tx.verifiedAt)}
                            </span>
                            {isAdmin && (
                              <GcButton
                                onClick={() => handleDeleteSingle(tx)}
                                variant="ghost"
                                size="sm"
                              >
                                🗑 Delete
                              </GcButton>
                            )}
                          </div>
                        )}
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

      {isAdmin && filtered.length > 0 && (
        <div style={{ position:"fixed", left:24, bottom:24, zIndex:20 }}>
          <label
            style={{
              display:"inline-flex",
              alignItems:"center",
              gap:8,
              background:C.white,
              border:`1px solid ${C.border}`,
              borderRadius:9,
              padding:"8px 12px",
              boxShadow:C.shadow,
              fontSize:12.5,
              color:C.tx2,
            }}
          >
            <input
              type="checkbox"
              checked={allVisibleSelected}
              onChange={(e) => toggleSelectAllVisible(e.target.checked)}
            />
            Select all visible ({selectedVisibleCount}/{filtered.length})
          </label>
        </div>
      )}
    </>
  );
}
