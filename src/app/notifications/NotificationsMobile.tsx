"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useMobileSidebar } from "@/components/layout/AdminShell";
import { motion, AnimatePresence } from "framer-motion";
import {
  Menu as MenuIcon, X, Send, Clock, CheckCircle2,
  AlertCircle, Users, User, ChevronRight, RefreshCw,
} from "lucide-react";

// ── DESIGN TOKENS ──
const T = {
  bg:      "#F4F5F7",
  surface: "#FFFFFF",
  navy2:   "#1C2333",
  blue:    "#3B82F6",
  blueL:   "#EFF6FF",
  blueD:   "#1D4ED8",
  red:     "#DC2626",
  redL:    "#FEF2F2",
  redB:    "#FECACA",
  green:   "#059669",
  greenL:  "#ECFDF5",
  greenB:  "#6EE7B7",
  amber:   "#D97706",
  amberL:  "#FFFBEB",
  amberB:  "#FDE68A",
  purple:  "#7C3AED",
  purpleL: "#F5F3FF",
  purpleB: "#DDD6FE",
  tx1:     "#111827",
  tx2:     "#374151",
  tx3:     "#6B7280",
  tx4:     "#9CA3AF",
  border:  "#F3F4F6",
  border2: "#E5E7EB",
  r12: 12, r16: 16,
} as const;

interface NotifLog {
  id: string; type: string; title: string; body: string;
  targetType: "all" | "user"; targetName?: string; targetUid?: string;
  sentAt: string; sentBy: string; recipientCount: number;
}
interface Member { uid: string; name: string; email: string; }
type TabId = "send" | "history";

// ── HEADER ──
const PageHeader = ({ left, title, subtitle, right }: { left: React.ReactNode; title: string; subtitle?: React.ReactNode; right: React.ReactNode }) => (
  <div style={{ flexShrink: 0, background: T.surface, borderBottom: `1px solid ${T.border}`, padding: `calc(env(safe-area-inset-top, 16px) + 16px) 16px 12px`, display: "flex", alignItems: "center", justifyContent: "space-between", zIndex: 30 }}>
    <div style={{ width: 36, flexShrink: 0 }}>{left}</div>
    <div style={{ flex: 1, textAlign: "center", padding: "0 8px" }}>
      <p style={{ fontSize: 14, fontWeight: 800, color: T.tx1, letterSpacing: "-.01em", lineHeight: 1 }}>{title}</p>
      {subtitle && <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5, marginTop: 4 }}>{subtitle}</div>}
    </div>
    <div style={{ flexShrink: 0, display: "flex", justifyContent: "flex-end" }}>{right}</div>
  </div>
);

// ── TOAST ──
const MToast = ({ msg, type, onDone }: { msg: string; type: "success" | "error"; onDone: () => void }) => {
  useEffect(() => { const t = setTimeout(onDone, 3500); return () => clearTimeout(t); }, [onDone]);
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      style={{ position: "fixed", bottom: 100, left: "50%", transform: "translateX(-50%)", zIndex: 9999, padding: "12px 18px", borderRadius: 14, background: type === "success" ? T.navy2 : T.red, color: "#fff", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 8, boxShadow: "0 8px 24px rgba(0,0,0,.24)", whiteSpace: "nowrap" as const }}
    >
      {type === "success" ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
      {msg}
    </motion.div>
  );
};

