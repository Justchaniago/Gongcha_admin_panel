"use client";

import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import {
  collection, onSnapshot, query, orderBy, where,
  getDocs, limit, startAfter, getCountFromServer,
  QueryDocumentSnapshot, DocumentData,
} from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { useAuth } from "@/context/AuthContext";
import { useMobileSidebar } from "@/components/layout/AdminShell";
import {
  createAccountAction, updateAccountAction,
  deleteAccountAction, updatePointsAction,
} from "@/actions/userStaffActions";
import { userConverter, adminUserConverter } from "@/types/firestore";
import { motion, AnimatePresence } from "framer-motion";
import {
  Menu as MenuIcon, Search, X, Plus, ChevronRight,
  Users, Shield, Edit3, Trash2, AlertCircle,
  CheckCircle2, XCircle, Star, Zap, Award,
  MoreHorizontal, RefreshCw, Activity,
  ArrowUpDown,
} from "lucide-react";
import BentoRow, { BentoCard } from "@/components/ui/BentoRow";
import InjectVoucherModalForMember from "./InjectVoucherModalForMember";

// ── TYPES ──
type UserWithUid  = any;
type StaffWithUid = any;
type TabId        = "member" | "staff";
type TierFilter   = "All" | "Silver" | "Gold" | "Platinum";
type SortField    = "name" | "largestPoints" | "tier";
type SortOrder    = "asc" | "desc";

// ── DESIGN TOKENS — identical across all mobile pages ──
const T = {
  bg:      "#F4F5F7",
  surface: "#FFFFFF",
  navy2:   "#1C2333",
  blue:    "#3B82F6",
  blueL:   "#EFF6FF",
  blueD:   "#1D4ED8",
  amber:   "#D97706",
  amberL:  "#FFFBEB",
  amberB:  "#FDE68A",
  red:     "#DC2626",
  redL:    "#FEF2F2",
  redB:    "#FECACA",
  green:   "#059669",
  greenL:  "#ECFDF5",
  greenB:  "#6EE7B7",
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

const TIER_CFG: Record<string, { bg: string; color: string; border: string }> = {
  Platinum: { bg: T.purpleL, color: "#5B21B6", border: T.purpleB },
  Gold:     { bg: "#FFFBEB", color: "#92400E", border: "#FDE68A" },
  Silver:   { bg: "#F8FAFC", color: "#475569", border: "#E2E8F0" },
};

// ── Sort config ──
const SORT_OPTIONS: { field: SortField; label: string; supportsOrder: boolean }[] = [
  { field: "name",          label: "Nama (A-Z)",    supportsOrder: true  },
  { field: "largestPoints", label: "Poin Terbesar", supportsOrder: true  },
  { field: "tier",          label: "Tier",          supportsOrder: true  },
];

const PAGE_SIZE = 20;

// ── AVATAR ──
function Avatar({ name, src, size = 40 }: { name?: string; src?: string; size?: number }) {
  if (src) return <img src={src} alt={name} style={{ width: size, height: size, borderRadius: size / 2.5, objectFit: "cover", flexShrink: 0 }} />;
  const char = (name ?? "?")[0].toUpperCase();
  const code = (name ?? "A").charCodeAt(0);
  const grads = [["#3B82F6","#2563EB"],["#7C3AED","#3B82F6"],["#059669","#0D9488"],["#D97706","#B45309"],["#DC2626","#B91C1C"]];
  const [a, b] = grads[code % grads.length];
  return (
    <div style={{ width: size, height: size, borderRadius: size / 2.5, background: `linear-gradient(135deg,${a},${b})`, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: size * 0.38 }}>
      {char}
    </div>
  );
}

// ── SHARED SYMMETRIC HEADER ──
const PageHeader = ({ left, title, subtitle, right }: { left: React.ReactNode; title: string; subtitle?: React.ReactNode; right: React.ReactNode }) => (
  <div style={{ flexShrink: 0, background: T.surface, borderBottom: `1px solid ${T.border}`, padding: "48px 16px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", zIndex: 30 }}>
    <div style={{ width: 36, flexShrink: 0 }}>{left}</div>
    <div style={{ flex: 1, textAlign: "center", padding: "0 8px" }}>
      <p style={{ fontSize: 14, fontWeight: 800, color: T.tx1, letterSpacing: "-.01em", lineHeight: 1 }}>{title}</p>
      {subtitle && <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5, marginTop: 4 }}>{subtitle}</div>}
    </div>
    <div style={{ flexShrink: 0, display: "flex", justifyContent: "flex-end" }}>{right}</div>
  </div>
);

// ── BOTTOM SHEET ──
const BottomSheet = ({ isOpen, onClose, children, title, fullHeight }: { isOpen: boolean; onClose: () => void; children: React.ReactNode; title: string; fullHeight?: boolean }) => (
  <AnimatePresence>
    {isOpen && (
      <>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.32)", backdropFilter: "blur(4px)", zIndex: 9998 }}
        />
        <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 28, stiffness: 300 }}
          style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: T.surface, borderRadius: "24px 24px 0 0", padding: "20px 20px 48px", zIndex: 9999, maxHeight: fullHeight ? "92dvh" : "88dvh", overflowY: "auto", display: "flex", flexDirection: "column" }}
        >
          <div style={{ width: 36, height: 4, background: T.border2, borderRadius: 10, margin: "0 auto 16px", flexShrink: 0 }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexShrink: 0 }}>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: T.tx1 }}>{title}</h2>
            <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 99, background: T.bg, border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              <X size={14} color={T.tx3} />
            </button>
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>{children}</div>
        </motion.div>
      </>
    )}
  </AnimatePresence>
);

