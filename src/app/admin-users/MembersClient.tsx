"use client";

import React, { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { User, UserTier, UserRole, userConverter, AdminUser, AdminRole, adminUserConverter } from "@/types/firestore";
import {
  collection, onSnapshot, query, orderBy, limit, startAfter, getDocs, where, getCountFromServer,
  QueryDocumentSnapshot, DocumentData, doc, getDoc
} from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { useAuth } from "@/context/AuthContext";
import { GcModalShell, GcPage, GcPageHeader, GcPanel } from "@/components/ui/gc";
import {
  createAccountAction,
  updateAccountAction,
  deleteAccountAction,
  updatePointsAction
} from "@/actions/userStaffActions";

import InjectVoucherModalForMember from "./InjectVoucherModalForMember";

// ── Types ─────────────────────────────────────────────────────────────────────
type UserWithUid  = User  & { uid: string };
type StaffWithUid = AdminUser & { uid: string };

function normalizeStoreAccess(s: StaffWithUid): { storeLocations: string[]; accessAllStores: boolean } {
  if (s.role === "SUPER_ADMIN") return { storeLocations: [], accessAllStores: true };
  return { storeLocations: s.assignedStoreId ? [s.assignedStoreId] : [], accessAllStores: false };
}

type TabType    = "member" | "staff";
type ToastType  = "success" | "error" | "info";
type SyncStatus = "connecting" | "live" | "error";

interface Toast { id: string; type: ToastType; message: string; }
interface ConfirmOptions {
  title: string; description: string; confirmLabel?: string;
  danger?: boolean; onConfirm: () => void | Promise<void>;
}

const PAGE_SIZE = 20;

// ── Configuration & Design System ─────────────────────────────────────────────
const C = {
  bg: "#F4F6FB", white: "#FFFFFF", border: "#EAECF2", border2: "#F0F2F7",
  tx1: "#0F1117", tx2: "#4A5065", tx3: "#9299B0", tx4: "#BCC1D3",
  blue: "#3B82F6", blueL: "#EFF6FF", blueD: "#2563EB",
  green: "#12B76A", greenBg: "#ECFDF3",
  amber: "#F79009", amberBg: "#FFFAEB",
  red: "#C8102E", redBg: "#FEF3F2",
  purple: "#7C3AED", purpleBg: "#F5F3FF",
  shadow: "0 1px 3px rgba(16,24,40,.06), 0 1px 2px rgba(16,24,40,.04)",
  shadowLg: "0 20px 60px rgba(16,24,40,.18), 0 4px 12px rgba(16,24,40,.08)",
} as const;

const font = "Inter, system-ui, sans-serif";

const TIER_CFG: Record<string, { bg: string; color: string; ring: string }> = {
  Platinum: { bg: "#F5F3FF", color: "#5B21B6", ring: "#DDD6FE" },
  Gold:     { bg: "#FFFBEB", color: "#92400E", ring: "#FDE68A" },
  Silver:   { bg: "#F8FAFC", color: "#475569", ring: "#E2E8F0" },
};

const STAFF_CFG: Record<AdminRole, { bg: string; color: string; label: string; code: string }> = {
  SUPER_ADMIN: { bg: C.redBg,   color: C.red,    label: "Super Admin", code: "ROOT" },
  STAFF:       { bg: C.blueL,   color: C.blueD,  label: "Staff",       code: "STF"  },
  admin:       { bg: C.redBg,   color: C.red,    label: "Admin",       code: "ADM"  },
  master:      { bg: C.redBg,   color: C.red,    label: "Master",      code: "MST"  },
  manager:     { bg: C.greenBg, color: "#027A48", label: "Manager",    code: "MGR"  },
};

const TIER_OPTIONS = ["All", "Silver", "Gold", "Platinum"] as const;

const GLOBAL_CSS = `
  @keyframes gcFadeIn  { from{opacity:0} to{opacity:1} }
  @keyframes gcRise    { from{opacity:0;transform:translateY(18px) scale(.97)} to{opacity:1;transform:none} }
  @keyframes gcSlideUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:none} }
  @keyframes gcShake   { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-4px)} 75%{transform:translateX(4px)} }
  @keyframes spin      { to{transform:rotate(360deg)} }
  @keyframes pulse     { 0%,100%{opacity:1} 50%{opacity:.25} }
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:${font}}
  ::-webkit-scrollbar{width:6px;height:6px}
  ::-webkit-scrollbar-track{background:transparent}
  ::-webkit-scrollbar-thumb{background:${C.border};border-radius:99px}
  .gc-table-wrap::-webkit-scrollbar{height:6px}
  .gc-table-wrap::-webkit-scrollbar-thumb{background:${C.border};border-radius:10px}
`;

function GlobalStyle() { return <style dangerouslySetInnerHTML={{ __html: GLOBAL_CSS }} />; }

// ── UI Primitives ─────────────────────────────────────────────────────────────
export function FL({ children }: { children: React.ReactNode }) {
  return (
    <label style={{ display: "block", marginBottom: 6, fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: C.tx3 }}>
      {children}
    </label>
  );
}

function Avatar({ name, src, size = 36 }: { name?: string; src?: string; size?: number }) {
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        style={{ width: size, height: size, borderRadius: size < 40 ? 10 : 14, objectFit: "cover", flexShrink: 0 }}
      />
    );
  }
  const char = (name ?? "?")[0].toUpperCase();
  const code = (name ?? "A").charCodeAt(0);
  const g = [["#3B82F6","#2563EB"],["#7C3AED","#3B82F6"],["#059669","#0D9488"],["#D97706","#B45309"],["#DC2626","#B91C1C"]];
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
  const currentBorderColor = f ? C.blue : (hasError ? "#F04438" : C.border);
  return (
    <input
      {...p}
      onFocus={e => { setF(true); p.onFocus?.(e); }}
      onBlur={e  => { setF(false); p.onBlur?.(e);  }}
      style={{
        width: "100%", height: 42, borderRadius: 9, outline: "none",
        border: `1.5px solid ${currentBorderColor}`,
        background: f ? C.white : C.bg,
        boxShadow: f ? "0 0 0 3px rgba(67,97,238,.1)" : "none",
        padding: "0 13px", fontFamily: font, fontSize: 13.5, color: C.tx1,
        transition: "all .14s", ...style,
      }}
    />
  );
}

function GcSelect({ style, ...p }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const [f, setF] = useState(false);
  return (
    <select
      {...p}
      onFocus={e => { setF(true); p.onFocus?.(e); }}
      onBlur={e  => { setF(false); p.onBlur?.(e);  }}
      style={{
        width: "100%", height: 42, borderRadius: 9, outline: "none",
        border: `1.5px solid ${f ? C.blue : C.border}`,
        background: f ? C.white : C.bg,
        boxShadow: f ? "0 0 0 3px rgba(67,97,238,.1)" : "none",
        padding: "0 13px", fontFamily: font, fontSize: 13.5, color: C.tx1,
        appearance: "none", cursor: "pointer", transition: "all .14s", ...style,
      }}
    />
  );
}

