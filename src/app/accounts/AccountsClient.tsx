"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { Account, AccountRole, AccountStatus } from "@/types/firestore";

type SyncStatus = "connecting" | "live" | "error";

// ── Design tokens (matches MembersClient palette) ─────────────────────────────
const C = {
  bg: "#F4F6FB", white: "#FFFFFF", border: "#EAECF2", border2: "#F0F2F7",
  tx1: "#0F1117", tx2: "#4A5065", tx3: "#9299B0", tx4: "#BCC1D3",
  blue: "#4361EE", blueL: "#EEF2FF", blueD: "#3A0CA3",
  green: "#12B76A", greenBg: "#ECFDF3",
  amber: "#F79009", amberBg: "#FFFAEB",
  red: "#C8102E", redBg: "#FEF3F2",
  shadow: "0 1px 3px rgba(16,24,40,.06), 0 1px 2px rgba(16,24,40,.04)",
  shadowLg: "0 20px 60px rgba(16,24,40,.18), 0 4px 12px rgba(16,24,40,.08)",
} as const;
const font = "'Plus Jakarta Sans', system-ui, sans-serif";

const STATUS_CFG: Record<AccountStatus, { bg: string; color: string; label: string }> = {
  active:    { bg: C.greenBg, color: "#027A48", label: "Aktif"     },
  suspended: { bg: C.redBg,   color: "#B42318", label: "Suspended" },
  pending:   { bg: C.amberBg, color: "#B54708", label: "Pending"   },
};
const ROLE_CFG: Record<AccountRole, { bg: string; color: string }> = {
  master:  { bg: "#F5F3FF", color: "#5B21B6" },
  admin:   { bg: C.redBg,   color: C.red     },
  manager: { bg: C.blueL,   color: C.blueD   },
  viewer:  { bg: C.bg,      color: C.tx2     },
};