// ── SORT SHEET ──
function SortSheet({ sortBy, sortOrder, onApply, onClose }: {
  sortBy: SortField;
  sortOrder: SortOrder;
  onApply: (field: SortField, order: SortOrder) => void;
  onClose: () => void;
}) {
  const [localField, setLocalField] = useState<SortField>(sortBy);
  const [localOrder, setLocalOrder] = useState<SortOrder>(sortOrder);
  const selected = SORT_OPTIONS.find(o => o.field === localField);
  const showOrder = selected?.supportsOrder ?? false;

  return (
    <div>
      <p style={{ fontSize: 9, fontWeight: 800, color: T.tx4, textTransform: "uppercase" as const, letterSpacing: ".14em", marginBottom: 10 }}>
        Urutkan berdasarkan
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 20 }}>
        {SORT_OPTIONS.map(opt => {
          const active = localField === opt.field;
          return (
            <button key={opt.field} onClick={() => setLocalField(opt.field)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "13px 14px", borderRadius: 12,
                border: `1.5px solid ${active ? T.blue : T.border2}`,
                background: active ? T.blueL : T.surface, cursor: "pointer", textAlign: "left" as const,
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 700, color: active ? T.blueD : T.tx1 }}>{opt.label}</span>
              {active && (
                <div style={{ width: 18, height: 18, borderRadius: "50%", background: T.blue, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                    <path d="M1 4l3 3 5-6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {showOrder && (
        <>
          <p style={{ fontSize: 9, fontWeight: 800, color: T.tx4, textTransform: "uppercase" as const, letterSpacing: ".14em", marginBottom: 10 }}>
            Arah urutan
          </p>
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            {([["asc", "Naik ↑"], ["desc", "Turun ↓"]] as [SortOrder, string][]).map(([val, label]) => {
              const active = localOrder === val;
              return (
                <button key={val} onClick={() => setLocalOrder(val)}
                  style={{
                    flex: 1, padding: "11px 0", borderRadius: 12,
                    border: `1.5px solid ${active ? T.blue : T.border2}`,
                    background: active ? T.blueL : T.surface,
                    fontSize: 13, fontWeight: 700, color: active ? T.blueD : T.tx2, cursor: "pointer",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </>
      )}

      <button
        onClick={() => { onApply(localField, localOrder); onClose(); }}
        style={{ width: "100%", padding: 15, background: T.navy2, color: "#fff", border: "none", borderRadius: 14, fontWeight: 800, fontSize: 14, cursor: "pointer" }}
      >
        Terapkan
      </button>
    </div>
  );
}

// ── FIELD ──
const Field = ({ label, required, ...props }: { label: string; required?: boolean; [k: string]: any }) => (
  <div style={{ marginBottom: 14 }}>
    <label style={{ display: "block", fontSize: 9, fontWeight: 800, color: T.tx4, textTransform: "uppercase" as const, letterSpacing: ".14em", marginBottom: 6 }}>
      {label}{required && <span style={{ color: T.red }}> *</span>}
    </label>
    <input style={{ width: "100%", background: T.bg, border: `1px solid ${T.border2}`, borderRadius: 12, padding: "12px 14px", fontSize: 14, color: T.tx1, outline: "none", boxSizing: "border-box" as const }} {...props} />
  </div>
);

// ── TOAST ──
const MToast = ({ msg, type, onDone }: { msg: string; type: "success" | "error"; onDone: () => void }) => {
  useEffect(() => { const t = setTimeout(onDone, 3500); return () => clearTimeout(t); }, [onDone]);
  return (
    <motion.div initial={{ opacity: 0, y: 16, scale: .96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8 }}
      style={{ position: "fixed", bottom: 100, left: "50%", transform: "translateX(-50%)", zIndex: 9999, padding: "12px 18px", borderRadius: 14, background: type === "success" ? T.navy2 : T.red, color: "#fff", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 8, boxShadow: "0 8px 24px rgba(0,0,0,.24)", whiteSpace: "nowrap" as const }}
    >
      {type === "success" ? <CheckCircle2 size={14} strokeWidth={2.5} /> : <AlertCircle size={14} strokeWidth={2.5} />}
      {msg}
    </motion.div>
  );
};

// ── CONFIRM SHEET ──
const ConfirmSheet = ({ title, message, confirmLabel, danger, onConfirm, onClose, loading }: { title: string; message: string; confirmLabel: string; danger?: boolean; onConfirm: () => void; onClose: () => void; loading: boolean }) => (
  <AnimatePresence>
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: "fixed", inset: 0, zIndex: 10998, background: "rgba(0,0,0,.4)", backdropFilter: "blur(4px)" }}
      onClick={() => !loading && onClose()} />
    <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 360, damping: 36 }}
      style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 10999, background: T.surface, borderRadius: "24px 24px 0 0", padding: "16px 20px 48px" }}
    >
      <div style={{ width: 36, height: 4, borderRadius: 99, background: T.border2, margin: "0 auto 20px" }} />
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: danger ? T.redL : T.greenL, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {danger ? <AlertCircle size={18} color={T.red} strokeWidth={2} /> : <CheckCircle2 size={18} color={T.green} strokeWidth={2} />}
        </div>
        <div>
          <p style={{ fontSize: 15, fontWeight: 800, color: T.tx1, marginBottom: 4 }}>{title}</p>
          <p style={{ fontSize: 13, color: T.tx3, lineHeight: 1.5 }}>{message}</p>
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
        <button onClick={onClose} disabled={loading} style={{ flex: 1, padding: 14, borderRadius: 14, border: `1px solid ${T.border2}`, background: "transparent", fontSize: 13, fontWeight: 700, color: T.tx2, cursor: "pointer" }}>Cancel</button>
        <button onClick={onConfirm} disabled={loading} style={{ flex: 2, padding: 14, borderRadius: 14, border: "none", background: danger ? T.red : T.green, fontSize: 13, fontWeight: 800, color: "#fff", cursor: loading ? "default" : "pointer", opacity: loading ? .7 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          {loading && <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: .9, ease: "linear" }}><Activity size={14} color="#fff" /></motion.div>}
          {loading ? "Processing…" : confirmLabel}
        </button>
      </div>
    </motion.div>
  </AnimatePresence>
);

// ── TIER BADGE ──
const TierBadge = ({ tier }: { tier: string }) => {
  const cfg = TIER_CFG[tier] ?? TIER_CFG.Silver;
  const emoji = tier === "Platinum" ? "💎" : tier === "Gold" ? "🥇" : "🥈";
  return (
    <span style={{ fontSize: 9, fontWeight: 800, padding: "3px 9px", borderRadius: 99, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
      {emoji} {tier}
    </span>
  );
};

// ── MEMBER DETAIL SHEET ──
function MemberDetailSheet({ user, onClose, onEdit, onDeleted, showToast }: { user: UserWithUid; onClose: () => void; onEdit: () => void; onDeleted: (uid: string) => void; showToast: (m: string, t: "success" | "error") => void }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [localUser, setLocalUser]         = useState(user);
  const [editPoints, setEditPoints]       = useState(false);
  const [newPoints,  setNewPoints]        = useState(String(user.currentPoints ?? 0));
  const [newXP,      setNewXP]            = useState(String(user.lifetimePoints ?? 0));
  const [ptLoading,  setPtLoading]        = useState(false);

  const handleDelete = async () => {
    setDeleteLoading(true);
    try {
      await deleteAccountAction(localUser.uid, "users");
      showToast(`${localUser.name} deleted.`, "success");
      onDeleted(localUser.uid);
      onClose();
    } catch (e: any) { showToast(e.message, "error"); }
    finally { setDeleteLoading(false); setConfirmDelete(false); }
  };

  const handleSavePoints = async () => {
    const pts = parseInt(newPoints, 10);
    const xp  = parseInt(newXP, 10);
    if (isNaN(pts) || isNaN(xp) || pts < 0 || xp < 0) return;
    setPtLoading(true);
    try {
      await updatePointsAction(localUser.uid, pts, xp);
      setLocalUser({ ...localUser, currentPoints: pts, lifetimePoints: xp });
      showToast("Points updated!", "success");
      setEditPoints(false);
    } catch (e: any) { showToast(e.message, "error"); }
    finally { setPtLoading(false); }
  };

  return (
    <>
      <div>
        {/* Hero */}
        <div style={{ display: "flex", gap: 14, marginBottom: 20, alignItems: "center" }}>
          <Avatar name={localUser.name} src={localUser.photoURL} size={56} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 16, fontWeight: 800, color: T.tx1, marginBottom: 4 }}>{localUser.name}</p>
            <p style={{ fontSize: 12, color: T.tx3, marginBottom: 6 }}>{localUser.email || "No email"}</p>
            <TierBadge tier={localUser.tier} />
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
          {[
            { l: "Active Pts",  v: (localUser.currentPoints  ?? 0).toLocaleString("id"), c: T.blue,   b: T.blueL   },
            { l: "Lifetime XP", v: (localUser.lifetimePoints ?? 0).toLocaleString("id"), c: T.purple, b: T.purpleL },
            { l: "Vouchers",    v: localUser.vouchers?.length ?? 0,                       c: T.green,  b: T.greenL  },
          ].map(s => (
            <div key={s.l} style={{ textAlign: "center", padding: "12px 8px", background: s.b, borderRadius: 12 }}>
              <p style={{ fontSize: 16, fontWeight: 900, color: s.c, lineHeight: 1, marginBottom: 4 }}>{s.v}</p>
              <p style={{ fontSize: 9, fontWeight: 700, color: s.c, opacity: .6, textTransform: "uppercase" as const, letterSpacing: ".1em" }}>{s.l}</p>
            </div>
          ))}
        </div>

        {/* Edit points toggle */}
        {!editPoints ? (
          <button onClick={() => setEditPoints(true)}
            style={{ width: "100%", padding: "10px", borderRadius: 12, border: `1.5px dashed ${T.blue}`, background: T.blueL, color: T.blueD, fontSize: 12, fontWeight: 700, cursor: "pointer", marginBottom: 14 }}
          >
            ✏️ Edit Points & XP
          </button>
        ) : (
          <div style={{ background: T.bg, borderRadius: 12, padding: "14px", marginBottom: 14, border: `1px solid ${T.border2}` }}>
            <p style={{ fontSize: 9, fontWeight: 800, color: T.tx4, textTransform: "uppercase" as const, letterSpacing: ".14em", marginBottom: 12 }}>Edit Points & XP</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: T.tx4, marginBottom: 4 }}>Active Points</label>
                <input type="number" min="0" value={newPoints} onChange={e => setNewPoints(e.target.value)}
                  style={{ width: "100%", background: T.surface, border: `1px solid ${T.border2}`, borderRadius: 10, padding: "10px 12px", fontSize: 14, color: T.tx1, outline: "none", boxSizing: "border-box" as const }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: T.tx4, marginBottom: 4 }}>Lifetime XP</label>
                <input type="number" min="0" value={newXP} onChange={e => setNewXP(e.target.value)}
                  style={{ width: "100%", background: T.surface, border: `1px solid ${T.border2}`, borderRadius: 10, padding: "10px 12px", fontSize: 14, color: T.tx1, outline: "none", boxSizing: "border-box" as const }}
                />
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setEditPoints(false)} style={{ flex: 1, padding: 10, borderRadius: 10, border: `1px solid ${T.border2}`, background: "transparent", fontSize: 12, fontWeight: 700, color: T.tx3, cursor: "pointer" }}>Cancel</button>
              <button onClick={handleSavePoints} disabled={ptLoading}
                style={{ flex: 2, padding: 10, borderRadius: 10, border: "none", background: T.blue, fontSize: 12, fontWeight: 800, color: "#fff", cursor: "pointer", opacity: ptLoading ? .7 : 1 }}
              >
                {ptLoading ? "Saving…" : "Save Points"}
              </button>
            </div>
          </div>
        )}

        {/* Phone & join date */}
        {(localUser.phoneNumber || localUser.joinedDate) && (
          <div style={{ background: T.bg, borderRadius: 12, padding: "12px 14px", marginBottom: 14 }}>
            {localUser.phoneNumber && (
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: localUser.joinedDate ? 8 : 0 }}>
                <span style={{ fontSize: 11, color: T.tx4, fontWeight: 700 }}>Phone</span>
                <span style={{ fontSize: 12, color: T.tx1, fontWeight: 600 }}>{localUser.phoneNumber}</span>
              </div>
            )}
            {localUser.joinedDate && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 11, color: T.tx4, fontWeight: 700 }}>Joined</span>
                <span style={{ fontSize: 12, color: T.tx1, fontWeight: 600 }}>{new Date(localUser.joinedDate).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</span>
              </div>
            )}
          </div>
        )}

        {/* Vouchers */}
        {localUser.vouchers?.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <p style={{ fontSize: 9, fontWeight: 800, color: T.tx4, textTransform: "uppercase" as const, letterSpacing: ".14em", marginBottom: 8 }}>Vouchers</p>
            <div style={{ border: `1px solid ${T.border2}`, borderRadius: 12, overflow: "hidden", maxHeight: 160, overflowY: "auto" }}>
              {localUser.vouchers.map((v: any, i: number) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderBottom: i < localUser.vouchers.length - 1 ? `1px solid ${T.border}` : "none" }}>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 700, color: T.tx1 }}>{v.title}</p>
                    <code style={{ fontSize: 10, color: T.tx4 }}>{v.code}</code>
                  </div>
                  <span style={{ fontSize: 9, fontWeight: 800, color: v.isUsed ? T.tx4 : T.green, background: v.isUsed ? T.bg : T.greenL, padding: "2px 8px", borderRadius: 6 }}>
                    {v.isUsed ? "USED" : "ACTIVE"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <button onClick={onEdit} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: 14, background: T.blueL, color: T.blueD, border: "none", borderRadius: 12, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
            <Edit3 size={14} /> Edit
          </button>
          <button onClick={() => setConfirmDelete(true)} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: 14, background: T.redL, color: T.red, border: "none", borderRadius: 12, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
            <Trash2 size={14} /> Delete
          </button>
        </div>
      </div>

      {confirmDelete && (
        <ConfirmSheet
          title="Delete Member?"
          message={`Account "${localUser.name}" will be permanently deleted. Points and vouchers cannot be restored.`}
          confirmLabel="Yes, Delete"
          danger
          onConfirm={handleDelete}
          onClose={() => setConfirmDelete(false)}
          loading={deleteLoading}
        />
      )}
    </>
  );
}

