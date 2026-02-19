"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { User, Staff, UserTier, UserRole, StaffRole } from "@/types/firestore";

type UserWithUid = User & { uid: string };
type StaffWithUid = Staff & { uid: string };

// ─── Design tokens (mirrors Tailwind config / CSS vars) ───────────────────────
const T = {
  red:      "#B8001F",
  redPale:  "#FBF0F2",
  ink:      "#0E0E0E",
  ink60:    "rgba(14,14,14,.60)",
  ink30:    "rgba(14,14,14,.30)",
  ink10:    "rgba(14,14,14,.07)",
  ink06:    "rgba(14,14,14,.04)",
  white:    "#FFFFFF",
  cream:    "#FAF8F6",
  border:   "rgba(14,14,14,.11)",
  surface:  "#F5F3F0",
} as const;

// ─── Tier & Role configs ──────────────────────────────────────────────────────
const TIER_CFG: Record<string, { bg: string; fg: string; ring: string }> = {
  Platinum: { bg: "#F3F0FF", fg: "#5B21B6", ring: "#DDD6FE" },
  Gold:     { bg: "#FFFBEB", fg: "#B45309", ring: "#FDE68A" },
  Silver:   { bg: "#F8FAFC", fg: "#475569", ring: "#E2E8F0" },
};

const STAFF_ROLE_CFG: Record<string, { label: string; code: string; bg: string; fg: string }> = {
  cashier:       { label: "Kasir",   code: "POS", bg: "#EFF6FF", fg: "#1D4ED8" },
  store_manager: { label: "Manajer", code: "MGT", bg: "#F0FDF4", fg: "#15803D" },
  admin:         { label: "Admin",   code: "ADM", bg: "#FFF1F2", fg: "#BE123C" },
};

// ─── Shared small components ──────────────────────────────────────────────────

function Badge({ label, bg, fg, ring }: { label: string; bg: string; fg: string; ring?: string }) {
  return (
    <span style={{
      background: bg, color: fg,
      border: `1px solid ${ring ?? "transparent"}`,
      fontSize: 10, fontWeight: 700, letterSpacing: ".07em",
      textTransform: "uppercase", padding: "3px 9px", borderRadius: 99,
      whiteSpace: "nowrap",
    }}>{label}</span>
  );
}

function Avatar({ name, size = 36, gradient }: { name: string; size?: number; gradient?: string }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: size / 3,
      background: gradient ?? `linear-gradient(135deg, ${T.ink} 0%, #3a3a3a 100%)`,
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "#fff", fontSize: size * 0.38, fontWeight: 700,
      flexShrink: 0, fontFamily: "'DM Serif Display', serif",
      letterSpacing: "-.01em",
    }}>
      {(name?.[0] ?? "?").toUpperCase()}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label style={{
      display: "block", marginBottom: 6,
      fontSize: 11, fontWeight: 600, letterSpacing: ".04em",
      textTransform: "uppercase", color: T.ink30,
    }}>{children}</label>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", height: 42,
  border: `1.5px solid ${T.border}`,
  borderRadius: 8, background: T.cream,
  fontFamily: "'DM Sans', sans-serif",
  fontSize: 13.5, color: T.ink,
  padding: "0 13px", outline: "none",
  transition: "border-color .15s, box-shadow .15s",
  appearance: "none",
};

function Input({ style, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      {...props}
      style={{
        ...inputStyle,
        borderColor: focused ? T.red : T.border,
        boxShadow: focused ? `0 0 0 3px rgba(184,0,31,.09)` : "none",
        background: focused ? T.white : T.cream,
        ...style,
      }}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    />
  );
}

function Select({ style, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const [focused, setFocused] = useState(false);
  return (
    <select
      {...props}
      style={{
        ...inputStyle,
        paddingRight: 36,
        cursor: "pointer",
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='6' fill='none'%3E%3Cpath d='M1 1l4.5 4L10 1' stroke='%230E0E0E' stroke-opacity='.35' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 13px center",
        borderColor: focused ? T.red : T.border,
        boxShadow: focused ? `0 0 0 3px rgba(184,0,31,.09)` : "none",
        background: focused ? T.white : T.cream,
        ...style,
      }}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    >
      {children}
    </select>
  );
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      style={{
        width: 40, height: 22, borderRadius: 99, border: "none",
        background: on ? T.red : T.ink10,
        cursor: "pointer", position: "relative",
        transition: "background .2s", flexShrink: 0,
      }}
    >
      <span style={{
        position: "absolute", top: 3, left: on ? 19 : 3,
        width: 16, height: 16, borderRadius: 99, background: "#fff",
        boxShadow: "0 1px 4px rgba(0,0,0,.2)",
        transition: "left .2s cubic-bezier(.34,1.56,.64,1)",
        display: "block",
      }} />
    </button>
  );
}

function Btn({
  variant = "ghost", children, style, ...props
}: { variant?: "ghost" | "primary" | "danger" } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const base: React.CSSProperties = {
    height: 38, padding: "0 18px", borderRadius: 8,
    fontFamily: "'DM Sans', sans-serif",
    fontSize: 13, fontWeight: 500, cursor: "pointer",
    display: "inline-flex", alignItems: "center", gap: 7,
    transition: "all .15s", letterSpacing: ".01em", border: "none",
    whiteSpace: "nowrap",
  };
  const variants = {
    ghost:   { background: "transparent", color: T.ink60, border: `1.5px solid ${T.border}` },
    primary: { background: T.ink, color: "#fff" },
    danger:  { background: "#FFF1F2", color: T.red, border: `1.5px solid #FECDD3` },
  };
  return (
    <button {...props} style={{ ...base, ...variants[variant], ...style }}>
      {children}
    </button>
  );
}

// ─── SEARCH BAR ───────────────────────────────────────────────────────────────
function SearchBar({ value, onChange, placeholder }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      height: 38, padding: "0 12px",
      border: `1.5px solid ${focused ? T.red : T.border}`,
      borderRadius: 8, background: focused ? T.white : T.cream,
      boxShadow: focused ? `0 0 0 3px rgba(184,0,31,.09)` : "none",
      transition: "all .15s", minWidth: 200,
    }}>
      <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke={T.ink30} strokeWidth={2.5}>
        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
      </svg>
      <input
        style={{ flex: 1, border: "none", background: "transparent", outline: "none",
          fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: T.ink }}
        placeholder={placeholder ?? "Cari…"}
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      {value && (
        <button onClick={() => onChange("")} style={{
          background: "none", border: "none", cursor: "pointer",
          color: T.ink30, fontSize: 14, lineHeight: 1, padding: 0,
        }}>✕</button>
      )}
    </div>
  );
}

