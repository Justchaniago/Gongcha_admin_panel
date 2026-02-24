
"use client";
// Label kecil untuk form field
export function FL({ children }: { children: React.ReactNode }) {
  return <label style={{ display: "block", marginBottom: 6, fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: C.tx3 }}>{children}</label>;
}
import InjectVoucherModalForMember from "./InjectVoucherModalForMember";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { User, Staff, UserTier, UserRole, StaffRole } from "@/types/firestore";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { createAccountAction, updateAccountAction, deleteAccountAction, updatePointsAction } from "@/actions/userStaffActions";

// ── Types ─────────────────────────────────────────────────────────────────────
type UserWithUid  = User  & { uid: string };
type StaffWithUid = Staff & {
  uid: string;
  storeLocations?: string[];
  accessAllStores?: boolean;
};

function normalizeStoreAccess(s: StaffWithUid): { storeLocations: string[]; accessAllStores: boolean } {
  if (s.accessAllStores) return { storeLocations: [], accessAllStores: true };
  if (s.storeLocations?.length) return { storeLocations: s.storeLocations, accessAllStores: false };
  return { storeLocations: s.storeLocation ? [s.storeLocation] : [], accessAllStores: false };
}
type TabType   = "member" | "staff";
type ToastType = "success" | "error" | "info";

interface Toast { id: string; type: ToastType; message: string; }
interface ConfirmOptions {
  title: string; description: string; confirmLabel?: string;
  danger?: boolean; onConfirm: () => void | Promise<void>;
}

const C = {
  bg: "#F4F6FB", white: "#FFFFFF", border: "#EAECF2", border2: "#F0F2F7",
  tx1: "#0F1117", tx2: "#4A5065", tx3: "#9299B0", tx4: "#BCC1D3",
  blue: "#4361EE", blueL: "#EEF2FF", blueD: "#3A0CA3",
  green: "#12B76A", greenBg: "#ECFDF3",
  amber: "#F79009", amberBg: "#FFFAEB",
  red: "#C8102E", redBg: "#FEF3F2",
  purple: "#7C3AED", purpleBg: "#F5F3FF",
  shadow: "0 1px 3px rgba(16,24,40,.06), 0 1px 2px rgba(16,24,40,.04)",
  shadowLg: "0 20px 60px rgba(16,24,40,.18), 0 4px 12px rgba(16,24,40,.08)",
} as const;

const font = "'Plus Jakarta Sans', system-ui, sans-serif";

const TIER_CFG: Record<string, { bg: string; color: string; ring: string }> = {
  Platinum: { bg: "#F5F3FF", color: "#5B21B6", ring: "#DDD6FE" },
  Gold:     { bg: "#FFFBEB", color: "#92400E", ring: "#FDE68A" },
  Silver:   { bg: "#F8FAFC", color: "#475569", ring: "#E2E8F0" },
};

const STAFF_CFG: Record<string, { bg: string; color: string; label: string; code: string }> = {
  cashier:       { bg: C.blueL,   color: C.blueD,   label: "Kasir",   code: "POS" },
  store_manager: { bg: C.greenBg, color: "#027A48",  label: "Manajer", code: "MGT" },
  admin:         { bg: C.redBg,   color: C.red,      label: "Admin",   code: "ADM" },
};

const TIER_OPTIONS = ["All", "Silver", "Gold", "Platinum"] as const;

const GLOBAL_CSS = `
  @keyframes gcFadeIn  { from{opacity:0}             to{opacity:1} }
  @keyframes gcRise    { from{opacity:0;transform:translateY(18px) scale(.97)} to{opacity:1;transform:none} }
  @keyframes gcSlideUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:none} }
  @keyframes gcShake   { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-4px)} 75%{transform:translateX(4px)} }
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:${font}}
  ::-webkit-scrollbar{width:6px;height:6px}
  ::-webkit-scrollbar-track{background:transparent}
  ::-webkit-scrollbar-thumb{background:${C.border};border-radius:99px}
`;
function GlobalStyle() { return <style dangerouslySetInnerHTML={{ __html: GLOBAL_CSS }} />; }

// ── Toast ─────────────────────────────────────────────────────────────────────
function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const show = useCallback((message: string, type: ToastType = "info") => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts(p => [...p, { id, type, message }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 4000);
  }, []);
  const dismiss = useCallback((id: string) => setToasts(p => p.filter(t => t.id !== id)), []);
  return { toasts, show, dismiss };
}

function ToastContainer({ toasts, dismiss }: { toasts: Toast[]; dismiss: (id: string) => void }) {
  const ICONS: Record<ToastType, string> = { success: "✓", error: "✕", info: "i" };
  const COLORS: Record<ToastType, { bg: string; icon: string; border: string }> = {
    success: { bg: C.greenBg, icon: "#027A48", border: "#A7F3D0" },
    error:   { bg: C.redBg,   icon: C.red,     border: "#FECDD3" },
    info:    { bg: C.blueL,   icon: C.blue,    border: "rgba(67,97,238,.2)" },
  };
  return (
    <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 9999, display: "flex", flexDirection: "column", gap: 10, pointerEvents: "none" }}>
      {toasts.map(t => {
        const col = COLORS[t.type];
        return (
          <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", background: col.bg, border: `1px solid ${col.border}`, borderRadius: 12, boxShadow: C.shadowLg, fontFamily: font, fontSize: 13.5, color: C.tx1, pointerEvents: "all", maxWidth: 360, animation: "gcSlideUp .22s ease" }}>
            <span style={{ width: 22, height: 22, borderRadius: 99, background: col.icon, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 900, flexShrink: 0 }}>{ICONS[t.type]}</span>
            <span style={{ flex: 1, fontWeight: 500 }}>{t.message}</span>
            <button onClick={() => dismiss(t.id)} style={{ background: "none", border: "none", cursor: "pointer", color: C.tx3, fontSize: 16, lineHeight: 1, flexShrink: 0 }}>×</button>
          </div>
        );
      })}
    </div>
  );
}

// ── Confirm Dialog ────────────────────────────────────────────────────────────
function ConfirmDialog({ opts, onCancel }: { opts: ConfirmOptions; onCancel: () => void }) {
  const [loading, setLoading] = useState(false);
  async function handleConfirm() { setLoading(true); await opts.onConfirm(); setLoading(false); }
  return (
    <div onClick={e => { if (e.target === e.currentTarget && !loading) onCancel(); }}
      style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: "rgba(10,12,20,.52)", backdropFilter: "blur(8px)", animation: "gcFadeIn .18s ease", fontFamily: font }}>
      <div style={{ background: C.white, borderRadius: 18, width: "100%", maxWidth: 400, boxShadow: C.shadowLg, animation: "gcRise .24s cubic-bezier(.22,.68,0,1.15) both", overflow: "hidden" }}>
        <div style={{ padding: "24px 28px 20px" }}>
          {opts.danger && (
            <div style={{ width: 44, height: 44, borderRadius: 12, background: C.redBg, border: `1px solid #FECDD3`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.red} strokeWidth={2.2} strokeLinecap="round"><path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
            </div>
          )}
          <h3 style={{ fontSize: 17, fontWeight: 800, color: C.tx1, marginBottom: 8 }}>{opts.title}</h3>
          <p style={{ fontSize: 13.5, color: C.tx2, lineHeight: 1.6 }}>{opts.description}</p>
        </div>
        <div style={{ padding: "16px 28px 24px", display: "flex", gap: 10, justifyContent: "flex-end", borderTop: `1px solid ${C.border2}` }}>
          <GcBtn variant="ghost" onClick={onCancel} disabled={loading}>Batal</GcBtn>
          <GcBtn variant={opts.danger ? "danger" : "blue"} onClick={handleConfirm} disabled={loading}>
            {loading ? "Memproses…" : (opts.confirmLabel ?? "Konfirmasi")}
          </GcBtn>
        </div>
      </div>
    </div>
  );
}

function useConfirm() {
  const [confirmOpts, setConfirmOpts] = useState<ConfirmOptions | null>(null);
  const confirm = useCallback((opts: ConfirmOptions) => setConfirmOpts(opts), []);
  const cancel  = useCallback(() => setConfirmOpts(null), []);
  const dialog  = confirmOpts
    ? <ConfirmDialog opts={{ ...confirmOpts, onConfirm: async () => { await confirmOpts.onConfirm(); setConfirmOpts(null); } }} onCancel={cancel} />
    : null;
  return { confirm, dialog };
}

