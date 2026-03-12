"use client";
// src/app/transactions/tx-helpers.tsx
// Sub-components for TransactionsClient

import { useState, useEffect, useRef } from "react";
import { GcButton, GcModalShell } from "@/components/ui/gc";

export type TxStatus = "PENDING" | "COMPLETED" | "CANCELLED" | "REFUNDED";

export interface Tx {
  docId: string; docPath: string;
  // Primary field per schema
  receiptNumber: string;
  // Legacy alias for backward compatibility
  transactionId?: string;
  memberName: string;
  userId?: string | null;
  memberId?: string;
  staffId: string;
  // Primary fields per schema
  storeId?: string;
  storeName?: string;
  // Legacy alias for backward compatibility
  storeLocation?: string;
  totalAmount: number;
  // Legacy alias for backward compatibility
  amount?: number;
  potentialPoints?: number;
  type?: "earn" | "redeem";
  status: TxStatus;
  createdAt: string|null; verifiedAt: string|null; verifiedBy: string|null;
}

export interface CsvRow {
  receiptNumber: string;
  amount: number;
  date: string;
  [key: string]: any;
}

export const C = {
  bg:"#F9FAFB", white:"#FFFFFF", border:"#E5E7EB", border2:"#F3F4F6",
  tx1:"#111827", tx2:"#374151", tx3:"#6B7280",
  blue:"#3B82F6", blueL:"#DBEAFE",
  green:"#059669", greenBg:"#D1FAE5",
  orange:"#D97706", orangeBg:"#FEF3C7",
  red:"#DC2626", redBg:"#FEE2E2",
  shadow:"0 1px 3px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.04)",
  shadowLg:"0 20px 60px rgba(0,0,0,.18), 0 4px 16px rgba(0,0,0,.10)",
} as const;
export const font = "Inter, system-ui, sans-serif";
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