// ── Primitives ─────────────────────────────────────────────────────────────────
function LiveBadge({ status }: { status: SyncStatus }) {
  const cfg = {
    connecting: { color: C.amber, label: "Connecting…" },
    live:       { color: C.green, label: "Live"        },
    error:      { color: C.red,   label: "Error"       },
  }[status];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, color: cfg.color }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: cfg.color, animation: status === "connecting" ? "pulse .9s infinite" : "none" }} />
      {cfg.label}
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.25}}`}</style>
    </span>
  );
}

function Avatar({ name, size = 36 }: { name?: string; size?: number }) {
  const char = (name ?? "?")[0].toUpperCase();
  const code = (name ?? "A").charCodeAt(0);
  const g = [["#4361EE","#3A0CA3"],["#7C3AED","#4361EE"],["#059669","#0D9488"],["#D97706","#B45309"],["#DC2626","#B91C1C"]];
  const [a, b] = g[code % g.length];
  return (
    <div style={{ width: size, height: size, borderRadius: 10, background: `linear-gradient(135deg,${a},${b})`, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: size * 0.38, fontFamily: font }}>
      {char}
    </div>
  );
}

function FL({ children }: { children: React.ReactNode }) {
  return <label style={{ display: "block", marginBottom: 6, fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: C.tx3 }}>{children}</label>;
}

function GcInput({ style, ...p }: React.InputHTMLAttributes<HTMLInputElement>) {
  const [f, setF] = useState(false);
  return <input {...p} onFocus={e => { setF(true); p.onFocus?.(e); }} onBlur={e => { setF(false); p.onBlur?.(e); }} style={{ width: "100%", height: 42, borderRadius: 9, outline: "none", border: `1.5px solid ${f ? C.blue : C.border}`, background: f ? C.white : C.bg, boxShadow: f ? "0 0 0 3px rgba(67,97,238,.1)" : "none", padding: "0 13px", fontFamily: font, fontSize: 13.5, color: C.tx1, transition: "all .14s", boxSizing: "border-box", ...style }} />;
}

function GcSelect({ style, ...p }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const [f, setF] = useState(false);
  return <select {...p} onFocus={e => { setF(true); p.onFocus?.(e); }} onBlur={e => { setF(false); p.onBlur?.(e); }} style={{ width: "100%", height: 42, borderRadius: 9, outline: "none", border: `1.5px solid ${f ? C.blue : C.border}`, background: f ? C.white : C.bg, boxShadow: f ? "0 0 0 3px rgba(67,97,238,.1)" : "none", padding: "0 13px", fontFamily: font, fontSize: 13.5, color: C.tx1, appearance: "none", cursor: "pointer", transition: "all .14s", ...style }} />;
}

function GcTextarea({ style, ...p }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const [f, setF] = useState(false);
  return <textarea {...p} onFocus={e => { setF(true); p.onFocus?.(e); }} onBlur={e => { setF(false); p.onBlur?.(e); }} style={{ width: "100%", minHeight: 80, borderRadius: 9, outline: "none", border: `1.5px solid ${f ? C.blue : C.border}`, background: f ? C.white : C.bg, boxShadow: f ? "0 0 0 3px rgba(67,97,238,.1)" : "none", padding: "10px 13px", fontFamily: font, fontSize: 13.5, color: C.tx1, resize: "vertical", transition: "all .14s", boxSizing: "border-box", ...style }} />;
}

function GcBtn({ variant = "ghost", children, disabled, onClick, style, fw }: {
  variant?: "ghost" | "primary" | "blue" | "danger";
  children: React.ReactNode; disabled?: boolean; onClick?: () => void;
  style?: React.CSSProperties; fw?: boolean;
}) {
  const [h, setH] = useState(false);
  const v = {
    ghost:   { background: h ? C.bg : C.white, color: C.tx2, border: `1.5px solid ${C.border}` },
    primary: { background: h ? "#262626" : C.tx1, color: "#fff", border: "none" },
    blue:    { background: `linear-gradient(135deg,${C.blue},${C.blueD})`, color: "#fff", border: "none", boxShadow: h ? "0 6px 20px rgba(67,97,238,.35)" : "0 2px 8px rgba(67,97,238,.2)", transform: h ? "translateY(-1px)" as const : "none" },
    danger:  { background: h ? "#B91C1C" : C.red, color: "#fff", border: "none", boxShadow: h ? "0 4px 14px rgba(200,16,46,.4)" : "none" },
  };
  return (
    <button onClick={disabled ? undefined : onClick} onMouseOver={() => setH(true)} onMouseOut={() => setH(false)} style={{ height: 40, padding: "0 20px", borderRadius: 9, fontFamily: font, fontSize: 13.5, fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer", display: "inline-flex", alignItems: "center", gap: 7, transition: "all .15s", opacity: disabled ? .55 : 1, width: fw ? "100%" : undefined, justifyContent: fw ? "center" : undefined, ...v[variant], ...style }}>
      {children}
    </button>
  );
}

function ActionBtn({ onClick, label, danger }: { onClick: () => void; label: string; danger?: boolean }) {
  const [h, setH] = useState(false);
  return (
    <button onClick={onClick} onMouseOver={() => setH(true)} onMouseOut={() => setH(false)} style={{ height: 32, padding: "0 14px", borderRadius: 8, fontFamily: font, fontSize: 12.5, fontWeight: 600, cursor: "pointer", transition: "all .13s", border: `1.5px solid ${h ? (danger ? C.red : C.blue) : C.border}`, background: h ? (danger ? C.redBg : C.blueL) : C.white, color: h ? (danger ? C.red : C.blue) : C.tx2, display: "inline-flex", alignItems: "center" }}>
      {label}
    </button>
  );
}

function SL({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: C.tx3, marginBottom: 14, paddingBottom: 10, borderBottom: `1px solid ${C.border2}` }}>{children}</p>;
}

function ErrBox({ msg }: { msg: string }) {
  return <div style={{ marginTop: 14, padding: "10px 14px", background: C.redBg, border: "1px solid #FECDD3", borderRadius: 9, fontSize: 12.5, color: "#B42318" }}>{msg}</div>;
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ msg, type, onDone }: { msg: string; type: "success" | "error"; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 3200); return () => clearTimeout(t); }, [onDone]);
  return (
    <div style={{ position: "fixed", bottom: 28, right: 28, zIndex: 999, padding: "13px 20px", borderRadius: 13, fontFamily: font, fontSize: 13.5, fontWeight: 600, color: "#fff", background: type === "success" ? C.green : C.red, boxShadow: "0 8px 32px rgba(0,0,0,.22)", display: "flex", alignItems: "center", gap: 10, animation: "gcRise .28s cubic-bezier(.22,.68,0,1.15)" }}>
      {type === "success" ? "✓" : "✕"} {msg}
      <style>{`@keyframes gcRise{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  );
}