// ── EDIT MEMBER SHEET ──
function EditMemberSheet({ user, onClose, onSaved, showToast }: { user: UserWithUid; onClose: () => void; onSaved: () => void; showToast: (m: string, t: "success" | "error") => void }) {
  const [form, setForm]       = useState({ name: user.name, email: user.email || "", phoneNumber: user.phoneNumber || "", tier: user.tier });
  const [loading, setLoading] = useState(false);
  const [showInject, setShowInject] = useState(false);

  const save = async () => {
    setLoading(true);
    try {
      await updateAccountAction(user.uid, form, "users");
      showToast("Member updated!", "success");
      onSaved(); onClose();
    } catch (e: any) { showToast(e.message, "error"); }
    finally { setLoading(false); }
  };

  return (
    <>
      <div>
        <Field label="Name" required value={form.name} onChange={(e: any) => setForm({ ...form, name: e.target.value })} />
        <Field label="Email" type="email" value={form.email} onChange={(e: any) => setForm({ ...form, email: e.target.value })} />
        <Field label="Phone Number" type="tel" value={form.phoneNumber} onChange={(e: any) => setForm({ ...form, phoneNumber: e.target.value })} />

        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: 9, fontWeight: 800, color: T.tx4, textTransform: "uppercase" as const, letterSpacing: ".14em", marginBottom: 6 }}>Tier</label>
          <select style={{ width: "100%", appearance: "none" as const, background: T.bg, border: `1px solid ${T.border2}`, borderRadius: 12, padding: "12px 14px", fontSize: 14, color: T.tx1, outline: "none" }}
            value={form.tier} onChange={(e: any) => setForm({ ...form, tier: e.target.value })}
          >
            <option value="Silver">🥈 Silver</option>
            <option value="Gold">🥇 Gold</option>
            <option value="Platinum">💎 Platinum</option>
          </select>
        </div>

        {/* Tier preview */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: TIER_CFG[form.tier]?.bg ?? T.bg, borderRadius: 12, marginBottom: 16, border: `1px solid ${TIER_CFG[form.tier]?.border ?? T.border2}` }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: TIER_CFG[form.tier]?.color }}>{form.tier} Tier</span>
        </div>

        <button onClick={() => setShowInject(true)}
          style={{ width: "100%", padding: "12px", borderRadius: 12, border: `1px solid ${T.border2}`, background: T.bg, color: T.tx2, fontSize: 13, fontWeight: 700, cursor: "pointer", marginBottom: 14 }}
        >
          🎟️ Inject Voucher Manual
        </button>

        <button onClick={save} disabled={loading}
          style={{ width: "100%", padding: 16, background: T.navy2, color: "#fff", border: "none", borderRadius: 14, fontWeight: 800, fontSize: 14, cursor: loading ? "default" : "pointer", opacity: loading ? .7 : 1 }}
        >
          {loading ? "Saving…" : "Save Changes"}
        </button>
      </div>

      {showInject && (
        <InjectVoucherModalForMember
          uid={user.uid}
          onClose={() => setShowInject(false)}
          onSuccess={(m: string) => showToast(m, "success")}
        />
      )}
    </>
  );
}