type BtnVariant = "ghost" | "primary" | "blue" | "danger";
function GcBtn({ variant = "ghost", children, disabled, onClick, style, fw, loading }: {
  variant?: BtnVariant; children: React.ReactNode; disabled?: boolean;
  onClick?: () => void; style?: React.CSSProperties; fw?: boolean; loading?: boolean;
}) {
  const [h, setH] = useState(false);
  const v: Record<BtnVariant, React.CSSProperties> = {
    ghost:   { background: h ? C.bg : C.white, color: C.tx2, border: `1.5px solid ${C.border}` },
    primary: { background: h ? "#0D0F16" : C.tx1, color: "#fff", transform: h ? "translateY(-1px)" : undefined, boxShadow: h ? "0 4px 14px rgba(0,0,0,.2)" : "none" },
    blue:    { background: `linear-gradient(135deg,${C.blue},${C.blueD})`, color: "#fff", boxShadow: h ? "0 6px 20px rgba(67,97,238,.35)" : "0 2px 8px rgba(67,97,238,.2)", transform: h ? "translateY(-1px)" : undefined },
    danger:  { background: h ? "#A30F25" : C.red, color: "#fff", boxShadow: h ? "0 6px 20px rgba(200,16,46,.3)" : "0 2px 8px rgba(200,16,46,.15)", transform: h ? "translateY(-1px)" : undefined },
  };
  return (
    <button
      type="button"
      onClick={disabled || loading ? undefined : onClick}
      onMouseOver={() => setH(true)}
      onMouseOut={() => setH(false)}
      style={{
        height: 40, padding: "0 20px", borderRadius: 9, fontFamily: font, fontSize: 13.5,
        fontWeight: 600, cursor: disabled || loading ? "not-allowed" : "pointer",
        border: "none", display: "inline-flex", alignItems: "center", gap: 7,
        transition: "all .15s", opacity: disabled || loading ? .55 : 1,
        width: fw ? "100%" : undefined, justifyContent: fw ? "center" : undefined,
        ...v[variant], ...style,
      }}
    >
      {loading
        ? <div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", animation: "spin 0.8s linear infinite" }} />
        : children
      }
    </button>
  );
}

function ActionBtn({ onClick, label, danger }: { onClick: (e: React.MouseEvent) => void; label: string; danger?: boolean }) {
  const [h, setH] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseOver={() => setH(true)}
      onMouseOut={() => setH(false)}
      style={{
        height: 32, padding: "0 14px", borderRadius: 8, fontFamily: font, fontSize: 12.5,
        fontWeight: 600, cursor: "pointer", transition: "all .13s",
        border: `1.5px solid ${h ? (danger ? C.red : C.blue) : C.border}`,
        background: h ? (danger ? C.redBg : C.blueL) : C.white,
        color: h ? (danger ? C.red : C.blue) : C.tx2,
        display: "inline-flex", alignItems: "center",
      }}
    >
      {label}
    </button>
  );
}

function SyncBadge({ status }: { status: SyncStatus }) {
  const cfg = {
    connecting: { color: C.amber, label: "Connecting…" },
    live:       { color: C.green, label: "Live"          },
    error:      { color: C.red,   label: "Error"         },
  }[status];

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, color: cfg.color }}>
      <span style={{
        width: 7, height: 7, borderRadius: "50%", background: cfg.color,
        boxShadow: status === "live" ? "0 0 0 3px rgba(18,183,106,.2)" : "none",
        animation: status === "connecting" ? "pulse .9s infinite" : "none",
      }} />
      {cfg.label}
    </span>
  );
}

// ── Modal Frame ───────────────────────────────────────────────────────────────
function ModalFrame({ children, onClose, maxW = 520, eyebrow, title, description, footer }: any) {
  return (
    <GcModalShell onClose={onClose} eyebrow={eyebrow} title={title} description={description} maxWidth={maxW} footer={footer}>
      {children}
    </GcModalShell>
  );
}

function SL({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: C.tx3, marginBottom: 14, paddingBottom: 10, borderBottom: `1px solid ${C.border2}` }}>
      {children}
    </p>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div style={{ marginTop: 14, padding: "10px 14px", background: C.redBg, border: "1px solid #FECDD3", borderRadius: 9, fontSize: 12.5, color: "#B42318", animation: "gcShake .3s ease" }}>
      {message}
    </div>
  );
}

function EmptyState({ query, type }: { query: string; type: TabType }) {
  return (
    <tr>
      <td colSpan={8} style={{ padding: "56px 0", textAlign: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <div style={{ width: 52, height: 52, borderRadius: 16, background: C.bg, border: `1.5px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>
            {query ? "🔍" : "👥"}
          </div>
          <p style={{ fontSize: 14, fontWeight: 700, color: C.tx1 }}>{query ? "No results found" : `No ${type === "member" ? "members" : "staff"} yet`}</p>
          <p style={{ fontSize: 12.5, color: C.tx3 }}>{query ? `No accounts match "${query}"` : "Add an account to get started"}</p>
        </div>
      </td>
    </tr>
  );
}

// ── Hooks ─────────────────────────────────────────────────────────────────────
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
  const ICONS: Record<ToastType, string>  = { success: "✓", error: "✕", info: "i" };
  const COLORS: Record<ToastType, { bg: string; icon: string; border: string }> = {
    success: { bg: C.greenBg, icon: "#027A48", border: "#A7F3D0" },
    error:   { bg: C.redBg,   icon: C.red,     border: "#FECDD3"  },
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

function ConfirmDialog({ opts, onCancel }: { opts: ConfirmOptions; onCancel: () => void }) {
  const [loading, setLoading] = useState(false);
  async function handleConfirm() { setLoading(true); await opts.onConfirm(); setLoading(false); }
  return (
    <ModalFrame
      onClose={() => !loading && onCancel()}
      maxW={400}
      eyebrow={opts.danger ? "Danger Zone" : "Confirmation"}
      title={opts.title}
      description={opts.description}
      footer={
        <>
          <GcBtn variant="ghost" onClick={onCancel} disabled={loading}>Batal</GcBtn>
          <GcBtn variant={opts.danger ? "danger" : "blue"} onClick={handleConfirm} disabled={loading} loading={loading}>
            {opts.confirmLabel ?? "Konfirmasi"}
          </GcBtn>
        </>
      }
    >
      {opts.danger && (
        <div style={{ width: 44, height: 44, borderRadius: 12, background: C.redBg, border: `1px solid #FECDD3`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.red} strokeWidth={2.2} strokeLinecap="round">
            <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
          </svg>
        </div>
      )}
      <div style={{ paddingTop: 2, fontSize: 13, color: C.tx3 }}>Pastikan aksi ini memang sudah final.</div>
    </ModalFrame>
  );
}

function useConfirm() {
  const [confirmOpts, setConfirmOpts] = useState<ConfirmOptions | null>(null);
  const confirm = useCallback((opts: ConfirmOptions) => setConfirmOpts(opts), []);
  const cancel  = useCallback(() => setConfirmOpts(null), []);
  const dialog  = confirmOpts
    ? <ConfirmDialog
        opts={{ ...confirmOpts, onConfirm: async () => { await confirmOpts.onConfirm(); setConfirmOpts(null); } }}
        onCancel={cancel}
      />
    : null;
  return { confirm, dialog };
}

// ── Modals ────────────────────────────────────────────────────────────────────
function EditPointsModal({ user, onClose, onSaved, toast, confirm }: any) {
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
      title: "Confirm Points Edit",
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
          setError(e.message ?? "Failed to save points.");
        } finally { setLoading(false); }
      },
    });
  }

  return (
    <ModalFrame
      onClose={onClose}
      maxW={460}
      eyebrow="Edit Points"
      title={user.name}
      footer={
        <>
          <GcBtn variant="ghost" onClick={onClose} disabled={loading}>Batal</GcBtn>
          <GcBtn variant="blue" onClick={handleSave} disabled={!isValid} loading={loading}>Simpan Perubahan</GcBtn>
        </>
      }
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 22 }}>
        <div style={{ padding: "12px", background: C.bg, borderRadius: 10 }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: C.tx3, textTransform: "uppercase" }}>Poin Sekarang</p>
          <p style={{ fontSize: 20, fontWeight: 800, color: C.blue }}>{(user.currentPoints ?? 0).toLocaleString("id")}</p>
        </div>
        <div style={{ padding: "12px", background: C.bg, borderRadius: 10 }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: C.tx3, textTransform: "uppercase" }}>XP Sekarang</p>
          <p style={{ fontSize: 20, fontWeight: 800, color: C.purple }}>{(user.lifetimePoints ?? 0).toLocaleString("id")}</p>
        </div>
      </div>
      <SL>Nilai Baru</SL>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <FL>Poin Aktif</FL>
          <GcInput type="number" min="0" value={points} onChange={(e: any) => setPoints(e.target.value)} hasError={!isNaN(pointsNum) && pointsNum < 0} />
        </div>
        <div>
          <FL>Lifetime XP</FL>
          <GcInput type="number" min="0" value={lifetime} onChange={(e: any) => setLifetime(e.target.value)} hasError={!isNaN(lifetimeNum) && lifetimeNum < pointsNum} />
        </div>
      </div>
      {error && <ErrorBox message={error} />}
    </ModalFrame>
  );
}