// ── Confirm Dialog ────────────────────────────────────────────────────────────
function ConfirmDialog({ title, message, onConfirm, onCancel }: {
  title: string; message: string; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onCancel(); }} style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(10,12,20,.52)", backdropFilter: "blur(8px)", fontFamily: font }}>
      <div style={{ background: C.white, borderRadius: 18, padding: 28, maxWidth: 400, width: "90%", boxShadow: C.shadowLg }}>
        <h3 style={{ fontSize: 18, fontWeight: 800, color: C.tx1, marginBottom: 8 }}>{title}</h3>
        <p style={{ fontSize: 13.5, color: C.tx2, marginBottom: 24 }}>{message}</p>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <GcBtn variant="ghost" onClick={onCancel}>Batal</GcBtn>
          <GcBtn variant="danger" onClick={onConfirm}>Hapus</GcBtn>
        </div>
      </div>
    </div>
  );
}

// ── Modal shell ───────────────────────────────────────────────────────────────
function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }} style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: "rgba(10,12,20,.52)", backdropFilter: "blur(8px)", animation: "gcFadeIn .18s ease", fontFamily: font }}>
      <div style={{ background: C.white, borderRadius: 22, width: "100%", maxWidth: 520, maxHeight: "92vh", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: C.shadowLg, animation: "gcRise .26s cubic-bezier(.22,.68,0,1.15) both" }}>
        {children}
      </div>
      <style>{`@keyframes gcFadeIn{from{opacity:0}to{opacity:1}}@keyframes gcRise{from{opacity:0;transform:translateY(18px) scale(.97)}to{opacity:1;transform:none}}`}</style>
    </div>
  );
}
function MHead({ eyebrow, title, onClose }: { eyebrow: string; title: string; onClose: () => void }) {
  const [h, setH] = useState(false);
  return (
    <div style={{ padding: "24px 28px 18px", borderBottom: `1px solid ${C.border2}`, display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexShrink: 0 }}>
      <div>
        <p style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: C.blue, marginBottom: 4 }}>{eyebrow}</p>
        <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-.02em", color: C.tx1, margin: 0 }}>{title}</h2>
      </div>
      <button onClick={onClose} onMouseOver={() => setH(true)} onMouseOut={() => setH(false)} style={{ width: 34, height: 34, borderRadius: 9, border: `1.5px solid ${C.border}`, background: h ? C.bg : "transparent", cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", transition: "background .13s" }}>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1 1l10 10M11 1L1 11" stroke={C.tx3} strokeWidth="1.7" strokeLinecap="round" /></svg>
      </button>
    </div>
  );
}
function MBody({ children }: { children: React.ReactNode }) {
  return <div style={{ overflowY: "auto", flex: 1, padding: "22px 28px" }}>{children}</div>;
}
function MFoot({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: "16px 28px 24px", borderTop: `1px solid ${C.border2}`, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10, flexShrink: 0 }}>{children}</div>;
}

// ── Create Modal ──────────────────────────────────────────────────────────────
type AccountFormState = {
  customId: string; name: string; email: string; phoneNumber: string;
  role: AccountRole; status: AccountStatus; notes: string;
};