export function normalizeTxStatus(status: string | null | undefined): TxStatus {
  switch ((status ?? "").toUpperCase()) {
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

// Helper to get receipt number (supports both legacy and new schema)
export const getReceiptNumber = (tx: Tx) => tx.receiptNumber || tx.transactionId || "";
// Helper to get store label (supports both legacy and new schema)
export const getStoreLabel = (tx: Tx) => tx.storeName || tx.storeLocation || tx.storeId || "-";
// Helper to get amount (supports both legacy and new schema)
export const getAmount = (tx: Tx) => tx.amount ?? tx.totalAmount ?? 0;
// Helper to get user reference (supports both legacy and new schema)
export const getUserRef = (tx: Tx) => tx.userId || tx.memberId || "";

export function extractPosData(row: Record<string,string>): { receiptNumber: string; amount: number; date: string } | null {
  // Find receipt / transaction ID column
  const txIdKey = Object.keys(row).find(k => 
    ["receiptnumber", "receipt_number", "transactionid", "transaction_id", "id", "txid", "no_transaksi", "nomor_transaksi"].includes(k.toLowerCase())
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

  return { receiptNumber: txId, amount, date };
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
  PENDING:    { label:"Pending",    bg:"#FEF3C7", color:"#D97706" },
  COMPLETED:  { label:"Completed",  bg:"#D1FAE5", color:"#059669" },
  CANCELLED:  { label:"Cancelled",  bg:"#FEE2E2", color:"#DC2626" },
  REFUNDED:   { label:"Refunded",   bg:"#FEF3C7", color:"#D97706" },
  // Legacy lowercase support
  pending:    { label:"Pending",    bg:"#FEF3C7", color:"#D97706" },
  verified:   { label:"Verified",   bg:"#D1FAE5", color:"#059669" },
  rejected:   { label:"Rejected",   bg:"#FEE2E2", color:"#DC2626" },
};
export function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status as keyof typeof STATUS_CFG] ?? STATUS_CFG.PENDING;
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
  const variant = confirmColor === C.red ? "danger" : confirmColor === C.green ? "primary" : "blue";
  return (
    <GcModalShell
      onClose={onClose}
      title={title}
      eyebrow="Confirmation"
      description={message}
      maxWidth={460}
      footer={
        <>
          <GcButton variant="ghost" size="lg" onClick={onClose} disabled={loading}>
            Cancel
          </GcButton>
          <GcButton variant={variant as "danger" | "primary" | "blue"} size="lg" onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </GcButton>
        </>
      }
    >
      <div style={{ paddingTop: 2, color: C.tx3, fontSize: 12.5 }}>
        Review this action carefully before continuing.
      </div>
    </GcModalShell>
  );
}

// ── CSV Upload Panel ──────────────────────────────────────────────────────────
export function CsvPanel({ pendingTxs, stores, onMatchVerify, onToast }: {
  pendingTxs: Tx[];
  stores: string[];
  onMatchVerify: (rows: Array<{ tx: Tx; posData: { receiptNumber: string; amount: number; date: string } }>) => Promise<void>;
  onToast: (msg: string, type: "success"|"error") => void;
}) {
  const [dragging,  setDragging]  = useState(false);
  const [csvRows,   setCsvRows]   = useState<Record<string,string>[]>([]);
  const [fileName,  setFileName]  = useState("");
  const [matched,   setMatched]   = useState<Array<{ tx: Tx; posData: { receiptNumber: string; amount: number; date: string } }>>([]);
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
      const matchedRows: Array<{ tx: Tx; posData: { receiptNumber: string; amount: number; date: string } }> = [];
      const unmatchedRows: Record<string,string>[] = [];
      
      rows.forEach(row => {
        const posData = extractPosData(row);
        if (!posData) { unmatchedRows.push(row); return; }
        
        const found = pendingTxs.find(tx => 
          getReceiptNumber(tx).toLowerCase() === posData.receiptNumber.toLowerCase()
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
    <div style={{ background:C.white, borderRadius:16, border:`1px solid ${C.border}`, boxShadow:C.shadow, padding:20, display:"flex", flexDirection:"column", gap:14 }}>
      <h2 style={{ fontSize:15, fontWeight:800, color:C.tx1, margin:0 }}>Upload CSV from POS</h2>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) processFile(f); }}
        onClick={() => fileRef.current?.click()}
        style={{ border:`2px dashed ${dragging?C.blue:C.border}`, borderRadius:14, padding:"24px 16px", textAlign:"center", cursor:"pointer", transition:"all .2s", background:dragging?C.blueL:C.bg }}
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
          <select style={{ width:"100%", height:38, borderRadius:9, border:`1.5px solid ${C.border}`, background:C.bg, padding:"0 12px", fontFamily:font, fontSize:13, color:C.tx1, outline:"none" }}>
            <option value="all">All Outlets</option>
            {stores.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <p style={{ fontSize:11, color:C.tx2, fontWeight:600, marginBottom:5 }}>Date</p>
          <input type="date" style={{ width:"100%", height:38, borderRadius:9, border:`1.5px solid ${C.border}`, background:C.bg, padding:"0 12px", fontFamily:font, fontSize:13, color:C.tx1, outline:"none", boxSizing:"border-box" }}/>
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
        style={{ width:"100%", height:42, borderRadius:9, border:"none", background:btnDisabled?"#F3F4F6":C.green, color:btnDisabled?C.tx3:"#fff", fontFamily:font, fontSize:13.5, fontWeight:700, cursor:btnDisabled?"not-allowed":"pointer", transition:"all .15s" }}
      >
        {loading ? "Verifying with POS data…" : matched.length > 0 ? `✓ Verify ${matched.length} Transactions vs POS` : "Verify & Match POS"}
      </button>

      {/* Format hint */}
      <div style={{ padding:"10px 14px", borderRadius:10, background:C.bg, border:`1px solid ${C.border2}` }}>
        <p style={{ fontSize:11, fontWeight:700, color:C.tx2, marginBottom:4 }}>Supported CSV format:</p>
        <code style={{ fontSize:10, color:C.tx3, lineHeight:1.8, display:"block" }}>
          receiptNumber,amount,date<br/>
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
    <div style={{ background:C.white, borderRadius:16, border:`1px solid ${C.border}`, boxShadow:C.shadow, padding:20, display:"flex", flexDirection:"column" }}>
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
              <code style={{ fontSize:10, color:C.red, fontFamily:"monospace" }}>{getReceiptNumber(tx) || "—"}</code>
              <p style={{ fontSize:11.5, color:C.tx2, marginTop:2, marginBottom:0 }}>{tx.memberName} · {getStoreLabel(tx)}</p>
              <p style={{ fontSize:12, fontWeight:700, color:C.tx1, marginTop:2, marginBottom:0 }}>
                {fmtRp(getAmount(tx))} · <span style={{ color:C.blue }}>{tx.potentialPoints ?? 0} pts</span>
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
    <div style={{ background:C.white, borderRadius:16, border:`1px solid ${C.border}`, boxShadow:C.shadow, padding:20, display:"flex", flexDirection:"column" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
        <h2 style={{ fontSize:15, fontWeight:800, color:C.tx1, margin:0 }}>Pending ({pending.length})</h2>
        {pending.length > 0 && (
          <button onClick={onVerifyAll} style={{ height:34, padding:"0 14px", borderRadius:7, border:"none", background:C.green, color:"#fff", fontFamily:font, fontSize:12, fontWeight:700, cursor:"pointer" }}>
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
              <code style={{ fontSize:10, color:C.blue, fontFamily:"monospace" }}>{getReceiptNumber(tx) || "—"}</code>
              <p style={{ fontSize:11.5, color:C.tx2, marginTop:2, marginBottom:0 }}>{tx.memberName} · {getStoreLabel(tx)}</p>
              <p style={{ fontSize:12, fontWeight:700, color:C.tx1, marginTop:2, marginBottom:0 }}>
                {fmtRp(getAmount(tx))} · <span style={{ color:C.blue }}>{tx.potentialPoints ?? 0} pts</span>
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
