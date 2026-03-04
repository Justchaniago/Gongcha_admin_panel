"use client";
// src/app/transactions/tx-helpers.tsx
// Sub-components for TransactionsClient

import { useState, useEffect, useRef } from "react";

export interface Tx {
  docId: string; docPath: string; transactionId: string; memberName: string;
  memberId: string; staffId: string; storeLocation: string; amount: number;
  potentialPoints: number; type?: "earn"|"redeem"; status: "pending"|"verified"|"rejected";
  createdAt: string|null; verifiedAt: string|null; verifiedBy: string|null;
}

export interface CsvRow {
  transactionId: string;
  amount: number;
  date: string;
  [key: string]: any;
}

export const C = {
  bg:"#F4F6FB", white:"#FFFFFF", border:"#EAECF2", border2:"#F0F2F7",
  tx1:"#0F1117", tx2:"#4A5065", tx3:"#9299B0",
  blue:"#4361EE", blueL:"#EEF2FF",
  green:"#059669", greenBg:"#D1FAE5",
  orange:"#D97706", orangeBg:"#FEF3C7",
  red:"#DC2626", redBg:"#FEE2E2",
  shadow:"0 1px 3px rgba(16,24,40,.06)",
  shadowLg:"0 20px 60px rgba(16,24,40,.18)",
} as const;
export const font = "'Plus Jakarta Sans',system-ui,sans-serif";
export const fmtRp = (n: number) => "Rp " + n.toLocaleString("id-ID");
export const fmtDate = (iso: string|null) => {
  if (!iso) return "-";
  try { return new Date(iso).toLocaleDateString("id-ID",{day:"2-digit",month:"short",year:"numeric"}); }
  catch { return iso; }
};

export function parseCSV(text: string): Record<string,string>[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g,"").toLowerCase());
  return lines.slice(1).map(line => {
    const vals = line.split(",").map(v => v.trim().replace(/^"|"$/g,""));
    const row: Record<string,string> = {};
    headers.forEach((h,i) => { row[h] = vals[i] ?? ""; });
    return row;
  });
}

// Extract transactionId, amount, date from CSV row with flexible column name matching
export function extractPosData(row: Record<string,string>): { transactionId: string; amount: number; date: string } | null {
  // Find transaction ID column
  const txIdKey = Object.keys(row).find(k => 
    ["transactionid", "transaction_id", "id", "txid", "no_transaksi", "nomor_transaksi"].includes(k.toLowerCase())
  );
  const txId = txIdKey ? row[txIdKey]?.trim() : "";
  if (!txId) return null;

  // Find amount column
  const amountKey = Object.keys(row).find(k => 
    ["amount", "total", "quantity_value", "nilai", "harga", "subtotal"].includes(k.toLowerCase())
  );
  const amountStr = amountKey ? row[amountKey]?.trim() : "";
  const amount = amountStr ? parseFloat(amountStr.replace(/[^0-9.-]/g, "")) : 0;
  if (isNaN(amount) || amount <= 0) return null;

  // Find date column
  const dateKey = Object.keys(row).find(k => 
    ["date", "transaction_date", "tanggal", "tgl", "created_at"].includes(k.toLowerCase())
  );
  const dateStr = dateKey ? row[dateKey]?.trim() : "";
  // Parse date format: could be YYYY-MM-DD, DD/MM/YYYY, or MM/DD/YYYY
  let date = "";
  if (dateStr.includes("-")) {
    date = dateStr;
  } else if (dateStr.includes("/")) {
    const parts = dateStr.split("/");
    if (parts.length === 3) {
      const d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
      if (!isNaN(d.getTime())) {
        date = d.toISOString().split("T")[0];
      }
    }
  }
  if (!date) return null;

  return { transactionId: txId, amount, date };
}