function CreateAccountModal({ onClose, onCreated }: { onClose: () => void; onCreated: (msg: string) => void }) {
  const [form, setForm] = useState<AccountFormState>({
    customId: "", name: "", email: "", phoneNumber: "", role: "viewer", status: "active", notes: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  // Validate custom ID: only alphanumeric, hyphens, underscores
  const idValid = !form.customId || /^[a-zA-Z0-9_-]+$/.test(form.customId);

  async function create() {
    if (!form.name.trim() || !form.email.trim()) {
      setError("Nama dan email wajib diisi."); return;
    }
    if (form.customId && !idValid) {
      setError("Document ID hanya boleh huruf, angka, tanda hubung (-), dan underscore (_)."); return;
    }
    setLoading(true); setError("");
    try {
      const r = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message ?? "Gagal membuat akun.");
      onCreated("Akun berhasil dibuat ✓");
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  const set = (k: keyof AccountFormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));

  return (
    <Modal onClose={onClose}>
      <MHead eyebrow="Akun Baru" title="Tambah Akun" onClose={onClose} />
      <MBody>
        <SL>Document ID</SL>
        <div style={{ marginBottom: 22 }}>
          <FL>Custom ID <span style={{ color: C.tx3, fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(opsional — kosongkan untuk auto)</span></FL>
          <GcInput
            placeholder="contoh: SBY-ADMIN-01"
            value={form.customId}
            onChange={set("customId")}
            style={{ borderColor: form.customId && !idValid ? "#F04438" : undefined }}
          />
          {form.customId && !idValid && (
            <p style={{ fontSize: 11.5, color: "#B42318", marginTop: 5 }}>Hanya boleh huruf, angka, - dan _</p>
          )}
          {form.customId && idValid && (
            <p style={{ fontSize: 11.5, color: C.green, marginTop: 5 }}>ID: <code style={{ background: C.blueL, padding: "1px 7px", borderRadius: 5, color: C.blue }}>{form.customId}</code></p>
          )}
        </div>
        <SL>Informasi Akun</SL>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 22 }}>
          <div><FL>Nama *</FL><GcInput placeholder="Budi Santoso" value={form.name} onChange={set("name")} /></div>
          <div><FL>Email *</FL><GcInput type="email" placeholder="budi@email.com" value={form.email} onChange={set("email")} /></div>
          <div><FL>No. HP</FL><GcInput placeholder="+62 812 xxxx" value={form.phoneNumber} onChange={set("phoneNumber")} /></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <FL>Role</FL>
              <GcSelect value={form.role} onChange={set("role")}>
                <option value="viewer">Viewer</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
                <option value="master">Master</option>
              </GcSelect>
            </div>
            <div>
              <FL>Status</FL>
              <GcSelect value={form.status} onChange={set("status")}>
                <option value="active">Aktif</option>
                <option value="pending">Pending</option>
                <option value="suspended">Suspended</option>
              </GcSelect>
            </div>
          </div>
          <div><FL>Catatan</FL><GcTextarea placeholder="Opsional…" value={form.notes} onChange={set("notes")} /></div>
        </div>
        {error && <ErrBox msg={error} />}
      </MBody>
      <MFoot>
        <p style={{ flex: 1, fontSize: 11.5, color: C.tx3 }}>Kolom <span style={{ color: C.red }}>*</span> wajib diisi</p>
        <GcBtn variant="ghost" onClick={onClose}>Batal</GcBtn>
        <GcBtn variant="blue" onClick={create} disabled={loading}>{loading ? "Membuat…" : "Buat Akun"}</GcBtn>
      </MFoot>
    </Modal>
  );
}

// ── Edit Modal ────────────────────────────────────────────────────────────────
function EditAccountModal({ account, onClose, onSaved }: {
  account: Account; onClose: () => void; onSaved: (msg: string) => void;
}) {
  const [form, setForm] = useState<AccountFormState>({
    customId:    "",               // not editable on update, just satisfies type
    name:        account.name,
    email:       account.email,
    phoneNumber: account.phoneNumber ?? "",
    role:        account.role,
    status:      account.status,
    notes:       account.notes ?? "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  async function save() {
    if (!form.name.trim()) { setError("Nama tidak boleh kosong."); return; }
    setLoading(true); setError("");
    try {
      const r = await fetch(`/api/accounts/${account.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message ?? "Gagal memperbarui akun.");
      onSaved("Akun berhasil diperbarui ✓");
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  const set = (k: keyof AccountFormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));

  return (
    <Modal onClose={onClose}>
      <MHead eyebrow="Edit Akun" title={account.name} onClose={onClose} />
      <MBody>
        <SL>Informasi Akun</SL>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 22 }}>
          <div><FL>Nama</FL><GcInput value={form.name} onChange={set("name")} /></div>
          <div><FL>Email</FL><GcInput type="email" value={form.email} onChange={set("email")} /></div>
          <div><FL>No. HP</FL><GcInput value={form.phoneNumber} onChange={set("phoneNumber")} /></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <FL>Role</FL>
              <GcSelect value={form.role} onChange={set("role")}>
                <option value="viewer">Viewer</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
                <option value="master">Master</option>
              </GcSelect>
            </div>
            <div>
              <FL>Status</FL>
              <GcSelect value={form.status} onChange={set("status")}>
                <option value="active">Aktif</option>
                <option value="pending">Pending</option>
                <option value="suspended">Suspended</option>
              </GcSelect>
            </div>
          </div>
          <div><FL>Catatan</FL><GcTextarea value={form.notes} onChange={set("notes")} /></div>
        </div>
        {error && <ErrBox msg={error} />}
      </MBody>
      <MFoot>
        <GcBtn variant="ghost" onClick={onClose}>Batal</GcBtn>
        <GcBtn variant="primary" onClick={save} disabled={loading}>{loading ? "Menyimpan…" : "Simpan"}</GcBtn>
      </MFoot>
    </Modal>
  );
}

// ── Detail Modal ──────────────────────────────────────────────────────────────
function DetailAccountModal({ account, onClose, onEdit }: {
  account: Account; onClose: () => void; onEdit: () => void;
}) {
  const status = STATUS_CFG[account.status];
  const role   = ROLE_CFG[account.role];
  return (
    <Modal onClose={onClose}>
      <MHead eyebrow="Detail Akun" title={account.name} onClose={onClose} />
      <MBody>
        <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 18px", background: C.bg, borderRadius: 14, border: `1px solid ${C.border}`, marginBottom: 20 }}>
          <Avatar name={account.name} size={52} />
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 16, fontWeight: 700, color: C.tx1, marginBottom: 3 }}>{account.name}</p>
            <p style={{ fontSize: 12.5, color: C.tx3, marginBottom: 2 }}>{account.email}</p>
            <p style={{ fontSize: 12.5, color: C.tx3 }}>{account.phoneNumber || "—"}</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
            <span style={{ padding: "4px 11px", borderRadius: 99, fontSize: 11, fontWeight: 700, background: role.bg, color: role.color }}>{account.role}</span>
            <span style={{ padding: "4px 11px", borderRadius: 99, fontSize: 11, fontWeight: 700, background: status.bg, color: status.color }}>{status.label}</span>
          </div>
        </div>
        <SL>Informasi Akun</SL>
        {[
          { label: "ID", value: <code style={{ fontSize: 11, background: C.blueL, padding: "2px 8px", borderRadius: 6, color: C.blue }}>{account.id}</code> },
          { label: "Dibuat", value: account.createdAt ? new Date(account.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "—" },
          { label: "Login Terakhir", value: account.lastLogin ? new Date(account.lastLogin).toLocaleString("id-ID") : "Belum pernah" },
        ].map((row, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${C.border2}` }}>
            <span style={{ fontSize: 12.5, color: C.tx3, fontWeight: 500 }}>{row.label}</span>
            <span style={{ fontSize: 12.5, color: C.tx1, fontWeight: 600 }}>{row.value}</span>
          </div>
        ))}
        {account.notes && (
          <div style={{ marginTop: 18 }}>
            <SL>Catatan</SL>
            <p style={{ fontSize: 13, color: C.tx2, lineHeight: 1.6 }}>{account.notes}</p>
          </div>
        )}
      </MBody>
      <MFoot>
        <GcBtn variant="ghost" onClick={onClose}>Tutup</GcBtn>
        <GcBtn variant="blue" onClick={onEdit}>Edit Akun</GcBtn>
      </MFoot>
    </Modal>
  );
}