function MemberDetailModal({ user, onClose, onEdit, onDeleted, toast, confirm }: any) {
  const tier = TIER_CFG[user.tier] ?? TIER_CFG.Silver;
  const [localUser, setLocalUser] = useState(user);
  const [showEditPoints, setShowEditPoints] = useState(false);
  const [showPhotoPreview, setShowPhotoPreview] = useState(false);

  function handleDelete() {
    confirm({
      title: "Delete Member Account",
      description: `Account "${localUser.name}" will be permanently deleted. Points and vouchers cannot be restored.`,
      confirmLabel: "Delete Account",
      danger: true,
      onConfirm: async () => {
        await deleteAccountAction(localUser.uid, "users");
        toast(`Akun ${localUser.name} berhasil dihapus.`, "success");
        onDeleted(localUser.uid);
        onClose();
      },
    });
  }

  return (
    <>
      <ModalFrame
        onClose={onClose}
        maxW={540}
        eyebrow="Detail Member"
        title={localUser.name}
        footer={
          <>
            <GcBtn onClick={onClose}>Tutup</GcBtn>
            <GcBtn variant="blue" onClick={onEdit}>Edit Member</GcBtn>
            <GcBtn variant="danger" onClick={handleDelete}>Delete</GcBtn>
          </>
        }
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px", background: C.bg, borderRadius: 14, marginBottom: 20 }}>
          <div onClick={() => localUser.photoURL && setShowPhotoPreview(true)} style={{ cursor: localUser.photoURL ? "pointer" : "default" }}>
            <Avatar name={localUser.name} src={localUser.photoURL} size={52} />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 16, fontWeight: 700 }}>{localUser.name}</p>
            <p style={{ fontSize: 12.5, color: C.tx3 }}>{localUser.email || "No Email"}</p>
            <p style={{ fontSize: 12.5, color: C.tx3 }}>{localUser.phoneNumber || "No Phone"}</p>
            <p style={{ fontSize: 12, color: C.tx3, marginTop: 4 }}>
              <b>Join Date:</b> {localUser.joinedDate ? new Date(localUser.joinedDate).toLocaleDateString() : "—"}
            </p>
          </div>
          <span style={{ padding: "5px 12px", borderRadius: 99, fontSize: 11, fontWeight: 700, background: tier.bg, color: tier.color }}>
            {localUser.tier}
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 20 }}>
          {[
            { l: "Poin Aktif",   v: (localUser.currentPoints  ?? 0).toLocaleString("id"), c: C.blue   },
            { l: "Lifetime XP",  v: (localUser.lifetimePoints ?? 0).toLocaleString("id"), c: C.purple },
            { l: "Voucher",      v: localUser.vouchers?.length ?? 0,                       c: C.green  },
          ].map(s => (
            <div key={s.l} style={{ textAlign: "center", padding: "14px 10px", background: C.bg, borderRadius: 12 }}>
              <p style={{ fontSize: 18, fontWeight: 800, color: s.c, lineHeight: 1, marginBottom: 5 }}>{s.v}</p>
              <p style={{ fontSize: 10.5, color: C.tx3, fontWeight: 600, textTransform: "uppercase" }}>{s.l}</p>
            </div>
          ))}
        </div>

        <button
          onClick={() => setShowEditPoints(true)}
          style={{ width: "100%", height: 34, borderRadius: 8, border: `1.5px dashed ${C.blue}`, background: C.blueL, color: C.blue, fontSize: 12.5, fontWeight: 600, cursor: "pointer", marginBottom: 20 }}
        >
          Edit Points & XP
        </button>

        <SL>Voucher Member</SL>
        <div style={{ maxHeight: 180, overflowY: "auto", border: `1px solid ${C.border}`, borderRadius: 10 }}>
          {localUser.vouchers?.length > 0
            ? localUser.vouchers.map((v: any, idx: number) => (
                <div key={idx} style={{ padding: "10px", borderBottom: `1px solid ${C.border2}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700 }}>{v.title}</p>
                    <code style={{ fontSize: 11, color: C.tx3 }}>{v.code}</code>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: v.isUsed ? C.tx4 : C.green }}>
                    {v.isUsed ? "USED" : "ACTIVE"}
                  </span>
                </div>
              ))
            : <p style={{ padding: "20px", textAlign: "center", fontSize: 12, color: C.tx3 }}>No vouchers.</p>
          }
        </div>

        {showPhotoPreview && (
          <div
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}
            onClick={() => setShowPhotoPreview(false)}
          >
            <img src={localUser.photoURL} style={{ maxWidth: "90%", maxHeight: "90%", borderRadius: 20 }} />
          </div>
        )}
      </ModalFrame>

      {showEditPoints && (
        <EditPointsModal
          user={localUser}
          onClose={() => setShowEditPoints(false)}
          onSaved={(patch: any) => setLocalUser({ ...localUser, ...patch })}
          toast={toast}
          confirm={confirm}
        />
      )}
    </>
  );
}

function EditMemberModal({ user, onClose, onSaved, toast }: any) {
  const [showInject, setShowInject] = useState(false);
  const [form, setForm] = useState({ name: user.name, email: user.email || "", phoneNumber: user.phoneNumber || "", tier: user.tier, role: user.role || "member" });
  const [loading, setLoading] = useState(false);

  async function save() {
    setLoading(true);
    try {
      await updateAccountAction(user.uid, form, "users");
      toast("Berhasil update member", "success");
      onSaved(); onClose();
    } catch (e: any) {
      toast(e.message, "error");
    } finally { setLoading(false); }
  }

  return (
    <>
      <ModalFrame
        onClose={onClose}
        title="Edit Member"
        eyebrow="Account Settings"
        footer={
          <>
            <GcBtn onClick={onClose}>Batal</GcBtn>
            <GcBtn variant="blue" onClick={save} loading={loading}>Simpan</GcBtn>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div><FL>Nama</FL><GcInput value={form.name} onChange={(e: any) => setForm({ ...form, name: e.target.value })} /></div>
          <div><FL>Email</FL><GcInput value={form.email} onChange={(e: any) => setForm({ ...form, email: e.target.value })} /></div>
          <div>
            <FL>Tier</FL>
            <GcSelect value={form.tier} onChange={(e: any) => setForm({ ...form, tier: e.target.value })}>
              <option>Silver</option>
              <option>Gold</option>
              <option>Platinum</option>
            </GcSelect>
          </div>
          <GcBtn variant="primary" onClick={() => setShowInject(true)} fw>+ Suntik Voucher Manual</GcBtn>
        </div>
      </ModalFrame>
      {showInject && (
        <InjectVoucherModalForMember
          uid={user.uid}
          onClose={() => setShowInject(false)}
          onSuccess={(m: string) => toast(m, "success")}
        />
      )}
    </>
  );
}

function EditStaffModal({ staff, storeIds, onClose, onSaved, toast }: any) {
  const normalized = normalizeStoreAccess(staff);
  const [form, setForm] = useState({
    name: staff.name,
    role: staff.role,
    assignedStoreId: normalized.storeLocations[0] || "",
    isActive: staff.isActive ?? true,
  });
  const [loading, setLoading] = useState(false);

  async function save() {
    setLoading(true);
    try {
      await updateAccountAction(staff.uid, form, "admin_users");
      toast("Berhasil update staff", "success");
      onSaved(); onClose();
    } catch (e: any) {
      toast(e.message, "error");
    } finally { setLoading(false); }
  }

  return (
    <ModalFrame
      onClose={onClose}
      title="Edit Staff"
      footer={
        <>
          <GcBtn onClick={onClose}>Batal</GcBtn>
          <GcBtn variant="blue" onClick={save} loading={loading}>Simpan</GcBtn>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div><FL>Nama</FL><GcInput value={form.name} onChange={(e: any) => setForm({ ...form, name: e.target.value })} /></div>
        <div>
          <FL>Role</FL>
          <GcSelect value={form.role} onChange={(e: any) => setForm({ ...form, role: e.target.value })}>
            <option value="STAFF">Staff</option>
            <option value="SUPER_ADMIN">Super Admin</option>
          </GcSelect>
        </div>
        <StoreAccessPicker
          storeIds={storeIds}
          selected={form.assignedStoreId ? [form.assignedStoreId] : []}
          accessAll={form.role === "SUPER_ADMIN"}
          onChangeSelected={(v: string[]) => setForm({ ...form, assignedStoreId: v[0] ?? "" })}
          onChangeAccessAll={() => {}}
          singleSelect
        />
      </div>
    </ModalFrame>
  );
}

function BatchEditModal({ type, count, onClose, onSaved }: any) {
  const [tierChange,   setTierChange]   = useState("");
  const [statusChange, setStatusChange] = useState<boolean | undefined>(undefined);
  const [loading,      setLoading]      = useState(false);

  async function save() {
    setLoading(true);
    const payload: any = {};
    if (tierChange) payload.tier = tierChange;
    if (statusChange !== undefined) payload.isActive = statusChange;
    try { await onSaved(payload); onClose(); } catch (e: any) { console.error(e); } finally { setLoading(false); }
  }

  return (
    <ModalFrame
      onClose={onClose}
      title={`Edit ${count} Akun`}
      footer={
        <>
          <GcBtn onClick={onClose}>Batal</GcBtn>
          <GcBtn variant="blue" onClick={save} loading={loading}>Terapkan</GcBtn>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {type === "member" && (
          <div>
            <FL>Ubah Tier</FL>
            <GcSelect value={tierChange} onChange={(e: any) => setTierChange(e.target.value)}>
              <option value="">Pilih Tier</option>
              <option>Silver</option>
              <option>Gold</option>
              <option>Platinum</option>
            </GcSelect>
          </div>
        )}
        <div>
          <FL>Ubah Status Aktif</FL>
          <GcSelect onChange={(e: any) => setStatusChange(e.target.value === "true" ? true : e.target.value === "false" ? false : undefined)}>
            <option value="">Pilih Status</option>
            <option value="true">Aktif</option>
            <option value="false">Nonaktif</option>
          </GcSelect>
        </div>
      </div>
    </ModalFrame>
  );
}

// ── Type Akun Selector (tab pill di dalam modal) ──────────────────────────────
function AccountTypePill({ value, onChange }: { value: "member" | "staff"; onChange: (v: "member" | "staff") => void }) {
  return (
    <div style={{ display: "flex", background: C.bg, borderRadius: 10, padding: 3, border: `1.5px solid ${C.border}`, marginBottom: 4 }}>
      {(["member", "staff"] as const).map(t => (
        <button
          key={t}
          type="button"
          onClick={() => onChange(t)}
          style={{
            flex: 1, height: 36, borderRadius: 8, border: "none", cursor: "pointer",
            fontFamily: font, fontSize: 13, fontWeight: 700, transition: "all .15s",
            background: value === t ? C.white : "transparent",
            color: value === t ? C.tx1 : C.tx3,
            boxShadow: value === t ? C.shadow : "none",
          }}
        >
          {t === "member" ? "👤  Member" : "🛡️  Staff"}
        </button>
      ))}
    </div>
  );
}

function CreateModal({ onClose, toast, onCreated }: any) {
  const [accountType, setAccountType] = useState<"member" | "staff">("member");

  // Shared fields
  const [name,     setName]     = useState("");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);

  // Member-only fields
  const [tier,        setTier]        = useState<"Silver" | "Gold" | "Platinum">("Silver");
  const [phoneNumber, setPhoneNumber] = useState("");

  // Staff-only fields — only STAFF and SUPER_ADMIN
  const [role,            setRole]            = useState<"STAFF" | "SUPER_ADMIN">("STAFF");
  const [assignedStoreId, setAssignedStoreId] = useState("");
  const [isActive,        setIsActive]        = useState(true);

  // Realtime store list from Firestore
  const [stores,       setStores]       = useState<{ id: string; name: string }[]>([]);
  const [storesLoading, setStoresLoading] = useState(true);

  useEffect(() => {
    // Listen to "stores" collection in realtime
    const unsub = onSnapshot(
      query(collection(db, "stores"), orderBy("name")),
      snap => {
        setStores(snap.docs.map(d => ({ id: d.id, name: (d.data().name as string) ?? d.id })));
        setStoresLoading(false);
      },
      err => { console.error("stores listener:", err); setStoresLoading(false); },
    );
    return () => unsub();
  }, []);

  // Reset store selection when role changes to SUPER_ADMIN
  useEffect(() => {
    if (role === "SUPER_ADMIN") setAssignedStoreId("");
  }, [role]);

  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  // Validation
  const staffStoreRequired = accountType === "staff" && role === "STAFF" && assignedStoreId === "";
  const isValid =
    name.trim() !== "" &&
    email.trim() !== "" &&
    password.length >= 6 &&
    !staffStoreRequired;

  async function create() {
    if (!isValid) return;
    setLoading(true);
    setError("");
    try {
      const payload = accountType === "member"
        ? { name: name.trim(), email: email.trim(), password, tier, phoneNumber: phoneNumber.trim(), role: "member" }
        : { name: name.trim(), email: email.trim(), password, role, assignedStoreId: role === "SUPER_ADMIN" ? "" : assignedStoreId, isActive };

      await createAccountAction(payload, accountType);
      toast(`${accountType === "member" ? "Member" : "Staff"} account created successfully.`, "success");
      onCreated?.();
      onClose();
    } catch (e: any) {
      setError(e.message ?? "Failed to create account.");
    } finally {
      setLoading(false);
    }
  }

  // Selected store label helper
  const selectedStore = stores.find(s => s.id === assignedStoreId);

  return (
    <ModalFrame
      onClose={onClose}
      maxW={500}
      eyebrow="User Management"
      title="Create New Account"
      description="Fill in the details below for the account type you want to create."
      footer={
        <>
          <GcBtn variant="ghost" onClick={onClose} disabled={loading}>Cancel</GcBtn>
          <GcBtn variant="blue" onClick={create} disabled={!isValid} loading={loading}>
            Create {accountType === "member" ? "Member" : "Staff"} Account
          </GcBtn>
        </>
      }
    >
      {/* Account Type Switcher */}
      <div style={{ marginBottom: 20 }}>
        <FL>Account Type</FL>
        <AccountTypePill value={accountType} onChange={v => { setAccountType(v); setError(""); }} />
      </div>

      {/* ── Shared Fields ── */}
      <SL>Basic Information</SL>
      <div style={{ display: "flex", flexDirection: "column", gap: 13, marginBottom: 20 }}>
        <div>
          <FL>Full Name <span style={{ color: C.red }}>*</span></FL>
          <GcInput
            placeholder="e.g. John Doe"
            value={name}
            onChange={(e: any) => setName(e.target.value)}
            hasError={name.trim() === "" && name !== ""}
          />
        </div>
        <div>
          <FL>Email Address <span style={{ color: C.red }}>*</span></FL>
          <GcInput
            type="email"
            placeholder="user@example.com"
            value={email}
            onChange={(e: any) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <FL>Password <span style={{ color: C.red }}>*</span></FL>
          <div style={{ position: "relative" }}>
            <GcInput
              type={showPass ? "text" : "password"}
              placeholder="Min. 6 characters"
              value={password}
              onChange={(e: any) => setPassword(e.target.value)}
              hasError={password.length > 0 && password.length < 6}
              style={{ paddingRight: 80 }}
            />
            <button
              type="button"
              onClick={() => setShowPass(p => !p)}
              style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: C.tx3, fontSize: 12, fontWeight: 600, fontFamily: font }}
            >
              {showPass ? "Hide" : "Show"}
            </button>
          </div>
          {password.length > 0 && password.length < 6 && (
            <p style={{ fontSize: 11, color: C.red, marginTop: 4 }}>Password must be at least 6 characters.</p>
          )}
        </div>
      </div>

      {/* ── Member Fields ── */}
      {accountType === "member" && (
        <>
          <SL>Member Details</SL>
          <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <FL>Starting Tier</FL>
                <GcSelect value={tier} onChange={(e: any) => setTier(e.target.value)}>
                  <option value="Silver">Silver</option>
                  <option value="Gold">Gold</option>
                  <option value="Platinum">Platinum</option>
                </GcSelect>
              </div>
              <div>
                <FL>Phone Number</FL>
                <GcInput
                  type="tel"
                  placeholder="+62 8xx xxxx xxxx"
                  value={phoneNumber}
                  onChange={(e: any) => setPhoneNumber(e.target.value)}
                />
              </div>
            </div>
            {/* Tier preview */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: TIER_CFG[tier]?.bg, borderRadius: 10, border: `1px solid ${TIER_CFG[tier]?.ring}` }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: TIER_CFG[tier]?.color }}>
                {tier === "Silver" ? "🥈" : tier === "Gold" ? "🥇" : "💎"} {tier} Tier
              </span>
              <span style={{ fontSize: 11, color: TIER_CFG[tier]?.color, opacity: .7 }}>
                · Starting points: 0 · Lifetime XP: 0
              </span>
            </div>
          </div>
        </>
      )}

      {/* ── Staff Fields ── */}
      {accountType === "staff" && (
        <>
          <SL>Staff Details</SL>
          <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <FL>Role</FL>
                <GcSelect value={role} onChange={(e: any) => setRole(e.target.value)}>
                  <option value="STAFF">Staff</option>
                  <option value="SUPER_ADMIN">Super Admin</option>
                </GcSelect>
              </div>
              <div>
                <FL>Account Status</FL>
                <GcSelect value={String(isActive)} onChange={(e: any) => setIsActive(e.target.value === "true")}>
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </GcSelect>
              </div>
            </div>

            {/* Store assignment — only for STAFF role */}
            {role === "STAFF" ? (
              <div>
                <FL>
                  Assigned Store <span style={{ color: C.red }}>*</span>
                  {storesLoading && <span style={{ color: C.tx4, fontWeight: 400, marginLeft: 6, fontSize: 10 }}>Loading…</span>}
                </FL>
                <GcSelect
                  value={assignedStoreId}
                  onChange={(e: any) => setAssignedStoreId(e.target.value)}
                  disabled={storesLoading}
                  style={{ opacity: storesLoading ? .6 : 1 }}
                >
                  <option value="">— Select a Store —</option>
                  {stores.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </GcSelect>
                {!storesLoading && stores.length === 0 && (
                  <p style={{ fontSize: 11, color: C.amber, marginTop: 4 }}>No stores found in the database.</p>
                )}
                {staffStoreRequired && assignedStoreId === "" && name !== "" && (
                  <p style={{ fontSize: 11, color: C.red, marginTop: 4 }}>Please assign a store for this staff member.</p>
                )}
              </div>
            ) : (
              /* SUPER_ADMIN banner */
              <div style={{ padding: "12px 14px", background: C.redBg, borderRadius: 10, border: `1px solid #FECDD3`, display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span style={{ fontSize: 18, lineHeight: 1, marginTop: 1 }}>⚠️</span>
                <div>
                  <p style={{ fontSize: 12.5, fontWeight: 700, color: C.red, marginBottom: 3 }}>Super Admin — Full Access</p>
                  <p style={{ fontSize: 11.5, color: C.tx2, lineHeight: 1.5 }}>
                    This account will have unrestricted access to all stores and system features. Assign with caution.
                  </p>
                </div>
              </div>
            )}

            {/* Role badge preview */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: STAFF_CFG[role]?.bg ?? C.bg, borderRadius: 10 }}>
              <span style={{ padding: "3px 9px", borderRadius: 99, fontSize: 10, fontWeight: 700, background: STAFF_CFG[role]?.bg, color: STAFF_CFG[role]?.color }}>
                {STAFF_CFG[role]?.code ?? "—"}
              </span>
              <span style={{ fontSize: 12, color: C.tx2 }}>{STAFF_CFG[role]?.label}</span>
              {role === "STAFF" && selectedStore && (
                <span style={{ fontSize: 11, color: C.tx3 }}>· {selectedStore.name}</span>
              )}
            </div>
          </div>
        </>
      )}

      {error && <ErrorBox message={error} />}
    </ModalFrame>
  );
}

