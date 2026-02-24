"use client";
// src/app/settings/page.tsx

import { useState, useEffect, useCallback } from "react";
import UnauthorizedOverlay from "@/components/ui/UnauthorizedOverlay";

const font = "'Plus Jakarta Sans',system-ui,sans-serif";
const C = {
  bg:"#F4F6FB", white:"#FFFFFF", border:"#EAECF2", border2:"#F0F2F7",
  tx1:"#0F1117", tx2:"#4A5065", tx3:"#9299B0",
  blue:"#4361EE", blueL:"#EEF2FF",
  green:"#059669", red:"#DC2626",
  shadow:"0 1px 3px rgba(16,24,40,.06)",
  shadowLg:"0 20px 60px rgba(16,24,40,.18)",
} as const;

// ── Types ─────────────────────────────────────────────────────────────────────
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
  pointsPerThousand:  10,
  minimumTransaction: 25000,
  pointsExpiry:       "12_months",
  tiers: {
    silver:   { minPoints: 0,     bonus: "0%",  label: "Silver" },
    gold:     { minPoints: 10000, bonus: "10%", label: "Gold" },
    platinum: { minPoints: 50000, bonus: "25%", label: "Platinum" },
  },
  notifications: { email: true, push: true, weekly: false },
  updatedAt: null,
  updatedBy: null,
};

// ── Sub-components ────────────────────────────────────────────────────────────
function Toggle({ on, onChange, disabled }: { on: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onChange}
      disabled={disabled}
      style={{
        width:44, height:24, borderRadius:99, border:"none", position:"relative",
        flexShrink:0, cursor:disabled?"not-allowed":"pointer", transition:"background .2s",
        background: on ? C.blue : "#E2E8F0",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <span style={{
        position:"absolute", top:2, width:20, height:20, background:"#fff",
        borderRadius:"50%", boxShadow:"0 1px 3px rgba(0,0,0,.2)", transition:"left .2s",
        left: on ? 22 : 2,
      }}/>
    </button>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background:C.white, borderRadius:18, border:`1px solid ${C.border}`, boxShadow:C.shadow, overflow:"hidden" }}>
      <div style={{ padding:"16px 24px", borderBottom:`1px solid ${C.border2}` }}>
        <h2 style={{ fontFamily:font, fontSize:15, fontWeight:800, color:C.tx1, margin:0 }}>{title}</h2>
      </div>
      <div style={{ padding:24 }}>{children}</div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom:20 }}>
      <label style={{ display:"block", fontSize:12, fontWeight:700, color:C.tx2, marginBottom:6, fontFamily:font }}>{label}</label>
      {children}
      {hint && <p style={{ fontSize:11, color:C.tx3, marginTop:5, marginBottom:0, fontFamily:font }}>{hint}</p>}
    </div>
  );
}