// ─── STAT CARD ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, accent }: {
  label: string; value: number | string; sub?: string; accent: string;
}) {
  return (
    <div style={{
      background: T.white, border: `1px solid ${T.border}`,
      borderRadius: 12, padding: "18px 20px",
      boxShadow: "0 1px 4px rgba(0,0,0,.04)",
    }}>
      <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".08em",
        textTransform: "uppercase", color: T.ink30, marginBottom: 8 }}>{label}</p>
      <p style={{ fontFamily: "'DM Serif Display', serif", fontSize: 30,
        fontWeight: 400, color: accent, lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: T.ink30, marginTop: 4 }}>{sub}</p>}
    </div>
  );
}

// ─── SECTION HEADER ───────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".15em",
      textTransform: "uppercase", color: T.ink30, marginBottom: 14 }}>
      {children}
    </p>
  );
}

// ─── MODAL SHELL ─────────────────────────────────────────────────────────────
function Modal({ children, onClose, maxWidth = 520 }: {
  children: React.ReactNode; onClose: () => void; maxWidth?: number;
}) {
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onClose]);

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 50,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
        background: "rgba(8,8,8,.5)", backdropFilter: "blur(8px)",
      }}
    >
      <div style={{
        background: T.white, borderRadius: 20, width: "100%",
        maxWidth, maxHeight: "92vh", overflow: "hidden",
        display: "flex", flexDirection: "column",
        boxShadow: "0 0 0 1px rgba(255,255,255,.06), 0 24px 64px rgba(0,0,0,.22), 0 4px 12px rgba(0,0,0,.08)",
        animation: "modalRise .3s cubic-bezier(.22,.68,0,1.2) both",
      }}>
        {children}
      </div>
      <style>{`
        @keyframes modalRise {
          from { opacity:0; transform:translateY(20px) scale(.97); }
          to   { opacity:1; transform:translateY(0)    scale(1); }
        }
      `}</style>
    </div>
  );
}

function ModalHead({ title, subtitle, onClose }: {
  title: React.ReactNode; subtitle?: string; onClose: () => void;
}) {
  return (
    <div style={{
      padding: "28px 32px 20px", flexShrink: 0,
      borderBottom: `1px solid ${T.border}`,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          {subtitle && (
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".18em",
              textTransform: "uppercase", color: T.red, marginBottom: 4 }}>{subtitle}</p>
          )}
          <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 24,
            fontWeight: 400, color: T.ink, lineHeight: 1.1, letterSpacing: "-.01em" }}>
            {title}
          </h2>
        </div>
        <button onClick={onClose} style={{
          width: 34, height: 34, borderRadius: "50%",
          border: `1.5px solid ${T.border}`, background: "transparent",
          cursor: "pointer", display: "flex", alignItems: "center",
          justifyContent: "center", flexShrink: 0, marginTop: 2,
          transition: "background .15s",
        }}
          onMouseOver={e => (e.currentTarget.style.background = T.ink06)}
          onMouseOut={e => (e.currentTarget.style.background = "transparent")}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M1 1l10 10M11 1L1 11" stroke={T.ink60} strokeWidth="1.6" strokeLinecap="round"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

function ModalBody({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      overflowY: "auto", flex: 1, padding: "24px 32px",
    }}>{children}</div>
  );
}

function ModalFoot({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      padding: "16px 32px 24px", flexShrink: 0,
      borderTop: `1px solid ${T.border}`,
      display: "flex", alignItems: "center", justifyContent: "space-between",
    }}>{children}</div>
  );
}

