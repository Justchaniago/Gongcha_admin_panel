"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useMobileSidebar } from "@/components/layout/AdminShell";
import { motion, AnimatePresence } from "framer-motion";
import {
  Menu as MenuIcon, X, ChevronRight, Settings,
  Bell, Shield, Zap, AlertTriangle, CheckCircle2, Save,
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
  purple:  "#7C3AED",
  purpleL: "#F5F3FF",
  tx1:     "#111827",
  tx2:     "#374151",
  tx3:     "#6B7280",
  tx4:     "#9CA3AF",
  border:  "#F3F4F6",
  border2: "#E5E7EB",
  r12: 12, r16: 16,
} as const;

interface Settings {
  pointsPerThousand:  number;
  minimumTransaction: number;
  pointsExpiry:       string;
  tiers: {
    silver:   { minPoints: number; bonus: string; label: string };
    gold:     { minPoints: number; bonus: string; label: string };
    platinum: { minPoints: number; bonus: string; label: string };
  };
  notifications: { email: boolean; push: boolean; weekly: boolean };
  updatedAt: string | null;
  updatedBy: string | null;
}

const DEFAULTS: Settings = {
  pointsPerThousand: 10, minimumTransaction: 25000, pointsExpiry: "12_months",
  tiers: {
    silver:   { minPoints: 0,     bonus: "0%",  label: "Silver"   },
    gold:     { minPoints: 10000, bonus: "10%", label: "Gold"     },
    platinum: { minPoints: 50000, bonus: "25%", label: "Platinum" },
  },
  notifications: { email: true, push: true, weekly: false },
  updatedAt: null, updatedBy: null,
};

// ── HEADER ──
const PageHeader = ({ left, title, right }: { left: React.ReactNode; title: string; right: React.ReactNode }) => (
  <div style={{ flexShrink: 0, background: T.surface, borderBottom: `1px solid ${T.border}`, padding: "48px 16px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", zIndex: 30 }}>
    <div style={{ width: 36, flexShrink: 0 }}>{left}</div>
    <p style={{ fontSize: 14, fontWeight: 800, color: T.tx1, letterSpacing: "-.01em" }}>{title}</p>
    <div style={{ flexShrink: 0, display: "flex", justifyContent: "flex-end" }}>{right}</div>
  </div>
);

// ── BOTTOM SHEET ──
const BottomSheet = ({ isOpen, onClose, children, title }: { isOpen: boolean; onClose: () => void; children: React.ReactNode; title: string }) => (
  <AnimatePresence>
    {isOpen && (
      <>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.32)", backdropFilter: "blur(4px)", zIndex: 9998 }} />
        <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 28, stiffness: 300 }}
          style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: T.surface, borderRadius: "24px 24px 0 0", padding: "20px 20px 48px", zIndex: 9999, maxHeight: "88dvh", overflowY: "auto" }}
        >
          <div style={{ width: 36, height: 4, background: T.border2, borderRadius: 10, margin: "0 auto 16px" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: T.tx1 }}>{title}</h2>
            <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 99, background: T.bg, border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              <X size={14} color={T.tx3} />
            </button>
          </div>
          {children}
        </motion.div>
      </>
    )}
  </AnimatePresence>
);

// ── TOAST ──
const MToast = ({ msg, type, onDone }: { msg: string; type: "success" | "error"; onDone: () => void }) => {
  useEffect(() => { const t = setTimeout(onDone, 3500); return () => clearTimeout(t); }, [onDone]);
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      style={{ position: "fixed", bottom: 100, left: "50%", transform: "translateX(-50%)", zIndex: 9999, padding: "12px 18px", borderRadius: 14, background: type === "success" ? T.navy2 : T.red, color: "#fff", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 8, boxShadow: "0 8px 24px rgba(0,0,0,.24)", whiteSpace: "nowrap" as const }}
    >
      {type === "success" ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
      {msg}
    </motion.div>
  );
};