// ── Table Row ─────────────────────────────────────────────────────────────────
function AccountRow({ acc, isLast, onDetail, onEdit, onDelete }: {
  acc: Account; isLast: boolean;
  onDetail: () => void; onEdit: () => void; onDelete: () => void;
}) {
  const [hov, setHov] = useState(false);
  const status = STATUS_CFG[acc.status] ?? STATUS_CFG.active;
  const role   = ROLE_CFG[acc.role]    ?? ROLE_CFG.viewer;
  return (
    <tr onMouseOver={() => setHov(true)} onMouseOut={() => setHov(false)} onClick={onDetail} style={{ borderBottom: isLast ? "none" : `1px solid ${C.border2}`, background: hov ? "#F8F9FC" : C.white, transition: "background .1s", cursor: "pointer" }}>
      <td style={{ padding: "14px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Avatar name={acc.name} size={36} />
          <div>
            <p style={{ fontSize: 13.5, fontWeight: 700, color: C.tx1, marginBottom: 2 }}>{acc.name}</p>
            <code style={{ fontSize: 10.5, color: C.tx3, background: C.bg, padding: "1px 6px", borderRadius: 5, border: `1px solid ${C.border2}` }}>{(acc.id ?? "").slice(0, 12)}…</code>
          </div>
        </div>
      </td>
      <td style={{ padding: "14px 20px", fontSize: 13, color: C.tx2 }}>{acc.email}</td>
      <td style={{ padding: "14px 20px", fontSize: 13, color: C.tx2 }}>{acc.phoneNumber || "—"}</td>
      <td style={{ padding: "14px 20px" }}>
        <span style={{ padding: "4px 11px", borderRadius: 99, fontSize: 11, fontWeight: 700, background: role.bg, color: role.color }}>{acc.role}</span>
      </td>
      <td style={{ padding: "14px 20px" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 11px", borderRadius: 99, fontSize: 11, fontWeight: 700, background: status.bg, color: status.color }}>
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: status.color }} />
          {status.label}
        </span>
      </td>
      <td style={{ padding: "14px 20px", fontSize: 12, color: C.tx3 }}>
        {acc.createdAt ? new Date(acc.createdAt).toLocaleDateString("id-ID") : "—"}
      </td>
      <td style={{ padding: "14px 20px" }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", gap: 6 }}>
          <ActionBtn onClick={onDetail} label="Detail" />
          <ActionBtn onClick={onEdit}   label="Edit"   />
          <ActionBtn onClick={onDelete} label="Hapus"  danger />
        </div>
      </td>
    </tr>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function AccountsClient({ initialAccounts }: { initialAccounts: Account[] }) {
  // ── Realtime listener ─────────────────────────────────────────────────────
  const [accounts,   setAccounts]  = useState<Account[]>(initialAccounts);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("connecting");

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "accounts"), orderBy("createdAt", "desc")),
      snap => {
        setAccounts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Account)));
        setSyncStatus("live");
      },
      () => setSyncStatus("error"),
    );
    return () => unsub();
  }, []);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [search,   setSearch]   = useState("");
  const [roleF,    setRoleF]    = useState("All");
  const [statusF,  setStatusF]  = useState("All");
  const [sf,       setSF]       = useState(false);

  const [detailAcc,  setDetailAcc]  = useState<Account | null>(null);
  const [editAcc,    setEditAcc]    = useState<Account | null>(null);
  const [deleteAcc,  setDeleteAcc]  = useState<Account | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [toast,      setToast]      = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [deleting,   setDeleting]   = useState(false);

  const showToast = useCallback((msg: string, type: "success" | "error" = "success") =>
    setToast({ msg, type }), []);

  // ── Filtered list ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => accounts.filter(a => {
    const q = search.toLowerCase();
    const matchQ = !q || a.name?.toLowerCase().includes(q) || a.email?.toLowerCase().includes(q) || a.phoneNumber?.includes(q);
    const matchR = roleF   === "All" || a.role   === roleF;
    const matchS = statusF === "All" || a.status === statusF;
    return matchQ && matchR && matchS;
  }), [accounts, search, roleF, statusF]);

  // ── Delete handler ────────────────────────────────────────────────────────
  async function confirmDelete() {
    if (!deleteAcc?.id) return;
    setDeleting(true);
    try {
      const r = await fetch(`/api/accounts/${deleteAcc.id}`, { method: "DELETE" });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message ?? "Gagal menghapus akun.");
      showToast("Akun berhasil dihapus.");
    } catch (e) {
      showToast(String(e), "error");
    } finally {
      setDeleting(false);
      setDeleteAcc(null);
    }
  }

  // ── Stat counts ───────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    total:     accounts.length,
    active:    accounts.filter(a => a.status === "active").length,
    suspended: accounts.filter(a => a.status === "suspended").length,
    admin:     accounts.filter(a => a.role === "admin" || a.role === "master").length,
    pending:   accounts.filter(a => a.status === "pending").length,
  }), [accounts]);

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1400, fontFamily: font, WebkitFontSmoothing: "antialiased" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: C.tx3, marginBottom: 5 }}>Gong Cha Admin</p>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-.025em", color: C.tx1, lineHeight: 1.1, margin: 0 }}>Account Management</h1>
          <p style={{ fontSize: 14, color: C.tx2, marginTop: 5, display: "flex", alignItems: "center", gap: 10 }}>
            Kelola akun admin, manager, dan akses sistem.
            <LiveBadge status={syncStatus} />
          </p>
        </div>
        <GcBtn variant="blue" onClick={() => setShowCreate(true)}>
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
          Tambah Akun
        </GcBtn>
      </div>

      {/* Stat Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 14, marginBottom: 24 }}>
        {[
          { label: "Total Akun",  value: stats.total,     color: C.blue,    bg: C.blueL   },
          { label: "Aktif",       value: stats.active,    color: C.green,   bg: C.greenBg },
          { label: "Pending",     value: stats.pending,   color: C.amber,   bg: C.amberBg },
          { label: "Suspended",   value: stats.suspended, color: C.red,     bg: C.redBg   },
          { label: "Admin/Master",value: stats.admin,     color: "#5B21B6", bg: "#F5F3FF" },
        ].map(s => (
          <div key={s.label} style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 18, boxShadow: C.shadow, padding: "20px 22px" }}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: C.tx3, marginBottom: 10 }}>{s.label}</p>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: s.bg, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
              <div style={{ width: 12, height: 12, borderRadius: "50%", background: s.color, opacity: .7 }} />
            </div>
            <p style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-.02em", color: s.color, lineHeight: 1 }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {/* Role filter */}
          <div style={{ display: "flex", background: C.bg, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: 3 }}>
            {["All", "master", "admin", "manager", "viewer"].map(r => (
              <button key={r} onClick={() => setRoleF(r)} style={{ padding: "5px 14px", borderRadius: 7, border: "none", fontFamily: font, fontSize: 12.5, fontWeight: 600, cursor: "pointer", transition: "all .13s", background: roleF === r ? C.white : "transparent", color: roleF === r ? C.tx1 : C.tx3, boxShadow: roleF === r ? C.shadow : "none", textTransform: "capitalize" }}>
                {r}
              </button>
            ))}
          </div>
          {/* Status filter */}
          <div style={{ display: "flex", background: C.bg, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: 3 }}>
            {["All", "active", "pending", "suspended"].map(s => (
              <button key={s} onClick={() => setStatusF(s)} style={{ padding: "5px 14px", borderRadius: 7, border: "none", fontFamily: font, fontSize: 12.5, fontWeight: 600, cursor: "pointer", transition: "all .13s", background: statusF === s ? C.white : "transparent", color: statusF === s ? C.tx1 : C.tx3, boxShadow: statusF === s ? C.shadow : "none", textTransform: "capitalize" }}>
                {s}
              </button>
            ))}
          </div>
        </div>
        {/* Search */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, height: 40, padding: "0 13px", minWidth: 240, background: C.white, border: `1.5px solid ${sf ? C.blue : C.border}`, borderRadius: 10, transition: "all .14s", boxShadow: sf ? "0 0 0 3px rgba(67,97,238,.1)" : "none" }}>
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke={C.tx3} strokeWidth={2.2}><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
          <input style={{ flex: 1, border: "none", background: "transparent", outline: "none", fontFamily: font, fontSize: 13.5, color: C.tx1 }} placeholder="Cari akun…" value={search} onChange={e => setSearch(e.target.value)} onFocus={() => setSF(true)} onBlur={() => setSF(false)} />
          {search && <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", color: C.tx3, fontSize: 15, padding: 0 }}>✕</button>}
        </div>
      </div>

      {/* Table */}
      <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 18, boxShadow: C.shadow, overflow: "hidden" }}>
        {filtered.length === 0 ? (
          <div style={{ padding: "60px 24px", textAlign: "center" }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: C.tx1, marginBottom: 6 }}>Tidak ada akun</p>
            <p style={{ fontSize: 13, color: C.tx3 }}>
              {syncStatus === "connecting" ? "Memuat data…" : search || roleF !== "All" || statusF !== "All" ? "Tidak ada yang cocok dengan filter." : "Belum ada akun terdaftar."}
            </p>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: font }}>
            <thead>
              <tr style={{ background: "#F8F9FC" }}>
                {["Akun", "Email", "No. HP", "Role", "Status", "Dibuat", "Aksi"].map(h => (
                  <th key={h} style={{ padding: "11px 20px", textAlign: "left", fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: C.tx3, borderBottom: `1px solid ${C.border2}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((acc, i) => (
                <AccountRow
                  key={acc.id}
                  acc={acc}
                  isLast={i === filtered.length - 1}
                  onDetail={() => setDetailAcc(acc)}
                  onEdit={() => setEditAcc(acc)}
                  onDelete={() => setDeleteAcc(acc)}
                />
              ))}
            </tbody>
          </table>
        )}
        <div style={{ padding: "12px 20px", borderTop: `1px solid ${C.border2}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ fontSize: 12, color: C.tx3 }}>
            <strong style={{ color: C.tx2 }}>{filtered.length}</strong> dari <strong style={{ color: C.tx2 }}>{accounts.length}</strong> akun
          </p>
          <LiveBadge status={syncStatus} />
        </div>
      </div>

      {/* Modals */}
      {detailAcc && !editAcc && (
        <DetailAccountModal account={detailAcc} onClose={() => setDetailAcc(null)} onEdit={() => { setEditAcc(detailAcc); setDetailAcc(null); }} />
      )}
      {editAcc && (
        <EditAccountModal account={editAcc} onClose={() => setEditAcc(null)} onSaved={msg => { showToast(msg); setEditAcc(null); }} />
      )}
      {showCreate && (
        <CreateAccountModal onClose={() => setShowCreate(false)} onCreated={msg => showToast(msg)} />
      )}
      {deleteAcc && (
        <ConfirmDialog
          title="Hapus Akun?"
          message={`Akun "${deleteAcc.name}" akan dihapus permanen. Tindakan ini tidak dapat diurungkan.`}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteAcc(null)}
        />
      )}
      {deleting && (
        <div style={{ position: "fixed", inset: 0, zIndex: 70, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(10,12,20,.3)" }}>
          <div style={{ background: C.white, padding: "20px 32px", borderRadius: 14, fontFamily: font, fontSize: 14, color: C.tx2 }}>Menghapus…</div>
        </div>
      )}

      {/* Toast */}
      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
    </div>
  );
}