// ─── DETAIL MEMBER MODAL ──────────────────────────────────────────────────────
function MemberDetailModal({ user, onClose, onEdit }: {
  user: UserWithUid; onClose: () => void; onEdit: () => void;
}) {
  const tier = TIER_CFG[user.tier] ?? TIER_CFG.Silver;
  const avatarGradients = ["135deg,#B8001F,#7A000F", "135deg,#1D4ED8,#1E3A5F", "135deg,#15803D,#052e16"];
  const idx = (user.name?.charCodeAt(0) ?? 0) % avatarGradients.length;

  return (
    <Modal onClose={onClose} maxWidth={500}>
      <ModalHead
        subtitle="Member Detail"
        title={<>{user.name ?? "—"}</>}
        onClose={onClose}
      />
      <ModalBody>
        {/* Hero row */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24,
          padding: "16px 20px", background: T.cream, borderRadius: 12,
          border: `1px solid ${T.border}` }}>
          <Avatar name={user.name ?? "?"} size={52} gradient={`linear-gradient(${avatarGradients[idx]})`} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 15, fontWeight: 600, color: T.ink, marginBottom: 2 }}>{user.name}</p>
            <p style={{ fontSize: 12, color: T.ink60, marginBottom: 2, overflow: "hidden",
              textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.email}</p>
            <p style={{ fontSize: 12, color: T.ink30 }}>{user.phoneNumber}</p>
          </div>
          <Badge label={user.tier} bg={tier.bg} fg={tier.fg} ring={tier.ring} />
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 24 }}>
          {[
            { label: "Poin Aktif", value: (user.currentPoints ?? 0).toLocaleString("id"), fg: T.red },
            { label: "Lifetime XP", value: (user.lifetimePoints ?? 0).toLocaleString("id"), fg: "#1D4ED8" },
            { label: "Voucher", value: String(user.vouchers?.length ?? 0), fg: "#15803D" },
          ].map(s => (
            <div key={s.label} style={{
              background: T.cream, border: `1px solid ${T.border}`,
              borderRadius: 10, padding: "12px 14px", textAlign: "center",
            }}>
              <p style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22, color: s.fg, lineHeight: 1 }}>{s.value}</p>
              <p style={{ fontSize: 10, color: T.ink30, marginTop: 4, fontWeight: 600,
                textTransform: "uppercase", letterSpacing: ".06em" }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Info rows */}
        <SectionLabel>Informasi Akun</SectionLabel>
        <div style={{ marginBottom: 24 }}>
          {[
            { label: "UID", value: <code style={{ fontSize: 11, background: T.cream, padding: "2px 8px", borderRadius: 6, color: T.red, border: `1px solid ${T.border}` }}>{user.uid}</code> },
            { label: "Role", value: <span style={{ fontSize: 13, color: T.ink, fontWeight: 500 }}>{user.role}</span> },
            { label: "Bergabung", value: <span style={{ fontSize: 13, color: T.ink }}>{user.joinedDate ? new Date(user.joinedDate).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "—"}</span> },
          ].map((row, i, arr) => (
            <div key={row.label} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "10px 0",
              borderBottom: i < arr.length - 1 ? `1px solid ${T.border}` : "none",
            }}>
              <span style={{ fontSize: 12, color: T.ink30, fontWeight: 500 }}>{row.label}</span>
              {row.value}
            </div>
          ))}
        </div>

        {/* XP History */}
        {(user.xpHistory?.length ?? 0) > 0 && (
          <>
            <SectionLabel>Riwayat XP Terbaru</SectionLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
              {[...user.xpHistory].reverse().slice(0, 5).map(x => (
                <div key={x.id} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  background: T.cream, border: `1px solid ${T.border}`,
                  borderRadius: 10, padding: "10px 14px",
                }}>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 500, color: T.ink, marginBottom: 2 }}>{x.context}</p>
                    <p style={{ fontSize: 11, color: T.ink30 }}>{x.location} · {new Date(x.date).toLocaleDateString("id-ID")}</p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: x.type === "earn" ? "#15803D" : T.red }}>
                      {x.type === "earn" ? "+" : "−"}{x.amount.toLocaleString("id")} pts
                    </p>
                    <Badge
                      label={x.status}
                      bg={x.status === "verified" ? "#F0FDF4" : x.status === "pending" ? "#FFFBEB" : "#FFF1F2"}
                      fg={x.status === "verified" ? "#15803D" : x.status === "pending" ? "#B45309" : T.red}
                    />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Vouchers */}
        {(user.vouchers?.filter(v => !v.isUsed).length ?? 0) > 0 && (
          <>
            <SectionLabel>Voucher Aktif</SectionLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {user.vouchers.filter(v => !v.isUsed).map(v => (
                <div key={v.id} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  border: `1px solid ${T.border}`, borderRadius: 10, padding: "10px 14px",
                }}>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 500, color: T.ink, marginBottom: 2 }}>{v.title}</p>
                    <code style={{ fontSize: 11, color: T.red }}>{v.code}</code>
                  </div>
                  <p style={{ fontSize: 11, color: T.ink30 }}>Exp: {new Date(v.expiresAt).toLocaleDateString("id-ID")}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </ModalBody>
      <ModalFoot>
        <p style={{ fontSize: 11, color: T.ink30 }}>UID: <code style={{ color: T.ink60 }}>{user.uid.slice(0, 16)}…</code></p>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn variant="ghost" onClick={onClose}>Tutup</Btn>
          <Btn variant="primary" onClick={onEdit}
            style={{ background: T.ink }}
            onMouseOver={e => (e.currentTarget.style.background = T.red)}
            onMouseOut={e => (e.currentTarget.style.background = T.ink)}>
            Edit Member
          </Btn>
        </div>
      </ModalFoot>
    </Modal>
  );
}