// ── Primitives ────────────────────────────────────────────────────────────────
function Avatar({ name, size = 36 }: { name?: string; size?: number }) {
  const char = (name ?? "?")[0].toUpperCase();
  const code = (name ?? "A").charCodeAt(0);
  const g = [["#4361EE","#3A0CA3"],["#7C3AED","#4361EE"],["#059669","#0D9488"],["#D97706","#B45309"],["#DC2626","#B91C1C"]];
  const [a, b] = g[code % g.length];
  return (
    <div style={{ width: size, height: size, borderRadius: size < 40 ? 10 : 14, background: `linear-gradient(135deg,${a},${b})`, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: size * 0.38, fontFamily: font }}>
      {char}
    </div>
  );
}


interface GcInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean;
}

export function GcInput({ style, hasError, ...p }: GcInputProps) {
  const [f, setF] = useState(false);
  // Tentukan warna border. Prioritas: 1. Focus -> 2. Error -> 3. Default
  const currentBorderColor = f ? C.blue : (hasError ? "#F04438" : C.border);
  return (
    <input 
      {...p} 
      onFocus={e => { setF(true); p.onFocus?.(e); }} 
      onBlur={e => { setF(false); p.onBlur?.(e); }} 
      style={{ 
        width: "100%", 
        height: 42, 
        borderRadius: 9, 
        outline: "none", 
        border: `1.5px solid ${currentBorderColor}`,
        background: f ? C.white : C.bg, 
        boxShadow: f ? "0 0 0 3px rgba(67,97,238,.1)" : "none", 
        padding: "0 13px", 
        fontFamily: font, 
        fontSize: 13.5, 
        color: C.tx1, 
        transition: "all .14s", 
        ...style 
      }} 
    />
  );
}

function GcSelect({ style, ...p }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const [f, setF] = useState(false);
  return <select {...p} onFocus={e => { setF(true); p.onFocus?.(e); }} onBlur={e => { setF(false); p.onBlur?.(e); }} style={{ width: "100%", height: 42, borderRadius: 9, outline: "none", border: `1.5px solid ${f ? C.blue : C.border}`, background: f ? C.white : C.bg, boxShadow: f ? "0 0 0 3px rgba(67,97,238,.1)" : "none", padding: "0 13px", fontFamily: font, fontSize: 13.5, color: C.tx1, appearance: "none", cursor: "pointer", transition: "all .14s", ...style }} />;
}