// ── TYPE BADGE ──
function TypeBadge({ type }: { type: string }) {
  const cfg: Record<string, { label: string; bg: string; color: string }> = {
    voucher_injected: { label: "🎁 Voucher",    bg: T.purpleL, color: T.purple   },
    tx_verified:      { label: "✅ Verified",    bg: T.greenL,  color: "#027A48"  },
    tx_rejected:      { label: "❌ Rejected",    bg: T.redL,    color: T.red      },
    broadcast:        { label: "📢 Broadcast",   bg: T.amberL,  color: "#92400E"  },
    targeted:         { label: "🎯 Targeted",    bg: T.blueL,   color: T.blue     },
  };
  const s = cfg[type] ?? { label: type, bg: T.bg, color: T.tx3 };
  return (
    <span style={{ fontSize: 9, fontWeight: 800, padding: "3px 8px", borderRadius: 99, background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

export default function NotificationsMobile({ initialLogs = [], members = [] }: { initialLogs?: NotifLog[]; members?: Member[] }) {
  const { user }       = useAuth();
  const { openDrawer } = useMobileSidebar();
  const router         = useRouter();
  const canMutate      = user?.role === "SUPER_ADMIN";

  const [tab,          setTab]          = useState<TabId>("send");
  const [logs,         setLogs]         = useState<NotifLog[]>(initialLogs);
  const [targetType,   setTargetType]   = useState<"all" | "user">("all");
  const [targetUid,    setTargetUid]    = useState("");
  const [title,        setTitle]        = useState("");
  const [message,      setMessage]      = useState("");
  const [sending,      setSending]      = useState(false);
  const [sendResult,   setSendResult]   = useState<{ ok: boolean; msg: string } | null>(null);
  const [memberSearch, setMemberSearch] = useState("");
  const [showPicker,   setShowPicker]   = useState(false);
  const [refreshing,   setRefreshing]   = useState(false);
  const [toast,        setToast]        = useState<{ msg: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    if (user && user.role !== "SUPER_ADMIN") router.replace("/dashboard");
  }, [user, router]);

  const filteredMembers = members.filter(m => {
    const q = memberSearch.toLowerCase();
    return !q || m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q);
  });
  const selectedMember = members.find(m => m.uid === targetUid);

  const handleSend = async () => {
    if (!canMutate) return;
    if (!title.trim() || !message.trim()) { setSendResult({ ok: false, msg: "Judul dan pesan tidak boleh kosong." }); return; }
    if (targetType === "user" && !targetUid) { setSendResult({ ok: false, msg: "Pilih member tujuan." }); return; }
    setSending(true); setSendResult(null);
    try {
      const res = await fetch("/api/notifications", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, message, targetType, targetUid: targetType === "user" ? targetUid : undefined, targetName: targetType === "user" ? selectedMember?.name ?? targetUid : undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setSendResult({ ok: true, msg: `Terkirim ke ${data.recipientCount} member.` });
      setTitle(""); setMessage(""); setTargetUid(""); setMemberSearch("");
      // refresh logs
      const logRes = await fetch("/api/notifications");
      if (logRes.ok) { const d = await logRes.json(); setLogs(d.logs ?? []); }
    } catch (e: any) { setSendResult({ ok: false, msg: e.message }); }
    finally { setSending(false); }
  };

  const refreshLogs = async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) { const d = await res.json(); setLogs(d.logs ?? []); }
    } finally { setRefreshing(false); }
  };

  const TABS = [
    { id: "send"    as const, icon: Send,  label: "Send",    badge: 0 },
    { id: "history" as const, icon: Clock, label: "History", badge: logs.length },
  ];

  const AUTO_EVENTS = [
    { icon: "🎁", label: "Voucher Inject",   desc: "Auto saat admin inject voucher",     color: T.purple, bg: T.purpleL },
    { icon: "✅", label: "TX Verified",       desc: "Auto saat transaksi diverifikasi",   color: "#027A48", bg: T.greenL },
    { icon: "❌", label: "TX Rejected",       desc: "Auto saat transaksi ditolak",        color: T.red,    bg: T.redL   },
  ];

  const canSend = canMutate && title.trim() && message.trim() && (targetType === "all" || targetUid);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: T.bg, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif", WebkitFontSmoothing: "antialiased", overflowX: "hidden" }}>

      <PageHeader
        left={
          <button onClick={openDrawer} style={{ width: 36, height: 36, borderRadius: 11, border: `1px solid ${T.border2}`, background: T.surface, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <MenuIcon size={18} color={T.tx1} strokeWidth={2} />
          </button>
        }
        title="Notifications"
        right={<div style={{ width: 36 }} />}
      />

      {/* ── SCROLLABLE CONTENT ── */}
      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>

        {/* Auto-events info */}
        <div style={{ padding: "14px 14px 0" }}>
          <p style={{ fontSize: 9, fontWeight: 800, color: T.tx4, textTransform: "uppercase" as const, letterSpacing: ".14em", marginBottom: 8 }}>Auto Notifications</p>
          <div style={{ display: "flex", overflowX: "auto", gap: 10, paddingBottom: 14 }} className="scrollbar-hide">
            {AUTO_EVENTS.map(e => (
              <div key={e.label} style={{ minWidth: 150, background: T.surface, padding: "12px", borderRadius: T.r16, border: `1px solid ${T.border}`, flexShrink: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 16 }}>{e.icon}</span>
                  <span style={{ fontSize: 10, fontWeight: 800, background: e.bg, color: e.color, padding: "2px 7px", borderRadius: 99 }}>AKTIF</span>
                </div>
                <p style={{ fontSize: 12, fontWeight: 700, color: T.tx1, marginBottom: 2 }}>{e.label}</p>
                <p style={{ fontSize: 10, color: T.tx4, lineHeight: 1.4 }}>{e.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* SEND TAB */}
        {tab === "send" && (
          <div style={{ padding: "0 14px 24px" }}>
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r16, padding: 16 }}>

              {/* Target type */}
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 9, fontWeight: 800, color: T.tx4, textTransform: "uppercase" as const, letterSpacing: ".14em", marginBottom: 8 }}>Target</p>
                <div style={{ display: "flex", gap: 8 }}>
                  {[
                    { val: "all"  as const, icon: Users, label: "Semua Member" },
                    { val: "user" as const, icon: User,  label: "Member Tertentu" },
                  ].map(opt => (
                    <button key={opt.val} onClick={() => { setTargetType(opt.val); setTargetUid(""); }}
                      style={{ flex: 1, padding: "10px 8px", borderRadius: 12, border: `1.5px solid ${targetType === opt.val ? T.blue : T.border2}`, background: targetType === opt.val ? T.blueL : T.surface, color: targetType === opt.val ? T.blueD : T.tx3, fontSize: 11, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                    >
                      <opt.icon size={13} />
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Member picker */}
              {targetType === "user" && (
                <div style={{ marginBottom: 16 }}>
                  <button onClick={() => setShowPicker(true)}
                    style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: `1px solid ${targetUid ? T.blue : T.border2}`, background: targetUid ? T.blueL : T.bg, color: targetUid ? T.blueD : T.tx3, fontSize: 13, fontWeight: 600, cursor: "pointer", textAlign: "left" as const, display: "flex", alignItems: "center", justifyContent: "space-between" }}
                  >
                    <span>{selectedMember ? selectedMember.name : "Pilih member…"}</span>
                    <ChevronRight size={14} color={T.tx4} />
                  </button>
                </div>
              )}

              {/* Title */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 9, fontWeight: 800, color: T.tx4, textTransform: "uppercase" as const, letterSpacing: ".14em", marginBottom: 6 }}>Judul</label>
                <input value={title} onChange={e => setTitle(e.target.value)} maxLength={80}
                  placeholder="Promo Spesial Akhir Pekan!"
                  style={{ width: "100%", background: T.bg, border: `1px solid ${T.border2}`, borderRadius: 12, padding: "12px 14px", fontSize: 14, color: T.tx1, outline: "none", boxSizing: "border-box" as const }}
                />
                <p style={{ fontSize: 10, color: T.tx4, textAlign: "right" as const, marginTop: 3 }}>{title.length}/80</p>
              </div>

              {/* Message */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 9, fontWeight: 800, color: T.tx4, textTransform: "uppercase" as const, letterSpacing: ".14em", marginBottom: 6 }}>Pesan</label>
                <textarea value={message} onChange={e => setMessage(e.target.value)} rows={4} maxLength={300}
                  placeholder="Tulis isi notifikasi..."
                  style={{ width: "100%", background: T.bg, border: `1px solid ${T.border2}`, borderRadius: 12, padding: "12px 14px", fontSize: 14, color: T.tx1, outline: "none", resize: "none", boxSizing: "border-box" as const }}
                />
                <p style={{ fontSize: 10, color: T.tx4, textAlign: "right" as const, marginTop: 3 }}>{message.length}/300</p>
              </div>

              {/* Preview */}
              {(title || message) && (
                <div style={{ marginBottom: 16, background: "#0F1117", borderRadius: 14, padding: "14px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <div style={{ width: 24, height: 24, borderRadius: 7, background: T.blue, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>🔔</div>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,.4)", letterSpacing: ".06em" }}>GONG CHA APP</span>
                  </div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 4, lineHeight: 1.4 }}>{title || "Judul notifikasi..."}</p>
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,.6)", lineHeight: 1.5 }}>{message || "Isi pesan..."}</p>
                </div>
              )}

              {sendResult && (
                <div style={{ padding: "10px 14px", borderRadius: 10, marginBottom: 14, background: sendResult.ok ? T.greenL : T.redL, color: sendResult.ok ? "#027A48" : T.red, fontSize: 12, fontWeight: 600, border: `1px solid ${sendResult.ok ? T.greenB : T.redB}` }}>
                  {sendResult.msg}
                </div>
              )}

              <button onClick={handleSend} disabled={!canSend || sending}
                style={{ width: "100%", padding: 16, background: canSend ? T.navy2 : T.border2, color: canSend ? "#fff" : T.tx4, border: "none", borderRadius: 14, fontWeight: 800, fontSize: 14, cursor: canSend && !sending ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
              >
                {sending
                  ? <><motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: .9, ease: "linear" }}><RefreshCw size={14} color="#fff" /></motion.div> Mengirim…</>
                  : <><Send size={14} /> {targetType === "all" ? `Kirim ke Semua (${members.length})` : `Kirim ke ${selectedMember?.name ?? "Member"}`}</>
                }
              </button>
            </div>
          </div>
        )}

        {/* HISTORY TAB */}
        {tab === "history" && (
          <div style={{ padding: "0 14px 24px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: T.tx1 }}>{logs.length} notifications</p>
              <button onClick={refreshLogs} disabled={refreshing}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 99, border: `1px solid ${T.border2}`, background: T.surface, fontSize: 11, fontWeight: 700, color: T.blue, cursor: "pointer" }}
              >
                <motion.div animate={{ rotate: refreshing ? 360 : 0 }} transition={{ repeat: refreshing ? Infinity : 0, duration: .9, ease: "linear" }}>
                  <RefreshCw size={12} color={T.blue} />
                </motion.div>
                Refresh
              </button>
            </div>

            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r16, overflow: "hidden" }}>
              {logs.length === 0 ? (
                <div style={{ padding: "40px 0", textAlign: "center" }}>
                  <p style={{ fontSize: 12, color: T.tx4 }}>Belum ada notifikasi terkirim.</p>
                </div>
              ) : logs.map((log, i) => (
                <motion.div key={log.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * .02 }}
                  style={{ padding: "12px 14px", borderBottom: i < logs.length - 1 ? `1px solid ${T.border}` : "none" }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: T.tx1, marginBottom: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{log.title}</p>
                      <p style={{ fontSize: 11, color: T.tx3, lineHeight: 1.4, marginBottom: 6, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as any }}>{log.body}</p>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" as const }}>
                    <TypeBadge type={log.type} />
                    <span style={{ fontSize: 9, fontWeight: 700, color: T.blue, background: T.blueL, padding: "2px 7px", borderRadius: 6 }}>
                      {log.recipientCount} penerima
                    </span>
                    {log.targetType === "user" && (
                      <span style={{ fontSize: 9, color: T.tx4 }}>→ {log.targetName ?? log.targetUid}</span>
                    )}
                    <span style={{ fontSize: 9, color: T.tx4, marginLeft: "auto" }}>
                      {log.sentAt ? new Date(log.sentAt).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── ISLAND TAB BAR ── */}
      <div style={{ flexShrink: 0, display: "flex", justifyContent: "center", padding: "8px 0 28px", background: T.bg }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4, background: T.navy2, borderRadius: 99, padding: "5px 6px", boxShadow: "0 8px 24px rgba(0,0,0,.22), 0 2px 8px rgba(0,0,0,.12)" }}>
          {TABS.map(({ id, icon: Icon, label, badge }) => {
            const active = tab === id;
            return (
              <button key={id} onClick={() => setTab(id)}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, height: 36, padding: "0 16px", borderRadius: 99, border: "none", background: active ? T.blue : "transparent", cursor: "pointer", transition: "background .2s", position: "relative" }}
              >
                <Icon size={15} color={active ? "#fff" : "rgba(255,255,255,.4)"} strokeWidth={active ? 2.5 : 2} />
                <span style={{ fontSize: 11, fontWeight: 700, color: active ? "#fff" : "rgba(255,255,255,.38)", whiteSpace: "nowrap" as const }}>
                  {active ? label : badge > 0 ? `${label} ${badge}` : label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── MEMBER PICKER OVERLAY ── */}
      <AnimatePresence>
        {showPicker && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowPicker(false)}
              style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.32)", backdropFilter: "blur(4px)", zIndex: 9998 }}
            />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: T.surface, borderRadius: "24px 24px 0 0", padding: "20px 20px 48px", zIndex: 9999, maxHeight: "80dvh", display: "flex", flexDirection: "column" }}
            >
              <div style={{ width: 36, height: 4, background: T.border2, borderRadius: 10, margin: "0 auto 16px", flexShrink: 0 }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexShrink: 0 }}>
                <h2 style={{ fontSize: 15, fontWeight: 800, color: T.tx1 }}>Pilih Member</h2>
                <button onClick={() => setShowPicker(false)} style={{ width: 30, height: 30, borderRadius: 99, background: T.bg, border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                  <X size={14} color={T.tx3} />
                </button>
              </div>
              {/* Search */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, background: T.bg, padding: "10px 14px", borderRadius: 12, marginBottom: 12, flexShrink: 0 }}>
                <input value={memberSearch} onChange={e => setMemberSearch(e.target.value)} placeholder="Cari nama atau email…"
                  style={{ flex: 1, border: "none", background: "transparent", outline: "none", fontSize: 13, color: T.tx1 }}
                />
                {memberSearch && <button onClick={() => setMemberSearch("")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}><X size={13} color={T.tx4} /></button>}
              </div>
              {/* List */}
              <div style={{ flex: 1, overflowY: "auto", borderRadius: 12, border: `1px solid ${T.border}` }}>
                {filteredMembers.slice(0, 30).map((m, i) => (
                  <div key={m.uid} onClick={() => { setTargetUid(m.uid); setShowPicker(false); }}
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", background: targetUid === m.uid ? T.blueL : "transparent", borderBottom: i < filteredMembers.length - 1 ? `1px solid ${T.border}` : "none", cursor: "pointer" }}
                  >
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: T.tx1 }}>{m.name || "(no name)"}</p>
                      <p style={{ fontSize: 11, color: T.tx4 }}>{m.email}</p>
                    </div>
                    {targetUid === m.uid && <CheckCircle2 size={16} color={T.blue} />}
                  </div>
                ))}
                {filteredMembers.length === 0 && (
                  <div style={{ padding: "20px", textAlign: "center" }}><p style={{ fontSize: 12, color: T.tx4 }}>Tidak ada member.</p></div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && <MToast key="toast" msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
      </AnimatePresence>

      <style dangerouslySetInnerHTML={{ __html: `.scrollbar-hide::-webkit-scrollbar{display:none}.scrollbar-hide{-ms-overflow-style:none;scrollbar-width:none}` }} />
    </div>
  );
}