// ─── EDIT MEMBER MODAL ────────────────────────────────────────────────────────
function EditMemberModal({ user, onClose, onSaved }: {
  user: UserWithUid; onClose: () => void;
  onSaved: (updated: Partial<UserWithUid>) => void;
}) {
  const [form, setForm] = useState({
    name: user.name ?? "",
    tier: user.tier ?? "Silver",
    currentPoints: user.currentPoints ?? 0,
    lifetimePoints: user.lifetimePoints ?? 0,
    role: user.role ?? "member",
    phoneNumber: user.phoneNumber ?? "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    setLoading(true); setError("");
    try {
      const res = await fetch(`/api/members/${user.uid}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Gagal menyimpan");
      onSaved(form); onClose();
    } catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  }

  const F = (key: keyof typeof form, label: string, type = "text") => (
    <div key={key}>
      <FieldLabel>{label}</FieldLabel>
      <Input type={type} value={String(form[key])}
        onChange={e => setForm(p => ({ ...p, [key]: type === "number" ? Number(e.target.value) : e.target.value }))} />
    </div>
  );

  return (
    <Modal onClose={onClose} maxWidth={460}>
      <ModalHead subtitle="Edit Member" title={<>Ubah Data <em style={{ fontStyle: "italic", color: T.red }}>{user.name}</em></>} onClose={onClose} />
      <ModalBody>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {F("name", "Nama Lengkap")}
          {F("phoneNumber", "No. Telepon")}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {F("currentPoints", "Poin Aktif", "number")}
            {F("lifetimePoints", "Lifetime Points", "number")}
          </div>
          <div>
            <FieldLabel>Tier</FieldLabel>
            <Select value={form.tier} onChange={e => setForm(p => ({ ...p, tier: e.target.value as UserTier }))}>
              {["Silver", "Gold", "Platinum"].map(t => <option key={t}>{t}</option>)}
            </Select>
          </div>
          <div>
            <FieldLabel>Role</FieldLabel>
            <Select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value as UserRole }))}>
              {["member", "admin", "trial", "master"].map(r => <option key={r}>{r}</option>)}
            </Select>
          </div>
          {error && <p style={{ fontSize: 12, color: T.red }}>{error}</p>}
        </div>
      </ModalBody>
      <ModalFoot>
        <p style={{ fontSize: 11, color: T.ink30 }}>Perubahan langsung tersimpan</p>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn variant="ghost" onClick={onClose}>Batal</Btn>
          <Btn variant="primary" onClick={handleSave} disabled={loading}
            style={{ background: T.ink, opacity: loading ? .5 : 1 }}
            onMouseOver={e => { if (!loading) e.currentTarget.style.background = T.red; }}
            onMouseOut={e => { e.currentTarget.style.background = T.ink; }}>
            {loading ? "Menyimpan…" : "Simpan Perubahan"}
          </Btn>
        </div>
      </ModalFoot>
    </Modal>
  );
}

// ─── EDIT STAFF MODAL ─────────────────────────────────────────────────────────
function EditStaffModal({ staff, storeIds, onClose, onSaved }: {
  staff: StaffWithUid; storeIds: string[]; onClose: () => void;
  onSaved: (updated: Partial<StaffWithUid>) => void;
}) {
  const [form, setForm] = useState({
    name: staff.name ?? "",
    role: staff.role ?? "cashier",
    storeLocation: staff.storeLocation ?? "",
    isActive: staff.isActive ?? true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    setLoading(true); setError("");
    try {
      const res = await fetch(`/api/staff/${staff.uid}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Gagal menyimpan");
      onSaved(form); onClose();
    } catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  }

  return (
    <Modal onClose={onClose} maxWidth={460}>
      <ModalHead subtitle="Edit Staff" title={<>Ubah Data <em style={{ fontStyle: "italic", color: T.red }}>{staff.name}</em></>} onClose={onClose} />
      <ModalBody>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <FieldLabel>Nama Lengkap</FieldLabel>
            <Input type="text" value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
          </div>
          <div>
            <FieldLabel>Role</FieldLabel>
            <Select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value as StaffRole }))}>
              <option value="cashier">Kasir</option>
              <option value="store_manager">Manajer</option>
              <option value="admin">Admin</option>
            </Select>
          </div>
          <div>
            <FieldLabel>Outlet / Cabang</FieldLabel>
            <Select value={form.storeLocation} onChange={e => setForm(p => ({ ...p, storeLocation: e.target.value }))}>
              {storeIds.map(id => <option key={id} value={id}>{id}</option>)}
            </Select>
          </div>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "14px 16px", background: T.cream, borderRadius: 10,
            border: `1.5px solid ${T.border}`,
          }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 500, color: T.ink }}>Status Aktif</p>
              <p style={{ fontSize: 11, color: T.ink30 }}>Akun dapat digunakan untuk login</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{
                fontSize: 10, fontWeight: 700, letterSpacing: ".07em",
                textTransform: "uppercase", padding: "3px 10px", borderRadius: 99,
                background: form.isActive ? "#F0FDF4" : T.ink06,
                color: form.isActive ? "#15803D" : T.ink30,
                border: `1px solid ${form.isActive ? "#BBF7D0" : T.border}`,
              }}>{form.isActive ? "Aktif" : "Nonaktif"}</span>
              <Toggle on={form.isActive} onToggle={() => setForm(p => ({ ...p, isActive: !p.isActive }))} />
            </div>
          </div>
          {error && <p style={{ fontSize: 12, color: T.red }}>{error}</p>}
        </div>
      </ModalBody>
      <ModalFoot>
        <p style={{ fontSize: 11, color: T.ink30 }}>Perubahan langsung tersimpan</p>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn variant="ghost" onClick={onClose}>Batal</Btn>
          <Btn variant="primary" onClick={handleSave} disabled={loading}
            style={{ background: T.ink, opacity: loading ? .5 : 1 }}
            onMouseOver={e => { if (!loading) e.currentTarget.style.background = T.red; }}
            onMouseOut={e => { e.currentTarget.style.background = T.ink; }}>
            {loading ? "Menyimpan…" : "Simpan Perubahan"}
          </Btn>
        </div>
      </ModalFoot>
    </Modal>
  );
}

