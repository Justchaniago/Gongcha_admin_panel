"use client";

import { useState, useEffect } from "react";

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

interface Props {
  initialRole: string;
  initialLogs: NotifLog[];
  members: Member[];
}

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  bg: "#F4F6FB", white: "#FFFFFF", border: "#EAECF2", border2: "#F0F2F7",
  tx1: "#0F1117", tx2: "#4A5065", tx3: "#9299B0",
  blue: "#4361EE", blueL: "#EEF2FF",
  green: "#12B76A", greenBg: "#ECFDF3",
  red: "#C8102E", redBg: "#FEF3F2",
  amber: "#F79009", amberBg: "#FFFAEB",
  purple: "#7C3AED", purpleBg: "#F3F0FF",
  shadow: "0 1px 3px rgba(16,24,40,.06), 0 1px 2px rgba(16,24,40,.04)",
  shadowMd: "0 4px 16px rgba(16,24,40,.08), 0 2px 4px rgba(16,24,40,.04)",
} as const;

const font = "'Plus Jakarta Sans', system-ui, sans-serif";

const card: React.CSSProperties = {
  background: C.white,
  border: `1px solid ${C.border}`,
  borderRadius: 18,
  boxShadow: C.shadow,
};

// ── Badge ─────────────────────────────────────────────────────────────────────
function TypeBadge({ type }: { type: string }) {
  const cfg: Record<string, { label: string; bg: string; color: string }> = {
    voucher_injected: { label: "🎁 Voucher",    bg: C.purpleBg, color: C.purple },
    tx_verified:      { label: "✅ TX Verified", bg: C.greenBg,  color: "#027A48" },
    tx_rejected:      { label: "❌ TX Rejected", bg: C.redBg,    color: C.red     },
    broadcast:        { label: "📢 Broadcast",   bg: C.amberBg,  color: "#92400E" },
    targeted:         { label: "🎯 Targeted",    bg: C.blueL,    color: C.blue    },
  };
  const s = cfg[type] ?? { label: type, bg: C.border2, color: C.tx2 };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", padding: "3px 10px",
      borderRadius: 99, fontSize: 11, fontWeight: 700, letterSpacing: ".04em",
      background: s.bg, color: s.color,
    }}>
      {s.label}
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function NotificationsClient({ initialRole, initialLogs, members }: Props) {
  const [tab, setTab] = useState<"send" | "history">(initialRole === "SUPER_ADMIN" ? "send" : "history");
  const isSuperAdmin = initialRole === "SUPER_ADMIN";
  const [logs, setLogs] = useState<NotifLog[]>(initialLogs);

  // Send form state
  const [targetType, setTargetType] = useState<"all" | "user">("all");
  const [targetUid, setTargetUid]   = useState("");
  const [title, setTitle]           = useState("");
  const [message, setMessage]       = useState("");
  const [sending, setSending]       = useState(false);
  const [sendResult, setSendResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // Member search
  const [memberSearch, setMemberSearch] = useState("");
  const filteredMembers = members.filter((m) => {
    const q = memberSearch.toLowerCase();
    return !q || m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q);
  });

  const selectedMember = members.find((m) => m.uid === targetUid);

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
          targetUid:   targetType === "user" ? targetUid  : undefined,
          targetName:  targetType === "user" ? selectedMember?.name ?? targetUid : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Gagal mengirim notifikasi.");

      setSendResult({
        ok: true,
        msg: `Notifikasi berhasil dikirim ke ${data.recipientCount} member.`,
      });
      // Reset form
      setTitle("");
      setMessage("");
      setTargetUid("");
      setMemberSearch("");

      // Refresh log
      const logRes = await fetch("/api/notifications?limit=50");
      if (logRes.ok) {
        const logData = await logRes.json();
        setLogs(logData.logs ?? []);
      }
    } catch (e: any) {
      setSendResult({ ok: false, msg: e.message ?? "Terjadi kesalahan." });
    } finally {
      setSending(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: "28px 32px", maxWidth: 1200, fontFamily: font, WebkitFontSmoothing: "antialiased" }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: C.tx3, marginBottom: 6 }}>
          Admin Panel
        </p>
        <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-.025em", color: C.tx1, margin: 0 }}>
          🔔 Notification Management
        </h1>
        <p style={{ fontSize: 14, color: C.tx2, marginTop: 6 }}>
          Kirim notifikasi ke member secara broadcast maupun personal. Auto-notif aktif untuk voucher &amp; transaksi.
        </p>
      </div>

      {/* Auto-event info cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
        {[
          { icon: "🎁", label: "Voucher Suntik", desc: "Auto-notif ke member saat admin inject voucher", color: C.purple, bg: C.purpleBg },
          { icon: "✅", label: "Transaksi Verified", desc: "Auto-notif ke member saat transaksi diverifikasi", color: "#027A48", bg: C.greenBg },
          { icon: "❌", label: "Transaksi Rejected", desc: "Auto-notif ke member saat transaksi ditolak", color: C.red, bg: C.redBg },
        ].map((e) => (
          <div key={e.label} style={{ ...card, padding: "16px 20px", display: "flex", alignItems: "flex-start", gap: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: e.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
              {e.icon}
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: C.tx1 }}>{e.label}</span>
                <span style={{ fontSize: 10, fontWeight: 700, background: e.bg, color: e.color, padding: "2px 8px", borderRadius: 99, letterSpacing: ".05em" }}>
                  AKTIF
                </span>
              </div>
              <p style={{ fontSize: 12, color: C.tx3, lineHeight: 1.5, margin: 0 }}>{e.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: `1px solid ${C.border}`, paddingBottom: 0 }}>
        {[
          ...(isSuperAdmin ? [{ key: "send", label: "📤 Kirim Notifikasi" }] : []),
          { key: "history", label: `📋 Riwayat (${logs.length})` },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as any)}
            style={{
              padding: "10px 20px",
              fontSize: 13,
              fontWeight: 700,
              border: "none",
              background: "transparent",
              cursor: "pointer",
              color: tab === t.key ? C.blue : C.tx3,
              borderBottom: tab === t.key ? `2px solid ${C.blue}` : "2px solid transparent",
              marginBottom: -1,
              transition: "all .15s",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Send ── */}
      {tab === "send" && isSuperAdmin && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 400px", gap: 20 }}>

          {/* Compose form */}
          <div style={{ ...card, padding: "28px 32px" }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: C.tx1, margin: "0 0 22px" }}>Tulis Pesan</h2>

            {/* Target type */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: C.tx2, display: "block", marginBottom: 10 }}>
                Target Penerima
              </label>
              <div style={{ display: "flex", gap: 10 }}>
                {[
                  { val: "all",  label: "📢 Semua Member" },
                  { val: "user", label: "🎯 Member Tertentu" },
                ].map((opt) => (
                  <button
                    key={opt.val}
                    onClick={() => { setTargetType(opt.val as any); setTargetUid(""); setMemberSearch(""); }}
                    style={{
                      padding: "9px 18px",
                      borderRadius: 10,
                      border: targetType === opt.val ? `2px solid ${C.blue}` : `2px solid ${C.border}`,
                      background: targetType === opt.val ? C.blueL : C.white,
                      color: targetType === opt.val ? C.blue : C.tx2,
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Member picker (if targeted) */}
            {targetType === "user" && (
              <div style={{ marginBottom: 20, padding: "16px 18px", background: C.bg, borderRadius: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: C.tx2, display: "block", marginBottom: 10 }}>
                  Pilih Member
                </label>
                <input
                  type="text"
                  placeholder="Cari nama atau email..."
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  style={{ width: "100%", padding: "9px 14px", borderRadius: 9, border: `1.5px solid ${C.border}`, fontSize: 13, color: C.tx1, background: C.white, boxSizing: "border-box", outline: "none", marginBottom: 8 }}
                />
                <div style={{ maxHeight: 180, overflowY: "auto", borderRadius: 9, border: `1px solid ${C.border}`, background: C.white }}>
                  {filteredMembers.length === 0 ? (
                    <div style={{ padding: "12px 16px", fontSize: 13, color: C.tx3 }}>
                      Tidak ada member ditemukan.
                    </div>
                  ) : filteredMembers.slice(0, 20).map((m) => (
                    <div
                      key={m.uid}
                      onClick={() => setTargetUid(m.uid)}
                      style={{
                        padding: "10px 16px",
                        cursor: "pointer",
                        background: targetUid === m.uid ? C.blueL : "transparent",
                        borderBottom: `1px solid ${C.border2}`,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.tx1 }}>{m.name || "(no name)"}</div>
                        <div style={{ fontSize: 11.5, color: C.tx3 }}>{m.email}</div>
                      </div>
                      {targetUid === m.uid && (
                        <span style={{ fontSize: 11, fontWeight: 700, color: C.blue, background: C.blueL, padding: "2px 10px", borderRadius: 99 }}>
                          Dipilih
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Title */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: C.tx2, display: "block", marginBottom: 8 }}>
                Judul Notifikasi
              </label>
              <input
                type="text"
                placeholder="Contoh: Promo Spesial Akhir Pekan!"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={80}
                style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 13.5, color: C.tx1, background: C.white, boxSizing: "border-box", outline: "none" }}
              />
              <div style={{ textAlign: "right", fontSize: 11, color: C.tx3, marginTop: 4 }}>{title.length}/80</div>
            </div>

            {/* Body */}
            <div style={{ marginBottom: 22 }}>
              <label style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: C.tx2, display: "block", marginBottom: 8 }}>
                Isi Pesan
              </label>
              <textarea
                placeholder="Tulis isi notifikasi di sini..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                maxLength={300}
                style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 13.5, color: C.tx1, background: C.white, boxSizing: "border-box", outline: "none", resize: "vertical", fontFamily: font }}
              />
              <div style={{ textAlign: "right", fontSize: 11, color: C.tx3, marginTop: 4 }}>{message.length}/300</div>
            </div>

            {/* Send result */}
            {sendResult && (
              <div style={{
                padding: "12px 16px",
                borderRadius: 10,
                marginBottom: 16,
                background: sendResult.ok ? C.greenBg : C.redBg,
                color: sendResult.ok ? "#027A48" : C.red,
                fontSize: 13,
                fontWeight: 600,
                border: `1px solid ${sendResult.ok ? "#A7F3D0" : "#FECACA"}`,
              }}>
                {sendResult.msg}
              </div>
            )}

            <button
              onClick={handleSend}
              disabled={sending || !title.trim() || !message.trim() || (targetType === "user" && !targetUid)}
              style={{
                width: "100%",
                padding: "13px",
                borderRadius: 12,
                border: "none",
                background: sending || !title.trim() || !message.trim() ? C.border : C.blue,
                color: sending || !title.trim() || !message.trim() ? C.tx3 : "#FFFFFF",
                fontSize: 14,
                fontWeight: 700,
                cursor: sending || !title.trim() || !message.trim() ? "not-allowed" : "pointer",
                transition: "background .15s",
              }}
            >
              {sending ? "Mengirim…" : targetType === "all" ? `📢 Kirim ke Semua Member (${members.length})` : `🎯 Kirim ke ${selectedMember?.name ?? "Member Terpilih"}`}
            </button>
          </div>

          {/* Preview card */}
          <div style={{ ...card, padding: "28px 24px" }}>
            <h2 style={{ fontWeight: 700, color: C.tx2, margin: "0 0 18px", letterSpacing: ".03em", textTransform: "uppercase", fontSize: 11 }}>
              Preview Notifikasi
            </h2>

            {/* Phone mockup style preview */}
            <div style={{ background: "#0F1117", borderRadius: 20, padding: "24px 20px", minHeight: 160 }}>
              <div style={{ background: "rgba(255,255,255,.08)", borderRadius: 14, padding: "14px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: C.blue, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>🔔</div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,.5)", letterSpacing: ".06em" }}>GONG CHA APP</span>
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,.3)", marginLeft: "auto" }}>baru saja</span>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#FFFFFF", marginBottom: 5, lineHeight: 1.4 }}>
                  {title || <span style={{ opacity: 0.3 }}>Judul notifikasi...</span>}
                </div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,.6)", lineHeight: 1.5 }}>
                  {message || <span style={{ opacity: 0.4 }}>Isi pesan akan tampil di sini...</span>}
                </div>
              </div>
            </div>

            {/* Target summary */}
            <div style={{ marginTop: 18, padding: "14px 16px", background: C.bg, borderRadius: 12 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: C.tx3, letterSpacing: ".07em", textTransform: "uppercase", marginBottom: 10 }}>Ringkasan Pengiriman</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12.5, color: C.tx2 }}>Target</span>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: C.tx1 }}>
                    {targetType === "all" ? "Semua Member" : selectedMember ? selectedMember.name : "Belum dipilih"}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12.5, color: C.tx2 }}>Estimasi Penerima</span>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: C.blue }}>
                    {targetType === "all" ? `${members.length} member` : targetUid ? "1 member" : "—"}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12.5, color: C.tx2 }}>Tipe</span>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: C.tx1 }}>
                    {targetType === "all" ? "Broadcast" : "Targeted"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: History ── */}
      {tab === "history" && (
        <div style={{ ...card, overflow: "hidden" }}>
          {/* Header */}
          <div style={{ padding: "20px 24px 16px", borderBottom: `1px solid ${C.border2}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: C.tx1, margin: 0 }}>Riwayat Notifikasi Terkirim</h2>
            <button
              onClick={async () => {
                const res = await fetch("/api/notifications?limit=50");
                if (res.ok) { const d = await res.json(); setLogs(d.logs ?? []); }
              }}
              style={{ fontSize: 12, fontWeight: 600, color: C.blue, background: C.blueL, border: "none", borderRadius: 8, padding: "7px 14px", cursor: "pointer" }}
            >
              🔄 Refresh
            </button>
          </div>

          {logs.length === 0 ? (
            <div style={{ padding: "52px 24px", textAlign: "center", color: C.tx3, fontSize: 14 }}>
              Belum ada notifikasi yang dikirim.
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#F8F9FC" }}>
                  {["Tipe", "Judul", "Pesan", "Target", "Penerima", "Waktu"].map((h) => (
                    <th key={h} style={{ padding: "10px 20px", textAlign: "left", fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: C.tx3, borderBottom: `1px solid ${C.border2}`, whiteSpace: "nowrap" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((log, i) => (
                  <tr key={log.id} style={{ borderBottom: i < logs.length - 1 ? `1px solid ${C.border2}` : "none" }}>
                    <td style={{ padding: "14px 20px" }}>
                      <TypeBadge type={log.type} />
                    </td>
                    <td style={{ padding: "14px 20px", fontSize: 13, fontWeight: 600, color: C.tx1, maxWidth: 200 }}>
                      {log.title}
                    </td>
                    <td style={{ padding: "14px 20px", fontSize: 12.5, color: C.tx2, maxWidth: 260 }}>
                      <span style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as any, overflow: "hidden" }}>
                        {log.body}
                      </span>
                    </td>
                    <td style={{ padding: "14px 20px", fontSize: 12.5, color: C.tx1, whiteSpace: "nowrap" }}>
                      {log.targetType === "all"
                        ? <span style={{ fontWeight: 700, color: C.amber }}>📢 Semua</span>
                        : <span title={log.targetUid}>🎯 {log.targetName ?? log.targetUid}</span>}
                    </td>
                    <td style={{ padding: "14px 20px", fontSize: 13, fontWeight: 700, color: C.blue, whiteSpace: "nowrap" }}>
                      {log.recipientCount?.toLocaleString("id-ID")} member
                    </td>
                    <td style={{ padding: "14px 20px", fontSize: 12, color: C.tx3, whiteSpace: "nowrap" }}>
                      {log.sentAt
                        ? new Date(log.sentAt).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div style={{ padding: "12px 24px", borderTop: `1px solid ${C.border2}` }}>
            <span style={{ fontSize: 12, color: C.tx3 }}>
              Menampilkan <strong style={{ color: C.tx2 }}>{logs.length}</strong> notifikasi terakhir
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