// ── Toast ─────────────────────────────────────────────────────────────────────
export function Toast({ msg, type, onDone }: { msg: string; type: "success"|"error"; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 3500); return () => clearTimeout(t); }, [onDone]);
  return (
    <div style={{
      position:"fixed", bottom:28, right:28, zIndex:9999,
      padding:"13px 20px", borderRadius:13, fontFamily:font, fontSize:13.5,
      fontWeight:600, color:"#fff",
      background: type==="success" ? C.green : C.red,
      boxShadow:"0 8px 32px rgba(0,0,0,.22)",
      display:"flex", alignItems:"center", gap:10, animation:"gcRise .28s ease",
    }}>
      {type==="success" ? "✓" : "✕"} {msg}
      <style>{`@keyframes gcRise{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}`}</style>
    </div>
  );
}

// ── Status Badge ──────────────────────────────────────────────────────────────
const STATUS_CFG = {
  pending:  { label:"Pending",  bg:"#FEF3C7", color:"#D97706" },
  verified: { label:"Verified", bg:"#D1FAE5", color:"#059669" },
  rejected: { label:"Rejected", bg:"#FEE2E2", color:"#DC2626" },
};
export function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status as keyof typeof STATUS_CFG] ?? STATUS_CFG.pending;
  return (
    <span style={{ display:"inline-block", padding:"3px 10px", borderRadius:99, background:cfg.bg, color:cfg.color, fontSize:11, fontWeight:700 }}>
      {cfg.label}
    </span>
  );
}