// ── Rows ──────────────────────────────────────────────────────────────────────
function UserRow({ u, isLast, onDetail, onEdit, checked, onCheck }: any) {
  const tier = TIER_CFG[u.tier] ?? TIER_CFG.Silver;
  return (
    <tr onClick={onDetail} style={{ borderBottom: isLast ? "none" : `1px solid ${C.border2}`, cursor: "pointer" }}>
      <td style={{ padding: "14px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <input
            type="checkbox"
            checked={checked}
            onChange={e => onCheck(e.target.checked)}
            onClick={e => e.stopPropagation()}
            style={{ width: 16, height: 16, cursor: "pointer" }}
          />
          <Avatar name={u.name} src={u.photoURL} size={36} />
          <div>
            <p style={{ fontSize: 13.5, fontWeight: 700 }}>{u.name}</p>
            <code style={{ fontSize: 10, color: C.tx3 }}>{u.uid.slice(0, 8)}…</code>
          </div>
        </div>
      </td>
      <td style={{ padding: "14px 20px", fontSize: 13, color: C.tx2 }}>{u.email || "—"}</td>
      <td style={{ padding: "14px 20px" }}>
        <span style={{ padding: "4px 11px", borderRadius: 99, fontSize: 11, fontWeight: 700, background: tier.bg, color: tier.color, border: `1.5px solid ${tier.ring}` }}>
          {u.tier}
        </span>
      </td>
      <td style={{ padding: "14px 20px", fontSize: 14, fontWeight: 800, color: C.blue }}>{(u.currentPoints ?? 0).toLocaleString("id")}</td>
      <td style={{ padding: "14px 20px", fontSize: 13, color: C.tx2 }}>{(u.lifetimePoints ?? 0).toLocaleString("id")}</td>
      <td style={{ padding: "14px 20px", fontSize: 12.5, color: C.tx2 }}>{u.role}</td>
      <td style={{ padding: "14px 20px" }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", gap: 6 }}>
          <ActionBtn onClick={() => onDetail()} label="Detail" />
          <ActionBtn onClick={() => onEdit()}   label="Edit"   />
        </div>
      </td>
    </tr>
  );
}

function StaffRow({ s, isLast, onEdit, checked, onCheck, canManageStaff }: any) {
  const r = STAFF_CFG[s.role as AdminRole] ?? STAFF_CFG.STAFF;
  return (
    <tr style={{ borderBottom: isLast ? "none" : `1px solid ${C.border2}` }}>
      <td style={{ padding: "14px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <input type="checkbox" checked={checked} onChange={e => onCheck(e.target.checked)} style={{ width: 16, height: 16 }} />
          <Avatar name={s.name} size={36} />
          <p style={{ fontSize: 13.5, fontWeight: 700 }}>{s.name}</p>
        </div>
      </td>
      <td style={{ padding: "14px 20px", fontSize: 13 }}>{s.email}</td>
      <td style={{ padding: "14px 20px" }}>
        <span style={{ padding: "3px 9px", borderRadius: 99, fontSize: 10, fontWeight: 700, background: r.bg, color: r.color }}>
          {r.code}
        </span>
      </td>
      <td style={{ padding: "14px 20px", fontSize: 12.5 }}>{s.assignedStoreId || "SEMUA TOKO"}</td>
      <td style={{ padding: "14px 20px", fontSize: 12.5 }}>{s.isActive ? "Aktif" : "Nonaktif"}</td>
      <td style={{ padding: "14px 20px" }}>
        {canManageStaff && <ActionBtn onClick={() => onEdit()} label="Edit" />}
      </td>
    </tr>
  );
}

function StoreAccessPicker({ storeIds, selected, accessAll, onChangeSelected, singleSelect }: any) {
  return (
    <div style={{ marginTop: 10 }}>
      <FL>Akses Toko</FL>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {accessAll
          ? <span style={{ color: C.tx3 }}>Akses Semua Toko Aktif</span>
          : storeIds.map((id: string) => (
              <button
                key={id}
                type="button"
                onClick={() => onChangeSelected(selected.includes(id) ? [] : [id])}
                style={{
                  padding: "6px 12px", borderRadius: 8,
                  border: `1px solid ${selected.includes(id) ? C.blue : C.border}`,
                  background: selected.includes(id) ? C.blueL : C.white,
                  cursor: "pointer",
                }}
              >
                {id}
              </button>
            ))
        }
      </div>
    </div>
  );
}

// ── Main Page Component ───────────────────────────────────────────────────────
export default function MembersClient({ storeIds = [] }: { storeIds?: string[] }) {
  const { user: authUser } = useAuth();
  const router = useRouter();
  const canManageStaff = authUser?.role === "SUPER_ADMIN";

  // --- States ---
  const [users,      setUsers]      = useState<UserWithUid[]>([]);
  const [staff,      setStaff]      = useState<StaffWithUid[]>([]);
  const [usersSync,  setUsersSync]  = useState<SyncStatus>("connecting");
  const [staffSync,  setStaffSync]  = useState<SyncStatus>("connecting");

  // Pagination
  const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore,     setHasMore]     = useState(true);
  const [loading,     setLoading]     = useState(false);

  // Statistics
  const [stats, setStats] = useState({ total: 0, platinum: 0, gold: 0, silver: 0, activeStaff: 0 });

  // Filters & Sorting
  const [tab,       setTab]       = useState<TabType>("member");
  const [search,    setSearch]    = useState("");
  const [sortBy,    setSortBy]    = useState("newest");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [tierF,     setTierF]     = useState<"All" | "Silver" | "Gold" | "Platinum">("All");

  // Selection & Modals
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [selectedStaff, setSelectedStaff] = useState<Set<string>>(new Set());
  const [detailUser,    setDetailUser]    = useState<UserWithUid | null>(null);
  const [editUser,      setEditUser]      = useState<UserWithUid | null>(null);
  const [editStaff,     setEditStaff]     = useState<StaffWithUid | null>(null);
  const [showCreate,    setShowCreate]    = useState(false);
  const [showBatchEdit, setShowBatchEdit] = useState(false);

  const { toasts, show: toast, dismiss } = useToast();
  const { confirm, dialog: confirmDialog } = useConfirm();

  // ── Helpers ──────────────────────────────────────────────────────────────
  // "newest" pakai createdAt desc — tapi TIDAK boleh dikombinasikan dengan
  // where() lain (butuh composite index Firestore).
  // Kalau ada filter aktif (tier/search), otomatis fallback ke "name asc"
  // supaya tidak error, dan UI menampilkan peringatan ringan.
  function resolveSort(sort: string, order: "asc" | "desc", hasFilter: boolean): { field: string; dir: "asc" | "desc" } {
    if (sort === "newest") {
      // Jika ada filter aktif, Firestore tidak bisa combine orderBy(createdAt) + where(tier/name)
      // tanpa composite index — fallback ke name
      if (hasFilter) return { field: "name", dir: "asc" };
      return { field: "createdAt", dir: "desc" };
    }
    if (sort === "largestPoints") return { field: "currentPoints", dir: order };
    if (sort === "tier")          return { field: "tier",          dir: order };
    return { field: "name", dir: order };
  }

  // ── Stats (aggregate, cheap) ──────────────────────────────────────────────
  const fetchStats = useCallback(async () => {
    try {
      const coll = collection(db, "users");
      const [t, p, g, s] = await Promise.all([
        getCountFromServer(coll),
        getCountFromServer(query(coll, where("tier", "==", "Platinum"))),
        getCountFromServer(query(coll, where("tier", "==", "Gold"))),
        getCountFromServer(query(coll, where("tier", "==", "Silver"))),
      ]);
      setStats(prev => ({
        ...prev,
        total:    t.data().count,
        platinum: p.data().count,
        gold:     g.data().count,
        silver:   s.data().count,
      }));
    } catch (e) { console.error(e); }
  }, []);

  // ── Load Users (paginated, manual fetch) ─────────────────────────────────
  // Aturan Firestore query ordering:
  //  1. equality where() dulu (tier == x)
  //  2. range where() (name >= s, name <= s+) — HARUS diikuti orderBy("name")
  //  3. Kalau sort "newest" (orderBy createdAt) + ada filter aktif → butuh
  //     composite index. Daripada paksa user buat index, kita fallback ke
  //     orderBy("name") otomatis saat ada filter, dan tampilkan hint di UI.
  const loadUsers = useCallback(async (reset = false) => {
    if (!reset && (loading || !hasMore)) return;
    setLoading(true);
    setUsersSync("connecting");

    try {
      const hasFilter = search.trim() !== "" || tierF !== "All";
      const { field: orderField, dir: orderDir } = resolveSort(sortBy, sortOrder, hasFilter);

      const constraints: Parameters<typeof query>[1][] = [];

      // equality filter dulu (Firestore requirement)
      if (tierF !== "All") {
        constraints.push(where("tier", "==", tierF));
      }

      // range filter — wajib diikuti orderBy field yg sama
      if (search.trim()) {
        const s = search.trim();
        constraints.push(where("name", ">=", s), where("name", "<=", s + "\uf8ff"));
        // orderField sudah "name" karena hasFilter=true di resolveSort
      }

      constraints.push(orderBy(orderField, orderDir));
      constraints.push(limit(PAGE_SIZE));

      if (!reset && lastVisible) {
        constraints.push(startAfter(lastVisible));
      }

      const q    = query(collection(db, "users").withConverter(userConverter), ...constraints);
      const snap = await getDocs(q);
      const newUsers = snap.docs.map(d => ({ ...d.data(), uid: d.id } as UserWithUid));

      setLastVisible(snap.docs[snap.docs.length - 1] ?? null);
      setHasMore(snap.docs.length === PAGE_SIZE);
      setUsers(prev => reset ? newUsers : [...prev, ...newUsers]);
      setUsersSync("live");
    } catch (e) {
      console.error("loadUsers error:", e);
      setUsersSync("error");
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, tierF, sortBy, sortOrder]);
  // lastVisible sengaja tidak masuk deps — hanya dipakai saat "load more" (reset=false).

  // ── Effects ───────────────────────────────────────────────────────────────
  // Auth guard
  useEffect(() => {
    if (!canManageStaff) router.replace("/dashboard");
  }, [canManageStaff, router]);

  // Re-fetch members when filters / sort change
  useEffect(() => {
    if (!canManageStaff) return;
    setLastVisible(null);
    setHasMore(true);
    loadUsers(true);
    fetchStats();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, tierF, sortBy, sortOrder]);

  // Staff realtime listener (small collection — onSnapshot is fine)
  useEffect(() => {
    if (!canManageStaff) return;
    const unsubStaff = onSnapshot(
      query(collection(db, "admin_users").withConverter(adminUserConverter), orderBy("name")),
      snap => {
        setStaff(snap.docs.map(d => d.data() as StaffWithUid));
        setStats(p => ({ ...p, activeStaff: snap.docs.filter(d => (d.data() as any).isActive).length }));
        setStaffSync("live");
      },
      () => setStaffSync("error"),
    );
    return () => unsubStaff();
  }, [canManageStaff]);

  // ── Selection helpers ─────────────────────────────────────────────────────
  const selectedCount = tab === "member" ? selectedUsers.size : selectedStaff.size;
  function toggleUser (uid: string, v: boolean) { setSelectedUsers(p => { const n = new Set(p); v ? n.add(uid) : n.delete(uid); return n; }); }
  function toggleStaff(uid: string, v: boolean) { setSelectedStaff(p => { const n = new Set(p); v ? n.add(uid) : n.delete(uid); return n; }); }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <GcPage style={{ background: C.bg }}>
      <GlobalStyle />
      <GcPageHeader
        title="User Management"
        description="View, manage, and edit all user and staff accounts."
        actions={
          <div style={{ display: "flex", gap: 10 }}>
            <SyncBadge status={tab === "member" ? usersSync : staffSync} />
            <GcBtn variant="blue" onClick={() => setShowCreate(true)}>Add Account</GcBtn>
          </div>
        }
      />

      {/* Stats Block */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
        {[
          { l: "Total Members", v: stats.total,       c: C.blue,    b: C.blueL     },
          { l: "Platinum",      v: stats.platinum,    c: C.purple,  b: C.purpleBg  },
          { l: "Gold",          v: stats.gold,        c: "#92400E", b: "#FFFBEB"   },
          { l: "Silver",        v: stats.silver,      c: "#475569", b: "#F8FAFC"   },
          { l: "Active Staff",  v: stats.activeStaff, c: C.green,   b: C.greenBg   },
        ].map(s => (
          <GcPanel key={s.l} style={{ flex: 1, minWidth: 0, padding: "16px 20px", display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 42, height: 42, borderRadius: 11, background: s.b, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 20, fontWeight: 800, color: s.c }}>{s.v}</span>
            </div>
            <p style={{ fontSize: 12, fontWeight: 600, color: C.tx3 }}>{s.l}</p>
          </GcPanel>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, gap: 10, flexWrap: "wrap" }}>
        {/* Tab switcher */}
        <div style={{ display: "flex", background: C.white, borderRadius: 10, padding: 3, border: `1.5px solid ${C.border}` }}>
          {(["member", "staff"] as TabType[]).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              style={{ padding: "6px 18px", borderRadius: 7, border: "none", background: tab === t ? C.bg : "none", fontWeight: 600, cursor: "pointer", fontFamily: font, fontSize: 13.5, color: C.tx1 }}
            >
              {t === "member" ? "Members" : "Staff"}
            </button>
          ))}
        </div>

        {/* Member filters */}
        {tab === "member" && (
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <GcSelect value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ width: 160 }}>
              <option value="tier">Tier</option>
              <option value="largestPoints">Largest Points</option>
              <option value="name">Name (A-Z)</option>
            </GcSelect>
            <GcSelect value={sortOrder} onChange={e => setSortOrder(e.target.value as "asc" | "desc")} style={{ width: 130 }}>
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </GcSelect>
            <GcSelect value={tierF} onChange={e => setTierF(e.target.value as any)} style={{ width: 140 }}>
              {TIER_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
            </GcSelect>
            <input
              style={{ width: 300, height: 42, borderRadius: 10, border: `1px solid ${C.border}`, padding: "0 12px", fontFamily: font, fontSize: 13.5, outline: "none" }}
              placeholder="Search member name..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {selectedCount > 0 && (
              <GcBtn variant="blue" onClick={() => setShowBatchEdit(true)}>
                Batch Edit ({selectedCount})
              </GcBtn>
            )}
          </div>
        )}

        {/* Staff filters */}
        {tab === "staff" && (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              style={{ width: 300, height: 42, borderRadius: 10, border: `1px solid ${C.border}`, padding: "0 12px", fontFamily: font, fontSize: 13.5, outline: "none" }}
              placeholder="Search staff name..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {selectedCount > 0 && (
              <GcBtn variant="blue" onClick={() => setShowBatchEdit(true)}>
                Batch Edit ({selectedCount})
              </GcBtn>
            )}
          </div>
        )}
      </div>

      {/* Table */}
      <GcPanel style={{ borderRadius: 18, overflow: "hidden" }}>
        <div className="gc-table-wrap" style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
            <thead>
              {tab === "member" ? (
                <tr style={{ background: "#F8F9FC", borderBottom: `1px solid ${C.border2}`, fontSize: 11, color: C.tx3, textAlign: "left" }}>
                  <th style={{ padding: "12px 20px" }}>IDENTITY</th>
                  <th style={{ padding: "12px 20px" }}>EMAIL</th>
                  <th style={{ padding: "12px 20px" }}>TIER</th>
                  <th style={{ padding: "12px 20px" }}>ACTIVE POINTS</th>
                  <th style={{ padding: "12px 20px" }}>LIFETIME XP</th>
                  <th style={{ padding: "12px 20px" }}>ROLE</th>
                  <th style={{ padding: "12px 20px" }}>ACTIONS</th>
                </tr>
              ) : (
                <tr style={{ background: "#F8F9FC", borderBottom: `1px solid ${C.border2}`, fontSize: 11, color: C.tx3, textAlign: "left" }}>
                  <th style={{ padding: "12px 20px" }}>IDENTITY</th>
                  <th style={{ padding: "12px 20px" }}>EMAIL</th>
                  <th style={{ padding: "12px 20px" }}>ROLE CODE</th>
                  <th style={{ padding: "12px 20px" }}>STORE ACCESS</th>
                  <th style={{ padding: "12px 20px" }}>STATUS</th>
                  <th style={{ padding: "12px 20px" }}>ACTIONS</th>
                </tr>
              )}
            </thead>
            <tbody>
              {tab === "member"
                ? users.length === 0
                  ? <EmptyState query={search} type="member" />
                  : users.map((u, i) => (
                      <UserRow
                        key={u.uid}
                        u={u}
                        isLast={i === users.length - 1}
                        checked={selectedUsers.has(u.uid)}
                        onCheck={(v: boolean) => toggleUser(u.uid, v)}
                        onDetail={() => setDetailUser(u)}
                        onEdit={() => setEditUser(u)}
                      />
                    ))
                : staff.length === 0
                  ? <EmptyState query={search} type="staff" />
                  : staff.map((s, i) => (
                      <StaffRow
                        key={s.uid}
                        s={s}
                        isLast={i === staff.length - 1}
                        checked={selectedStaff.has(s.uid)}
                        onCheck={(v: boolean) => toggleStaff(s.uid, v)}
                        onEdit={() => setEditStaff(s)}
                        canManageStaff={canManageStaff}
                      />
                    ))
              }
            </tbody>
          </table>
        </div>

        {/* Load More */}
        {tab === "member" && hasMore && (
          <div style={{ padding: "20px", textAlign: "center", borderTop: `1px solid ${C.border2}` }}>
            <GcBtn onClick={() => loadUsers(false)} loading={loading}>Load More Members</GcBtn>
          </div>
        )}
      </GcPanel>

      {/* Modals */}
      {showCreate    && <CreateModal    storeIds={storeIds} onClose={() => setShowCreate(false)} toast={toast} onCreated={() => { loadUsers(true); fetchStats(); }} />}
      {showBatchEdit && (
        <BatchEditModal
          type={tab}
          count={selectedCount}
          onClose={() => setShowBatchEdit(false)}
          onSaved={async (p: any) => {
            const ids = Array.from(tab === "member" ? selectedUsers : selectedStaff);
            const col = tab === "member" ? "users" : "admin_users";
            await Promise.all(ids.map(id => updateAccountAction(id, p, col)));
            toast("Batch Update Berhasil", "success");
            if (tab === "member") {
              setSelectedUsers(new Set());
              loadUsers(true);
            } else {
              setSelectedStaff(new Set());
            }
          }}
        />
      )}
      {detailUser && (
        <MemberDetailModal
          user={detailUser}
          onClose={() => setDetailUser(null)}
          onEdit={() => { setEditUser(detailUser); setDetailUser(null); }}
          onDeleted={() => { setDetailUser(null); loadUsers(true); fetchStats(); }}
          toast={toast}
          confirm={confirm}
        />
      )}
      {editUser  && <EditMemberModal user={editUser}  onClose={() => setEditUser(null)}  onSaved={() => loadUsers(true)} toast={toast} />}
      {editStaff && <EditStaffModal  staff={editStaff} storeIds={storeIds} onClose={() => setEditStaff(null)} onSaved={() => {}} toast={toast} />}

      {confirmDialog}
      <ToastContainer toasts={toasts} dismiss={dismiss} />
    </GcPage>
  );
}