// ─── CREATE ACCOUNT MODAL ─────────────────────────────────────────────────────
function CreateAccountModal({ onClose, storeIds, onCreated }: {
  onClose: () => void;
  storeIds: string[];
  onCreated: (type: "member" | "staff", data: any) => void;
}) {
  const [type, setType] = useState<"member" | "staff">("member");
  const [form, setForm] = useState<Record<string, any>>({
    tier: "Silver", role: "cashier", isActive: true,
  });
  const [pwVisible, setPwVisible] = useState(false);
  const [strength, setStrength] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function calcStrength(v: string) {
    let s = 0;
    if (v.length >= 8) s++;
    if (/[A-Z]/.test(v)) s++;
    if (/[0-9]/.test(v)) s++;
    if (/[^A-Za-z0-9]/.test(v)) s++;
    setStrength(s);
  }

  async function handleSave() {
    setLoading(true); setError("");
    try {
      // TODO: real API call
      await new Promise(r => setTimeout(r, 600)); // simulate
      onCreated(type, form);
      onClose();
    } catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  }

  const strColor = strength <= 1 ? "#EF4444" : strength <= 2 ? "#F59E0B" : "#22C55E";
  const strLabel = strength === 0 ? "" : strength <= 1 ? "Lemah" : strength <= 2 ? "Sedang" : strength <= 3 ? "Kuat" : "Sangat Kuat";

  return (
    <Modal onClose={onClose} maxWidth={540}>
      <ModalHead
        subtitle="Account Management"
        title={<>New <em style={{ fontStyle: "italic", color: T.red }}>Account</em></>}
        onClose={onClose}
      />

      {/* Type switcher */}
      <div style={{ padding: "16px 32px 0", borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
        <div style={{
          display: "inline-flex", background: T.ink06,
          borderRadius: 99, padding: 3, border: `1px solid ${T.border}`,
          marginBottom: 16,
        }}>
          {(["member", "staff"] as const).map(t => (
            <button key={t} onClick={() => { setType(t); setForm({ tier: "Silver", role: "cashier", isActive: true }); setError(""); }}
              style={{
                padding: "7px 20px", borderRadius: 99, border: "none",
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 12.5, fontWeight: 500, cursor: "pointer",
                letterSpacing: ".01em",
                background: type === t ? T.white : "transparent",
                color: type === t ? T.ink : T.ink60,
                boxShadow: type === t ? `0 1px 4px rgba(0,0,0,.1), 0 0 0 1px ${T.border}` : "none",
                transition: "all .15s",
              }}>
              {t === "member" ? "Member" : "Staff & Admin"}
            </button>
          ))}
        </div>
      </div>

      <ModalBody>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Personal */}
          <SectionLabel>Informasi Pribadi</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <FieldLabel>Nama Depan <span style={{ color: T.red }}>*</span></FieldLabel>
              <Input placeholder="Budi" value={form.firstName ?? ""}
                onChange={e => setForm(p => ({ ...p, firstName: e.target.value }))} />
            </div>
            <div>
              <FieldLabel>Nama Belakang</FieldLabel>
              <Input placeholder="Santoso" value={form.lastName ?? ""}
                onChange={e => setForm(p => ({ ...p, lastName: e.target.value }))} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <FieldLabel>Email <span style={{ color: T.red }}>*</span></FieldLabel>
              <Input type="email" placeholder="email@example.com" value={form.email ?? ""}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
            </div>
            <div>
              <FieldLabel>No. Telepon <span style={{ color: T.red }}>*</span></FieldLabel>
              <Input type="tel" placeholder="08xx-xxxx-xxxx" value={form.phone ?? ""}
                onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
            </div>
          </div>

          {/* Member-specific */}
          {type === "member" && (
            <>
              <div style={{ height: 1, background: T.border }} />
              <SectionLabel>Detail Member</SectionLabel>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <FieldLabel>Tier</FieldLabel>
                  <Select value={form.tier} onChange={e => setForm(p => ({ ...p, tier: e.target.value }))}>
                    {["Silver", "Gold", "Platinum"].map(t => <option key={t}>{t}</option>)}
                  </Select>
                </div>
                <div>
                  <FieldLabel>Tanggal Lahir</FieldLabel>
                  <Input type="date" value={form.dob ?? ""}
                    onChange={e => setForm(p => ({ ...p, dob: e.target.value }))} />
                </div>
              </div>
            </>
          )}

          {/* Staff-specific */}
          {type === "staff" && (
            <>
              <div style={{ height: 1, background: T.border }} />
              <SectionLabel>Akses & Jabatan</SectionLabel>
              <div>
                <FieldLabel>Outlet / Cabang <span style={{ color: T.red }}>*</span></FieldLabel>
                <Select value={form.storeLocation ?? ""}
                  onChange={e => setForm(p => ({ ...p, storeLocation: e.target.value }))}>
                  <option value="">Pilih outlet…</option>
                  {storeIds.map(id => <option key={id} value={id}>{id}</option>)}
                </Select>
              </div>
              <div>
                <FieldLabel>Role <span style={{ color: T.red }}>*</span></FieldLabel>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                  {Object.entries(STAFF_ROLE_CFG).map(([key, cfg]) => (
                    <button key={key} type="button"
                      onClick={() => setForm(p => ({ ...p, role: key }))}
                      style={{
                        border: `1.5px solid ${form.role === key ? T.red : T.border}`,
                        borderRadius: 8, padding: "12px 8px 10px",
                        background: form.role === key ? T.redPale : T.cream,
                        cursor: "pointer", textAlign: "center",
                        boxShadow: form.role === key ? `0 0 0 3px rgba(184,0,31,.07)` : "none",
                        transition: "all .14s",
                      }}>
                      <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".14em",
                        textTransform: "uppercase", marginBottom: 4,
                        color: form.role === key ? T.red : T.ink30 }}>{cfg.code}</p>
                      <p style={{ fontSize: 12.5, fontWeight: 500,
                        color: form.role === key ? T.ink : T.ink60 }}>{cfg.label}</p>
                      <div style={{
                        width: 5, height: 5, borderRadius: "50%",
                        background: form.role === key ? T.red : T.border,
                        margin: "8px auto 0", transition: "background .14s",
                      }} />
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Credentials */}
          <div style={{ height: 1, background: T.border }} />
          <SectionLabel>Kredensial Akun</SectionLabel>
          <div>
            <FieldLabel>Username <span style={{ color: T.red }}>*</span></FieldLabel>
            <Input placeholder="budi.santoso" value={form.username ?? ""}
              onChange={e => setForm(p => ({ ...p, username: e.target.value }))} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <FieldLabel>Password <span style={{ color: T.red }}>*</span></FieldLabel>
              <div style={{ position: "relative" }}>
                <Input
                  type={pwVisible ? "text" : "password"}
                  placeholder="Min. 8 karakter"
                  style={{ paddingRight: 50 }}
                  value={form.password ?? ""}
                  onChange={e => { setForm(p => ({ ...p, password: e.target.value })); calcStrength(e.target.value); }}
                />
                <button type="button"
                  onClick={() => setPwVisible(v => !v)}
                  style={{
                    position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                    background: "none", border: "none", cursor: "pointer",
                    fontSize: 11, fontWeight: 500, color: T.ink30,
                    fontFamily: "'DM Sans', sans-serif", letterSpacing: ".04em",
                  }}>
                  {pwVisible ? "hide" : "show"}
                </button>
              </div>
              {form.password && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 7 }}>
                  <div style={{ display: "flex", gap: 3, flex: 1 }}>
                    {[1,2,3,4].map(i => (
                      <div key={i} style={{
                        height: 2, flex: 1, borderRadius: 1,
                        background: i <= strength ? strColor : T.border,
                        transition: "background .2s",
                      }} />
                    ))}
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 600, color: strColor, letterSpacing: ".04em" }}>{strLabel}</span>
                </div>
              )}
            </div>
            <div>
              <FieldLabel>Konfirmasi Password <span style={{ color: T.red }}>*</span></FieldLabel>
              <div style={{ position: "relative" }}>
                <Input
                  type="password"
                  placeholder="Ulangi password"
                  value={form.confirmPassword ?? ""}
                  onChange={e => setForm(p => ({ ...p, confirmPassword: e.target.value }))}
                  style={form.confirmPassword && form.confirmPassword !== form.password
                    ? { borderColor: T.red } : {}}
                />
              </div>
              {form.confirmPassword && form.confirmPassword !== form.password && (
                <p style={{ fontSize: 11, color: T.red, marginTop: 5 }}>Password tidak cocok</p>
              )}
            </div>
          </div>

          {/* Status */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "14px 16px", background: T.cream, borderRadius: 10,
            border: `1.5px solid ${T.border}`,
          }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 500, color: T.ink }}>Status Akun</p>
              <p style={{ fontSize: 11, color: T.ink30 }}>Akun langsung aktif setelah dibuat</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{
                fontSize: 10, fontWeight: 700, letterSpacing: ".07em",
                textTransform: "uppercase", padding: "3px 10px", borderRadius: 99,
                background: form.isActive ? "#F0FDF4" : T.ink06,
                color: form.isActive ? "#15803D" : T.ink30,
                border: `1px solid ${form.isActive ? "#BBF7D0" : T.border}`,
              }}>{form.isActive ? "Aktif" : "Nonaktif"}</span>
              <Toggle on={form.isActive} onToggle={() => setForm(p => ({ ...p, isActive: !p.isActive }))} />
            </div>
          </div>

          {error && (
            <div style={{
              padding: "12px 14px", background: "#FFF1F2", border: `1px solid #FECDD3`,
              borderRadius: 8, fontSize: 12, color: T.red,
            }}>{error}</div>
          )}
        </div>
      </ModalBody>

      <ModalFoot>
        <p style={{ fontSize: 11, color: T.ink30 }}>
          Kolom <span style={{ color: T.red }}>*</span> wajib diisi
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn variant="ghost" onClick={onClose}>Batal</Btn>
          <Btn variant="primary" onClick={handleSave} disabled={loading}
            style={{ background: T.ink, opacity: loading ? .6 : 1, minWidth: 130 }}
            onMouseOver={e => { if (!loading) e.currentTarget.style.background = T.red; }}
            onMouseOut={e => { e.currentTarget.style.background = T.ink; }}>
            {loading ? "Membuat akun…" : "Buat Akun"}
          </Btn>
        </div>
      </ModalFoot>
    </Modal>
  );
}