type BtnVariant = "ghost" | "primary" | "blue" | "danger";
function GcBtn({ variant = "ghost", children, disabled, onClick, style, fw }: {
  variant?: BtnVariant; children: React.ReactNode; disabled?: boolean; onClick?: () => void; style?: React.CSSProperties; fw?: boolean;
}) {
  const [h, setH] = useState(false);
  const v: Record<BtnVariant, React.CSSProperties> = {
    ghost:   { background: h ? C.bg : C.white, color: C.tx2, border: `1.5px solid ${C.border}` },
    primary: { background: h ? "#0D0F16" : C.tx1, color: "#fff", transform: h ? "translateY(-1px)" : undefined, boxShadow: h ? "0 4px 14px rgba(0,0,0,.2)" : "none" },
    blue:    { background: `linear-gradient(135deg,${C.blue},${C.blueD})`, color: "#fff", boxShadow: h ? "0 6px 20px rgba(67,97,238,.35)" : "0 2px 8px rgba(67,97,238,.2)", transform: h ? "translateY(-1px)" : undefined },
    danger:  { background: h ? "#A30F25" : C.red, color: "#fff", boxShadow: h ? "0 6px 20px rgba(200,16,46,.3)" : "0 2px 8px rgba(200,16,46,.15)", transform: h ? "translateY(-1px)" : undefined },
  };
  return (
    <button type="button" onClick={disabled ? undefined : onClick} onMouseOver={() => setH(true)} onMouseOut={() => setH(false)}
      style={{ height: 40, padding: "0 20px", borderRadius: 9, fontFamily: font, fontSize: 13.5, fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer", border: "none", display: "inline-flex", alignItems: "center", gap: 7, transition: "all .15s", opacity: disabled ? .55 : 1, width: fw ? "100%" : undefined, justifyContent: fw ? "center" : undefined, ...v[variant], ...style }}>
      {children}
    </button>
  );
}

function ActionBtn({ onClick, label, danger }: { onClick: () => void; label: string; danger?: boolean }) {
  const [h, setH] = useState(false);
  return (
    <button type="button" onClick={onClick} onMouseOver={() => setH(true)} onMouseOut={() => setH(false)}
      style={{ height: 32, padding: "0 14px", borderRadius: 8, fontFamily: font, fontSize: 12.5, fontWeight: 600, cursor: "pointer", transition: "all .13s", border: `1.5px solid ${h ? (danger ? C.red : C.blue) : C.border}`, background: h ? (danger ? C.redBg : C.blueL) : C.white, color: h ? (danger ? C.red : C.blue) : C.tx2, display: "inline-flex", alignItems: "center" }}>
      {label}
    </button>
  );
}

// ── Modal Shell ───────────────────────────────────────────────────────────────
function Modal({ children, onClose, maxW = 520 }: { children: React.ReactNode; onClose: () => void; maxW?: number }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: "rgba(10,12,20,.52)", backdropFilter: "blur(8px)", animation: "gcFadeIn .18s ease", fontFamily: font }}>
      <div style={{ background: C.white, borderRadius: 22, width: "100%", maxWidth: maxW, maxHeight: "92vh", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: C.shadowLg, animation: "gcRise .26s cubic-bezier(.22,.68,0,1.15) both" }}>
        {children}
      </div>
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
      <button type="button" onClick={onClose} onMouseOver={() => setH(true)} onMouseOut={() => setH(false)}
        style={{ width: 34, height: 34, borderRadius: 9, border: `1.5px solid ${C.border}`, background: h ? C.bg : "transparent", cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", transition: "background .13s" }}>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1 1l10 10M11 1L1 11" stroke={C.tx3} strokeWidth="1.7" strokeLinecap="round"/></svg>
      </button>
    </div>
  );
}
function MBody({ children }: { children: React.ReactNode }) { return <div style={{ overflowY: "auto", flex: 1, padding: "22px 28px" }}>{children}</div>; }
function MFoot({ children }: { children: React.ReactNode }) { return <div style={{ padding: "16px 28px 24px", borderTop: `1px solid ${C.border2}`, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10, flexShrink: 0 }}>{children}</div>; }
function SL({ children }: { children: React.ReactNode }) { return <p style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: C.tx3, marginBottom: 14, paddingBottom: 10, borderBottom: `1px solid ${C.border2}` }}>{children}</p>; }
function ErrorBox({ message }: { message: string }) { return <div style={{ marginTop: 14, padding: "10px 14px", background: C.redBg, border: "1px solid #FECDD3", borderRadius: 9, fontSize: 12.5, color: "#B42318", animation: "gcShake .3s ease" }}>{message}</div>; }
function EmptyState({ query, type }: { query: string; type: TabType }) {
  return (
    <tr><td colSpan={8} style={{ padding: "56px 0", textAlign: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
        <div style={{ width: 52, height: 52, borderRadius: 16, background: C.bg, border: `1.5px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>{query ? "🔍" : "👥"}</div>
        <p style={{ fontSize: 14, fontWeight: 700, color: C.tx1 }}>{query ? "Tidak ada hasil" : `Belum ada ${type === "member" ? "member" : "staff"}`}</p>
        <p style={{ fontSize: 12.5, color: C.tx3 }}>{query ? `Tidak ada akun yang cocok dengan "${query}"` : "Tambah akun untuk memulai"}</p>
      </div>
    </td></tr>
  );
}

async function apiFetch(url: string, options?: RequestInit): Promise<any> {

// ── Edit Points Modal ─────────────────────────────────────────────────────────
// ✅ No admin gate — available to all dashboard users
function EditPointsModal({
  user, onClose, onSaved, toast, confirm,
}: {
  user: UserWithUid; onClose: () => void;
  onSaved: (patch: Pick<UserWithUid, "currentPoints" | "lifetimePoints">) => void;
  toast: ReturnType<typeof useToast>["show"];
  confirm: ReturnType<typeof useConfirm>["confirm"];
}) {
  const [points,   setPoints]   = useState(String(user.currentPoints  ?? 0));
  const [lifetime, setLifetime] = useState(String(user.lifetimePoints ?? 0));
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

  const pointsNum   = parseInt(points,   10);
  const lifetimeNum = parseInt(lifetime, 10);
  const isValid     = !isNaN(pointsNum) && !isNaN(lifetimeNum) && pointsNum >= 0 && lifetimeNum >= 0 && lifetimeNum >= pointsNum;

  function handleSave() {
    if (!isValid) return;
    confirm({
      title: "Konfirmasi Edit Poin",
      description: `Poin aktif ${user.name} akan diubah menjadi ${pointsNum.toLocaleString("id")} dan Lifetime XP menjadi ${lifetimeNum.toLocaleString("id")}.`,
      confirmLabel: "Simpan Perubahan",
      onConfirm: async () => {
        setLoading(true); setError("");
        try {
          await updatePointsAction(user.uid, pointsNum, lifetimeNum);
          toast(`Poin ${user.name} berhasil diperbarui.`, "success");
          onSaved({ currentPoints: pointsNum, lifetimePoints: lifetimeNum });
          onClose();
        } catch (e: any) {
          setError(e.message ?? "Gagal menyimpan perubahan poin.");
        } finally { setLoading(false); }
      },
    });
  }

  const deltaPoints   = pointsNum   - (user.currentPoints  ?? 0);
  const deltaLifetime = lifetimeNum - (user.lifetimePoints ?? 0);

  return (
    <Modal onClose={onClose} maxW={460}>
      <MHead eyebrow="Edit Poin" title={user.name ?? "—"} onClose={onClose} />
      <MBody>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 22 }}>
          {[
            { label: "Poin Aktif Sekarang",  value: (user.currentPoints  ?? 0).toLocaleString("id"), color: C.blue   },
            { label: "Lifetime XP Sekarang", value: (user.lifetimePoints ?? 0).toLocaleString("id"), color: C.purple },
          ].map(s => (
            <div key={s.label} style={{ padding: "12px 14px", background: C.bg, border: `1px solid ${C.border2}`, borderRadius: 10 }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: C.tx3, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 5 }}>{s.label}</p>
              <p style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</p>
            </div>
          ))}
        </div>
        <SL>Nilai Baru</SL>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 16 }}>
          <div>
            <FL>Poin Aktif</FL>
            <GcInput type="number" min="0" value={points} onChange={e => setPoints(e.target.value)}
              hasError={!isNaN(pointsNum) && pointsNum < 0} 
            />
          </div>
          <div>
            <FL>Lifetime XP</FL>
            <GcInput type="number" min="0" value={lifetime} onChange={e => setLifetime(e.target.value)}
              hasError={!isNaN(lifetimeNum) && lifetimeNum < pointsNum} 
            />
            {!isNaN(lifetimeNum) && !isNaN(pointsNum) && lifetimeNum < pointsNum && (
              <p style={{ fontSize: 11.5, color: "#B42318", marginTop: 5 }}>Lifetime XP tidak boleh lebih kecil dari Poin Aktif.</p>
            )}
          </div>
        </div>
        {isValid && (deltaPoints !== 0 || deltaLifetime !== 0) && (
          <div style={{ padding: "10px 14px", borderRadius: 9, background: C.blueL, border: `1px solid rgba(67,97,238,.2)`, marginBottom: 4 }}>
            <p style={{ fontSize: 11.5, fontWeight: 700, color: C.blue, marginBottom: 6 }}>Preview Perubahan</p>
            <div style={{ display: "flex", gap: 16 }}>
              {deltaPoints !== 0 && <span style={{ fontSize: 12.5, fontWeight: 600, color: deltaPoints > 0 ? "#027A48" : C.red }}>Poin: {deltaPoints > 0 ? "+" : ""}{deltaPoints.toLocaleString("id")}</span>}
              {deltaLifetime !== 0 && <span style={{ fontSize: 12.5, fontWeight: 600, color: deltaLifetime > 0 ? "#027A48" : C.red }}>Lifetime XP: {deltaLifetime > 0 ? "+" : ""}{deltaLifetime.toLocaleString("id")}</span>}
            </div>
          </div>
        )}
        {error && <ErrorBox message={error} />}
      </MBody>
      <MFoot>
        <GcBtn variant="ghost" onClick={onClose} disabled={loading}>Batal</GcBtn>
        <GcBtn variant="blue" onClick={handleSave} disabled={loading || !isValid || (deltaPoints === 0 && deltaLifetime === 0)}>
          {loading ? "Menyimpan…" : "Simpan Perubahan"}
        </GcBtn>
      </MFoot>
    </Modal>
  );
}

// ── Member Detail Modal ───────────────────────────────────────────────────────
// ✅ isAdmin prop REMOVED — edit poin selalu tersedia
function MemberDetailModal({
  user, onClose, onEdit, onDeleted, toast, confirm,
}: {
  user: UserWithUid; onClose: () => void; onEdit: () => void;
  onDeleted: (uid: string) => void;
  toast: ReturnType<typeof useToast>["show"];
  confirm: ReturnType<typeof useConfirm>["confirm"];
}) {
  const tier = TIER_CFG[user.tier] ?? TIER_CFG.Silver;
  const [localUser, setLocalUser] = useState(user);
  const [showEditPoints, setShowEditPoints] = useState(false);

  function handleDelete() {
    confirm({
      title: "Hapus Akun Member",
      description: `Akun "${localUser.name}" akan dihapus permanen. Data poin, voucher, dan riwayat XP tidak dapat dikembalikan.`,
      confirmLabel: "Hapus Akun", danger: true,
      onConfirm: async () => {
        await deleteAccountAction(localUser.uid, 'users');
        toast(`Akun ${localUser.name} berhasil dihapus.`, "success");
        onDeleted(localUser.uid); onClose();
      },
    });
  }

  return (
    <>
      <Modal onClose={onClose} maxW={540}>
        <MHead eyebrow="Detail Member" title={localUser.name ?? "—"} onClose={onClose} />
        <MBody>
          <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 18px", background: C.bg, borderRadius: 14, border: `1px solid ${C.border}`, marginBottom: 20 }}>
            <Avatar name={localUser.name} size={52} />
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 16, fontWeight: 700, color: C.tx1, marginBottom: 3 }}>{localUser.name}</p>
              <p style={{ fontSize: 12.5, color: C.tx3, marginBottom: 2 }}>{localUser.email}</p>
              <p style={{ fontSize: 12.5, color: C.tx3 }}>{localUser.phoneNumber}</p>
            </div>
            <span style={{ padding: "5px 12px", borderRadius: 99, fontSize: 11, fontWeight: 700, background: tier.bg, color: tier.color, border: `1.5px solid ${tier.ring}` }}>{localUser.tier}</span>
          </div>

          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 10 }}>
              {[
                { label: "Poin Aktif",  value: (localUser.currentPoints  ?? 0).toLocaleString("id"), color: C.blue   },
                { label: "Lifetime XP", value: (localUser.lifetimePoints ?? 0).toLocaleString("id"), color: C.purple },
                { label: "Voucher",     value: String(localUser.vouchers?.length ?? 0),               color: C.green  },
              ].map(s => (
                <div key={s.label} style={{ textAlign: "center", padding: "14px 10px", background: C.bg, border: `1px solid ${C.border2}`, borderRadius: 12 }}>
                  <p style={{ fontSize: 22, fontWeight: 800, color: s.color, lineHeight: 1, marginBottom: 5 }}>{s.value}</p>
                  <p style={{ fontSize: 10.5, color: C.tx3, fontWeight: 600, letterSpacing: ".05em", textTransform: "uppercase" }}>{s.label}</p>
                </div>
              ))}
            </div>

            {/* ✅ Edit poin button selalu tampil — tidak ada gate */}
            <button type="button" onClick={() => setShowEditPoints(true)}
              style={{ width: "100%", height: 34, borderRadius: 8, border: `1.5px dashed ${C.blue}`, background: C.blueL, color: C.blue, fontFamily: font, fontSize: 12.5, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, transition: "all .13s" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              Edit Poin & Lifetime XP
            </button>
          </div>

          <SL>Informasi Akun</SL>
          <div style={{ marginBottom: 20 }}>
            {[
              { label: "UID",       value: <code style={{ fontSize: 11, background: C.blueL, padding: "2px 8px", borderRadius: 6, color: C.blue }}>{localUser.uid}</code> },
              { label: "Role",      value: localUser.role },
              { label: "Bergabung", value: localUser.joinedDate ? new Date(localUser.joinedDate).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "—" },
            ].map((r, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${C.border2}` }}>
                <span style={{ fontSize: 12.5, color: C.tx3, fontWeight: 500 }}>{r.label}</span>
                <span style={{ fontSize: 12.5, color: C.tx1, fontWeight: 600 }}>{r.value}</span>
              </div>
            ))}
          </div>
        </MBody>
        <MFoot>
          <GcBtn variant="ghost"  onClick={onClose}>Tutup</GcBtn>
          <GcBtn variant="blue"   onClick={onEdit}>Edit Member</GcBtn>
          <GcBtn variant="danger" onClick={handleDelete}>Hapus Akun</GcBtn>
        </MFoot>
      </Modal>

      {showEditPoints && (
        <EditPointsModal
          user={localUser}
          onClose={() => setShowEditPoints(false)}
          onSaved={patch => setLocalUser(p => ({ ...p, ...patch }))}
          toast={(msg, type) => toast(msg, type as any)}
          confirm={confirm}
        />
      )}
    </>
  );
}

