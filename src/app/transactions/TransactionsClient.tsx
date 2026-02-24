"use client";
// src/app/transactions/TransactionsClient.tsx

import { useState, useMemo, useEffect, useCallback } from "react";
import {
  Tx, C, font, fmtRp, fmtDate, StatusBadge,
  Toast, ConfirmModal, CsvPanel, PendingPanel,
} from "./tx-helpers";

type SyncStatus   = "idle"|"loading"|"live"|"error";
type FilterStatus = "all"|"pending"|"verified"|"rejected";

interface TransactionsClientProps {
  initialTransactions: Tx[];
}

export default function TransactionsClient({ initialTransactions }: TransactionsClientProps) {
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

  const showToast = useCallback((msg: string, type: "success"|"error" = "success") => {
    setToast({ msg, type });
  }, []);

  // ── Fetch ───────────────────────────────────────────────────────────────────
  const fetchTxs = useCallback(async () => {
    setSyncStatus("loading");
    try {
      const res = await fetch("/api/transactions");
      if (!res.ok) throw new Error((await res.json()).message ?? "Gagal memuat data");
      setTxs(await res.json());
      setSyncStatus("live");
    } catch (e: any) {
      setSyncStatus("error");
      showToast(e.message ?? "Gagal memuat transaksi", "error");
    }
  }, [showToast]);

  useEffect(() => { fetchTxs(); }, [fetchTxs]);

  // ── Derived ─────────────────────────────────────────────────────────────────
  const pending  = useMemo(() => txs.filter(t => t.status === "pending"),  [txs]);
  const verified = useMemo(() => txs.filter(t => t.status === "verified"), [txs]);
  const rejected = useMemo(() => txs.filter(t => t.status === "rejected"), [txs]);
  const totalPendingPts = useMemo(() => pending.reduce((a,t) => a + t.potentialPoints, 0), [pending]);
  const uniqueStores    = useMemo(() => [...new Set(txs.map(t => t.storeLocation).filter(Boolean))].sort(), [txs]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return txs.filter(tx => {
      const ms = !q ||
        tx.memberName.toLowerCase().includes(q) ||
        tx.transactionId.toLowerCase().includes(q) ||
        tx.docId.toLowerCase().includes(q) ||
        tx.storeLocation.toLowerCase().includes(q);
      const mf = filterStatus === "all" || tx.status === filterStatus;
      return ms && mf;
    });
  }, [txs, search, filterStatus]);

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
      if (!res.ok) throw new Error(data.message ?? "Gagal");
      showToast(
        action === "verify"
          ? `✓ Diverifikasi! +${tx.potentialPoints} pts untuk ${tx.memberName}`
          : "Transaksi ditolak.",
        action === "verify" ? "success" : "error"
      );
      await fetchTxs();
    } catch (e: any) {
      showToast(e.message ?? "Gagal memproses", "error");
    } finally {
      setLoadingId(null);
    }
  }

  // ── Verify all pending ──────────────────────────────────────────────────────
  function handleVerifyAll() {
    if (pending.length === 0) return;
    setConfirm({
      title:        "Verifikasi Semua Pending?",
      message:      `Anda akan memverifikasi ${pending.length} transaksi dan mencairkan total ${totalPendingPts.toLocaleString("id")} poin ke member. Tindakan ini tidak dapat dibatalkan.`,
      confirmLabel: `✓ Verifikasi ${pending.length} Transaksi`,
      confirmColor: C.green,
      onConfirm: async () => {
        const res = await fetch("/api/transactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ docPaths: pending.map(t => t.docPath), action: "verify" }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message ?? "Gagal");
        showToast(`✓ ${data.successCount} transaksi berhasil diverifikasi!`, "success");
        await fetchTxs();
      },
    });
  }

  // ── CSV match verify ────────────────────────────────────────────────────────
  async function handleMatchVerify(docPaths: string[]) {
    const res = await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ docPaths, action: "verify" }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message ?? "Gagal");
    await fetchTxs();
  }

  // ── Export CSV ──────────────────────────────────────────────────────────────
  function handleExport() {
    const headers = ["docId","transactionId","memberName","storeLocation","amount","potentialPoints","status","createdAt","verifiedAt"];
    const rows = filtered.map(tx => [
      tx.docId, tx.transactionId, tx.memberName, tx.storeLocation,
      tx.amount, tx.potentialPoints, tx.status, tx.createdAt ?? "", tx.verifiedAt ?? "",
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
      showToast(e.message ?? "Gagal", "error");
    } finally {
      setConfirmLoading(false);
    }
  }

  // ── Sync badge ──────────────────────────────────────────────────────────────
  const syncCfg = {
    idle:    { color: C.tx3,    label: "Idle" },
    loading: { color: C.orange, label: "Memuat…" },
    live:    { color: C.green,  label: "Live" },
    error:   { color: C.red,    label: "Error" },
  }[syncStatus];

  const summaryCards = [
    { label:"Pending",  count:pending.length,  pts:totalPendingPts, bg:"#FEF3C7", color:"#D97706", bdr:"#FDE68A" },
    { label:"Verified", count:verified.length, pts:null,            bg:"#D1FAE5", color:"#059669", bdr:"#6EE7B7" },
    { label:"Rejected", count:rejected.length, pts:null,            bg:"#FEE2E2", color:"#DC2626", bdr:"#FCA5A5" },
  ];

  const filterTabs: { key: FilterStatus; label: string }[] = [
    { key:"all",      label:`Semua (${txs.length})` },
    { key:"pending",  label:`Pending (${pending.length})` },
    { key:"verified", label:`Verified (${verified.length})` },
    { key:"rejected", label:`Rejected (${rejected.length})` },
  ];

  return (
    <>
      <div style={{ padding:"32px 32px 48px", maxWidth:1400, fontFamily:font }}>

        {/* ── Header ── */}
        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:28 }}>
          <div>
            <h1 style={{ fontSize:24, fontWeight:800, color:C.tx1, margin:0, letterSpacing:"-.02em" }}>
              Transaction Audit &amp; CSV Sync
            </h1>
            <p style={{ fontSize:13.5, color:C.tx2, marginTop:6, marginBottom:0 }}>
              Upload CSV POS → Auto-match → Verifikasi → Cairkan poin member.
            </p>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <span style={{ display:"inline-flex", alignItems:"center", gap:6, fontSize:11, fontWeight:700, color:syncCfg.color }}>
              <span style={{ width:7, height:7, borderRadius:"50%", background:syncCfg.color, display:"inline-block" }}/>
              {syncCfg.label}
            </span>
            <button onClick={fetchTxs} style={{ height:36, padding:"0 14px", borderRadius:9, border:`1.5px solid ${C.border}`, background:C.white, color:C.tx2, fontFamily:font, fontSize:12.5, fontWeight:600, cursor:"pointer" }}>
              ↻ Refresh
            </button>
            <button onClick={handleExport} style={{ height:36, padding:"0 14px", borderRadius:9, border:`1.5px solid ${C.border}`, background:C.white, color:C.tx2, fontFamily:font, fontSize:12.5, fontWeight:600, cursor:"pointer" }}>
              ⬇ Export CSV
            </button>
          </div>
        </div>

        {/* ── Summary cards ── */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14, marginBottom:20 }}>
          {summaryCards.map(c => (
            <div key={c.label} style={{ background:C.white, borderRadius:16, border:`1px solid ${c.bdr}`, boxShadow:C.shadow, padding:20 }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
                <p style={{ fontSize:12, fontWeight:600, color:C.tx2, margin:0 }}>{c.label}</p>
                <span style={{ fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:99, background:c.bg, color:c.color }}>{c.label}</span>
              </div>
              <p style={{ fontSize:32, fontWeight:800, color:c.color, margin:0, lineHeight:1 }}>{c.count}</p>
              {c.pts !== null && (
                <p style={{ fontSize:11, color:C.tx3, marginTop:6, marginBottom:0 }}>
                  {c.pts.toLocaleString("id")} pts tertahan
                </p>
              )}
            </div>
          ))}
        </div>

        {/* ── CSV + Pending row ── */}
        <div style={{ display:"grid", gridTemplateColumns:"2fr 3fr", gap:14, marginBottom:14 }}>
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
        <div style={{ background:C.white, borderRadius:18, border:`1px solid ${C.border}`, boxShadow:C.shadow, overflow:"hidden" }}>

          {/* Table toolbar */}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"16px 20px", borderBottom:`1px solid ${C.border2}` }}>
            <h2 style={{ fontSize:15, fontWeight:800, color:C.tx1, margin:0 }}>
              Riwayat Lengkap ({filtered.length})
            </h2>
            <div style={{ display:"flex", gap:8, alignItems:"center" }}>
              {/* Search */}
              <div style={{ display:"flex", alignItems:"center", gap:8, height:36, padding:"0 12px", background:C.bg, border:`1.5px solid ${searchFocus?C.blue:C.border}`, borderRadius:9, transition:"all .14s", minWidth:220 }}>
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke={C.tx3} strokeWidth={2}>
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
                <input
                  style={{ flex:1, border:"none", background:"transparent", outline:"none", fontFamily:font, fontSize:12.5, color:C.tx1 }}
                  placeholder="Cari member, ID, outlet…"
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
          <div style={{ display:"flex", gap:0, padding:"0 20px", borderBottom:`1px solid ${C.border2}` }}>
            {filterTabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setFilterStatus(tab.key)}
                style={{
                  height:40, padding:"0 16px", border:"none", background:"transparent",
                  fontFamily:font, fontSize:12.5, fontWeight:filterStatus===tab.key?700:500,
                  color:filterStatus===tab.key?C.blue:C.tx2, cursor:"pointer",
                  borderBottom:filterStatus===tab.key?`2px solid ${C.blue}`:"2px solid transparent",
                  transition:"all .14s",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Table */}
          {filtered.length === 0 ? (
            <div style={{ padding:"64px 16px", textAlign:"center" }}>
              <p style={{ fontSize:32, marginBottom:8 }}>📭</p>
              <p style={{ fontSize:14, fontWeight:700, color:C.tx1 }}>Tidak ada transaksi</p>
              <p style={{ fontSize:12.5, color:C.tx3, marginTop:4 }}>
                {search ? `Tidak ada hasil untuk "${search}"` : "Belum ada data transaksi."}
              </p>
            </div>
          ) : (
            <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse" }}>
                <thead style={{ background:"#F8FAFF" }}>
                  <tr>
                    {["Document ID","Member","Outlet","Tanggal","Jumlah","Poin","Status","Aksi"].map(h => (
                      <th key={h} style={{ textAlign:"left", fontSize:11, fontWeight:700, color:C.tx3, textTransform:"uppercase", letterSpacing:".06em", padding:"10px 16px", whiteSpace:"nowrap" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(tx => (
                    <tr key={tx.docId} style={{ borderTop:`1px solid ${C.border2}`, transition:"background .12s" }}
                      onMouseEnter={e => (e.currentTarget.style.background="#F8FAFF")}
                      onMouseLeave={e => (e.currentTarget.style.background="transparent")}
                    >
                      <td style={{ padding:"12px 16px" }}>
                        <code style={{ fontSize:10, fontFamily:"monospace", color:C.blue, background:C.blueL, padding:"2px 7px", borderRadius:5 }}>
                          {tx.docId}
                        </code>
                      </td>
                      <td style={{ padding:"12px 16px" }}>
                        <p style={{ fontSize:13, fontWeight:600, color:C.tx1, margin:0 }}>{tx.memberName}</p>
                        <p style={{ fontSize:10.5, color:C.tx3, margin:0, marginTop:2 }}>{tx.memberId}</p>
                      </td>
                      <td style={{ padding:"12px 16px", fontSize:12.5, color:C.tx2, whiteSpace:"nowrap" }}>{tx.storeLocation}</td>
                      <td style={{ padding:"12px 16px", fontSize:12, color:C.tx2, whiteSpace:"nowrap" }}>{fmtDate(tx.createdAt)}</td>
                      <td style={{ padding:"12px 16px", fontSize:13, fontWeight:700, color:C.tx1, whiteSpace:"nowrap" }}>{fmtRp(tx.amount)}</td>
                      <td style={{ padding:"12px 16px" }}>
                        <span style={{ fontSize:12, fontWeight:700, color:C.blue }}>{tx.potentialPoints} pts</span>
                      </td>
                      <td style={{ padding:"12px 16px" }}>
                        <StatusBadge status={tx.status}/>
                      </td>
                      <td style={{ padding:"12px 16px" }}>
                        {tx.status === "pending" && (
                          <div style={{ display:"flex", gap:6 }}>
                            <button
                              onClick={() => handleAction(tx, "verify")}
                              disabled={loadingId === tx.docId}
                              style={{ height:30, padding:"0 12px", borderRadius:8, border:"1px solid #6EE7B7", background:"#F0FDF4", color:C.green, fontFamily:font, fontSize:11.5, fontWeight:700, cursor:loadingId===tx.docId?"not-allowed":"pointer" }}
                            >
                              {loadingId === tx.docId ? "…" : "✓ Verifikasi"}
                            </button>
                            <button
                              onClick={() => handleAction(tx, "reject")}
                              disabled={loadingId === tx.docId}
                              style={{ height:30, padding:"0 12px", borderRadius:8, border:"1px solid #FCA5A5", background:"#FFF5F5", color:C.red, fontFamily:font, fontSize:11.5, fontWeight:700, cursor:loadingId===tx.docId?"not-allowed":"pointer" }}
                            >
                              ✕ Tolak
                            </button>
                          </div>
                        )}
                        {tx.status !== "pending" && (
                          <span style={{ fontSize:11, color:C.tx3 }}>
                            {fmtDate(tx.verifiedAt)}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

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
    </>
  );
}