// ── CREATE ACCOUNT SHEET ──
function CreateAccountSheet({ onClose, onCreated, showToast }: { onClose: () => void; onCreated: () => void; showToast: (m: string, t: "success" | "error") => void }) {
  const [accountType, setAccountType] = useState<"member" | "staff">("member");
  const [name,     setName]     = useState("");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [tier,     setTier]     = useState("Silver");
  const [phone,    setPhone]    = useState("");
  const [role,     setRole]     = useState<"STAFF" | "SUPER_ADMIN">("STAFF");
  const [storeId,  setStoreId]  = useState("");
  const [isActive, setIsActive] = useState(true);
  const [stores,   setStores]   = useState<{ id: string; name: string }[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, "stores"), orderBy("name")),
      snap => setStores(snap.docs.map(d => ({ id: d.id, name: (d.data().name as string) ?? d.id }))),
    );
    return () => unsub();
  }, []);

  useEffect(() => { if (role === "SUPER_ADMIN") setStoreId(""); }, [role]);

  const isValid = name.trim() !== "" && email.trim() !== "" && password.length >= 6
    && !(accountType === "staff" && role === "STAFF" && storeId === "");

  const create = async () => {
    if (!isValid) return;
    setLoading(true); setError("");
    try {
      const payload = accountType === "member"
        ? { name: name.trim(), email: email.trim(), password, tier, phoneNumber: phone.trim(), role: "member" }
        : { name: name.trim(), email: email.trim(), password, role, assignedStoreId: role === "SUPER_ADMIN" ? "" : storeId, isActive };
      await createAccountAction(payload, accountType);
      showToast(`${accountType === "member" ? "Member" : "Staff"} account created!`, "success");
      onCreated(); onClose();
    } catch (e: any) { setError(e.message ?? "Failed to create account."); }
    finally { setLoading(false); }
  };

  return (
    <div>
      {/* Type switcher */}
      <div style={{ display: "flex", background: T.bg, borderRadius: 12, padding: 4, marginBottom: 20, border: `1px solid ${T.border2}` }}>
        {(["member", "staff"] as const).map(t => (
          <button key={t} onClick={() => { setAccountType(t); setError(""); }}
            style={{ flex: 1, padding: "10px 0", borderRadius: 9, border: "none", background: accountType === t ? T.surface : "transparent", color: accountType === t ? T.tx1 : T.tx3, fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: accountType === t ? "0 1px 4px rgba(0,0,0,.08)" : "none", transition: "all .15s" }}
          >
            {t === "member" ? "👤 Member" : "🛡️ Staff"}
          </button>
        ))}
      </div>

      {/* Shared fields */}
      <Field label="Full Name" required placeholder="e.g. John Doe" value={name} onChange={(e: any) => setName(e.target.value)} />
      <Field label="Email" required type="email" placeholder="user@example.com" value={email} onChange={(e: any) => setEmail(e.target.value)} />

      <div style={{ marginBottom: 14, position: "relative" as const }}>
        <label style={{ display: "block", fontSize: 9, fontWeight: 800, color: T.tx4, textTransform: "uppercase" as const, letterSpacing: ".14em", marginBottom: 6 }}>
          Password <span style={{ color: T.red }}>*</span>
        </label>
        <div style={{ position: "relative" as const }}>
          <input type={showPass ? "text" : "password"} placeholder="Min. 6 characters" value={password} onChange={e => setPassword(e.target.value)}
            style={{ width: "100%", background: T.bg, border: `1px solid ${password.length > 0 && password.length < 6 ? T.red : T.border2}`, borderRadius: 12, padding: "12px 52px 12px 14px", fontSize: 14, color: T.tx1, outline: "none", boxSizing: "border-box" as const }}
          />
          <button onClick={() => setShowPass(v => !v)} style={{ position: "absolute" as const, right: 14, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: T.tx4, fontSize: 12, fontWeight: 700 }}>
            {showPass ? "Hide" : "Show"}
          </button>
        </div>
        {password.length > 0 && password.length < 6 && <p style={{ fontSize: 11, color: T.red, marginTop: 4 }}>Min. 6 characters</p>}
      </div>

      {/* Member fields */}
      {accountType === "member" && (
        <>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 9, fontWeight: 800, color: T.tx4, textTransform: "uppercase" as const, letterSpacing: ".14em", marginBottom: 6 }}>Starting Tier</label>
            <select style={{ width: "100%", appearance: "none" as const, background: T.bg, border: `1px solid ${T.border2}`, borderRadius: 12, padding: "12px 14px", fontSize: 14, color: T.tx1, outline: "none" }}
              value={tier} onChange={e => setTier(e.target.value)}
            >
              <option value="Silver">🥈 Silver</option>
              <option value="Gold">🥇 Gold</option>
              <option value="Platinum">💎 Platinum</option>
            </select>
          </div>
          <Field label="Phone Number" type="tel" placeholder="+62 8xx xxxx xxxx" value={phone} onChange={(e: any) => setPhone(e.target.value)} />
        </>
      )}

      {/* Staff fields */}
      {accountType === "staff" && (
        <>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 9, fontWeight: 800, color: T.tx4, textTransform: "uppercase" as const, letterSpacing: ".14em", marginBottom: 6 }}>Role</label>
            <select style={{ width: "100%", appearance: "none" as const, background: T.bg, border: `1px solid ${T.border2}`, borderRadius: 12, padding: "12px 14px", fontSize: 14, color: T.tx1, outline: "none" }}
              value={role} onChange={e => setRole(e.target.value as any)}
            >
              <option value="STAFF">Staff</option>
              <option value="SUPER_ADMIN">Super Admin</option>
            </select>
          </div>

          {role === "STAFF" ? (
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 9, fontWeight: 800, color: T.tx4, textTransform: "uppercase" as const, letterSpacing: ".14em", marginBottom: 6 }}>
                Assigned Store <span style={{ color: T.red }}>*</span>
              </label>
              <select style={{ width: "100%", appearance: "none" as const, background: T.bg, border: `1px solid ${storeId === "" && name !== "" ? T.amber : T.border2}`, borderRadius: 12, padding: "12px 14px", fontSize: 14, color: T.tx1, outline: "none" }}
                value={storeId} onChange={e => setStoreId(e.target.value)}
              >
                <option value="">— Select a Store —</option>
                {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          ) : (
            <div style={{ padding: "12px 14px", background: T.redL, borderRadius: 12, marginBottom: 14, border: `1px solid ${T.redB}` }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: T.red, marginBottom: 2 }}>⚠️ Super Admin — Full Access</p>
              <p style={{ fontSize: 11, color: T.tx2, lineHeight: 1.5 }}>This account will have unrestricted access to all stores and features.</p>
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", background: T.bg, borderRadius: 12, marginBottom: 14 }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: T.tx1 }}>Account Active</p>
              <p style={{ fontSize: 10, color: T.tx4, marginTop: 1 }}>Allow login immediately</p>
            </div>
            <button onClick={() => setIsActive(v => !v)}
              style={{ width: 44, height: 24, borderRadius: 99, border: "none", background: isActive ? T.blue : T.tx4, position: "relative" as const, cursor: "pointer", transition: "background .2s", flexShrink: 0 }}
            >
              <span style={{ position: "absolute" as const, top: 2, left: isActive ? 22 : 2, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left .2s", boxShadow: "0 1px 3px rgba(0,0,0,.2)" }} />
            </button>
          </div>
        </>
      )}

      {error && (
        <div style={{ padding: "10px 14px", background: T.redL, border: `1px solid ${T.redB}`, borderRadius: 10, fontSize: 12, color: T.red, marginBottom: 14 }}>
          {error}
        </div>
      )}

      <button onClick={create} disabled={!isValid || loading}
        style={{ width: "100%", padding: 16, background: isValid ? T.navy2 : T.border2, color: isValid ? "#fff" : T.tx4, border: "none", borderRadius: 14, fontWeight: 800, fontSize: 14, cursor: isValid && !loading ? "pointer" : "default", opacity: loading ? .7 : 1 }}
      >
        {loading ? "Creating…" : `Create ${accountType === "member" ? "Member" : "Staff"} Account`}
      </button>
    </div>
  );
}