// ── Edit Member Modal ─────────────────────────────────────────────────────────
// ✅ isAdmin prop REMOVED — edit poin selalu tersedia
function EditMemberModal({
  user, onClose, onSaved, toast, confirm
}: {
  user: UserWithUid;
  onClose: () => void;
  onSaved: (patch: Partial<UserWithUid>) => void;
  toast: (msg: string, type?: string) => void;
  confirm: (msg: string, onYes: () => void) => void;
}) {
    const [showInject, setShowInject] = useState(false);
    const [form, setForm] = useState({
      name:        user.name        ?? "",
      email:       user.email       ?? "",
      phoneNumber: user.phoneNumber ?? "",
      tier:        (user.tier  as string) ?? "Silver",
      role:        (user.role  as string) ?? "member",
    });
    const [loading,       setLoading]       = useState(false);
    const [error,         setError]         = useState("");
    const [showEditPoints, setShowEditPoints] = useState(false);
    const [localPoints,   setLocalPoints]   = useState<number | undefined>(user.currentPoints);
    const [localLifetime, setLocalLifetime] = useState<number | undefined>(user.lifetimePoints);

    const set = <K extends keyof typeof form>(k: K, v: typeof form[K]) => setForm(p => ({ ...p, [k]: v }));

    async function save() {
      if (!form.name.trim()) { setError("Nama tidak boleh kosong."); return; }
      setLoading(true); setError("");
      try {
        await updateAccountAction(user.uid, form, "users");
        toast(`${form.name} berhasil diperbarui.`, "success");
        onSaved({ name: form.name, email: form.email, phoneNumber: form.phoneNumber, tier: form.tier as UserTier, role: form.role as UserRole });
        onClose();
      } catch (e: any) {
        setError(e.message ?? "Gagal menyimpan perubahan.");
      } finally { setLoading(false); }
    }

    return (
      <>
        <Modal onClose={onClose} maxW={520}>
          <MHead eyebrow="Edit Akun" title="Edit Member" onClose={onClose} />
          <MBody>
            <SL>Informasi Member</SL>
            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 22 }}>
              <div><FL>Nama</FL><GcInput value={form.name}        onChange={e => set("name",        e.target.value)} /></div>
              <div><FL>Email</FL><GcInput type="email" value={form.email}  onChange={e => set("email",       e.target.value)} /></div>
              <div><FL>No. HP</FL><GcInput value={form.phoneNumber} onChange={e => set("phoneNumber", e.target.value)} /></div>
              <div>
                <FL>Tier</FL>
                <GcSelect value={form.tier} onChange={e => set("tier", e.target.value as UserTier)}>
                  {["Silver","Gold","Platinum"].map(t => <option key={t}>{t}</option>)}
                </GcSelect>
              </div>
              <div>
                <FL>Role</FL>
                <GcSelect value={form.role} onChange={e => set("role", e.target.value as UserRole)}>
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </GcSelect>
              </div>
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <GcBtn variant="primary" onClick={() => setShowInject(true)} style={{ width: "100%" }}>
                  <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2} style={{ marginRight: 7 }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
                  </svg>
                  Suntik Voucher ke User
                </GcBtn>
                <GcBtn variant="blue" onClick={() => setShowEditPoints(true)} style={{ width: "100%" }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" style={{ marginRight: 7 }}><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  Edit Poin & Lifetime XP
                </GcBtn>
              </div>
            </div>
            {/* ...existing code... */}
          </MBody>
          {/* ...existing code... */}
        </Modal>
        {/* ...existing code... */}
        {showInject && (
          <InjectVoucherModalForMember
            uid={user.uid}
            onClose={() => setShowInject(false)}
            onSuccess={msg => { toast(msg, "success"); setShowInject(false); }}
          />
        )}
        {showEditPoints && (
          <EditPointsModal
            user={user}
            onClose={() => setShowEditPoints(false)}
            onSaved={patch => {
              if (patch.currentPoints !== undefined) setLocalPoints?.(patch.currentPoints);
              if (patch.lifetimePoints !== undefined) setLocalLifetime?.(patch.lifetimePoints);
            }}
            toast={toast}
            confirm={confirm}
          />
        )}
      </>
    );
}

// ── Edit Staff Modal ──────────────────────────────────────────────────────────
function EditStaffModal({ staff, storeIds, onClose, onSaved, toast }: {
  staff: StaffWithUid; storeIds: string[]; onClose: () => void;
  onSaved: (u: Partial<StaffWithUid>) => void;
  toast: ReturnType<typeof useToast>["show"];
}) {
  const normalized = normalizeStoreAccess(staff);
  const [form, setForm] = useState({ name: staff.name ?? "", role: (staff.role as string) ?? "cashier", storeLocations: normalized.storeLocations, accessAllStores: normalized.accessAllStores, isActive: staff.isActive ?? true });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const canSave = form.accessAllStores || form.storeLocations.length > 0;

  async function save() {
    if (!form.name.trim()) { setError("Nama tidak boleh kosong."); return; }
    if (!canSave) { setError("Pilih minimal satu toko atau aktifkan akses semua toko."); return; }
    setLoading(true); setError("");
    try {
      await updateAccountAction(staff.uid, form, "staff");
      toast(`${form.name} berhasil diperbarui.`, "success");
      onSaved({ name: form.name, role: form.role as StaffRole, storeLocations: form.storeLocations, accessAllStores: form.accessAllStores, isActive: form.isActive });
      onClose();
    } catch (e: any) { setError(e.message ?? "Gagal menyimpan perubahan."); }
    finally { setLoading(false); }
  }

  return (
    <Modal onClose={onClose}>
      <MHead eyebrow="Edit Akun" title="Edit Staff" onClose={onClose} />
      <MBody>
        <SL>Informasi Staff</SL>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 22 }}>
          <div><FL>Nama</FL><GcInput value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
          <div>
            <FL>Role</FL>
            <GcSelect value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}>
              <option value="cashier">Kasir</option>
              <option value="store_manager">Store Manager</option>
              <option value="admin">Admin</option>
            </GcSelect>
          </div>
        </div>
        <SL>Akses Outlet</SL>
        <div style={{ marginBottom: 22 }}>
<StoreAccessPicker storeIds={storeIds} selected={form.storeLocations} accessAll={form.accessAllStores} onChangeSelected={v => setForm(p => ({ ...p, storeLocations: v }))} onChangeAccessAll={v => { setForm(p => ({ ...p, accessAllStores: v })); if (v) setForm(p => ({ ...p, storeLocations: [] })); }} />
        </div>
        <SL>Status Akun</SL>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderRadius: 12, background: C.bg, border: `1.5px solid ${C.border}` }}>
          <div>
            <p style={{ fontSize: 13.5, fontWeight: 600, color: C.tx1, marginBottom: 2 }}>Status Aktif</p>
            <p style={{ fontSize: 12, color: C.tx3 }}>{form.isActive ? "Staff aktif dan dapat login" : "Akses staff dinonaktifkan"}</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 99, background: form.isActive ? C.greenBg : C.border2, color: form.isActive ? "#027A48" : C.tx3 }}>{form.isActive ? "Aktif" : "Nonaktif"}</span>
            <button type="button" onClick={() => setForm(p => ({ ...p, isActive: !p.isActive }))} style={{ width: 42, height: 24, borderRadius: 99, border: "none", cursor: "pointer", background: form.isActive ? C.blue : C.border, position: "relative", transition: "background .2s" }}>
              <span style={{ position: "absolute", top: 3, borderRadius: "50%", width: 18, height: 18, background: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,.2)", display: "block", left: form.isActive ? 21 : 3, transition: "left .2s cubic-bezier(.34,1.56,.64,1)" }} />
            </button>
          </div>
        </div>
        {error && <ErrorBox message={error} />}
      </MBody>
      <MFoot>
        <GcBtn variant="ghost" onClick={onClose} disabled={loading}>Batal</GcBtn>
        <GcBtn variant="blue"  onClick={save}    disabled={loading || !canSave}>{loading ? "Menyimpan…" : "Simpan"}</GcBtn>
      </MFoot>
    </Modal>
  );
}