// ─── TABLE ────────────────────────────────────────────────────────────────────
function TableHead({ columns }: { columns: string[] }) {
  return (
    <thead>
      <tr style={{ background: T.surface }}>
        {columns.map(c => (
          <th key={c} style={{
            textAlign: "left", padding: "10px 20px",
            fontSize: 10, fontWeight: 700, letterSpacing: ".1em",
            textTransform: "uppercase", color: T.ink30,
            borderBottom: `1px solid ${T.border}`,
          }}>{c}</th>
        ))}
      </tr>
    </thead>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function MembersClient({
  initialUsers, initialStaff, storeIds,
}: {
  initialUsers: UserWithUid[];
  initialStaff: StaffWithUid[];
  storeIds: string[];
}) {
  const [users, setUsers] = useState(initialUsers);
  const [staff, setStaff] = useState(initialStaff);
  const [activeTab, setActiveTab] = useState<"member" | "staff">("member");

  // search & filter
  const [memberSearch, setMemberSearch] = useState("");
  const [staffSearch, setStaffSearch] = useState("");
  const [tierFilter, setTierFilter] = useState("All");

  // modals
  const [detailUser, setDetailUser] = useState<UserWithUid | null>(null);
  const [editUser, setEditUser] = useState<UserWithUid | null>(null);
  const [editStaff, setEditStaff] = useState<StaffWithUid | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const filteredUsers = useMemo(() => users.filter(u => {
    const q = memberSearch.toLowerCase();
    const matchQ = !q || u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || u.phoneNumber?.includes(q);
    const matchT = tierFilter === "All" || u.tier === tierFilter;
    return matchQ && matchT;
  }), [users, memberSearch, tierFilter]);

  const filteredStaff = useMemo(() => staff.filter(s => {
    const q = staffSearch.toLowerCase();
    return !q || s.name?.toLowerCase().includes(q) || s.email?.toLowerCase().includes(q);
  }), [staff, staffSearch]);

  function handleUserSaved(uid: string, updated: Partial<UserWithUid>) {
    setUsers(prev => prev.map(u => u.uid === uid ? { ...u, ...updated } : u));
  }
  function handleStaffSaved(uid: string, updated: Partial<StaffWithUid>) {
    setStaff(prev => prev.map(s => s.uid === uid ? { ...s, ...updated } : s));
  }
  function handleCreated(type: "member" | "staff", data: any) {
    // TODO: push to state after API response
    setActiveTab(type);
  }

  // ── STYLES ──────────────────────────────────────────────────────────────────
  const pageStyle: React.CSSProperties = {
    fontFamily: "'DM Sans', sans-serif",
    padding: "32px 40px",
    maxWidth: 1360,
    minHeight: "100vh",
    background: T.surface,
  };

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: "10px 22px",
    borderRadius: 99,
    border: "none",
    background: active ? T.white : "transparent",
    color: active ? T.ink : T.ink60,
    fontFamily: "'DM Sans', sans-serif",
    fontSize: 13.5, fontWeight: 500,
    cursor: "pointer", letterSpacing: ".01em",
    boxShadow: active ? `0 1px 4px rgba(0,0,0,.1), 0 0 0 1px ${T.border}` : "none",
    transition: "all .15s",
  });

  const cardStyle: React.CSSProperties = {
    background: T.white,
    border: `1px solid ${T.border}`,
    borderRadius: 16,
    overflow: "hidden",
    boxShadow: "0 1px 4px rgba(0,0,0,.04)",
  };

  const rowHoverStyle = `
    @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600&display=swap');
    .acct-row:hover { background: ${T.cream} !important; }
    .acct-btn:hover { border-color: ${T.red} !important; color: ${T.red} !important; }
  `;

  const avatarGrads = [
    "135deg,#B8001F,#7A000F",
    "135deg,#1D4ED8,#1E3A5F",
    "135deg,#15803D,#052e16",
    "135deg,#7C3AED,#3B0764",
  ];
  const grad = (name: string) => `linear-gradient(${avatarGrads[(name?.charCodeAt(0) ?? 0) % avatarGrads.length]})`;

  return (
    <div style={pageStyle}>
      <style>{rowHoverStyle}</style>

      {/* ── PAGE HEADER ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 32 }}>
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".18em", textTransform: "uppercase",
            color: T.red, marginBottom: 6 }}>Gong Cha Admin</p>
          <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 32, fontWeight: 400,
            color: T.ink, letterSpacing: "-.02em", lineHeight: 1.05 }}>
            Account <em style={{ fontStyle: "italic", color: T.red }}>Management</em>
          </h1>
          <p style={{ fontSize: 13, color: T.ink60, marginTop: 6 }}>
            Kelola member, tier, poin, dan akses staff dalam satu tempat.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          style={{
            height: 42, padding: "0 22px", borderRadius: 10, border: "none",
            background: T.ink, color: "#fff",
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 13, fontWeight: 500, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 8,
            transition: "all .15s", letterSpacing: ".01em",
            boxShadow: "0 2px 8px rgba(0,0,0,.12)",
          }}
          onMouseOver={e => { e.currentTarget.style.background = T.red; e.currentTarget.style.transform = "translateY(-1px)"; }}
          onMouseOut={e => { e.currentTarget.style.background = T.ink; e.currentTarget.style.transform = "translateY(0)"; }}
        >
          <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15"/>
          </svg>
          Tambah Akun
        </button>
      </div>

      {/* ── STAT CARDS ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 28 }}>
        <StatCard label="Total Member" value={users.length} accent={T.ink} />
        <StatCard label="Platinum" value={users.filter(u => u.tier === "Platinum").length} accent="#5B21B6"
          sub={`${Math.round(users.filter(u=>u.tier==="Platinum").length/Math.max(users.length,1)*100)}% dari total`} />
        <StatCard label="Gold" value={users.filter(u => u.tier === "Gold").length} accent="#B45309"
          sub={`${Math.round(users.filter(u=>u.tier==="Gold").length/Math.max(users.length,1)*100)}% dari total`} />
        <StatCard label="Silver" value={users.filter(u => u.tier === "Silver").length} accent="#475569" />
        <StatCard label="Total Staff" value={staff.length}
          sub={`${staff.filter(s=>s.isActive).length} aktif`} accent={T.red} />
      </div>

      {/* ── TABS ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 16,
      }}>
        <div style={{
          display: "inline-flex", background: T.white,
          border: `1px solid ${T.border}`, borderRadius: 99, padding: 4,
        }}>
          <button style={tabStyle(activeTab === "member")} onClick={() => setActiveTab("member")}>
            Member
            <span style={{
              marginLeft: 8, fontSize: 11, fontWeight: 700,
              background: activeTab === "member" ? T.red : T.ink10,
              color: activeTab === "member" ? "#fff" : T.ink30,
              padding: "1px 7px", borderRadius: 99,
              transition: "all .15s",
            }}>{users.length}</span>
          </button>
          <button style={tabStyle(activeTab === "staff")} onClick={() => setActiveTab("staff")}>
            Staff & Admin
            <span style={{
              marginLeft: 8, fontSize: 11, fontWeight: 700,
              background: activeTab === "staff" ? T.red : T.ink10,
              color: activeTab === "staff" ? "#fff" : T.ink30,
              padding: "1px 7px", borderRadius: 99,
              transition: "all .15s",
            }}>{staff.length}</span>
          </button>
        </div>

        {/* Filters per tab */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {activeTab === "member" && (
            <>
              <div style={{ display: "flex", gap: 4 }}>
                {["All", "Platinum", "Gold", "Silver"].map(t => {
                  const cfg = TIER_CFG[t];
                  return (
                    <button key={t} onClick={() => setTierFilter(t)} style={{
                      padding: "6px 14px", borderRadius: 99, border: "none", cursor: "pointer",
                      fontSize: 11.5, fontWeight: 600, transition: "all .14s",
                      background: tierFilter === t ? (cfg?.bg ?? T.ink) : T.white,
                      color: tierFilter === t ? (cfg?.fg ?? "#fff") : T.ink60,
                      boxShadow: tierFilter === t ? `0 0 0 1.5px ${cfg?.ring ?? T.ink}` : `0 0 0 1px ${T.border}`,
                    }}>{t}</button>
                  );
                })}
              </div>
              <SearchBar value={memberSearch} onChange={setMemberSearch} placeholder="Cari member…" />
            </>
          )}
          {activeTab === "staff" && (
            <SearchBar value={staffSearch} onChange={setStaffSearch} placeholder="Cari staff…" />
          )}
        </div>
      </div>

      {/* ── MEMBER TABLE ── */}
      {activeTab === "member" && (
        <div style={cardStyle}>
          {filteredUsers.length === 0 ? (
            <div style={{ padding: "60px 0", textAlign: "center", color: T.ink30, fontSize: 13 }}>
              {memberSearch || tierFilter !== "All"
                ? `Tidak ada member untuk "${memberSearch || tierFilter}"`
                : "Belum ada member terdaftar."}
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <TableHead columns={["Member", "Email", "Tier", "Poin", "Lifetime XP", "Role", ""]} />
              <tbody>
                {filteredUsers.map((u, i) => {
                  const tier = TIER_CFG[u.tier] ?? TIER_CFG.Silver;
                  return (
                    <tr key={u.uid} className="acct-row"
                      style={{
                        borderTop: i === 0 ? "none" : `1px solid ${T.border}`,
                        cursor: "pointer", transition: "background .1s",
                        background: T.white,
                      }}
                      onClick={() => setDetailUser(u)}
                    >
                      <td style={{ padding: "14px 20px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <Avatar name={u.name ?? "?"} size={36} gradient={grad(u.name ?? "")} />
                          <div>
                            <p style={{ fontSize: 13.5, fontWeight: 600, color: T.ink }}>{u.name}</p>
                            <p style={{ fontSize: 11, color: T.ink30, marginTop: 1 }}>{u.phoneNumber}</p>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: "14px 20px", fontSize: 12.5, color: T.ink60 }}>{u.email}</td>
                      <td style={{ padding: "14px 20px" }}>
                        <Badge label={u.tier} bg={tier.bg} fg={tier.fg} ring={tier.ring} />
                      </td>
                      <td style={{ padding: "14px 20px" }}>
                        <p style={{ fontFamily: "'DM Serif Display', serif", fontSize: 18, color: T.red, lineHeight: 1 }}>
                          {(u.currentPoints ?? 0).toLocaleString("id")}
                        </p>
                        <p style={{ fontSize: 10, color: T.ink30, marginTop: 1 }}>pts</p>
                      </td>
                      <td style={{ padding: "14px 20px", fontSize: 12.5, color: T.ink60 }}>
                        {(u.lifetimePoints ?? 0).toLocaleString("id")}
                      </td>
                      <td style={{ padding: "14px 20px" }}>
                        <code style={{ fontSize: 11, background: T.ink06, padding: "3px 8px",
                          borderRadius: 6, color: T.ink60, border: `1px solid ${T.border}` }}>
                          {u.role}
                        </code>
                      </td>
                      <td style={{ padding: "14px 20px" }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button className="acct-btn" onClick={() => setDetailUser(u)}
                            style={{
                              fontSize: 11.5, padding: "5px 14px",
                              border: `1px solid ${T.border}`, borderRadius: 7,
                              background: "transparent", cursor: "pointer",
                              color: T.ink60, fontFamily: "'DM Sans', sans-serif",
                              fontWeight: 500, transition: "all .13s",
                            }}>Detail</button>
                          <button className="acct-btn" onClick={() => setEditUser(u)}
                            style={{
                              fontSize: 11.5, padding: "5px 14px",
                              border: `1px solid ${T.border}`, borderRadius: 7,
                              background: "transparent", cursor: "pointer",
                              color: T.ink60, fontFamily: "'DM Sans', sans-serif",
                              fontWeight: 500, transition: "all .13s",
                            }}>Edit</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {/* Table footer */}
          <div style={{
            padding: "10px 20px", borderTop: `1px solid ${T.border}`,
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <p style={{ fontSize: 11.5, color: T.ink30 }}>
              Menampilkan <strong style={{ color: T.ink60 }}>{filteredUsers.length}</strong> dari <strong style={{ color: T.ink60 }}>{users.length}</strong> member
            </p>
            <p style={{ fontSize: 11, color: T.ink30 }}>
              Total XP: <strong style={{ color: T.ink60 }}>{users.reduce((a,u) => a + (u.lifetimePoints ?? 0), 0).toLocaleString("id")}</strong>
            </p>
          </div>
        </div>
      )}

      {/* ── STAFF TABLE ── */}
      {activeTab === "staff" && (
        <div style={cardStyle}>
          {filteredStaff.length === 0 ? (
            <div style={{ padding: "60px 0", textAlign: "center", color: T.ink30, fontSize: 13 }}>
              {staffSearch ? `Tidak ada staff untuk "${staffSearch}"` : "Belum ada staff terdaftar."}
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <TableHead columns={["Staff", "Email", "Role", "Outlet", "Status", ""]} />
              <tbody>
                {filteredStaff.map((s, i) => {
                  const r = STAFF_ROLE_CFG[s.role] ?? STAFF_ROLE_CFG.cashier;
                  return (
                    <tr key={s.uid} className="acct-row"
                      style={{
                        borderTop: i === 0 ? "none" : `1px solid ${T.border}`,
                        transition: "background .1s", background: T.white,
                      }}
                    >
                      <td style={{ padding: "14px 20px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <Avatar name={s.name ?? "?"} size={36} />
                          <div>
                            <p style={{ fontSize: 13.5, fontWeight: 600, color: T.ink }}>{s.name}</p>
                            <code style={{ fontSize: 10, color: T.ink30 }}>{s.uid?.slice(0, 12)}…</code>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: "14px 20px", fontSize: 12.5, color: T.ink60 }}>{s.email}</td>
                      <td style={{ padding: "14px 20px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                          <span style={{
                            fontSize: 9, fontWeight: 700, letterSpacing: ".1em",
                            textTransform: "uppercase", padding: "2px 7px", borderRadius: 99,
                            background: r.bg, color: r.fg,
                          }}>{r.code}</span>
                          <span style={{ fontSize: 12.5, color: T.ink60, fontWeight: 500 }}>{r.label}</span>
                        </div>
                      </td>
                      <td style={{ padding: "14px 20px" }}>
                        <code style={{ fontSize: 11.5, background: T.cream, padding: "4px 10px",
                          borderRadius: 6, color: T.ink, border: `1px solid ${T.border}` }}>
                          {s.storeLocation}
                        </code>
                      </td>
                      <td style={{ padding: "14px 20px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{
                            width: 6, height: 6, borderRadius: "50%",
                            background: s.isActive ? "#22C55E" : T.ink30,
                          }} />
                          <span style={{ fontSize: 12.5, color: s.isActive ? "#15803D" : T.ink30, fontWeight: 500 }}>
                            {s.isActive ? "Aktif" : "Nonaktif"}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: "14px 20px" }}>
                        <button className="acct-btn" onClick={() => setEditStaff(s)}
                          style={{
                            fontSize: 11.5, padding: "5px 14px",
                            border: `1px solid ${T.border}`, borderRadius: 7,
                            background: "transparent", cursor: "pointer",
                            color: T.ink60, fontFamily: "'DM Sans', sans-serif",
                            fontWeight: 500, transition: "all .13s",
                          }}>Edit</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          <div style={{
            padding: "10px 20px", borderTop: `1px solid ${T.border}`,
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <p style={{ fontSize: 11.5, color: T.ink30 }}>
              <strong style={{ color: T.ink60 }}>{staff.filter(s=>s.isActive).length}</strong> aktif dari <strong style={{ color: T.ink60 }}>{staff.length}</strong> staff
            </p>
            <p style={{ fontSize: 11, color: T.ink30 }}>
              {Object.entries(STAFF_ROLE_CFG).map(([k, v]) => `${staff.filter(s=>s.role===k).length} ${v.label}`).join(" · ")}
            </p>
          </div>
        </div>
      )}

      {/* ── MODALS ── */}
      {detailUser && !editUser && (
        <MemberDetailModal
          user={detailUser}
          onClose={() => setDetailUser(null)}
          onEdit={() => { setEditUser(detailUser); setDetailUser(null); }}
        />
      )}
      {editUser && (
        <EditMemberModal
          user={editUser}
          onClose={() => setEditUser(null)}
          onSaved={u => handleUserSaved(editUser.uid, u)}
        />
      )}
      {editStaff && (
        <EditStaffModal
          staff={editStaff}
          storeIds={storeIds}
          onClose={() => setEditStaff(null)}
          onSaved={u => handleStaffSaved(editStaff.uid, u)}
        />
      )}
      {showCreate && (
        <CreateAccountModal
          onClose={() => setShowCreate(false)}
          storeIds={storeIds}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
}