// ── EDIT STAFF SHEET ──
function EditStaffSheet({ staff, onClose, onSaved, showToast }: { staff: StaffWithUid; onClose: () => void; onSaved: () => void; showToast: (m: string, t: "success" | "error") => void }) {
  const [form, setForm]       = useState({ name: staff.name, role: staff.role, assignedStoreId: staff.assignedStoreId || "", isActive: staff.isActive ?? true });
  const [stores,   setStores] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, "stores"), orderBy("name")),
      snap => setStores(snap.docs.map(d => ({ id: d.id, name: (d.data().name as string) ?? d.id }))),
    );
    return () => unsub();
  }, []);

  const save = async () => {
    setLoading(true);
    try {
      await updateAccountAction(staff.uid, form, "admin_users");
      showToast("Staff updated!", "success");
      onSaved(); onClose();
    } catch (e: any) { showToast(e.message, "error"); }
    finally { setLoading(false); }
  };

  return (
    <div>
      <Field label="Name" required value={form.name} onChange={(e: any) => setForm({ ...form, name: e.target.value })} />

      <div style={{ marginBottom: 14 }}>
        <label style={{ display: "block", fontSize: 9, fontWeight: 800, color: T.tx4, textTransform: "uppercase" as const, letterSpacing: ".14em", marginBottom: 6 }}>Role</label>
        <select style={{ width: "100%", appearance: "none" as const, background: T.bg, border: `1px solid ${T.border2}`, borderRadius: 12, padding: "12px 14px", fontSize: 14, color: T.tx1, outline: "none" }}
          value={form.role} onChange={(e: any) => setForm({ ...form, role: e.target.value })}
        >
          <option value="STAFF">Staff</option>
          <option value="SUPER_ADMIN">Super Admin</option>
        </select>
      </div>

      {form.role === "STAFF" && (
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: 9, fontWeight: 800, color: T.tx4, textTransform: "uppercase" as const, letterSpacing: ".14em", marginBottom: 6 }}>Assigned Store</label>
          <select style={{ width: "100%", appearance: "none" as const, background: T.bg, border: `1px solid ${T.border2}`, borderRadius: 12, padding: "12px 14px", fontSize: 14, color: T.tx1, outline: "none" }}
            value={form.assignedStoreId} onChange={(e: any) => setForm({ ...form, assignedStoreId: e.target.value })}
          >
            <option value="">— Select a Store —</option>
            {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", background: T.bg, borderRadius: 12, marginBottom: 20 }}>
        <div>
          <p style={{ fontSize: 13, fontWeight: 700, color: T.tx1 }}>Account Active</p>
          <p style={{ fontSize: 10, color: T.tx4, marginTop: 1 }}>Allow staff to login</p>
        </div>
        <button onClick={() => setForm(f => ({ ...f, isActive: !f.isActive }))}
          style={{ width: 44, height: 24, borderRadius: 99, border: "none", background: form.isActive ? T.blue : T.tx4, position: "relative" as const, cursor: "pointer", transition: "background .2s", flexShrink: 0 }}
        >
          <span style={{ position: "absolute" as const, top: 2, left: form.isActive ? 22 : 2, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left .2s" }} />
        </button>
      </div>

      <button onClick={save} disabled={loading}
        style={{ width: "100%", padding: 16, background: T.navy2, color: "#fff", border: "none", borderRadius: 14, fontWeight: 800, fontSize: 14, cursor: loading ? "default" : "pointer", opacity: loading ? .7 : 1 }}
      >
        {loading ? "Saving…" : "Save Changes"}
      </button>
    </div>
  );
}

// ── MAIN ──
export default function MembersMobile({ initialUsers = [], initialStaff = [] }: { initialUsers?: UserWithUid[]; initialStaff?: StaffWithUid[] }) {
  const { user: authUser } = useAuth();
  const { openDrawer }     = useMobileSidebar();
  const canManage          = authUser?.role === "SUPER_ADMIN";

  const [tab,         setTab]         = useState<TabId>("member");
  const [users,       setUsers]       = useState<UserWithUid[]>(initialUsers);
  const [staff,       setStaff]       = useState<StaffWithUid[]>(initialStaff);
  const [search,      setSearch]      = useState("");
  const [searchOpen,  setSearchOpen]  = useState(false);
  const [tierFilter,  setTierFilter]  = useState<TierFilter>("All");

  // ── Sort state (baru) ──
  const [sortBy,      setSortBy]      = useState<SortField>("tier");
  const [sortOrder,   setSortOrder]   = useState<SortOrder>("desc");
  const [showSort,    setShowSort]    = useState(false);

  const [loading,     setLoading]     = useState(false);
  const [hasMore,     setHasMore]     = useState(true);
  const [lastDoc,     setLastDoc]     = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [stats,       setStats]       = useState({ total: 0, platinum: 0, gold: 0, silver: 0, activeStaff: 0 });

  // Modals
  const [detailUser,  setDetailUser]  = useState<UserWithUid | null>(null);
  const [editUser,    setEditUser]    = useState<UserWithUid | null>(null);
  const [editStaff,   setEditStaff]   = useState<StaffWithUid | null>(null);
  const [showCreate,  setShowCreate]  = useState(false);
  const [toast,       setToast]       = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = useCallback((msg: string, type: "success" | "error" = "success") => setToast({ msg, type }), []);

  // ── Resolve sort → Firestore field ──
  function resolveSort(field: SortField, order: SortOrder): { firestoreField: string; dir: SortOrder } {
    if (field === "largestPoints") return { firestoreField: "currentPoints", dir: order };
    if (field === "tier")          return { firestoreField: "tier",          dir: order };
    return { firestoreField: "name", dir: order };
  }

  // Load users (paginated)
  const loadUsers = useCallback(async (reset = false) => {
    if (!reset && (loading || !hasMore)) return;
    setLoading(true);
    try {
      const { firestoreField, dir } = resolveSort(sortBy, sortOrder);

      const constraints: any[] = [];
      if (tierFilter !== "All") constraints.push(where("tier", "==", tierFilter));
      if (search.trim()) {
        const s = search.trim();
        constraints.push(where("name", ">=", s), where("name", "<=", s + "\uf8ff"));
      }
      constraints.push(orderBy(firestoreField, dir));
      constraints.push(limit(PAGE_SIZE));
      if (!reset && lastDoc) constraints.push(startAfter(lastDoc));

      const snap = await getDocs(query(collection(db, "users").withConverter(userConverter), ...constraints));
      const newUsers = snap.docs.map(d => ({ ...d.data(), uid: d.id }));
      setLastDoc(snap.docs[snap.docs.length - 1] ?? null);
      setHasMore(snap.docs.length === PAGE_SIZE);
      setUsers(prev => reset ? newUsers : [...prev, ...newUsers]);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, tierFilter, sortBy, sortOrder]);

  // Stats
  const fetchStats = useCallback(async () => {
    try {
      const coll = collection(db, "users");
      const [t, p, g, s] = await Promise.all([
        getCountFromServer(coll),
        getCountFromServer(query(coll, where("tier", "==", "Platinum"))),
        getCountFromServer(query(coll, where("tier", "==", "Gold"))),
        getCountFromServer(query(coll, where("tier", "==", "Silver"))),
      ]);
      setStats(prev => ({ ...prev, total: t.data().count, platinum: p.data().count, gold: g.data().count, silver: s.data().count }));
    } catch (e) { console.error(e); }
  }, []);

  // Staff realtime
  useEffect(() => {
    if (!canManage) return;
    const unsub = onSnapshot(
      query(collection(db, "admin_users").withConverter(adminUserConverter), orderBy("name")),
      snap => {
        setStaff(snap.docs.map(d => d.data() as StaffWithUid));
        setStats(p => ({ ...p, activeStaff: snap.docs.filter(d => (d.data() as any).isActive).length }));
      },
    );
    return () => unsub();
  }, [canManage]);

  // FIX: pisah initial load dari filter-change effect,
  // sama persis dengan fix di MembersClient.tsx
  const isFirstRender = useRef(true);

  // 1. Initial load saat mount — tanpa guard canManage
  useEffect(() => {
    setLastDoc(null);
    setHasMore(true);
    loadUsers(true);
    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2. Reload saat filter/sort berubah — skip initial render
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setLastDoc(null);
    setHasMore(true);
    loadUsers(true);
    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, tierFilter, sortBy, sortOrder]);

  // Filtered staff (client-side, small collection)
  const filteredStaff = useMemo(() => {
    if (!search.trim()) return staff;
    return staff.filter(s => s.name?.toLowerCase().includes(search.toLowerCase()) || s.email?.toLowerCase().includes(search.toLowerCase()));
  }, [staff, search]);

  // Sort label untuk tombol
  const sortLabel = useMemo(() => {
    const opt = SORT_OPTIONS.find(o => o.field === sortBy);
    if (!opt) return "Urutkan";
    return `${opt.label} ${sortOrder === "asc" ? "↑" : "↓"}`;
  }, [sortBy, sortOrder]);

  const TABS: { id: TabId; icon: React.ElementType; label: string; count: number }[] = [
    { id: "member", icon: Users,  label: "Members", count: stats.total       },
    { id: "staff",  icon: Shield, label: "Staff",   count: stats.activeStaff },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: T.bg, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', sans-serif", WebkitFontSmoothing: "antialiased", overflowX: "hidden" }}>

      {/* ── HEADER ── */}
      <PageHeader
        left={
          <button onClick={openDrawer} style={{ width: 36, height: 36, borderRadius: 11, border: `1px solid ${T.border2}`, background: T.surface, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <MenuIcon size={18} color={T.tx1} strokeWidth={2} />
          </button>
        }
        title="Members"
        right={
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setSearchOpen(v => !v)}
              style={{ width: 36, height: 36, borderRadius: 11, background: searchOpen ? T.navy2 : T.border, border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
            >
              {searchOpen ? <X size={16} color="#fff" strokeWidth={2.5} /> : <Search size={16} color={T.tx2} strokeWidth={2} />}
            </button>
            {canManage && (
              <button onClick={() => setShowCreate(true)}
                style={{ width: 36, height: 36, borderRadius: 11, background: T.blue, border: "none", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
              >
                <Plus size={18} strokeWidth={2.5} />
              </button>
            )}
          </div>
        }
      />

      {/* ── SEARCH BAR ── */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: .18 }}
            style={{ flexShrink: 0, background: T.surface, borderBottom: `1px solid ${T.border}`, overflow: "hidden" }}
          >
            <div style={{ padding: "8px 14px", display: "flex", alignItems: "center", gap: 8 }}>
              <Search size={14} color={T.tx4} strokeWidth={2} style={{ flexShrink: 0 }} />
              <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
                placeholder={tab === "member" ? "Search member name…" : "Search staff name or email…"}
                style={{ flex: 1, border: "none", background: "transparent", outline: "none", fontSize: 13, color: T.tx1 }}
              />
              {search && <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}><X size={14} color={T.tx4} /></button>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── SCROLLABLE CONTENT ── */}
      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
        <div style={{ padding: "14px 14px 0" }}>

          {/* STATS BENTO */}
          <BentoRow>
            <BentoCard label="Total Members" value={stats.total}       color={T.blue}   bg={T.blueL}   icon={Users}  delay={0}    />
            <BentoCard label="Platinum"      value={stats.platinum}    color={T.purple} bg={T.purpleL} icon={Award}  delay={0.05} />
            <BentoCard label="Gold"          value={stats.gold}        color="#92400E"  bg="#FFFBEB"   icon={Star}   delay={0.1}  />
            <BentoCard label="Silver"        value={stats.silver}      color="#475569"  bg="#F8FAFC"   icon={Zap}    delay={0.15} />
            <BentoCard label="Active Staff"  value={stats.activeStaff} color={T.green}  bg={T.greenL}  icon={Shield} delay={0.2}  />
          </BentoRow>

          {/* TIER FILTER + SORT BUTTON — hanya untuk tab member */}
          {tab === "member" && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14 }}>
              {/* Tier pills — scrollable */}
              <div style={{ display: "flex", gap: 6, overflowX: "auto", flex: 1 }} className="scrollbar-hide">
                {(["All", "Silver", "Gold", "Platinum"] as TierFilter[]).map(f => (
                  <button key={f} onClick={() => setTierFilter(f)}
                    style={{ flexShrink: 0, padding: "5px 12px", borderRadius: 99, fontSize: 11, fontWeight: 700, border: `1.5px solid ${tierFilter === f ? T.blue : T.border2}`, background: tierFilter === f ? T.blueL : T.surface, color: tierFilter === f ? T.blueD : T.tx3, cursor: "pointer", whiteSpace: "nowrap" as const }}
                  >
                    {f === "Platinum" ? "💎" : f === "Gold" ? "🥇" : f === "Silver" ? "🥈" : ""}{f !== "All" ? " " : ""}{f}
                  </button>
                ))}
              </div>

              {/* Sort button */}
              <button
                onClick={() => setShowSort(true)}
                style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 5, padding: "5px 11px", borderRadius: 99, fontSize: 11, fontWeight: 700, border: `1.5px solid ${T.blue}`, background: T.blueL, color: T.blueD, cursor: "pointer", whiteSpace: "nowrap" as const }}
              >
                <ArrowUpDown size={11} strokeWidth={2.5} />
                {sortLabel}
              </button>
            </div>
          )}
        </div>

        {/* ── LIST ── */}
        <div style={{ padding: "0 14px 24px" }}>
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r16, overflow: "hidden" }}>
            {tab === "member" ? (
              users.length === 0 && !loading ? (
                <div style={{ padding: "40px 0", textAlign: "center" }}><p style={{ fontSize: 12, color: T.tx4 }}>{search ? `No results for "${search}"` : "No members yet"}</p></div>
              ) : (
                <>
                  {users.map((u, i) => (
                    <motion.div key={u.uid} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * .02 }}
                      onClick={() => setDetailUser(u)}
                      style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderBottom: i < users.length - 1 ? `1px solid ${T.border}` : "none", cursor: "pointer" }}
                    >
                      <Avatar name={u.name} src={u.photoURL} size={40} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: T.tx1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginBottom: 3 }}>{u.name}</p>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" as const }}>
                          <TierBadge tier={u.tier} />
                          <span style={{ fontSize: 10, color: T.tx4 }}>{(u.currentPoints ?? 0).toLocaleString("id")} pts</span>
                        </div>
                      </div>
                      <ChevronRight size={16} color={T.tx4} style={{ flexShrink: 0 }} />
                    </motion.div>
                  ))}
                  {/* Load more */}
                  {hasMore && (
                    <button onClick={() => loadUsers(false)} disabled={loading}
                      style={{ width: "100%", padding: "14px", background: "transparent", border: "none", color: T.blue, fontSize: 12, fontWeight: 700, cursor: "pointer", borderTop: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                    >
                      {loading
                        ? <><motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: .9, ease: "linear" }}><RefreshCw size={13} color={T.blue} /></motion.div> Loading…</>
                        : <>Load more members</>
                      }
                    </button>
                  )}
                </>
              )
            ) : (
              filteredStaff.length === 0 ? (
                <div style={{ padding: "40px 0", textAlign: "center" }}><p style={{ fontSize: 12, color: T.tx4 }}>No staff found</p></div>
              ) : filteredStaff.map((s, i) => {
                const isAdmin = s.role === "SUPER_ADMIN";
                return (
                  <motion.div key={s.uid} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * .03 }}
                    style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderBottom: i < filteredStaff.length - 1 ? `1px solid ${T.border}` : "none" }}
                  >
                    <Avatar name={s.name} size={40} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: T.tx1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginBottom: 3 }}>{s.name}</p>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 9, fontWeight: 800, padding: "2px 8px", borderRadius: 6, background: isAdmin ? T.redL : T.blueL, color: isAdmin ? T.red : T.blueD }}>
                          {isAdmin ? "SUPER ADMIN" : "STAFF"}
                        </span>
                        {s.assignedStoreId && !isAdmin && <span style={{ fontSize: 10, color: T.tx4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{s.assignedStoreId}</span>}
                        <span style={{ fontSize: 9, fontWeight: 700, color: s.isActive ? T.green : T.tx4, background: s.isActive ? T.greenL : T.bg, padding: "2px 6px", borderRadius: 6 }}>
                          {s.isActive ? "Active" : "Inactive"}
                        </span>
                      </div>
                    </div>
                    {canManage && (
                      <button onClick={() => setEditStaff(s)} style={{ width: 32, height: 32, borderRadius: 9, border: `1px solid ${T.border2}`, background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
                        <MoreHorizontal size={15} color={T.tx3} />
                      </button>
                    )}
                  </motion.div>
                );
              })
            )}
          </div>
          {tab === "member" && users.length > 0 && (
            <p style={{ fontSize: 10, color: T.tx4, textAlign: "center", marginTop: 8 }}>
              Showing {users.length} member{users.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>
      </div>

      {/* ── ISLAND TAB BAR ── */}
      <div style={{ flexShrink: 0, display: "flex", justifyContent: "center", padding: "8px 0 28px", background: T.bg }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4, background: T.navy2, borderRadius: 99, padding: "5px 6px", boxShadow: "0 8px 24px rgba(0,0,0,.22), 0 2px 8px rgba(0,0,0,.12)" }}>
          {TABS.map(({ id, icon: Icon, label, count }) => {
            const active = tab === id;
            return (
              <button key={id} onClick={() => setTab(id)}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, height: 36, padding: "0 16px", borderRadius: 99, border: "none", background: active ? T.blue : "transparent", cursor: "pointer", transition: "background .2s ease" }}
              >
                <Icon size={15} color={active ? "#fff" : "rgba(255,255,255,.4)"} strokeWidth={active ? 2.5 : 2} />
                <span style={{ fontSize: 11, fontWeight: 700, color: active ? "#fff" : "rgba(255,255,255,.38)", whiteSpace: "nowrap" as const }}>
                  {active ? label : `${label} ${count}`}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── BOTTOM SHEET: MEMBER DETAIL ── */}
      <BottomSheet isOpen={!!detailUser} onClose={() => setDetailUser(null)} title="Member Detail" fullHeight>
        {detailUser && (
          <MemberDetailSheet
            user={detailUser}
            onClose={() => setDetailUser(null)}
            onEdit={() => { setEditUser(detailUser); setDetailUser(null); }}
            onDeleted={(uid) => { setUsers(prev => prev.filter(u => u.uid !== uid)); fetchStats(); }}
            showToast={showToast}
          />
        )}
      </BottomSheet>

      {/* ── BOTTOM SHEET: EDIT MEMBER ── */}
      <BottomSheet isOpen={!!editUser} onClose={() => setEditUser(null)} title="Edit Member">
        {editUser && (
          <EditMemberSheet
            user={editUser}
            onClose={() => setEditUser(null)}
            onSaved={() => { loadUsers(true); fetchStats(); }}
            showToast={showToast}
          />
        )}
      </BottomSheet>

      {/* ── BOTTOM SHEET: EDIT STAFF ── */}
      <BottomSheet isOpen={!!editStaff} onClose={() => setEditStaff(null)} title="Edit Staff">
        {editStaff && (
          <EditStaffSheet
            staff={editStaff}
            onClose={() => setEditStaff(null)}
            onSaved={() => {}}
            showToast={showToast}
          />
        )}
      </BottomSheet>

      {/* ── BOTTOM SHEET: CREATE ACCOUNT ── */}
      <BottomSheet isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create New Account" fullHeight>
        <CreateAccountSheet
          onClose={() => setShowCreate(false)}
          onCreated={() => { loadUsers(true); fetchStats(); }}
          showToast={showToast}
        />
      </BottomSheet>

      {/* ── BOTTOM SHEET: SORT ── */}
      <BottomSheet isOpen={showSort} onClose={() => setShowSort(false)} title="Urutkan Member">
        <SortSheet
          sortBy={sortBy}
          sortOrder={sortOrder}
          onApply={(field, order) => { setSortBy(field); setSortOrder(order); }}
          onClose={() => setShowSort(false)}
        />
      </BottomSheet>

      {/* ── TOAST ── */}
      <AnimatePresence>
        {toast && <MToast key="toast" msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
      </AnimatePresence>

      <style dangerouslySetInnerHTML={{ __html: `.scrollbar-hide::-webkit-scrollbar{display:none}.scrollbar-hide{-ms-overflow-style:none;scrollbar-width:none}` }} />
    </div>
  );
}