// ── Batch Edit Modal ──────────────────────────────────────────────────────────
function BatchEditModal({ type, count, storeIds, onClose, onSaved }: { type: TabType; count: number; storeIds: string[]; onClose: () => void; onSaved: (data: Record<string, any>) => Promise<void>; }) {
  const [tierChange, setTierChange] = useState("");
  const [statusChange, setStatusChange] = useState<boolean | undefined>(undefined);
  const [changeOutlet, setChangeOutlet] = useState(false);
  const [storeLocations, setStoreLocations] = useState<string[]>([]);
  const [accessAllStores, setAccessAllStores] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const memberHasChanges = tierChange !== "" || statusChange !== undefined;
  const staffHasChanges  = statusChange !== undefined || (changeOutlet && (accessAllStores || storeLocations.length > 0));
  const hasChanges = type === "member" ? memberHasChanges : staffHasChanges;
  function buildPayload(): Record<string, any> {
    if (type === "member") { const p: Record<string, any> = {}; if (tierChange !== "") p.tier = tierChange; if (statusChange !== undefined) p.isActive = statusChange; return p; }
    else { const p: Record<string, any> = {}; if (statusChange !== undefined) p.isActive = statusChange; if (changeOutlet) { p.accessAllStores = accessAllStores; p.storeLocations = accessAllStores ? [] : storeLocations; } return p; }
  }
  async function save() {
    if (!hasChanges) return; setLoading(true); setError("");
    try { await onSaved(buildPayload()); } catch (e: any) { setError(e.message ?? "Terjadi kesalahan."); } finally { setLoading(false); }
  }
  return (
    <Modal onClose={onClose} maxW={440}>
      <MHead eyebrow="Batch Action" title={`Edit ${count} Akun`} onClose={onClose} />
      <MBody>
        <p style={{ fontSize: 13, color: C.tx2, marginBottom: 20, lineHeight: 1.6 }}>Field yang dibiarkan kosong <strong>tidak akan diubah</strong> pada akun yang dipilih.</p>
        {type === "member" ? (
          <><div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div><FL>Ubah Tier (Opsional)</FL><GcSelect value={tierChange} onChange={e => setTierChange(e.target.value)}><option value="">— Jangan ubah Tier —</option><option value="Silver">Silver</option><option value="Gold">Gold</option><option value="Platinum">Platinum</option></GcSelect></div>
            <div><FL>Ubah Status (Opsional)</FL><GcSelect value={statusChange === undefined ? "" : String(statusChange)} onChange={e => setStatusChange(e.target.value === "" ? undefined : e.target.value === "true")}><option value="">— Jangan ubah Status —</option><option value="true">Aktif</option><option value="false">Nonaktif</option></GcSelect></div>
          </div></>
        ) : (
          <><div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div><FL>Ubah Status (Opsional)</FL><GcSelect value={statusChange === undefined ? "" : String(statusChange)} onChange={e => setStatusChange(e.target.value === "" ? undefined : e.target.value === "true")}><option value="">— Jangan ubah Status —</option><option value="true">Aktif</option><option value="false">Nonaktif</option></GcSelect></div>
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <FL>Ubah Akses Outlet (Opsional)</FL>
                <button type="button" onClick={() => setChangeOutlet(p => !p)} style={{ width: 38, height: 22, borderRadius: 99, border: "none", cursor: "pointer", background: changeOutlet ? C.blue : C.border, position: "relative", transition: "background .2s" }}>
                  <span style={{ position: "absolute", top: 2, borderRadius: "50%", width: 18, height: 18, background: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,.2)", display: "block", left: changeOutlet ? 18 : 2, transition: "left .2s cubic-bezier(.34,1.56,.64,1)" }} />
                </button>
              </div>
              {changeOutlet ? <StoreAccessPicker storeIds={storeIds} selected={storeLocations} accessAll={accessAllStores} onChangeSelected={setStoreLocations} onChangeAccessAll={v => { setAccessAllStores(v); if (v) setStoreLocations([]); }} /> : <p style={{ fontSize: 12, color: C.tx3, fontStyle: "italic" }}>Aktifkan toggle di atas untuk mengubah akses outlet.</p>}
            </div>
          </div></>
        )}
        {!hasChanges && <p style={{ marginTop: 14, fontSize: 12, color: C.tx3, fontStyle: "italic" }}>Pilih minimal satu field untuk mengaktifkan tombol Terapkan.</p>}
        {error && <ErrorBox message={error} />}
      </MBody>
      <MFoot><GcBtn variant="ghost" onClick={onClose} disabled={loading}>Batal</GcBtn><GcBtn variant="blue" onClick={save} disabled={loading || !hasChanges}>{loading ? "Menyimpan…" : "Terapkan Perubahan"}</GcBtn></MFoot>
    </Modal>
  );
}

// ── Create Modal ──────────────────────────────────────────────────────────────
function CreateModal({ storeIds, onClose, toast }: { storeIds: string[]; onClose: () => void; toast: ReturnType<typeof useToast>["show"]; }) {
  const [type, setType] = useState<TabType>("member");
  const [form, setForm] = useState({ name: "", email: "", phoneNumber: "", tier: "Silver", role: "member", staffRole: "cashier", password: "", confirm: "" });
  const [storeLocations, setStoreLocations] = useState<string[]>(storeIds.slice(0, 1));
  const [accessAllStores, setAccessAllStores] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const set = <K extends keyof typeof form>(k: K, v: string) => setForm(p => ({ ...p, [k]: v }));
  const pwMismatch = form.confirm !== "" && form.password !== form.confirm;
  const storeValid = type !== "staff" || accessAllStores || storeLocations.length > 0;
  async function create() {
    setError("");
    if (!form.name.trim()) { setError("Nama wajib diisi."); return; }
    if (!form.email.trim()) { setError("Email wajib diisi."); return; }
    if (form.password.length < 8) { setError("Password minimal 8 karakter."); return; }
    if (form.password !== form.confirm) { setError("Password tidak cocok."); return; }
    if (!storeValid) { setError("Pilih minimal satu toko atau aktifkan akses semua toko."); return; }
    setLoading(true);
    try {
      const url = type === "member" ? "/api/members" : "/api/staff";
      const payload = type === "member" ? { name: form.name, email: form.email, phoneNumber: form.phoneNumber, tier: form.tier, role: form.role, password: form.password } : { name: form.name, email: form.email, role: form.staffRole, storeLocations, accessAllStores, password: form.password };
      await createAccountAction(payload, 'member');
      toast(`Akun ${form.name} berhasil dibuat.`, "success"); onClose();
    } catch (e: any) { setError(e.message ?? "Gagal membuat akun."); } finally { setLoading(false); }
  }
  return (
    <Modal onClose={onClose}>
      <MHead eyebrow="Akun Baru" title="Tambah Akun" onClose={onClose} />
      <MBody>
        <div style={{ display: "flex", background: C.bg, border: `1.5px solid ${C.border}`, borderRadius: 12, padding: 4, marginBottom: 22 }}>
          {(["member","staff"] as const).map(t => (
            <button key={t} type="button" onClick={() => setType(t)} style={{ flex: 1, height: 36, borderRadius: 9, border: "none", fontFamily: font, fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all .15s", background: type === t ? C.white : "transparent", color: type === t ? C.tx1 : C.tx3, boxShadow: type === t ? C.shadow : "none" }}>
              {t === "member" ? "👤 Member" : "🏷️ Staff & Admin"}
            </button>
          ))}
        </div>
        {type === "member" ? (
          <><SL>Informasi Member</SL>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 22 }}>
            <div><FL>Nama *</FL><GcInput placeholder="Budi Santoso" value={form.name} onChange={e => set("name", e.target.value)} /></div>
            <div><FL>Email *</FL><GcInput type="email" placeholder="budi@email.com" value={form.email} onChange={e => set("email", e.target.value)} /></div>
            <div><FL>No. HP</FL><GcInput placeholder="+62 812 xxxx" value={form.phoneNumber} onChange={e => set("phoneNumber", e.target.value)} /></div>
            <div><FL>Tier Awal</FL><GcSelect value={form.tier} onChange={e => set("tier", e.target.value)}>{["Silver","Gold","Platinum"].map(t => <option key={t}>{t}</option>)}</GcSelect></div>
          </div></>
        ) : (
          <><SL>Informasi Staff</SL>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 22 }}>
            <div><FL>Nama *</FL><GcInput placeholder="Siti Rahayu" value={form.name} onChange={e => set("name", e.target.value)} /></div>
            <div><FL>Email *</FL><GcInput type="email" placeholder="siti@gongcha.id" value={form.email} onChange={e => set("email", e.target.value)} /></div>
            <div><FL>Role</FL><GcSelect value={form.staffRole} onChange={e => set("staffRole", e.target.value)}><option value="cashier">Kasir</option><option value="store_manager">Store Manager</option><option value="admin">Admin</option></GcSelect></div>
          </div>
          {storeIds.length > 0 && <><SL>Akses Outlet</SL><div style={{ marginBottom: 22 }}><StoreAccessPicker storeIds={storeIds} selected={storeLocations} accessAll={accessAllStores} onChangeSelected={setStoreLocations} onChangeAccessAll={v => { setAccessAllStores(v); if (v) setStoreLocations([]); }} /></div></>}</>
        )}
        <SL>Password</SL>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div><FL>Password *</FL><GcInput type="password" placeholder="Min. 8 karakter" value={form.password} onChange={e => set("password", e.target.value)} /></div>
          <div>
            <FL>Konfirmasi Password *</FL>
            <GcInput type="password" placeholder="Ulangi password" value={form.confirm} onChange={e => set("confirm", e.target.value)} hasError={pwMismatch} />
            {pwMismatch && <p style={{ fontSize: 11.5, color: "#B42318", marginTop: 5 }}>Password tidak cocok</p>}
          </div>
        </div>
        {error && <ErrorBox message={error} />}
      </MBody>
      <MFoot>
        <p style={{ flex: 1, fontSize: 11.5, color: C.tx3 }}>Kolom <span style={{ color: C.red }}>*</span> wajib diisi</p>
        <GcBtn variant="ghost" onClick={onClose} disabled={loading}>Batal</GcBtn>
        <GcBtn variant="blue" onClick={create} disabled={loading || pwMismatch || !storeValid}>{loading ? "Membuat…" : `Buat ${type === "member" ? "Member" : "Staff"}`}</GcBtn>
      </MFoot>
    </Modal>
  );
}

