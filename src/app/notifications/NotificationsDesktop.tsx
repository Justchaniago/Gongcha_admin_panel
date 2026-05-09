"use client";

import React, { useState, useEffect, useCallback } from "react";
import { font } from "@/lib/design-tokens";
import { GcButton, GcPage, GcPageHeader, GcPanel } from "@/components/ui/gc";
import { useAuth } from "@/context/AuthContext";

// ── Types ─────────────────────────────────────────────────────────────────────
interface NotifLog {
  id: string;
  type: string;
  title: string;
  body: string;
  targetType: "all" | "user";
  targetName?: string;
  targetUid?: string;
  sentAt: string;
  sentBy: string;
  recipientCount: number;
}

interface Member {
  uid: string;
  name: string;
  email: string;
}

interface AiNotifSuggestion {
  title: string;
  body: string;
}

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  bg: "#F4F6FB", white: "#FFFFFF", border: "#EAECF2", border2: "#F0F2F7",
  tx1: "#0F1117", tx2: "#4A5065", tx3: "#9299B0",
  blue: "#3B82F6", blueL: "#EFF6FF", blueMid: "#2563EB",
  green: "#12B76A", greenBg: "#ECFDF3", greenBorder: "#A7F3D0",
  red: "#C8102E", redBg: "#FEF3F2", redBorder: "#FECACA",
  amber: "#F79009", amberBg: "#FFFAEB",
  purple: "#7C3AED", purpleBg: "#F3F0FF",
  violet: "#6D28D9", violetBg: "#EDE9FE", violetBorder: "#C4B5FD",
  shadow: "0 1px 3px rgba(16,24,40,.06), 0 1px 2px rgba(16,24,40,.04)",
  shadowMd: "0 4px 16px rgba(16,24,40,.08), 0 2px 4px rgba(16,24,40,.04)",
} as const;

