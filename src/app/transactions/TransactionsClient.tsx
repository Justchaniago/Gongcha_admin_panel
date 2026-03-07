"use client";
// src/app/transactions/TransactionsClient.tsx

import { useState, useMemo, useEffect, useCallback } from "react";
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import {
  Tx, C, font, fmtRp, fmtDate,
  StatusBadge, Toast, VerifyTxModal,
} from "./tx-helpers";

type SyncStatus   = "connecting" | "live" | "error";
type FilterStatus = "all" | "NEEDS_REVIEW" | "COMPLETED" | "FRAUD" | "FLAGGED" | "REFUNDED";

interface Props {
  initialRole: string;
}

export default function TransactionsClient({ initialRole }: Props) {
  const [txs,           setTxs]           = useState<Tx[]>([]);
  const [syncStatus,    setSyncStatus]     = useState<SyncStatus>("connecting");
  const [search,        setSearch]         = useState("");
  const [filterStatus,  setFilterStatus]   = useState<FilterStatus>("all");
  const [toast,         setToast]          = useState<{ msg: string; type: "success" | "error" } | null>(null);

  // ── Modal verifikasi state ──────────────────────────────────────────────────
  const [verifyTx,      setVerifyTx]       = useState<Tx | null>(null);
  const [verifyLoading, setVerifyLoading]  = useState(false);

  const showToast = useCallback((msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
  }, []);

  // ── Pilar 4: Efisiensi Query — onSnapshot + orderBy(timestamp,desc) + limit(100) ──
  useEffect(() => {
    setSyncStatus("connecting");
    const q = query(
      collection(db, "transactions"),
      orderBy("timestamp", "desc"),
      limit(100)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows: Tx[] = snap.docs.map((doc) => {
          const d = doc.data();
          return {
            docId:           doc.id,
            docPath:         doc.ref.path,
            transactionId:   d.transactionId ?? doc.id,
            memberName:      d.memberName    ?? "-",
            memberId:        d.memberId      ?? "",
            staffId:         d.staffId       ?? "",
            storeLocation:   d.storeLocation ?? "-",
            amount:          d.amount        ?? 0,
            potentialPoints: d.potentialPoints ?? 0,
            status:          (d.status ?? "NEEDS_REVIEW") as Tx["status"],
            createdAt:   d.timestamp  ? d.timestamp.toDate().toISOString()  : null,
            verifiedAt:  d.verifiedAt ? d.verifiedAt.toDate().toISOString() : null,
            verifiedBy:  d.verifiedBy ?? null,
          };
        });
        setTxs(rows);
        setSyncStatus("live");
      },
      (err) => {
        console.error("[transactions onSnapshot]", err);
        setSyncStatus("error");
        showToast("Gagal memuat transaksi realtime", "error");
      }
    );

    return () => unsub();
  }, [showToast]);

  // ── Filter + Search (client-side, data sudah di-caps di limit 100) ─────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return txs.filter((tx) => {
      const ms =
        !q ||
        tx.transactionId.toLowerCase().includes(q) ||
        tx.memberName.toLowerCase().includes(q) ||
        tx.storeLocation.toLowerCase().includes(q);
      const mf = filterStatus === "all" || tx.status === filterStatus;
      return ms && mf;
    });
  }, [txs, search, filterStatus]);

  // ── Summary counts ──────────────────────────────────────────────────────────
  const counts = useMemo(() => ({
    NEEDS_REVIEW: txs.filter(t => t.status === "NEEDS_REVIEW").length,
    COMPLETED:    txs.filter(t => t.status === "COMPLETED").length,
    FRAUD:        txs.filter(t => t.status === "FRAUD").length,
    REFUNDED:     txs.filter(t => t.status === "REFUNDED").length,
  }), [txs]);

  // ── Pilar 1 + 2 + 3: Verifikasi dengan loading guard (anti double-click) ───
  async function handleVerify(action: "approve" | "reject") {
    if (!verifyTx || verifyLoading) return;
    setVerifyLoading(true);
    try {
      const res = await fetch("/api/transactions/verify", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ transactionId: verifyTx.docId, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Gagal memproses");
      showToast(data.message, "success");
      setVerifyTx(null);
    } catch (err: any) {
      showToast(err.message ?? "Terjadi kesalahan", "error");
    } finally {
      setVerifyLoading(false);
    }
  }

  // ── Sync badge ──────────────────────────────────────────────────────────────
  const syncBadge = {
    connecting: { bg: "#FEF3C7", color: "#D97706", dot: "🟡", label: "Menghubungkan…" },
    live:       { bg: "#D1FAE5", color: "#059669", dot: "🟢", label: `Live · ${txs.length} docs` },
    error:      { bg: "#FEE2E2", color: "#DC2626", dot: "🔴", label: "Error" },
  }[syncStatus];

  return (
    <div style={{ fontFamily: font, padding: "28px 32px", maxWidth: 1400, WebkitFontSmoothing: "antialiased" }}>

      {/* ── PAGE HEADER ── */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: C.tx3, marginBottom: 4 }}>
            Gong Cha Admin
          </p>
          <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-.025em", color: C.tx1, margin: 0 }}>
            Transaksi
          </h1>
          <p style={{ fontSize: 13, color: C.tx2, marginTop: 4 }}>100 transaksi terbaru · realtime</p>
        </div>
        <span style={{ padding: "6px 14px", borderRadius: 99, background: syncBadge.bg, color: syncBadge.color, fontSize: 12, fontWeight: 700 }}>
          {syncBadge.dot} {syncBadge.label}
        </span>
      </div>

      {/* ── SUMMARY CARDS ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
        {([
          { key: "NEEDS_REVIEW", label: "Needs Review", bg: "#FEF3C7", color: "#D97706" },
          { key: "COMPLETED",    label: "Completed",    bg: "#D1FAE5", color: "#059669" },
          { key: "FRAUD",        label: "Fraud",        bg: "#FEE2E2", color: "#DC2626" },
          { key: "REFUNDED",     label: "Refunded",     bg: "#F3F4F6", color: "#6B7280" },
        ] as const).map((s) => (
          <div
            key={s.key}
            onClick={() => setFilterStatus(filterStatus === s.key ? "all" : s.key)}
            style={{
              background: filterStatus === s.key ? s.bg : C.white,
              border: `1px solid ${filterStatus === s.key ? s.color : C.border}`,
              borderRadius: 16, padding: "16px 20px", cursor: "pointer",
              boxShadow: C.shadow, transition: "all .15s",
            }}
          >
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: C.tx3, marginBottom: 6 }}>
              {s.label}
            </p>
            <p style={{ fontSize: 28, fontWeight: 800, color: s.color, margin: 0, lineHeight: 1 }}>
              {counts[s.key]}
            </p>
          </div>
        ))}
      </div>

      {/* ── TABLE CARD ── */}
      <div style={{ background: C.white, borderRadius: 18, border: `1px solid ${C.border}`, boxShadow: C.shadow, overflow: "hidden" }}>

        {/* Toolbar */}
        <div style={{ padding: "14px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", gap: 12, alignItems: "center" }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari ID / nama member / outlet…"
            style={{
              height: 38, padding: "0 14px", borderRadius: 9, outline: "none",
              border: `1.5px solid ${C.border}`, background: C.bg,
              fontFamily: font, fontSize: 13, color: C.tx1, width: 280, boxSizing: "border-box",
            }}
          />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
            style={{
              height: 38, padding: "0 12px", borderRadius: 9, outline: "none",
              border: `1.5px solid ${C.border}`, background: C.bg,
              fontFamily: font, fontSize: 13, color: C.tx1,
            }}
          >
            <option value="all">Semua Status</option>
            <option value="NEEDS_REVIEW">⚠ Needs Review</option>
            <option value="COMPLETED">Completed</option>
            <option value="FRAUD">Fraud</option>
            <option value="FLAGGED">Flagged</option>
            <option value="REFUNDED">Refunded</option>
          </select>
          <span style={{ marginLeft: "auto", fontSize: 12, color: C.tx3 }}>
            {filtered.length} transaksi
          </span>
        </div>

        {/* Table */}
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: C.bg }}>
                {["ID Transaksi", "Tanggal", "Member", "Outlet", "Nominal", "Poin", "Status", "Aksi"].map((h) => (
                  <th key={h} style={{ padding: "11px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: C.tx3, borderBottom: `1px solid ${C.border}` }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((tx) => (
                <tr key={tx.docId} style={{ borderBottom: `1px solid ${C.border}`, transition: "background .1s" }}
                  onMouseEnter={e => (e.currentTarget.style.background = C.bg)}
                  onMouseLeave={e => (e.currentTarget.style.background = "")}
                >
                  <td style={{ padding: "12px 16px", fontWeight: 700, color: C.blue, fontFamily: "monospace", fontSize: 12 }}>{tx.transactionId}</td>
                  <td style={{ padding: "12px 16px", color: C.tx2 }}>{fmtDate(tx.createdAt)}</td>
                  <td style={{ padding: "12px 16px", color: C.tx1, fontWeight: 600 }}>{tx.memberName}</td>
                  <td style={{ padding: "12px 16px", color: C.tx2 }}>{tx.storeLocation}</td>
                  <td style={{ padding: "12px 16px", fontWeight: 700, color: C.tx1 }}>{fmtRp(tx.amount)}</td>
                  <td style={{ padding: "12px 16px", color: C.blue, fontWeight: 600 }}>{tx.potentialPoints.toLocaleString("id")}</td>
                  <td style={{ padding: "12px 16px" }}><StatusBadge status={tx.status} /></td>
                  <td style={{ padding: "12px 16px", textAlign: "center" }}>
                    {tx.status === "NEEDS_REVIEW" && (
                      <button
                        onClick={() => setVerifyTx(tx)}
                        style={{
                          background: "#FEF3C7", color: "#D97706",
                          border: "1px solid #FDE68A", padding: "5px 12px",
                          borderRadius: 7, cursor: "pointer",
                          fontFamily: font, fontSize: 12, fontWeight: 700,
                          display: "inline-flex", alignItems: "center", gap: 5,
                        }}
                      >
                        <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                        </svg>
                        Tinjau
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: "48px 16px", color: C.tx3 }}>
                    {syncStatus === "connecting" ? "Memuat data…" : "Tidak ada transaksi."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Modal Verifikasi ── */}
      {verifyTx && (
        <VerifyTxModal
          tx={verifyTx}
          loading={verifyLoading}
          onApprove={() => handleVerify("approve")}
          onReject={() => handleVerify("reject")}
          onClose={() => { if (!verifyLoading) setVerifyTx(null); }}
        />
      )}

      {/* ── Toast ── */}
      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
    </div>
  );
}