// ── Table Rows ────────────────────────────────────────────────────────────────
function UserRow({ u, isLast, onDetail, onEdit, checked, onCheck }: { u: UserWithUid; isLast: boolean; onDetail: () => void; onEdit: () => void; checked: boolean; onCheck: (checked: boolean) => void; }) {
  const [hovered, setHovered] = useState(false);
  const tier = TIER_CFG[u.tier] ?? TIER_CFG.Silver;
  return (
    <tr onMouseOver={() => setHovered(true)} onMouseOut={() => setHovered(false)} onClick={onDetail}
      style={{ borderBottom: isLast ? "none" : `1px solid ${C.border2}`, background: checked ? "#F5F7FF" : hovered ? "#F8F9FC" : C.white, transition: "background .1s", cursor: "pointer" }}>
      <td style={{ padding: "14px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <input type="checkbox" checked={checked} onChange={e => onCheck(e.target.checked)} onClick={e => e.stopPropagation()} style={{ width: 16, height: 16, cursor: "pointer", accentColor: C.blue, flexShrink: 0 }} />
          <Avatar name={u.name} size={36} />
          <div>
            <p style={{ fontSize: 13.5, fontWeight: 700, color: C.tx1, marginBottom: 2 }}>{u.name}</p>
            <code style={{ fontSize: 10.5, color: C.tx3, background: C.bg, padding: "1px 6px", borderRadius: 5, border: `1px solid ${C.border2}` }}>{u.uid.slice(0, 12)}…</code>
          </div>
        </div>
      </td>
      <td style={{ padding: "14px 20px", fontSize: 13, color: C.tx2 }}>{u.email}</td>
      <td style={{ padding: "14px 20px" }}><span style={{ padding: "4px 11px", borderRadius: 99, fontSize: 11, fontWeight: 700, background: tier.bg, color: tier.color, border: `1.5px solid ${tier.ring}` }}>{u.tier}</span></td>
      <td style={{ padding: "14px 20px", fontSize: 14, fontWeight: 800, color: C.blue }}>{(u.currentPoints ?? 0).toLocaleString("id")}</td>
      <td style={{ padding: "14px 20px", fontSize: 13, color: C.tx2 }}>{(u.lifetimePoints ?? 0).toLocaleString("id")}</td>
      <td style={{ padding: "14px 20px", fontSize: 12.5, color: C.tx2, fontWeight: 500 }}>{u.role}</td>
      <td style={{ padding: "14px 20px" }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", gap: 6 }}>
          <ActionBtn onClick={onDetail} label="Detail" />
          <ActionBtn onClick={onEdit}   label="Edit"   />
        </div>
      </td>
    </tr>
  );
}

function StaffRow({ s, isLast, onEdit, checked, onCheck }: { s: StaffWithUid; isLast: boolean; onEdit: () => void; checked: boolean; onCheck: (checked: boolean) => void; }) {
  const [hovered, setHovered] = useState(false);
  const r = STAFF_CFG[s.role] ?? STAFF_CFG.cashier;
  return (
    <tr onMouseOver={() => setHovered(true)} onMouseOut={() => setHovered(false)}
      style={{ borderBottom: isLast ? "none" : `1px solid ${C.border2}`, background: checked ? "#F5F7FF" : hovered ? "#F8F9FC" : C.white, transition: "background .1s" }}>
      <td style={{ padding: "14px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <input type="checkbox" checked={checked} onChange={e => onCheck(e.target.checked)} style={{ width: 16, height: 16, cursor: "pointer", accentColor: C.blue, flexShrink: 0 }} />
          <Avatar name={s.name} size={36} />
          <div>
            <p style={{ fontSize: 13.5, fontWeight: 700, color: C.tx1, marginBottom: 2 }}>{s.name}</p>
            <code style={{ fontSize: 10.5, color: C.tx3, background: C.bg, padding: "1px 6px", borderRadius: 5, border: `1px solid ${C.border2}` }}>{s.uid.slice(0, 12)}…</code>
          </div>
        </div>
      </td>
      <td style={{ padding: "14px 20px", fontSize: 13, color: C.tx2 }}>{s.email}</td>
      <td style={{ padding: "14px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ padding: "3px 9px", borderRadius: 99, fontSize: 10, fontWeight: 700, letterSpacing: ".06em", background: r.bg, color: r.color }}>{r.code}</span>
          <span style={{ fontSize: 13, color: C.tx2, fontWeight: 500 }}>{r.label}</span>
        </div>
      </td>
      <td style={{ padding: "14px 20px" }}>
        {(() => {
          const { storeLocations, accessAllStores } = normalizeStoreAccess(s);
          if (accessAllStores) return <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 99, background: C.purpleBg, color: C.purple, border: `1px solid #DDD6FE` }}>🏢 Semua Toko</span>;
          if (storeLocations.length === 0) return <span style={{ fontSize: 12.5, color: C.tx4 }}>—</span>;
          if (storeLocations.length === 1) return <code style={{ fontSize: 12, background: C.blueL, padding: "3px 9px", borderRadius: 6, color: C.blue, border: `1px solid rgba(67,97,238,.15)` }}>{storeLocations[0]}</code>;
          return <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>{storeLocations.slice(0, 2).map(id => <code key={id} style={{ fontSize: 11, background: C.blueL, padding: "2px 7px", borderRadius: 5, color: C.blue, border: `1px solid rgba(67,97,238,.15)` }}>{id}</code>)}{storeLocations.length > 2 && <span style={{ fontSize: 11, fontWeight: 700, color: C.tx3 }}>+{storeLocations.length - 2}</span>}</div>;
        })()}
      </td>
      <td style={{ padding: "14px 20px", fontSize: 12.5, color: C.tx2, fontWeight: 500 }}>{s.isActive ? "Aktif" : "Nonaktif"}</td>
      <td style={{ padding: "14px 20px" }}><ActionBtn onClick={onEdit} label="Edit" /></td>
    </tr>
  );
}

// ── Store Access Picker ───────────────────────────────────────────────────────
function StoreAccessPicker({ storeIds, selected, accessAll, onChangeSelected, onChangeAccessAll }: { storeIds: string[]; selected: string[]; accessAll: boolean; onChangeSelected: (ids: string[]) => void; onChangeAccessAll: (v: boolean) => void; }) {
  function toggleStore(id: string) { onChangeSelected(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]); }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div onClick={() => onChangeAccessAll(!accessAll)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderRadius: 10, cursor: "pointer", border: `1.5px solid ${accessAll ? C.blue : C.border}`, background: accessAll ? C.blueL : C.bg, transition: "all .15s" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 18 }}>🏢</span>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: accessAll ? C.blue : C.tx1 }}>Semua Toko</p>
            <p style={{ fontSize: 11.5, color: C.tx3 }}>Akses ke seluruh outlet tanpa batasan</p>
          </div>
        </div>
        <div style={{ width: 18, height: 18, borderRadius: 5, border: `2px solid ${accessAll ? C.blue : C.border}`, background: accessAll ? C.blue : C.white, display: "flex", alignItems: "center", justifyContent: "center", transition: "all .15s", flexShrink: 0 }}>
          {accessAll && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4l3 3 5-6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
        </div>
      </div>
      {!accessAll && storeIds.length > 0 && <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "2px 0" }}><div style={{ flex: 1, height: 1, background: C.border2 }} /><span style={{ fontSize: 10.5, color: C.tx4, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase" }}>atau pilih toko</span><div style={{ flex: 1, height: 1, background: C.border2 }} /></div>}
      {!accessAll && storeIds.map(id => {
        const isChecked = selected.includes(id);
        return (
          <div key={id} onClick={() => toggleStore(id)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: 10, cursor: "pointer", border: `1.5px solid ${isChecked ? C.blue : C.border}`, background: isChecked ? C.blueL : C.white, transition: "all .13s" }}>
            <code style={{ fontSize: 12, background: isChecked ? "rgba(67,97,238,.15)" : C.bg, padding: "2px 8px", borderRadius: 6, color: isChecked ? C.blue : C.tx2, fontWeight: 700, border: `1px solid ${isChecked ? "rgba(67,97,238,.2)" : C.border2}`, transition: "all .13s" }}>{id}</code>
            <div style={{ width: 18, height: 18, borderRadius: 5, border: `2px solid ${isChecked ? C.blue : C.border}`, background: isChecked ? C.blue : C.white, display: "flex", alignItems: "center", justifyContent: "center", transition: "all .15s", flexShrink: 0 }}>
              {isChecked && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4l3 3 5-6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            </div>
          </div>
        );
      })}
      {!accessAll && selected.length === 0 && <p style={{ fontSize: 11.5, color: C.amber, fontWeight: 600, marginTop: 2 }}>⚠ Pilih minimal satu toko, atau aktifkan "Semua Toko".</p>}
      {!accessAll && selected.length > 0 && <p style={{ fontSize: 11.5, color: "#027A48", fontWeight: 600, marginTop: 2 }}>✓ {selected.length} toko dipilih: {selected.join(", ")}</p>}
    </div>
  );
}

function TierFilter({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {TIER_OPTIONS.map(tier => {
        const active = value === tier;
        const cfg = tier !== "All" ? TIER_CFG[tier] : null;
        return (
          <button key={tier} type="button" onClick={() => onChange(tier)}
            style={{ height: 30, padding: "0 12px", borderRadius: 99, border: `1.5px solid ${active ? (cfg?.ring ?? C.blue) : C.border}`, background: active ? (cfg?.bg ?? C.blueL) : C.white, color: active ? (cfg?.color ?? C.blue) : C.tx2, fontFamily: font, fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all .13s" }}>
            {tier === "All" ? "Semua Tier" : tier}
          </button>
        );
      })}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
// ✅ currentUserRole prop REMOVED — tidak ada role-based restriction di halaman ini
export default function MembersClient({ initialUsers, initialStaff, storeIds }: {
  initialUsers: UserWithUid[];
  initialStaff: StaffWithUid[];
  storeIds: string[];
}) {
  const [users,   setUsers]   = useState(initialUsers);
  const [staff,   setStaff]   = useState(initialStaff);
  const [tab,     setTab]     = useState<TabType>("member");
  const [search,  setSearch]  = useState("");
  const [tierF,   setTierF]   = useState("All");
  const [sfFocus, setSFocus]  = useState(false);

  const [detailUser,    setDetailUser]    = useState<UserWithUid  | null>(null);
  const [editUser,      setEditUser]      = useState<UserWithUid  | null>(null);
  const [editStaff,     setEditStaff]     = useState<StaffWithUid | null>(null);
  const [showCreate,    setShowCreate]    = useState(false);
  const [showBatchEdit, setShowBatchEdit] = useState(false);

  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [selectedStaff, setSelectedStaff] = useState<Set<string>>(new Set());
  const [batchDeleting, setBatchDeleting] = useState(false);

  const { toasts, show: toast, dismiss } = useToast();
  const { confirm, dialog: confirmDialog } = useConfirm();

  const fUsers = useMemo(() => { const q = search.toLowerCase().trim(); return users.filter(u => (!q || u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || u.phoneNumber?.includes(q)) && (tierF === "All" || u.tier === tierF)); }, [users, search, tierF]);

useEffect(() => {
  const unsubUsers = onSnapshot(query(collection(db, "users"), orderBy("name")), (snap) => {
    const data = snap.docs.map(d => ({ uid: d.id, ...d.data() })) as UserWithUid[];
    setUsers(data);
  });
  const unsubStaff = onSnapshot(query(collection(db, "staff"), orderBy("name")), (snap) => {
    const data = snap.docs.map(d => ({ uid: d.id, ...d.data() })) as StaffWithUid[];
    setStaff(data);
  });
  return () => {
    unsubUsers();
    unsubStaff();
  };
}, []);

  const fStaff = useMemo(() => { const q = search.toLowerCase().trim(); return staff.filter(s => !q || s.name?.toLowerCase().includes(q) || s.email?.toLowerCase().includes(q)); }, [staff, search]);

  function switchTab(t: TabType) { setTab(t); setSearch(""); setTierF("All"); setSelectedUsers(new Set()); setSelectedStaff(new Set()); }

  const selUsers = Array.from(selectedUsers);
  const selStaff = Array.from(selectedStaff);
  const selectedCount = tab === "member" ? selUsers.length : selStaff.length;
  const hasSelection  = selectedCount > 0;
  const isAllSelected = tab === "member" ? fUsers.length > 0 && fUsers.every(u => selectedUsers.has(u.uid)) : fStaff.length > 0 && fStaff.every(s => selectedStaff.has(s.uid));
  const isIndeterminate = tab === "member" ? selUsers.some(uid => fUsers.some(u => u.uid === uid)) && !isAllSelected : selStaff.some(uid => fStaff.some(s => s.uid === uid)) && !isAllSelected;

  const headCheckRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (headCheckRef.current) headCheckRef.current.indeterminate = isIndeterminate; }, [isIndeterminate]);

  function handleSelectAll(e: React.ChangeEvent<HTMLInputElement>) {
    if (tab === "member") setSelectedUsers(e.target.checked ? new Set(fUsers.map(u => u.uid)) : new Set());
    else setSelectedStaff(e.target.checked ? new Set(fStaff.map(s => s.uid)) : new Set());
  }
  function toggleUser(uid: string, v: boolean) { setSelectedUsers(p => { const n = new Set(p); v ? n.add(uid) : n.delete(uid); return n; }); }
  function toggleStaff(uid: string, v: boolean) { setSelectedStaff(p => { const n = new Set(p); v ? n.add(uid) : n.delete(uid); return n; }); }

  function handleBatchDelete() {
    const ids = tab === "member" ? selUsers : selStaff;
    confirm({
      title: `Hapus ${ids.length} Akun`, description: `${ids.length} akun akan dihapus secara permanen. Tindakan ini tidak dapat dibatalkan.`,
      confirmLabel: `Hapus ${ids.length} Akun`, danger: true,
      onConfirm: async () => {
        setBatchDeleting(true);
        const endpoint = tab === "member" ? "members" : "staff";
        const collection = tab === "member" ? "users" : "staff";
        const results = await Promise.allSettled(ids.map(uid => deleteAccountAction(uid, collection)));
        const failed = results.filter(r => r.status === "rejected").length;
        const success = results.filter(r => r.status === "fulfilled").length;
        if (tab === "member") { const failedIds = new Set(ids.filter((_, i) => results[i].status === "rejected")); setUsers(p => p.filter(u => failedIds.has(u.uid) || !ids.includes(u.uid))); setSelectedUsers(new Set()); }
        else { const failedIds = new Set(ids.filter((_, i) => results[i].status === "rejected")); setStaff(p => p.filter(s => failedIds.has(s.uid) || !ids.includes(s.uid))); setSelectedStaff(new Set()); }
        setBatchDeleting(false);
        if (failed === 0) toast(`${success} akun berhasil dihapus.`, "success"); else toast(`${success} berhasil, ${failed} gagal dihapus.`, "error");
      },
    });
  }

  async function handleBatchEditSave(payload: Record<string, any>) {
    const ids = tab === "member" ? selUsers : selStaff;
    const endpoint = tab === "member" ? "members" : "staff";
    const collection = tab === "member" ? "users" : "staff";
    const results = await Promise.allSettled(ids.map(uid => updateAccountAction(uid, payload, collection)));
    const failed = results.filter(r => r.status === "rejected").length;
    const success = results.filter(r => r.status === "fulfilled").length;
    if (failed > 0) throw new Error(`${failed} akun gagal diperbarui.`);
    if (tab === "member") { setUsers(p => p.map(u => ids.includes(u.uid) ? { ...u, ...payload } : u)); setSelectedUsers(new Set()); }
    else { setStaff(p => p.map(s => ids.includes(s.uid) ? { ...s, ...payload } : s)); setSelectedStaff(new Set()); }
    toast(`${success} akun berhasil diperbarui.`, "success");
    setShowBatchEdit(false);
  }

  const stats = useMemo(() => ({ totalMembers: users.length, platinum: users.filter(u => u.tier === "Platinum").length, gold: users.filter(u => u.tier === "Gold").length, activeStaff: staff.filter(s => s.isActive).length }), [users, staff]);

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1400, fontFamily: font, WebkitFontSmoothing: "antialiased", minHeight: "100vh", background: C.bg }}>
      <GlobalStyle />

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: C.tx3, marginBottom: 5 }}>Gong Cha Admin</p>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-.025em", color: C.tx1, lineHeight: 1.1 }}>User & Staff Management</h1>
        </div>
        <GcBtn variant="ghost" onClick={() => { /* refresh */ }} >
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
          Refresh
        </GcBtn>
        <GcBtn variant="blue" onClick={() => setShowCreate(true)}>
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>
          Tambah Akun
        </GcBtn>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 24 }}>
        {[
          { label: "Total Member", value: stats.totalMembers, color: C.blue,   bg: C.blueL    },
          { label: "Tier Platinum",value: stats.platinum,     color: C.purple, bg: C.purpleBg },
          { label: "Tier Gold",    value: stats.gold,         color: "#92400E",bg: "#FFFBEB"  },
          { label: "Staff Aktif",  value: stats.activeStaff,  color: C.green,  bg: C.greenBg  },
        ].map(s => (
          <div key={s.label} style={{ background: C.white, borderRadius: 14, border: `1px solid ${C.border}`, padding: "16px 20px", display: "flex", alignItems: "center", gap: 14, boxShadow: C.shadow }}>
            <div style={{ width: 42, height: 42, borderRadius: 11, background: s.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <span style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</span>
            </div>
            <p style={{ fontSize: 12, fontWeight: 600, color: C.tx3, lineHeight: 1.4 }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs + Toolbar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", background: C.bg, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: 3 }}>
          {([{ k: "member", l: "Member", c: fUsers.length }, { k: "staff", l: "Staff", c: fStaff.length }] as const).map(t => (
            <button key={t.k} type="button" onClick={() => switchTab(t.k as TabType)}
              style={{ padding: "6px 18px", borderRadius: 7, border: "none", fontFamily: font, fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all .13s", background: tab === t.k ? C.white : "transparent", color: tab === t.k ? C.tx1 : C.tx3, boxShadow: tab === t.k ? C.shadow : "none", display: "flex", alignItems: "center", gap: 7 }}>
              {t.l}<span style={{ padding: "1px 7px", borderRadius: 99, fontSize: 11, fontWeight: 700, background: tab === t.k ? C.blueL : C.border2, color: tab === t.k ? C.blue : C.tx3 }}>{t.c}</span>
            </button>
          ))}
        </div>
        {hasSelection ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10, background: C.blueL, border: `1px solid rgba(67,97,238,.25)`, padding: "6px 12px 6px 16px", borderRadius: 10, animation: "gcFadeIn .2s ease" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.blue }}>{selectedCount} dipilih</span>
            <div style={{ width: 1, height: 16, background: "rgba(67,97,238,.2)" }} />
            <GcBtn variant="ghost" onClick={() => setShowBatchEdit(true)} style={{ height: 32, background: C.white, borderColor: "rgba(67,97,238,.3)", color: C.blue }}>✏️ Edit Sekaligus</GcBtn>
            <GcBtn variant="danger" onClick={handleBatchDelete} disabled={batchDeleting} style={{ height: 32, padding: "0 14px" }}>{batchDeleting ? "Menghapus…" : "🗑 Hapus"}</GcBtn>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 8, height: 40, padding: "0 13px", minWidth: 240, background: C.white, border: `1.5px solid ${sfFocus ? C.blue : C.border}`, borderRadius: 10, boxShadow: sfFocus ? "0 0 0 3px rgba(67,97,238,.1)" : "none", transition: "all .14s" }}>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke={C.tx3} strokeWidth={2.2}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input style={{ flex: 1, border: "none", background: "transparent", outline: "none", fontFamily: font, fontSize: 13.5, color: C.tx1 }} placeholder={`Cari ${tab === "member" ? "member" : "staff"}…`} value={search} onChange={e => setSearch(e.target.value)} onFocus={() => setSFocus(true)} onBlur={() => setSFocus(false)} />
            {search && <button type="button" onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", color: C.tx3, fontSize: 16, lineHeight: 1 }}>×</button>}
          </div>
        )}
      </div>

      {tab === "member" && !hasSelection && <div style={{ marginBottom: 14 }}><TierFilter value={tierF} onChange={v => { setTierF(v); setSelectedUsers(new Set()); }} /></div>}

      {/* Member Table */}
      {tab === "member" && (
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 18, boxShadow: C.shadow, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: font }}>
            <thead><tr style={{ background: "#F8F9FC" }}>
              <th style={{ padding: "11px 20px", textAlign: "left", borderBottom: `1px solid ${C.border2}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <input ref={headCheckRef} type="checkbox" checked={isAllSelected} onChange={handleSelectAll} style={{ width: 16, height: 16, cursor: "pointer", accentColor: C.blue }} />
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: C.tx3 }}>Member</span>
                </div>
              </th>
              {["Email","Tier","Poin","Lifetime","Role","Aksi"].map(h => <th key={h} style={{ padding: "11px 20px", textAlign: "left", fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: C.tx3, borderBottom: `1px solid ${C.border2}` }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {fUsers.length === 0 ? <EmptyState query={search} type="member" /> : fUsers.map((u, i) => <UserRow key={u.uid} u={u} isLast={i === fUsers.length - 1} checked={selectedUsers.has(u.uid)} onCheck={v => toggleUser(u.uid, v)} onDetail={() => setDetailUser(u)} onEdit={() => setEditUser(u)} />)}
            </tbody>
          </table>
        </div>
      )}

      {/* Staff Table */}
      {tab === "staff" && (
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 18, boxShadow: C.shadow, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: font }}>
            <thead><tr style={{ background: "#F8F9FC" }}>
              <th style={{ padding: "11px 20px", textAlign: "left", borderBottom: `1px solid ${C.border2}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <input ref={headCheckRef} type="checkbox" checked={isAllSelected} onChange={handleSelectAll} style={{ width: 16, height: 16, cursor: "pointer", accentColor: C.blue }} />
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: C.tx3 }}>Staff</span>
                </div>
              </th>
              {["Email","Role","Outlet","Status","Aksi"].map(h => <th key={h} style={{ padding: "11px 20px", textAlign: "left", fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: C.tx3, borderBottom: `1px solid ${C.border2}` }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {fStaff.length === 0 ? <EmptyState query={search} type="staff" /> : fStaff.map((s, i) => <StaffRow key={s.uid} s={s} isLast={i === fStaff.length - 1} checked={selectedStaff.has(s.uid)} onCheck={v => toggleStaff(s.uid, v)} onEdit={() => setEditStaff(s)} />)}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      {showBatchEdit && <BatchEditModal type={tab} count={selectedCount} storeIds={storeIds} onClose={() => setShowBatchEdit(false)} onSaved={handleBatchEditSave} />}
      {detailUser && !editUser && (
        <MemberDetailModal
          user={detailUser}
          onClose={() => setDetailUser(null)}
          onEdit={() => { setEditUser(detailUser); setDetailUser(null); }}
          onDeleted={uid => setUsers(p => p.filter(u => u.uid !== uid))}
          toast={toast} confirm={confirm}
        />
      )}
      {editUser && (
        <EditMemberModal
          user={editUser}
          onClose={() => setEditUser(null)}
          onSaved={patch => setUsers(p => p.map(u => u.uid === editUser.uid ? { ...u, ...patch } : u))}
          toast={(msg, type) => toast(msg, type as any)}
          confirm={(msg, onYes) => confirm({ title: 'Konfirmasi', description: msg, onConfirm: onYes })}
        />
      )}
      {editStaff && <EditStaffModal staff={editStaff} storeIds={storeIds} onClose={() => setEditStaff(null)} onSaved={patch => setStaff(p => p.map(s => s.uid === editStaff.uid ? { ...s, ...patch } : s))} toast={toast} />}
      {showCreate && <CreateModal storeIds={storeIds} onClose={() => setShowCreate(false)} toast={toast} />}

      {confirmDialog}
      <ToastContainer toasts={toasts} dismiss={dismiss} />
    </div>
  );
}