// ── Helpers ───────────────────────────────────────────────────────────────────
function TypeBadge({ type }: { type: string }) {
  const cfg: Record<string, { label: string; bg: string; color: string }> = {
    voucher_injected: { label: "🎁 Voucher",    bg: C.purpleBg, color: C.purple },
    tx_verified:      { label: "✅ TX Verified", bg: C.greenBg,  color: "#027A48" },
    tx_rejected:      { label: "❌ TX Rejected", bg: C.redBg,    color: C.red },
    broadcast:        { label: "📢 Broadcast",   bg: C.amberBg,  color: "#92400E" },
    targeted:         { label: "🎯 Targeted",    bg: C.blueL,    color: C.blue },
  };
  const s = cfg[type] ?? { label: type, bg: C.border2, color: C.tx2 };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", padding: "3px 10px", borderRadius: 99, fontSize: 11, fontWeight: 700, letterSpacing: ".04em", background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

// ── AI Suggest Panel ──────────────────────────────────────────────────────────
function AiNotifPanel({
  currentTitle,
  currentBody,
  onApply,
  onClose,
}: {
  currentTitle: string;
  currentBody: string;
  onApply: (title: string, body: string) => void;
  onClose: () => void;
}) {
  const [context, setContext] = useState(currentTitle || currentBody ? `${currentTitle} ${currentBody}`.trim() : "");
  const [suggestions, setSuggestions] = useState<AiNotifSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    if (!context.trim()) return;
    setLoading(true);
    setError(null);
    setSuggestions([]);
    try {
      const res = await fetch("/api/ai/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "notification", context: context.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Gagal generate.");
      setSuggestions(data.suggestions ?? []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ marginTop: 10, padding: "16px 18px", borderRadius: 12, background: C.violetBg, border: `1.5px solid ${C.violetBorder}` }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: C.violet, fontFamily: font, display: "flex", alignItems: "center", gap: 6 }}>
          ✨ AI Bantu — Notifikasi
        </span>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: C.tx3, lineHeight: 1, padding: "2px 4px" }}>×</button>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <input
          type="text"
          value={context}
          onChange={(e) => setContext(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && generate()}
          placeholder="Topik notifikasi (mis: promo matcha akhir bulan)"
          style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: `1.5px solid ${C.violetBorder}`, fontSize: 13, fontFamily: font, outline: "none", background: C.white }}
        />
        <button
          onClick={generate}
          disabled={loading || !context.trim()}
          style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: loading || !context.trim() ? C.border2 : C.violet, color: loading || !context.trim() ? C.tx3 : "#fff", fontSize: 13, fontWeight: 700, cursor: loading || !context.trim() ? "default" : "pointer", fontFamily: font, whiteSpace: "nowrap" }}
        >
          {loading ? "⏳ Generating…" : "Generate"}
        </button>
      </div>

      {error && (
        <p style={{ fontSize: 12, color: C.red, marginBottom: 8, fontFamily: font }}>{error}</p>
      )}

      {suggestions.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => { onApply(s.title, s.body); onClose(); }}
              style={{ textAlign: "left", padding: "10px 12px", borderRadius: 9, border: `1.5px solid ${C.violetBorder}`, background: C.white, cursor: "pointer", fontFamily: font, transition: "border-color .12s, box-shadow .12s" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = C.violet; (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 2px 8px rgba(109,40,217,.12)`; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = C.violetBorder; (e.currentTarget as HTMLButtonElement).style.boxShadow = "none"; }}
            >
              <p style={{ fontSize: 12.5, fontWeight: 700, color: C.tx1, margin: "0 0 3px" }}>{s.title}</p>
              <p style={{ fontSize: 12, color: C.tx2, margin: 0, lineHeight: 1.45 }}>{s.body}</p>
            </button>
          ))}
          <p style={{ fontSize: 11, color: C.tx3, margin: 0, fontFamily: font }}>Klik kartu untuk langsung mengisi form.</p>
        </div>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function NotificationsDesktop() {
  const { can } = useAuth();
  const canSend = can("notification.send");

  const [tab, setTab] = useState<"send" | "history">("send");
  const [members, setMembers] = useState<Member[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [logs, setLogs] = useState<NotifLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);

  const [targetType, setTargetType] = useState<"all" | "user">("all");
  const [targetUid, setTargetUid] = useState("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [showAi, setShowAi] = useState(false);

  const filteredMembers = members.filter((m) => {
    const q = memberSearch.toLowerCase();
    return !q || m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q);
  });
  const selectedMember = members.find((m) => m.uid === targetUid);

  const loadMembers = useCallback(async () => {
    try {
      const res = await fetch("/api/members?pageSize=500&sortBy=name&sortOrder=asc");
      if (res.ok) {
        const data = await res.json();
        setMembers((data.users ?? []).map((u: any) => ({ uid: u.uid, name: u.name ?? u.displayName ?? "(no name)", email: u.email ?? "" })));
      }
    } finally {
      setMembersLoading(false);
    }
  }, []);

  const loadLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs ?? []);
      }
    } finally {
      setLogsLoading(false);
    }
  }, []);

  useEffect(() => { loadMembers(); }, [loadMembers]);
  useEffect(() => { loadLogs(); }, [loadLogs]);

  async function handleSend() {
    if (!title.trim() || !message.trim()) {
      setSendResult({ ok: false, msg: "Judul dan pesan tidak boleh kosong." });
      return;
    }
    if (targetType === "user" && !targetUid) {
      setSendResult({ ok: false, msg: "Pilih member tujuan terlebih dahulu." });
      return;
    }
    setSending(true);
    setSendResult(null);
    try {
      const res = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          message,
          targetType,
          targetUid:  targetType === "user" ? targetUid : undefined,
          targetName: targetType === "user" ? selectedMember?.name ?? targetUid : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Gagal mengirim.");
      setSendResult({ ok: true, msg: `Notifikasi berhasil dikirim ke ${data.recipientCount} member.` });
      setTitle(""); setMessage(""); setTargetUid(""); setMemberSearch(""); setShowAi(false);
      loadLogs();
    } catch (e: any) {
      setSendResult({ ok: false, msg: e.message ?? "Terjadi kesalahan." });
    } finally {
      setSending(false);
    }
  }

  return (
    <GcPage maxWidth={1240}>
      <GcPageHeader
        eyebrow="Communication Center"
        title="Notification Management"
        description="Kirim notifikasi ke member via broadcast atau personal. Notifikasi otomatis (voucher, transaksi) tetap aktif dari sistem."
        actions={canSend ? <GcButton variant="blue" onClick={() => setTab("send")}>Compose Notification</GcButton> : undefined}
      />

      {/* Auto-event cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
        {[
          { icon: "🎁", label: "Voucher Suntik", desc: "Auto-notif ke member saat admin inject voucher", color: C.purple, bg: C.purpleBg },
          { icon: "✅", label: "Transaksi Verified", desc: "Auto-notif ke member saat transaksi diverifikasi", color: "#027A48", bg: C.greenBg },
          { icon: "❌", label: "Transaksi Rejected", desc: "Auto-notif ke member saat transaksi ditolak", color: C.red, bg: C.redBg },
        ].map((e) => (
          <div key={e.label} style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 18, boxShadow: C.shadow, padding: "16px 20px", display: "flex", alignItems: "flex-start", gap: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: e.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{e.icon}</div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: C.tx1, fontFamily: font }}>{e.label}</span>
                <span style={{ fontSize: 10, fontWeight: 700, background: e.bg, color: e.color, padding: "2px 8px", borderRadius: 99, letterSpacing: ".05em", fontFamily: font }}>AKTIF</span>
              </div>
              <p style={{ fontSize: 12, color: C.tx3, lineHeight: 1.5, margin: 0, fontFamily: font }}>{e.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: `1px solid ${C.border}` }}>
        {[
          { key: "send",    label: "📤 Kirim Notifikasi" },
          { key: "history", label: `📋 Riwayat (${logs.length})` },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as "send" | "history")}
            style={{ padding: "10px 20px", fontSize: 13, fontWeight: 700, border: "none", background: "transparent", cursor: "pointer", color: tab === t.key ? C.blue : C.tx3, borderBottom: tab === t.key ? `2px solid ${C.blue}` : "2px solid transparent", marginBottom: -1, transition: "all .15s", fontFamily: font }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Send ── */}
      {tab === "send" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 400px", gap: 20 }}>

          {/* Compose */}
          <GcPanel style={{ padding: "28px 32px" }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: C.tx1, margin: "0 0 22px", fontFamily: font }}>Tulis Pesan</h2>

            {/* Target type */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: C.tx2, display: "block", marginBottom: 10, fontFamily: font }}>Target Penerima</label>
              <div style={{ display: "flex", gap: 10 }}>
                {[
                  { val: "all",  label: "📢 Semua Member" },
                  { val: "user", label: "🎯 Member Tertentu" },
                ].map((opt) => (
                  <button
                    key={opt.val}
                    onClick={() => { setTargetType(opt.val as "all" | "user"); setTargetUid(""); setMemberSearch(""); }}
                    style={{ padding: "9px 18px", borderRadius: 10, border: targetType === opt.val ? `2px solid ${C.blue}` : `2px solid ${C.border}`, background: targetType === opt.val ? C.blueL : C.white, color: targetType === opt.val ? C.blue : C.tx2, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: font }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Member picker */}
            {targetType === "user" && (
              <div style={{ marginBottom: 20, padding: "16px 18px", background: C.bg, borderRadius: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: C.tx2, display: "block", marginBottom: 10, fontFamily: font }}>Pilih Member</label>
                <input
                  type="text"
                  placeholder={membersLoading ? "Memuat daftar member…" : "Cari nama atau email..."}
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  style={{ width: "100%", padding: "9px 14px", borderRadius: 9, border: `1.5px solid ${C.border}`, fontSize: 13, color: C.tx1, background: C.white, boxSizing: "border-box", outline: "none", marginBottom: 8, fontFamily: font }}
                />
                <div style={{ maxHeight: 180, overflowY: "auto", borderRadius: 9, border: `1px solid ${C.border}`, background: C.white }}>
                  {membersLoading ? (
                    <div style={{ padding: "12px 16px", fontSize: 13, color: C.tx3, fontFamily: font }}>Memuat member…</div>
                  ) : filteredMembers.length === 0 ? (
                    <div style={{ padding: "12px 16px", fontSize: 13, color: C.tx3, fontFamily: font }}>Tidak ada member ditemukan.</div>
                  ) : filteredMembers.slice(0, 30).map((m) => (
                    <div
                      key={m.uid}
                      onClick={() => setTargetUid(m.uid)}
                      style={{ padding: "10px 16px", cursor: "pointer", background: targetUid === m.uid ? C.blueL : "transparent", borderBottom: `1px solid ${C.border2}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}
                    >
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.tx1, fontFamily: font }}>{m.name || "(no name)"}</div>
                        <div style={{ fontSize: 11.5, color: C.tx3, fontFamily: font }}>{m.email}</div>
                      </div>
                      {targetUid === m.uid && (
                        <span style={{ fontSize: 11, fontWeight: 700, color: C.blue, background: C.blueL, padding: "2px 10px", borderRadius: 99, fontFamily: font }}>Dipilih</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Title */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <label style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: C.tx2, fontFamily: font }}>Judul Notifikasi</label>
                <button
                  onClick={() => setShowAi((v) => !v)}
                  style={{ fontSize: 11.5, fontWeight: 700, color: showAi ? C.violet : C.tx3, background: showAi ? C.violetBg : "transparent", border: showAi ? `1px solid ${C.violetBorder}` : "1px solid transparent", borderRadius: 6, padding: "3px 9px", cursor: "pointer", fontFamily: font, transition: "all .15s" }}
                >
                  ✨ AI Bantu
                </button>
              </div>
              <input
                type="text"
                placeholder="Contoh: Promo Spesial Akhir Pekan!"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={80}
                style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 13.5, color: C.tx1, background: C.white, boxSizing: "border-box", outline: "none", fontFamily: font }}
              />
              <div style={{ textAlign: "right", fontSize: 11, color: C.tx3, marginTop: 4, fontFamily: font }}>{title.length}/80</div>
            </div>

            {/* Body */}
            <div style={{ marginBottom: 22 }}>
              <label style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: C.tx2, display: "block", marginBottom: 8, fontFamily: font }}>Isi Pesan</label>
              <textarea
                placeholder="Tulis isi notifikasi di sini..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                maxLength={300}
                style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 13.5, color: C.tx1, background: C.white, boxSizing: "border-box", outline: "none", resize: "vertical", fontFamily: font }}
              />
              <div style={{ textAlign: "right", fontSize: 11, color: C.tx3, marginTop: 4, fontFamily: font }}>{message.length}/300</div>
            </div>

            {/* AI panel */}
            {showAi && (
              <AiNotifPanel
                currentTitle={title}
                currentBody={message}
                onApply={(t, b) => { setTitle(t); setMessage(b); }}
                onClose={() => setShowAi(false)}
              />
            )}

            {/* Result */}
            {sendResult && (
              <div style={{ padding: "12px 16px", borderRadius: 10, marginTop: showAi ? 12 : 0, marginBottom: 16, background: sendResult.ok ? C.greenBg : C.redBg, color: sendResult.ok ? "#027A48" : C.red, fontSize: 13, fontWeight: 600, border: `1px solid ${sendResult.ok ? C.greenBorder : C.redBorder}`, fontFamily: font }}>
                {sendResult.msg}
              </div>
            )}

            <button
              onClick={handleSend}
              disabled={!canSend || sending || !title.trim() || !message.trim() || (targetType === "user" && !targetUid)}
              style={{ width: "100%", padding: "13px", borderRadius: 12, border: "none", background: !canSend || sending || !title.trim() || !message.trim() ? C.border : C.blue, color: !canSend || sending || !title.trim() || !message.trim() ? C.tx3 : "#fff", fontSize: 14, fontWeight: 700, cursor: !canSend || sending || !title.trim() || !message.trim() ? "not-allowed" : "pointer", transition: "background .15s", fontFamily: font, marginTop: 4 }}
            >
              {!canSend
                ? "Tidak punya izin kirim notifikasi"
                : sending
                ? "Mengirim…"
                : targetType === "all"
                ? `📢 Kirim ke Semua Member (${membersLoading ? "…" : members.length})`
                : `🎯 Kirim ke ${selectedMember?.name ?? "Member Terpilih"}`}
            </button>
          </GcPanel>

          {/* Preview */}
          <GcPanel style={{ padding: "28px 24px" }}>
            <h2 style={{ fontWeight: 700, color: C.tx2, margin: "0 0 18px", letterSpacing: ".03em", textTransform: "uppercase", fontSize: 11, fontFamily: font }}>
              Preview Notifikasi
            </h2>

            <div style={{ background: "#0F1117", borderRadius: 20, padding: "24px 20px", minHeight: 160 }}>
              <div style={{ background: "rgba(255,255,255,.08)", borderRadius: 14, padding: "14px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: C.blue, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>🔔</div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,.5)", letterSpacing: ".06em", fontFamily: font }}>GONG CHA APP</span>
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,.3)", marginLeft: "auto", fontFamily: font }}>baru saja</span>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 5, lineHeight: 1.4, fontFamily: font }}>
                  {title || <span style={{ opacity: 0.3 }}>Judul notifikasi...</span>}
                </div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,.6)", lineHeight: 1.5, fontFamily: font }}>
                  {message || <span style={{ opacity: 0.4 }}>Isi pesan akan tampil di sini...</span>}
                </div>
              </div>
            </div>

            <div style={{ marginTop: 18, padding: "14px 16px", background: C.bg, borderRadius: 12 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: C.tx3, letterSpacing: ".07em", textTransform: "uppercase", marginBottom: 10, fontFamily: font }}>Ringkasan Pengiriman</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {[
                  { label: "Target", value: targetType === "all" ? "Semua Member" : selectedMember ? selectedMember.name : "Belum dipilih" },
                  { label: "Estimasi Penerima", value: targetType === "all" ? `${membersLoading ? "…" : members.length} member` : targetUid ? "1 member" : "—", blue: true },
                  { label: "Tipe", value: targetType === "all" ? "Broadcast" : "Targeted" },
                ].map(({ label, value, blue }) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 12.5, color: C.tx2, fontFamily: font }}>{label}</span>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: blue ? C.blue : C.tx1, fontFamily: font }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </GcPanel>
        </div>
      )}

      {/* ── Tab: History ── */}
      {tab === "history" && (
        <GcPanel style={{ overflow: "hidden" }}>
          <div style={{ padding: "20px 24px 16px", borderBottom: `1px solid ${C.border2}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: C.tx1, margin: 0, fontFamily: font }}>Riwayat Notifikasi Terkirim</h2>
            <GcButton onClick={loadLogs} variant="ghost" size="sm" style={{ color: C.blue, background: C.blueL, borderColor: "#C7D2FE" }}>
              🔄 Refresh
            </GcButton>
          </div>

          {logsLoading ? (
            <div style={{ padding: "52px 24px", textAlign: "center", color: C.tx3, fontSize: 14, fontFamily: font }}>Memuat riwayat…</div>
          ) : logs.length === 0 ? (
            <div style={{ padding: "52px 24px", textAlign: "center", color: C.tx3, fontSize: 14, fontFamily: font }}>Belum ada notifikasi yang dikirim.</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#F8F9FC" }}>
                  {["Tipe", "Judul", "Pesan", "Target", "Penerima", "Waktu"].map((h) => (
                    <th key={h} style={{ padding: "10px 20px", textAlign: "left", fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: C.tx3, borderBottom: `1px solid ${C.border2}`, whiteSpace: "nowrap", fontFamily: font }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((log, i) => (
                  <tr key={log.id} style={{ borderBottom: i < logs.length - 1 ? `1px solid ${C.border2}` : "none" }}>
                    <td style={{ padding: "14px 20px" }}><TypeBadge type={log.type} /></td>
                    <td style={{ padding: "14px 20px", fontSize: 13, fontWeight: 600, color: C.tx1, maxWidth: 200, fontFamily: font }}>{log.title}</td>
                    <td style={{ padding: "14px 20px", fontSize: 12.5, color: C.tx2, maxWidth: 260, fontFamily: font }}>
                      <span style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as any, overflow: "hidden" }}>{log.body}</span>
                    </td>
                    <td style={{ padding: "14px 20px", fontSize: 12.5, color: C.tx1, whiteSpace: "nowrap", fontFamily: font }}>
                      {log.targetType === "all"
                        ? <span style={{ fontWeight: 700, color: C.amber }}>📢 Semua</span>
                        : <span title={log.targetUid}>🎯 {log.targetName ?? log.targetUid}</span>}
                    </td>
                    <td style={{ padding: "14px 20px", fontSize: 13, fontWeight: 700, color: C.blue, whiteSpace: "nowrap", fontFamily: font }}>{log.recipientCount?.toLocaleString("id-ID")} member</td>
                    <td style={{ padding: "14px 20px", fontSize: 12, color: C.tx3, whiteSpace: "nowrap", fontFamily: font }}>
                      {log.sentAt ? new Date(log.sentAt).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div style={{ padding: "12px 24px", borderTop: `1px solid ${C.border2}` }}>
            <span style={{ fontSize: 12, color: C.tx3, fontFamily: font }}>
              Menampilkan <strong style={{ color: C.tx2 }}>{logs.length}</strong> notifikasi terakhir
            </span>
          </div>
        </GcPanel>
      )}
    </GcPage>
  );
}