// ── Confirm Modal ─────────────────────────────────────────────────────────────
export function ConfirmModal({ title, message, confirmLabel, confirmColor, onConfirm, onClose, loading }: {
  title: string; message: string; confirmLabel: string; confirmColor: string;
  onConfirm: () => void; onClose: () => void; loading: boolean;
}) {
  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position:"fixed", inset:0, zIndex:50, display:"flex", alignItems:"center", justifyContent:"center", padding:24, background:"rgba(10,12,20,.52)", backdropFilter:"blur(8px)", fontFamily:font }}
    >
      <div style={{ background:C.white, borderRadius:20, width:"100%", maxWidth:440, boxShadow:C.shadowLg, padding:"32px 28px", animation:"gcRise .22s ease" }}>
        <h2 style={{ fontSize:20, fontWeight:800, color:C.tx1, marginBottom:10 }}>{title}</h2>
        <p style={{ fontSize:13.5, color:C.tx2, lineHeight:1.6, marginBottom:24 }}>{message}</p>
        <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
          <button onClick={onClose} style={{ height:40, padding:"0 20px", borderRadius:9, border:`1.5px solid ${C.border}`, background:C.white, color:C.tx2, fontFamily:font, fontSize:13.5, fontWeight:600, cursor:"pointer" }}>
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading} style={{ height:40, padding:"0 22px", borderRadius:9, border:"none", background:loading?"#9ca3af":confirmColor, color:"#fff", fontFamily:font, fontSize:13.5, fontWeight:600, cursor:loading?"not-allowed":"pointer" }}>
            {loading ? "Processing…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── CSV Upload Panel ──────────────────────────────────────────────────────────
export function CsvPanel({ pendingTxs, stores, onMatchVerify, onToast }: {
  pendingTxs: Tx[];
  stores: string[];
  onMatchVerify: (rows: Array<{ tx: Tx; posData: { transactionId: string; amount: number; date: string } }>) => Promise<void>;
  onToast: (msg: string, type: "success"|"error") => void;
}) {
  const [dragging,  setDragging]  = useState(false);
  const [csvRows,   setCsvRows]   = useState<Record<string,string>[]>([]);
  const [fileName,  setFileName]  = useState("");
  const [matched,   setMatched]   = useState<Array<{ tx: Tx; posData: { transactionId: string; amount: number; date: string } }>>([]);
  const [unmatched, setUnmatched] = useState<Record<string,string>[]>([]);
  const [loading,   setLoading]   = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function processFile(file: File) {
    if (!file.name.endsWith(".csv")) { onToast("File harus berformat .csv","error"); return; }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const rows = parseCSV(e.target?.result as string);
      setCsvRows(rows);
      const matchedRows: Array<{ tx: Tx; posData: { transactionId: string; amount: number; date: string } }> = [];
      const unmatchedRows: Record<string,string>[] = [];
      
      rows.forEach(row => {
        const posData = extractPosData(row);
        if (!posData) { unmatchedRows.push(row); return; }
        
        const found = pendingTxs.find(tx => 
          tx.transactionId.toLowerCase() === posData.transactionId.toLowerCase()
        );
        
        if (found) {
          matchedRows.push({ tx: found, posData });
        } else {
          unmatchedRows.push(row);
        }
      });
      
      setMatched(matchedRows);
      setUnmatched(unmatchedRows);
    };
    reader.readAsText(file);
  }

  async function handleBulkVerify() {
    if (matched.length === 0) return;
    setLoading(true);
    try {
      await onMatchVerify(matched);
      onToast(`✓ ${matched.length} transactions verified successfully!`, "success");
      setCsvRows([]); setMatched([]); setUnmatched([]); setFileName("");
    } catch (e: any) {
      onToast(e.message ?? "Failed", "error");
    } finally {
      setLoading(false);
    }
  }

  const btnDisabled = matched.length === 0 || loading;

  return (
    <div style={{ background:C.white, borderRadius:18, border:`1px solid ${C.border}`, boxShadow:C.shadow, padding:20, display:"flex", flexDirection:"column", gap:14 }}>
      <h2 style={{ fontSize:15, fontWeight:800, color:C.tx1, margin:0 }}>Upload CSV from POS</h2>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) processFile(f); }}
        onClick={() => fileRef.current?.click()}
        style={{ border:`2px dashed ${dragging?C.blue:"#C7D2FE"}`, borderRadius:14, padding:"24px 16px", textAlign:"center", cursor:"pointer", transition:"all .2s", background:dragging?C.blueL:"#FAFBFF" }}
      >
        <div style={{ width:44, height:44, borderRadius:12, background:C.blueL, display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 10px" }}>
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke={C.blue} strokeWidth={1.8}>
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
        </div>
        {fileName
          ? <p style={{ fontSize:13, fontWeight:700, color:C.blue }}>{fileName}</p>
          : <>
              <p style={{ fontSize:13, fontWeight:700, color:C.tx1 }}>Drag & Drop file CSV</p>
              <p style={{ fontSize:11, color:C.tx3, marginTop:4 }}>or click to select file</p>
            </>
        }
        <p style={{ fontSize:10, color:C.tx3, marginTop:6 }}>Format: .csv from Gong Cha POS machine</p>
        <input ref={fileRef} type="file" accept=".csv" style={{ display:"none" }} onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f); }}/>
      </div>

      {/* Filters */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
        <div>
          <p style={{ fontSize:11, color:C.tx2, fontWeight:600, marginBottom:5 }}>Filter Outlet</p>
          <select style={{ width:"100%", height:36, borderRadius:9, border:`1.5px solid ${C.border}`, background:C.bg, padding:"0 10px", fontFamily:font, fontSize:12.5, color:C.tx1, outline:"none" }}>
            <option value="all">All Outlets</option>
            {stores.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <p style={{ fontSize:11, color:C.tx2, fontWeight:600, marginBottom:5 }}>Date</p>
          <input type="date" style={{ width:"100%", height:36, borderRadius:9, border:`1.5px solid ${C.border}`, background:C.bg, padding:"0 10px", fontFamily:font, fontSize:12.5, color:C.tx1, outline:"none", boxSizing:"border-box" }}/>
        </div>
      </div>

      {/* Match results */}
      {csvRows.length > 0 && (
        <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
          <div style={{ padding:"10px 14px", borderRadius:10, background:matched.length>0?C.greenBg:C.orangeBg, border:`1px solid ${matched.length>0?"#6EE7B7":"#FDE68A"}` }}>
            <p style={{ fontSize:12.5, fontWeight:700, color:matched.length>0?C.green:C.orange, margin:0 }}>
              {matched.length > 0
                ? `✓ ${matched.length} transactions matched from ${csvRows.length} CSV rows - Ready for POS verification`
                : `⚠ No matches found from ${csvRows.length} CSV rows`}
            </p>
          </div>
          {unmatched.length > 0 && (
            <p style={{ fontSize:11, color:C.tx3, margin:0 }}>{unmatched.length} rows not matched or incomplete POS data.</p>
          )}
        </div>
      )}

      {/* Action */}
      <button
        onClick={handleBulkVerify}
        disabled={btnDisabled}
        style={{ width:"100%", height:42, borderRadius:11, border:"none", background:btnDisabled?"#9ca3af":"linear-gradient(135deg,#4361EE,#3A0CA3)", color:"#fff", fontFamily:font, fontSize:13.5, fontWeight:700, cursor:btnDisabled?"not-allowed":"pointer", transition:"all .2s" }}
      >
        {loading ? "Verifying with POS data…" : matched.length > 0 ? `✓ Verify ${matched.length} Transactions vs POS` : "Verify & Match POS"}
      </button>

      {/* Format hint */}
      <div style={{ padding:"10px 14px", borderRadius:10, background:C.bg, border:`1px solid ${C.border2}` }}>
        <p style={{ fontSize:11, fontWeight:700, color:C.tx2, marginBottom:4 }}>Supported CSV format:</p>
        <code style={{ fontSize:10, color:C.tx3, lineHeight:1.8, display:"block" }}>
          transactionId,amount,date<br/>
          101384,61000,2026-03-01<br/>
          or<br/>
          no_transaksi,total,tanggal<br/>
          101385,45000,01/03/2026
        </code>
      </div>
    </div>
  );
}