function Toast({ msg, type, onDone }: { msg: string; type: "success"|"error"; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 3500); return () => clearTimeout(t); }, [onDone]);
  return (
    <div style={{
      position:"fixed", bottom:28, right:28, zIndex:9999, padding:"13px 20px",
      borderRadius:13, fontFamily:font, fontSize:13.5, fontWeight:600, color:"#fff",
      background: type==="success" ? C.green : C.red,
      boxShadow:"0 8px 32px rgba(0,0,0,.22)",
      display:"flex", alignItems:"center", gap:10, animation:"gcRise .28s ease",
    }}>
      {type==="success" ? "✓" : "✕"} {msg}
      <style>{`@keyframes gcRise{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}`}</style>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width:"100%", height:40, borderRadius:10, border:`1.5px solid ${C.border}`,
  background:C.bg, padding:"0 14px", fontFamily:font, fontSize:13.5, color:C.tx1,
  outline:"none", boxSizing:"border-box", transition:"border-color .14s",
};

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const [settings,  setSettings]  = useState<Settings>(DEFAULTS);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [dirty,     setDirty]     = useState(false);
  const [toast,     setToast]     = useState<{msg:string;type:"success"|"error"}|null>(null);
  const [dangerConfirm, setDangerConfirm] = useState<string|null>(null);
  const [unauthorized, setUnauthorized] = useState(false);

  const showToast = (msg: string, type: "success"|"error" = "success") => setToast({ msg, type });

  // ── Load settings ───────────────────────────────────────────────────────────
  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings");
      if (res.status === 403) {
        setUnauthorized(true);
        setLoading(false);
        return;
      }
      if (!res.ok) throw new Error((await res.json()).message ?? "Gagal memuat pengaturan");
      setSettings(await res.json());
    } catch (e: any) {
      showToast(e.message ?? "Gagal memuat pengaturan", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  // ── Save settings ───────────────────────────────────────────────────────────
  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pointsPerThousand:  settings.pointsPerThousand,
          minimumTransaction: settings.minimumTransaction,
          pointsExpiry:       settings.pointsExpiry,
          tiers:              settings.tiers,
          notifications:      settings.notifications,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Gagal menyimpan");
      setSettings(data);
      setDirty(false);
      showToast("✓ Pengaturan berhasil disimpan!", "success");
    } catch (e: any) {
      showToast(e.message ?? "Gagal menyimpan pengaturan", "error");
    } finally {
      setSaving(false);
    }
  }

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings(prev => ({ ...prev, [key]: value }));
    setDirty(true);
  }

  function updateNotif(key: keyof Settings["notifications"]) {
    setSettings(prev => ({
      ...prev,
      notifications: { ...prev.notifications, [key]: !prev.notifications[key] },
    }));
    setDirty(true);
  }

  function updateTier(tier: keyof Settings["tiers"], field: string, value: string | number) {
    setSettings(prev => ({
      ...prev,
      tiers: {
        ...prev.tiers,
        [tier]: { ...prev.tiers[tier], [field]: value },
      },
    }));
    setDirty(true);
  }

  const tierList = [
    { key: "silver"   as const, icon: "🥈", color: "#64748B" },
    { key: "gold"     as const, icon: "🥇", color: "#D97706" },
    { key: "platinum" as const, icon: "💎", color: "#7C3AED" },
  ];

  if (unauthorized) {
    return <UnauthorizedOverlay />;
  }
  if (loading) {
    return (
      <div style={{ padding:"32px", fontFamily:font, display:"flex", alignItems:"center", gap:12, color:C.tx2 }}>
        <div style={{ width:20, height:20, borderRadius:"50%", border:`2px solid ${C.blue}`, borderTopColor:"transparent", animation:"spin .7s linear infinite" }}/>
        Memuat pengaturan…
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  return (
    <>
      <div style={{ padding:"32px 32px 48px", maxWidth:1200, fontFamily:font }}>

        {/* Header */}
        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:28 }}>
          <div>
            <h1 style={{ fontSize:24, fontWeight:800, color:C.tx1, margin:0, letterSpacing:"-.02em" }}>Global Settings</h1>
            <p style={{ fontSize:13.5, color:C.tx2, marginTop:6, marginBottom:0 }}>
              Konfigurasi sistem poin, tier member, dan preferensi notifikasi.
            </p>
            {settings.updatedAt && (
              <p style={{ fontSize:11, color:C.tx3, marginTop:4, marginBottom:0 }}>
                Terakhir diperbarui: {new Date(settings.updatedAt).toLocaleString("id-ID")}
              </p>
            )}
          </div>
          <div style={{ display:"flex", gap:10 }}>
            {dirty && (
              <button
                onClick={loadSettings}
                style={{ height:40, padding:"0 18px", borderRadius:10, border:`1.5px solid ${C.border}`, background:C.white, color:C.tx2, fontFamily:font, fontSize:13.5, fontWeight:600, cursor:"pointer" }}
              >
                Batalkan
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={!dirty || saving}
              style={{
                height:40, padding:"0 22px", borderRadius:10, border:"none",
                background: !dirty || saving ? "#9ca3af" : "linear-gradient(135deg,#4361EE,#3A0CA3)",
                color:"#fff", fontFamily:font, fontSize:13.5, fontWeight:700,
                cursor: !dirty || saving ? "not-allowed" : "pointer", transition:"all .2s",
              }}
            >
              {saving ? "Menyimpan…" : dirty ? "💾 Simpan Perubahan" : "✓ Tersimpan"}
            </button>
          </div>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>

          {/* ── Point Config ── */}
          <Card title="💎 Konfigurasi Poin">
            <Field label="Poin per Rp 1.000" hint="Setiap Rp 1.000 transaksi = X poin">
              <input
                type="number" min={1} max={1000}
                value={settings.pointsPerThousand}
                onChange={e => update("pointsPerThousand", Number(e.target.value))}
                style={inputStyle}
              />
            </Field>
            <Field label="Minimum Transaksi (Rp)" hint="Transaksi di bawah ini tidak mendapat poin">
              <input
                type="number" min={0} step={1000}
                value={settings.minimumTransaction}
                onChange={e => update("minimumTransaction", Number(e.target.value))}
                style={inputStyle}
              />
            </Field>
            <Field label="Masa Berlaku Poin">
              <select
                value={settings.pointsExpiry}
                onChange={e => update("pointsExpiry", e.target.value)}
                style={{ ...inputStyle, cursor:"pointer" }}
              >
                <option value="3_months">3 Bulan</option>
                <option value="6_months">6 Bulan</option>
                <option value="12_months">12 Bulan</option>
                <option value="24_months">24 Bulan</option>
                <option value="never">Tidak Kedaluwarsa</option>
              </select>
            </Field>
            <div style={{ padding:"12px 14px", borderRadius:10, background:C.blueL, border:`1px solid #C7D2FE` }}>
              <p style={{ fontSize:12, fontWeight:700, color:C.blue, margin:0 }}>Preview Kalkulasi</p>
              <p style={{ fontSize:11.5, color:C.tx2, marginTop:4, marginBottom:0 }}>
                Transaksi Rp 50.000 → <strong>{Math.floor(50000 / 1000) * settings.pointsPerThousand} poin</strong>
              </p>
              <p style={{ fontSize:11.5, color:C.tx2, marginTop:2, marginBottom:0 }}>
                Minimum transaksi: <strong>Rp {settings.minimumTransaction.toLocaleString("id-ID")}</strong>
              </p>
            </div>
          </Card>

          {/* ── Tier Config ── */}
          <Card title="🏆 Konfigurasi Tier Member">
            {tierList.map(({ key, icon, color }) => (
              <div key={key} style={{ marginBottom:16, padding:14, borderRadius:12, border:`1px solid ${C.border}`, background:C.bg }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
                  <span style={{ fontSize:18 }}>{icon}</span>
                  <p style={{ fontSize:13, fontWeight:800, color, margin:0 }}>{settings.tiers[key].label}</p>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                  <div>
                    <label style={{ fontSize:11, fontWeight:600, color:C.tx2, display:"block", marginBottom:4 }}>Min. Lifetime Poin</label>
                    <input
                      type="number" min={0}
                      value={settings.tiers[key].minPoints}
                      onChange={e => updateTier(key, "minPoints", Number(e.target.value))}
                      style={{ ...inputStyle, height:34, fontSize:12.5 }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize:11, fontWeight:600, color:C.tx2, display:"block", marginBottom:4 }}>Bonus Poin</label>
                    <input
                      type="text"
                      value={settings.tiers[key].bonus}
                      onChange={e => updateTier(key, "bonus", e.target.value)}
                      placeholder="mis. 10%"
                      style={{ ...inputStyle, height:34, fontSize:12.5 }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </Card>

          {/* ── Notifications ── */}
          <Card title="🔔 Notifikasi Admin">
            {([
              { key:"email"  as const, label:"Email saat ada transaksi pending", sub:"Notifikasi ke email admin" },
              { key:"push"   as const, label:"Push alert outlet non-aktif",       sub:"Browser notification" },
              { key:"weekly" as const, label:"Laporan mingguan otomatis",          sub:"Setiap Senin 08:00 WIB" },
            ]).map(n => (
              <div key={n.key} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 0", borderBottom:`1px solid ${C.border2}` }}>
                <div>
                  <p style={{ fontSize:13.5, fontWeight:600, color:C.tx1, margin:0 }}>{n.label}</p>
                  <p style={{ fontSize:11.5, color:C.tx3, margin:0, marginTop:3 }}>{n.sub}</p>
                </div>
                <Toggle on={settings.notifications[n.key]} onChange={() => updateNotif(n.key)}/>
              </div>
            ))}
            <p style={{ fontSize:11, color:C.tx3, marginTop:14, marginBottom:0 }}>
              Perubahan notifikasi akan aktif setelah disimpan.
            </p>
          </Card>

          {/* ── Danger Zone ── */}
          <Card title="⚠️ Danger Zone">
            <div style={{ borderRadius:12, border:"1px solid #FCA5A5", overflow:"hidden", background:"#FFF5F5" }}>
              {[
                {
                  id:    "reset_points",
                  title: "Reset Semua Poin Member",
                  desc:  "Mengatur ulang currentPoints semua user ke 0. Tidak dapat dibatalkan.",
                  label: "Reset Poin",
                },
                {
                  id:    "delete_transactions",
                  title: "Hapus Riwayat Transaksi",
                  desc:  "Menghapus semua dokumen di subcollection transactions. Permanen.",
                  label: "Hapus Riwayat",
                },
              ].map((d, i) => (
                <div key={d.id} style={{ padding:16, borderTop: i > 0 ? "1px solid #FEE2E2" : "none" }}>
                  <p style={{ fontSize:13.5, fontWeight:700, color:C.red, margin:0 }}>{d.title}</p>
                  <p style={{ fontSize:12, color:"#EF4444", margin:"4px 0 12px" }}>{d.desc}</p>
                  {dangerConfirm === d.id ? (
                    <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                      <p style={{ fontSize:12, fontWeight:700, color:C.red, margin:0 }}>Yakin? Tindakan ini permanen.</p>
                      <button
                        onClick={() => { showToast("Fitur ini memerlukan konfirmasi tambahan dari super admin.", "error"); setDangerConfirm(null); }}
                        style={{ height:30, padding:"0 12px", borderRadius:8, border:"none", background:C.red, color:"#fff", fontFamily:font, fontSize:12, fontWeight:700, cursor:"pointer" }}
                      >
                        Ya, Lanjutkan
                      </button>
                      <button
                        onClick={() => setDangerConfirm(null)}
                        style={{ height:30, padding:"0 12px", borderRadius:8, border:`1px solid #FCA5A5`, background:"#fff", color:C.red, fontFamily:font, fontSize:12, fontWeight:600, cursor:"pointer" }}
                      >
                        Batal
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDangerConfirm(d.id)}
                      style={{ height:32, padding:"0 14px", borderRadius:8, border:"1px solid #FCA5A5", background:"#fff", color:C.red, fontFamily:font, fontSize:12, fontWeight:700, cursor:"pointer" }}
                    >
                      {d.label}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </Card>

        </div>
      </div>

      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)}/>}
    </>
  );
}