// ── TOGGLE ──
const Toggle = ({ on, onChange }: { on: boolean; onChange: () => void }) => (
  <button onClick={onChange} style={{ width: 44, height: 24, borderRadius: 99, border: "none", background: on ? T.blue : T.tx4, position: "relative", cursor: "pointer", transition: "background .2s", flexShrink: 0 }}>
    <span style={{ position: "absolute", top: 2, left: on ? 22 : 2, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left .2s", boxShadow: "0 1px 3px rgba(0,0,0,.2)" }} />
  </button>
);

// ── FIELD ──
const Field = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
  <div style={{ marginBottom: 16 }}>
    <label style={{ display: "block", fontSize: 9, fontWeight: 800, color: T.tx4, textTransform: "uppercase" as const, letterSpacing: ".14em", marginBottom: 6 }}>{label}</label>
    {children}
    {hint && <p style={{ fontSize: 10, color: T.tx4, marginTop: 4 }}>{hint}</p>}
  </div>
);

const inputStyle: React.CSSProperties = {
  width: "100%", background: T.bg, border: `1px solid ${T.border2}`, borderRadius: 12,
  padding: "12px 14px", fontSize: 14, color: T.tx1, outline: "none", boxSizing: "border-box",
};

export default function SettingsMobile() {
  const { user: authUser } = useAuth();
  const { openDrawer }     = useMobileSidebar();
  const router             = useRouter();

  const [settings,  setSettings]  = useState<Settings>(DEFAULTS);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [dirty,     setDirty]     = useState(false);
  const [toast,     setToast]     = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [activeSheet, setSheet]   = useState<"points" | "tiers" | "notifications" | "danger" | null>(null);
  const [dangerConfirm, setDangerConfirm] = useState<string | null>(null);

  useEffect(() => {
    if (authUser && authUser.role !== "SUPER_ADMIN") router.replace("/dashboard");
  }, [authUser, router]);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings");
      if (!res.ok) throw new Error();
      setSettings(await res.json());
    } catch { /* use defaults */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  const showToast = (msg: string, type: "success" | "error" = "success") => setToast({ msg, type });

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pointsPerThousand: settings.pointsPerThousand,
          minimumTransaction: settings.minimumTransaction,
          pointsExpiry: settings.pointsExpiry,
          tiers: settings.tiers,
          notifications: settings.notifications,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setSettings(data);
      setDirty(false);
      showToast("Settings saved!", "success");
    } catch (e: any) { showToast(e.message ?? "Failed to save", "error"); }
    finally { setSaving(false); }
  };

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings(p => ({ ...p, [key]: value }));
    setDirty(true);
  }

  function updateTier(tier: keyof Settings["tiers"], field: string, value: string | number) {
    setSettings(p => ({ ...p, tiers: { ...p.tiers, [tier]: { ...p.tiers[tier], [field]: value } } }));
    setDirty(true);
  }

  function updateNotif(key: keyof Settings["notifications"]) {
    setSettings(p => ({ ...p, notifications: { ...p.notifications, [key]: !p.notifications[key] } }));
    setDirty(true);
  }

  const SECTIONS = [
    { id: "points" as const, icon: Zap, label: "Points Configuration", sub: `${settings.pointsPerThousand} pts / Rp 1.000`, color: T.blue, bg: T.blueL },
    { id: "tiers"  as const, icon: Shield, label: "Member Tier Config", sub: "Silver · Gold · Platinum", color: T.purple, bg: T.purpleL },
    { id: "notifications" as const, icon: Bell, label: "Admin Notifications", sub: `${Object.values(settings.notifications).filter(Boolean).length} active`, color: T.green, bg: T.greenL },
    { id: "danger" as const, icon: AlertTriangle, label: "Danger Zone", sub: "Irreversible actions", color: T.red, bg: T.redL },
  ];

  const tierList = [
    { key: "silver"   as const, icon: "🥈", color: "#475569" },
    { key: "gold"     as const, icon: "🥇", color: "#D97706" },
    { key: "platinum" as const, icon: "💎", color: T.purple  },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: T.bg, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif", WebkitFontSmoothing: "antialiased" }}>

      <PageHeader
        left={
          <button onClick={openDrawer} style={{ width: 36, height: 36, borderRadius: 11, border: `1px solid ${T.border2}`, background: T.surface, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <MenuIcon size={18} color={T.tx1} strokeWidth={2} />
          </button>
        }
        title="Settings"
        right={
          dirty ? (
            <button onClick={handleSave} disabled={saving}
              style={{ height: 36, padding: "0 14px", borderRadius: 11, background: T.blue, border: "none", color: "#fff", fontSize: 12, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, opacity: saving ? .7 : 1 }}
            >
              <Save size={13} />
              {saving ? "Saving…" : "Save"}
            </button>
          ) : <div style={{ width: 36 }} />
        }
      />

      <div style={{ flex: 1, overflowY: "auto" }}>
        <div style={{ padding: "14px 14px 0" }}>
          {/* Last updated */}
          {settings.updatedAt && (
            <p style={{ fontSize: 10, color: T.tx4, marginBottom: 14, textAlign: "center" }}>
              Last updated: {new Date(settings.updatedAt).toLocaleString("id-ID")}
            </p>
          )}

          {/* Dirty banner */}
          {dirty && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: T.amberL, borderRadius: 12, marginBottom: 14, border: `1px solid ${T.amber}` }}
            >
              <p style={{ fontSize: 12, fontWeight: 700, color: T.amber }}>Unsaved changes</p>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => { loadSettings(); setDirty(false); }} style={{ fontSize: 11, fontWeight: 700, color: T.tx3, background: "none", border: "none", cursor: "pointer" }}>Discard</button>
                <button onClick={handleSave} style={{ fontSize: 11, fontWeight: 800, color: T.amber, background: "none", border: "none", cursor: "pointer" }}>Save now</button>
              </div>
            </motion.div>
          )}
        </div>

        {/* Section list */}
        <div style={{ padding: "0 14px 24px" }}>
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r16, overflow: "hidden" }}>
            {loading ? (
              <div style={{ padding: "40px 0", textAlign: "center" }}>
                <p style={{ fontSize: 12, color: T.tx4 }}>Loading settings…</p>
              </div>
            ) : SECTIONS.map((s, i) => (
              <motion.div key={s.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * .05 }}
                onClick={() => setSheet(s.id)}
                style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px", borderBottom: i < SECTIONS.length - 1 ? `1px solid ${T.border}` : "none", cursor: "pointer" }}
              >
                <div style={{ width: 40, height: 40, borderRadius: 11, background: s.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <s.icon size={18} color={s.color} strokeWidth={2} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: T.tx1, marginBottom: 2 }}>{s.label}</p>
                  <p style={{ fontSize: 11, color: T.tx4 }}>{s.sub}</p>
                </div>
                <ChevronRight size={16} color={T.tx4} />
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* ── POINTS SHEET ── */}
      <BottomSheet isOpen={activeSheet === "points"} onClose={() => setSheet(null)} title="Points Configuration">
        <Field label="Points per Rp 1.000" hint="Setiap Rp 1.000 transaksi = X poin">
          <input type="number" min={1} value={settings.pointsPerThousand} onChange={e => update("pointsPerThousand", Number(e.target.value))} style={inputStyle} />
        </Field>
        <Field label="Minimum Transaction (Rp)" hint="Transaksi di bawah ini tidak mendapat poin">
          <input type="number" min={0} step={1000} value={settings.minimumTransaction} onChange={e => update("minimumTransaction", Number(e.target.value))} style={inputStyle} />
        </Field>
        <Field label="Points Validity">
          <select value={settings.pointsExpiry} onChange={e => update("pointsExpiry", e.target.value)} style={{ ...inputStyle, appearance: "none" as const }}>
            <option value="3_months">3 Months</option>
            <option value="6_months">6 Months</option>
            <option value="12_months">12 Months</option>
            <option value="24_months">24 Months</option>
            <option value="never">Never Expires</option>
          </select>
        </Field>
        {/* Preview */}
        <div style={{ padding: "12px 14px", borderRadius: 12, background: T.blueL, border: "1px solid #C7D2FE", marginBottom: 20 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: T.blueD, marginBottom: 4 }}>Preview</p>
          <p style={{ fontSize: 12, color: T.tx2 }}>Rp 50.000 → <strong>{Math.floor(50000 / 1000) * settings.pointsPerThousand} points</strong></p>
        </div>
        <button onClick={() => { handleSave(); setSheet(null); }} disabled={saving}
          style={{ width: "100%", padding: 16, background: T.navy2, color: "#fff", border: "none", borderRadius: 14, fontWeight: 800, fontSize: 14, cursor: "pointer" }}
        >
          Save Points Config
        </button>
      </BottomSheet>

      {/* ── TIERS SHEET ── */}
      <BottomSheet isOpen={activeSheet === "tiers"} onClose={() => setSheet(null)} title="Member Tier Config">
        {tierList.map(({ key, icon, color }) => (
          <div key={key} style={{ marginBottom: 14, padding: 14, borderRadius: 12, background: T.bg, border: `1px solid ${T.border2}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 18 }}>{icon}</span>
              <p style={{ fontSize: 13, fontWeight: 800, color }}>{settings.tiers[key].label}</p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: T.tx4, textTransform: "uppercase" as const, letterSpacing: ".12em", marginBottom: 5 }}>Min. Lifetime Pts</label>
                <input type="number" min={0} value={settings.tiers[key].minPoints} onChange={e => updateTier(key, "minPoints", Number(e.target.value))}
                  style={{ ...inputStyle, fontSize: 13 }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: T.tx4, textTransform: "uppercase" as const, letterSpacing: ".12em", marginBottom: 5 }}>Bonus Points</label>
                <input type="text" value={settings.tiers[key].bonus} onChange={e => updateTier(key, "bonus", e.target.value)} placeholder="10%"
                  style={{ ...inputStyle, fontSize: 13 }} />
              </div>
            </div>
          </div>
        ))}
        <button onClick={() => { handleSave(); setSheet(null); }}
          style={{ width: "100%", padding: 16, background: T.navy2, color: "#fff", border: "none", borderRadius: 14, fontWeight: 800, fontSize: 14, cursor: "pointer", marginTop: 6 }}
        >
          Save Tier Config
        </button>
      </BottomSheet>

      {/* ── NOTIFICATIONS SHEET ── */}
      <BottomSheet isOpen={activeSheet === "notifications"} onClose={() => setSheet(null)} title="Admin Notifications">
        {([
          { key: "email"  as const, label: "Email on pending transaction", sub: "Notification to admin email" },
          { key: "push"   as const, label: "Push alert inactive outlet",   sub: "Browser notification" },
          { key: "weekly" as const, label: "Weekly automated report",      sub: "Every Monday 08:00 WIB" },
        ]).map(n => (
          <div key={n.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px", background: T.bg, borderRadius: 12, marginBottom: 10 }}>
            <div style={{ flex: 1, minWidth: 0, marginRight: 12 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: T.tx1 }}>{n.label}</p>
              <p style={{ fontSize: 10, color: T.tx4, marginTop: 2 }}>{n.sub}</p>
            </div>
            <Toggle on={settings.notifications[n.key]} onChange={() => updateNotif(n.key)} />
          </div>
        ))}
        <button onClick={() => { handleSave(); setSheet(null); }}
          style={{ width: "100%", padding: 16, background: T.navy2, color: "#fff", border: "none", borderRadius: 14, fontWeight: 800, fontSize: 14, cursor: "pointer", marginTop: 6 }}
        >
          Save Notifications
        </button>
      </BottomSheet>

      {/* ── DANGER ZONE SHEET ── */}
      <BottomSheet isOpen={activeSheet === "danger"} onClose={() => setSheet(null)} title="Danger Zone">
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: T.redL, borderRadius: 12, marginBottom: 16, border: `1px solid ${T.redB}` }}>
          <AlertTriangle size={16} color={T.red} />
          <p style={{ fontSize: 12, color: T.red, fontWeight: 600 }}>These actions are permanent and cannot be undone.</p>
        </div>
        {[
          { id: "reset_points", label: "Reset All Member Points", desc: "Reset semua currentPoints ke 0." },
          { id: "delete_transactions", label: "Delete Transaction History", desc: "Hapus semua dokumen di subcollection transactions." },
        ].map(d => (
          <div key={d.id} style={{ padding: 14, background: T.bg, borderRadius: 12, marginBottom: 10, border: `1px solid ${T.border2}` }}>
            <p style={{ fontSize: 13, fontWeight: 800, color: T.red, marginBottom: 4 }}>{d.label}</p>
            <p style={{ fontSize: 11, color: T.tx3, marginBottom: 12 }}>{d.desc}</p>
            {dangerConfirm === d.id ? (
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setDangerConfirm(null)} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: `1px solid ${T.border2}`, background: "transparent", fontSize: 12, fontWeight: 700, color: T.tx3, cursor: "pointer" }}>Cancel</button>
                <button onClick={() => { showToast("Requires additional confirmation from super admin.", "error"); setDangerConfirm(null); }}
                  style={{ flex: 2, padding: "10px 0", borderRadius: 10, border: "none", background: T.red, fontSize: 12, fontWeight: 800, color: "#fff", cursor: "pointer" }}
                >
                  Yes, Continue
                </button>
              </div>
            ) : (
              <button onClick={() => setDangerConfirm(d.id)} style={{ padding: "8px 14px", borderRadius: 10, border: `1px solid ${T.redB}`, background: T.surface, color: T.red, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                {d.label.split(" ").slice(0, 2).join(" ")}
              </button>
            )}
          </div>
        ))}
      </BottomSheet>

      <AnimatePresence>
        {toast && <MToast key="toast" msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
      </AnimatePresence>

      <style dangerouslySetInnerHTML={{ __html: `.scrollbar-hide::-webkit-scrollbar{display:none}.scrollbar-hide{-ms-overflow-style:none;scrollbar-width:none}` }} />
    </div>
  );
}