// ── Rejected List Panel ──────────────────────────────────────────────────────
export function RejectedPanel({ rejected, onApprove, onReject, loadingId }: {
  rejected: Tx[];
  onApprove: (tx: Tx) => void;
  onReject: (tx: Tx) => void;
  loadingId: string|null;
}) {
  return (
    <div style={{ background:C.white, borderRadius:18, border:`1px solid ${C.border}`, boxShadow:C.shadow, padding:20, display:"flex", flexDirection:"column" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
        <h2 style={{ fontSize:15, fontWeight:800, color:C.tx1, margin:0 }}>Rejected - Manual Review ({rejected.length})</h2>
      </div>
      <div style={{ overflowY:"auto", maxHeight:380, display:"flex", flexDirection:"column", gap:8 }}>
        {rejected.length === 0 ? (
          <div style={{ padding:"48px 16px", textAlign:"center" }}>
            <p style={{ fontSize:28, marginBottom:8 }}>✓</p>
            <p style={{ fontSize:13.5, fontWeight:700, color:C.tx1 }}>No rejections</p>
            <p style={{ fontSize:12, color:C.tx3, marginTop:4 }}>All transactions match POS data.</p>
          </div>
        ) : rejected.map(tx => (
          <div key={tx.docId} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 12px", borderRadius:12, border:`1px solid ${loadingId===tx.docId?C.red:"#FCA5A5"}`, background:loadingId===tx.docId?"#FFF5F5":C.white, transition:"all .15s" }}>
            <div style={{ flex:1, minWidth:0 }}>
              <code style={{ fontSize:10, color:C.red, fontFamily:"monospace" }}>{tx.transactionId || "—"}</code>
              <p style={{ fontSize:11.5, color:C.tx2, marginTop:2, marginBottom:0 }}>{tx.memberName} · {tx.storeLocation}</p>
              <p style={{ fontSize:12, fontWeight:700, color:C.tx1, marginTop:2, marginBottom:0 }}>
                {fmtRp(tx.amount)} · <span style={{ color:C.blue }}>{tx.potentialPoints} pts</span>
              </p>
            </div>
            <div style={{ display:"flex", gap:6, flexShrink:0 }}>
              <button
                onClick={() => onApprove(tx)}
                disabled={loadingId === tx.docId}
                title="Approve despite mismatch"
                style={{ width:32, height:32, borderRadius:9, border:"1px solid #6EE7B7", background:"#F0FDF4", color:C.green, fontSize:14, fontWeight:700, cursor:loadingId===tx.docId?"not-allowed":"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}
              >
                {loadingId === tx.docId ? "…" : "✓"}
              </button>
              <button
                onClick={() => onReject(tx)}
                disabled={loadingId === tx.docId}
                title="Reject permanently"
                style={{ width:32, height:32, borderRadius:9, border:"1px solid #FCA5A5", background:"#FFF5F5", color:C.red, fontSize:14, fontWeight:700, cursor:loadingId===tx.docId?"not-allowed":"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PendingPanel({ pending, onVerify, onReject, onVerifyAll, loadingId }: {
  pending: Tx[];
  onVerify: (tx: Tx) => void;
  onReject: (tx: Tx) => void;
  onVerifyAll: () => void;
  loadingId: string|null;
}) {
  return (
    <div style={{ background:C.white, borderRadius:18, border:`1px solid ${C.border}`, boxShadow:C.shadow, padding:20, display:"flex", flexDirection:"column" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
        <h2 style={{ fontSize:15, fontWeight:800, color:C.tx1, margin:0 }}>Pending ({pending.length})</h2>
        {pending.length > 0 && (
          <button onClick={onVerifyAll} style={{ height:34, padding:"0 14px", borderRadius:9, border:"none", background:C.green, color:"#fff", fontFamily:font, fontSize:12, fontWeight:700, cursor:"pointer" }}>
            ✓ Verify All
          </button>
        )}
      </div>
      <div style={{ overflowY:"auto", maxHeight:380, display:"flex", flexDirection:"column", gap:8 }}>
        {pending.length === 0 ? (
          <div style={{ padding:"48px 16px", textAlign:"center" }}>
            <p style={{ fontSize:28, marginBottom:8 }}>🎉</p>
            <p style={{ fontSize:13.5, fontWeight:700, color:C.tx1 }}>All clear!</p>
            <p style={{ fontSize:12, color:C.tx3, marginTop:4 }}>No pending transactions.</p>
          </div>
        ) : pending.map(tx => (
          <div key={tx.docId} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 12px", borderRadius:12, border:`1px solid ${loadingId===tx.docId?C.blue:C.border}`, background:loadingId===tx.docId?C.blueL:C.white, transition:"all .15s" }}>
            <div style={{ flex:1, minWidth:0 }}>
              <code style={{ fontSize:10, color:C.blue, fontFamily:"monospace" }}>{tx.transactionId || "—"}</code>
              <p style={{ fontSize:11.5, color:C.tx2, marginTop:2, marginBottom:0 }}>{tx.memberName} · {tx.storeLocation}</p>
              <p style={{ fontSize:12, fontWeight:700, color:C.tx1, marginTop:2, marginBottom:0 }}>
                {fmtRp(tx.amount)} · <span style={{ color:C.blue }}>{tx.potentialPoints} pts</span>
              </p>
            </div>
            <div style={{ display:"flex", gap:6, flexShrink:0 }}>
              <button
                onClick={() => onVerify(tx)}
                disabled={loadingId === tx.docId}
                title="Verify"
                style={{ width:32, height:32, borderRadius:9, border:"1px solid #6EE7B7", background:"#F0FDF4", color:C.green, fontSize:14, fontWeight:700, cursor:loadingId===tx.docId?"not-allowed":"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}
              >
                {loadingId === tx.docId ? "…" : "✓"}
              </button>
              <button
                onClick={() => onReject(tx)}
                disabled={loadingId === tx.docId}
                title="Reject"
                style={{ width:32, height:32, borderRadius:9, border:"1px solid #FCA5A5", background:"#FFF5F5", color:C.red, fontSize:14, fontWeight:700, cursor:loadingId===tx.docId?"not-allowed":"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
