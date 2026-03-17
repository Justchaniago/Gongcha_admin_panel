"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL, listAll } from "firebase/storage";
import { db, storage } from "@/lib/firebaseClient";
import { Reward, rewardConverter } from "@/types/firestore";
import { useAuth } from "@/context/AuthContext";
import { useMobileSidebar } from "@/components/layout/AdminShell";
import {
  Menu as MenuIcon, Search, Plus, X, ChevronRight,
  Edit3, Trash2, AlertCircle, CheckCircle2, XCircle,
  Gift, Tag, Zap, RefreshCw, FolderOpen, Image as ImageIcon,
  Activity,
} from "lucide-react";
import BentoRow, { BentoCard } from "@/components/ui/BentoRow";

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

const fmtPts = (n: number) => n === 0 ? "FREE" : `${n.toLocaleString("id")} pts`;

// ── IMAGE COMPRESSION ──
const compressToWebP = (file: File): Promise<Blob> => new Promise((resolve, reject) => {
  const img = new Image();
  img.src = URL.createObjectURL(file);
  img.onload = () => {
    const max = 800;
    let { width, height } = img;
    if (width > height) { if (width > max) { height = Math.round(height * max / width); width = max; } }
    else { if (height > max) { width = Math.round(width * max / height); height = max; } }
    const canvas = document.createElement("canvas");
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) { reject(new Error("Canvas failed")); return; }
    ctx.drawImage(img, 0, 0, width, height);
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Conversion failed")), "image/webp", 0.8);
  };
  img.onerror = () => reject(new Error("Image read failed"));
});

// ── HEADER ──
const PageHeader = ({ left, title, right }: { left: React.ReactNode; title: string; right: React.ReactNode }) => (
  <div style={{ flexShrink: 0, background: T.surface, borderBottom: `1px solid ${T.border}`, padding: "48px 16px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", zIndex: 30 }}>
    <div style={{ width: 36, flexShrink: 0 }}>{left}</div>
    <p style={{ fontSize: 14, fontWeight: 800, color: T.tx1, letterSpacing: "-.01em" }}>Rewards</p>
    <div style={{ flexShrink: 0, display: "flex", justifyContent: "flex-end" }}>{right}</div>
  </div>
);

// ── BOTTOM SHEET ──
const BottomSheet = ({ isOpen, onClose, children, title, fullHeight }: { isOpen: boolean; onClose: () => void; children: React.ReactNode; title: string; fullHeight?: boolean }) => (
  <AnimatePresence>
    {isOpen && (
      <>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.32)", backdropFilter: "blur(4px)", zIndex: 9998 }} />
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

// ── STORAGE PICKER SHEET ──
function StoragePickerSheet({ isOpen, currentUrl, onConfirm, onClose }: { isOpen: boolean; currentUrl: string; onConfirm: (url: string) => void; onClose: () => void }) {
  const [images, setImages]   = useState<{ path: string; name: string; url: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(currentUrl);

  useEffect(() => {
    if (isOpen) { setSelected(currentUrl); if (images.length === 0) load(); }
  }, [isOpen]);

  const load = async () => {
    setLoading(true);
    try {
      const listing = await listAll(ref(storage, "rewards"));
      const resolved = await Promise.all(
        [...listing.items].reverse().slice(0, 80).map(async r => ({ path: r.fullPath, name: r.name, url: await getDownloadURL(r) }))
      );
      setImages(resolved);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)", zIndex: 10998 }} />
          <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 320 }}
            style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 10999, background: T.surface, borderRadius: "24px 24px 0 0", display: "flex", flexDirection: "column", height: "88dvh" }}
          >
            <div style={{ width: 36, height: 4, background: T.border2, borderRadius: 10, margin: "16px auto 0", flexShrink: 0 }} />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px 12px", borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
              <div>
                <p style={{ fontSize: 15, fontWeight: 800, color: T.tx1 }}>Firebase Storage /rewards</p>
                <p style={{ fontSize: 10, color: T.tx4, marginTop: 2 }}>{images.length} images</p>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={load} disabled={loading} style={{ width: 32, height: 32, borderRadius: 10, border: `1px solid ${T.border2}`, background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", opacity: loading ? .5 : 1 }}>
                  <RefreshCw size={14} color={T.tx3} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
                </button>
                <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 10, background: T.bg, border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                  <X size={15} color={T.tx3} />
                </button>
              </div>
            </div>
            {selected && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 20px", background: T.blueL, borderBottom: "1px solid #BFDBFE", flexShrink: 0 }}>
                <img src={selected} alt="selected" style={{ width: 36, height: 36, borderRadius: 8, objectFit: "cover", border: `2px solid ${T.blue}` }} />
                <p style={{ fontSize: 10, fontWeight: 700, color: T.blueD }}>Selected</p>
              </div>
            )}
            <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
              {loading ? (
                <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
                  <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}><RefreshCw size={20} color={T.tx4} /></motion.div>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                  {images.map((img, i) => {
                    const sel = selected === img.url;
                    return (
                      <motion.button key={img.path} initial={{ opacity: 0, scale: .95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: Math.min(i * .015, .3) }}
                        onClick={() => setSelected(img.url)}
                        style={{ position: "relative", border: `${sel ? 2 : 1}px solid ${sel ? T.blue : T.border2}`, borderRadius: 12, background: sel ? T.blueL : T.bg, cursor: "pointer", padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}
                      >
                        <img src={img.url} alt={img.name} style={{ width: "100%", aspectRatio: "1", objectFit: "cover" }} />
                        {sel && <div style={{ position: "absolute", top: 5, right: 5, width: 20, height: 20, borderRadius: "50%", background: T.blue, display: "flex", alignItems: "center", justifyContent: "center" }}><CheckCircle2 size={12} color="#fff" strokeWidth={3} /></div>}
                        <p style={{ fontSize: 9, color: T.tx4, padding: "4px 6px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{img.name}</p>
                      </motion.button>
                    );
                  })}
                </div>
              )}
            </div>
            <div style={{ padding: "12px 20px 36px", borderTop: `1px solid ${T.border}`, flexShrink: 0, display: "flex", gap: 10 }}>
              <button onClick={onClose} style={{ flex: 1, padding: 14, background: "transparent", color: T.tx2, border: `1px solid ${T.border2}`, borderRadius: 12, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Cancel</button>
              <button onClick={() => { onConfirm(selected); onClose(); }} disabled={!selected}
                style={{ flex: 2, padding: 14, background: selected ? T.blue : T.border2, color: selected ? "#fff" : T.tx4, border: "none", borderRadius: 12, fontWeight: 800, fontSize: 13, cursor: selected ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
              >
                <CheckCircle2 size={15} /> Use this image
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ── REWARD FORM SHEET ──
function RewardFormSheet({ reward, onClose, onSaved, showToast }: { reward: Reward | null; onClose: () => void; onSaved: () => void; showToast: (m: string, t: "success" | "error") => void }) {
  const isNew = !reward;
  const [form, setForm] = useState({
    rewardId:       reward?.id ?? "",
    title:          reward?.title ?? "",
    description:    reward?.description ?? "",
    pointsrequired: reward ? String(reward.pointsrequired) : "",
    isActive:       reward?.isActive ?? true,
    isRedeemable:   (reward as any)?.isRedeemable ?? true,
    imageUrl:       reward?.imageUrl ?? "",
  });
  const [loading,         setLoading]         = useState(false);
  const [error,           setError]           = useState("");
  const [uploadProgress,  setUploadProgress]  = useState<number | null>(null);
  const [processingImage, setProcessingImage] = useState(false);
  const [storageOpen,     setStorageOpen]     = useState(false);
  const [idTouched,       setIdTouched]       = useState(false);

  useEffect(() => {
    if (!isNew || idTouched) return;
    const slug = form.title.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim().split(/\s+/).filter(Boolean).map(w => w.slice(0, 4)).join("_").slice(0, 20);
    setForm(p => ({ ...p, rewardId: slug ? "rw_" + slug : "" }));
  }, [form.title, isNew, idTouched]);

  const handleImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProcessingImage(true);
    try {
      const blob = await compressToWebP(file);
      const storageRef = ref(storage, `rewards/${Date.now()}.webp`);
      const task = uploadBytesResumable(storageRef, blob);
      setUploadProgress(0); setProcessingImage(false);
      task.on("state_changed",
        s => setUploadProgress((s.bytesTransferred / s.totalBytes) * 100),
        err => { setError(err.message); setUploadProgress(null); },
        async () => { const url = await getDownloadURL(task.snapshot.ref); setForm(p => ({ ...p, imageUrl: url })); setUploadProgress(null); }
      );
    } catch (e: any) { setError(e.message); setProcessingImage(false); }
  };

  const handleSave = async () => {
    if (!form.title.trim()) { setError("Reward name is required."); return; }
    if (isNew && !form.rewardId.trim()) { setError("Reward ID is required."); return; }
    if (uploadProgress !== null || processingImage) { setError("Wait for image upload to finish."); return; }
    setLoading(true); setError("");
    try {
      const method = isNew ? "POST" : "PATCH";
      const url    = isNew ? "/api/rewards" : `/api/rewards/${reward!.id}`;
      const payload = {
        ...(isNew ? { rewardId: form.rewardId.trim() } : {}),
        title: form.title.trim(), description: form.description.trim(),
        pointsrequired: form.pointsrequired !== "" ? Number(form.pointsrequired) : 0,
        isActive: form.isActive, isRedeemable: form.isRedeemable, imageUrl: form.imageUrl.trim(),
      };
      const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message ?? "Failed to save.");
      showToast(isNew ? "Reward added!" : "Reward updated!", "success");
      onSaved(); onClose();
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const inputStyle: React.CSSProperties = { width: "100%", background: T.bg, border: `1px solid ${T.border2}`, borderRadius: 12, padding: "12px 14px", fontSize: 14, color: T.tx1, outline: "none", boxSizing: "border-box" };
  const Field = ({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) => (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 9, fontWeight: 800, color: T.tx4, textTransform: "uppercase" as const, letterSpacing: ".14em", marginBottom: 6 }}>{label}</label>
      {children}
      {hint && <p style={{ fontSize: 10, color: T.tx4, marginTop: 4 }}>{hint}</p>}
    </div>
  );

  return (
    <>
      <div>
        {isNew && (
          <Field label="Reward ID" hint="Cannot be changed after saving">
            <input value={form.rewardId} onChange={e => { setIdTouched(true); setForm(p => ({ ...p, rewardId: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "") })); }} placeholder="rw_free_drink" style={inputStyle} />
          </Field>
        )}
        <Field label="Voucher Name">
          <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Free Drink Any Size" style={inputStyle} />
        </Field>
        <Field label="Description">
          <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={3}
            style={{ ...inputStyle, resize: "none" }} placeholder="Short description..." />
        </Field>
        <Field label="Points Required" hint="0 = free">
          <input type="number" min="0" value={form.pointsrequired} onChange={e => setForm(p => ({ ...p, pointsrequired: e.target.value }))} placeholder="500" style={inputStyle} />
        </Field>

        {/* Image */}
        <Field label="Voucher Image">
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, overflow: "hidden", flexShrink: 0, border: `1px solid ${T.border2}`, background: T.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {form.imageUrl ? <img src={form.imageUrl} alt="preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <ImageIcon size={18} color={T.tx4} />}
            </div>
            {processingImage ? (
              <div style={{ flex: 1, padding: "12px 14px", background: T.bg, borderRadius: 12, border: `1px solid ${T.border2}` }}>
                <p style={{ fontSize: 12, color: T.amber, fontWeight: 700 }}>Compressing…</p>
              </div>
            ) : uploadProgress !== null ? (
              <div style={{ flex: 1, padding: "12px 14px", background: T.bg, borderRadius: 12, border: `1px solid ${T.border2}`, position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, background: T.blueL, width: `${uploadProgress}%`, transition: "width .2s" }} />
                <p style={{ position: "relative", fontSize: 12, color: T.blue, fontWeight: 700 }}>Uploading {Math.round(uploadProgress)}%</p>
              </div>
            ) : (
              <div style={{ flex: 1, position: "relative" }}>
                <input type="file" accept="image/*" onChange={handleImageFile} style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", zIndex: 10 }} />
                <div style={{ padding: "12px 14px", background: T.bg, borderRadius: 12, border: `1.5px dashed ${T.border2}`, textAlign: "center" as const }}>
                  <p style={{ fontSize: 12, color: T.tx3, fontWeight: 600 }}>Tap to upload image</p>
                </div>
              </div>
            )}
          </div>
          <button onClick={() => setStorageOpen(true)} style={{ width: "100%", padding: "10px", borderRadius: 12, border: `1px solid ${T.border2}`, background: T.bg, color: T.tx2, fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <FolderOpen size={14} color={T.tx3} /> Choose from Storage
          </button>
        </Field>

        {/* Toggles */}
        {([
          { key: "isActive",     label: "Active Status",         sub: "Global switch for this voucher",           color: T.blue  },
          { key: "isRedeemable", label: "Show in Catalog",       sub: "Visible for member point exchange",        color: T.green },
        ] as const).map(({ key, label, sub, color }) => {
          const val = (form as any)[key] as boolean;
          return (
            <div key={key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", background: T.bg, borderRadius: 12, marginBottom: 10 }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: T.tx1 }}>{label}</p>
                <p style={{ fontSize: 10, color: T.tx4, marginTop: 1 }}>{sub}</p>
              </div>
              <button onClick={() => setForm(p => ({ ...p, [key]: !val }))}
                style={{ width: 44, height: 24, borderRadius: 99, border: "none", background: val ? color : T.tx4, position: "relative", cursor: "pointer", transition: "background .2s", flexShrink: 0 }}
              >
                <span style={{ position: "absolute", top: 2, left: val ? 22 : 2, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left .2s", boxShadow: "0 1px 3px rgba(0,0,0,.2)" }} />
              </button>
            </div>
          );
        })}
        {!form.isRedeemable && <p style={{ fontSize: 10, color: T.amber, fontWeight: 600, marginBottom: 14 }}>⚠️ Special voucher — only for direct injection to specific users.</p>}

        {error && <div style={{ padding: "10px 14px", background: T.redL, border: `1px solid ${T.redB}`, borderRadius: 10, fontSize: 12, color: T.red, marginBottom: 14 }}>{error}</div>}

        <button onClick={handleSave} disabled={loading || uploadProgress !== null || processingImage}
          style={{ width: "100%", padding: 16, background: T.navy2, color: "#fff", border: "none", borderRadius: 14, fontWeight: 800, fontSize: 14, cursor: "pointer", opacity: loading ? .7 : 1 }}
        >
          {loading ? "Saving…" : isNew ? "Add Reward" : "Save Changes"}
        </button>
      </div>
      <StoragePickerSheet isOpen={storageOpen} currentUrl={form.imageUrl} onConfirm={url => setForm(p => ({ ...p, imageUrl: url }))} onClose={() => setStorageOpen(false)} />
    </>
  );
}

// ── MAIN ──
export default function RewardsMobile({ initialRewards = [] }: { initialRewards?: Reward[] }) {
  const { user }       = useAuth();
  const { openDrawer } = useMobileSidebar();
  const canMutate      = user?.role === "SUPER_ADMIN";

  const [rewards,      setRewards]      = useState<Reward[]>(initialRewards);
  const [search,       setSearch]       = useState("");
  const [searchOpen,   setSearchOpen]   = useState(false);
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive">("all");
  const [selectedR,    setSelectedR]    = useState<Reward | null>(null);
  const [editR,        setEditR]        = useState<Reward | null | "new">(null);
  const [deleteR,      setDeleteR]      = useState<Reward | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [toast,        setToast]        = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = useCallback((msg: string, type: "success" | "error" = "success") => setToast({ msg, type }), []);

  useEffect(() => {
    const q = query(collection(db, "rewards_catalog").withConverter(rewardConverter), orderBy("title"));
    const unsub = onSnapshot(q, snap => setRewards(snap.docs.map(d => d.data() as Reward)));
    return () => unsub();
  }, []);

  const filtered = useMemo(() => rewards.filter(r => {
    const q  = search.toLowerCase();
    const ok = !q || r.title?.toLowerCase().includes(q) || r.id?.toLowerCase().includes(q);
    const f  = filterStatus === "all" || (filterStatus === "active" ? r.isActive : !r.isActive);
    return ok && f;
  }), [rewards, search, filterStatus]);

  const activeCount  = rewards.filter(r => r.isActive).length;
  const catalogCount = rewards.filter(r => (r as any).isRedeemable !== false).length;

  const handleDelete = async () => {
    if (!deleteR) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/rewards/${deleteR.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message);
      showToast(`"${deleteR.title}" deleted.`, "success");
      setDeleteR(null); setSelectedR(null);
    } catch (e: any) { showToast(e.message, "error"); }
    finally { setDeleteLoading(false); }
  };

  const TABS = [
    { id: "all"      as const, icon: Gift,        label: "All",      count: rewards.length  },
    { id: "active"   as const, icon: CheckCircle2, label: "Active",   count: activeCount     },
    { id: "inactive" as const, icon: XCircle,      label: "Inactive", count: rewards.length - activeCount },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: T.bg, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif", WebkitFontSmoothing: "antialiased", overflowX: "hidden" }}>

      <PageHeader
        left={
          <button onClick={openDrawer} style={{ width: 36, height: 36, borderRadius: 11, border: `1px solid ${T.border2}`, background: T.surface, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <MenuIcon size={18} color={T.tx1} strokeWidth={2} />
          </button>
        }
        title="Rewards"
        right={
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setSearchOpen(v => !v)} style={{ width: 36, height: 36, borderRadius: 11, background: searchOpen ? T.navy2 : T.border, border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              {searchOpen ? <X size={16} color="#fff" strokeWidth={2.5} /> : <Search size={16} color={T.tx2} strokeWidth={2} />}
            </button>
            {canMutate && (
              <button onClick={() => setEditR("new")} style={{ width: 36, height: 36, borderRadius: 11, background: T.blue, border: "none", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                <Plus size={18} strokeWidth={2.5} />
              </button>
            )}
          </div>
        }
      />

      {/* Search bar */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: .18 }}
            style={{ flexShrink: 0, background: T.surface, borderBottom: `1px solid ${T.border}`, overflow: "hidden" }}
          >
            <div style={{ padding: "8px 14px", display: "flex", alignItems: "center", gap: 8 }}>
              <Search size={14} color={T.tx4} strokeWidth={2} style={{ flexShrink: 0 }} />
              <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Search reward name or ID…"
                style={{ flex: 1, border: "none", background: "transparent", outline: "none", fontSize: 13, color: T.tx1 }}
              />
              {search && <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}><X size={14} color={T.tx4} /></button>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
        <div style={{ padding: "14px 14px 0" }}>
          <BentoRow>
            <BentoCard label="Total Rewards" value={rewards.length} color={T.blue}   bg={T.blueL}   icon={Gift}         delay={0}    />
            <BentoCard label="Active"        value={activeCount}    color={T.green}  bg={T.greenL}  icon={CheckCircle2} delay={0.05} />
            <BentoCard label="In Catalog"    value={catalogCount}   color={T.purple} bg={T.purpleL} icon={Tag}          delay={0.1}  />
            <BentoCard label="Inactive"      value={rewards.length - activeCount} color={T.amber} bg={T.amberL} icon={Zap} delay={0.15} />
          </BentoRow>
        </div>

        {/* Reward list */}
        <div style={{ padding: "0 14px 24px" }}>
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r16, overflow: "hidden" }}>
            {filtered.length === 0 ? (
              <div style={{ padding: "40px 0", textAlign: "center" }}><p style={{ fontSize: 12, color: T.tx4 }}>No rewards found</p></div>
            ) : filtered.map((r, i) => {
              const isRedeemable = (r as any).isRedeemable !== false;
              return (
                <motion.div key={r.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * .025 }}
                  onClick={() => setSelectedR(r)}
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderBottom: i < filtered.length - 1 ? `1px solid ${T.border}` : "none", cursor: "pointer" }}
                >
                  {/* Thumbnail / points */}
                  <div style={{ width: 52, height: 52, borderRadius: 12, background: isRedeemable ? T.purpleL : T.bg, flexShrink: 0, overflow: "hidden", border: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {r.imageUrl
                      ? <img src={r.imageUrl} alt={r.title} style={{ width: "100%", height: "100%", objectFit: "cover", opacity: r.isActive ? 1 : .4 }} />
                      : <span style={{ fontSize: 11, fontWeight: 900, color: isRedeemable ? T.purple : T.tx4 }}>{fmtPts(r.pointsrequired)}</span>
                    }
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: r.isActive ? T.tx1 : T.tx3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginBottom: 3 }}>{r.title}</p>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" as const }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: T.purple }}>{fmtPts(r.pointsrequired)}</span>
                      <span style={{ fontSize: 9, fontWeight: 800, padding: "2px 7px", borderRadius: 6, background: isRedeemable ? T.greenL : T.amberL, color: isRedeemable ? T.green : T.amber }}>
                        {isRedeemable ? "Catalog" : "Direct Only"}
                      </span>
                      {!r.isActive && <span style={{ fontSize: 9, fontWeight: 800, padding: "2px 7px", borderRadius: 6, background: T.redL, color: T.red }}>Inactive</span>}
                    </div>
                  </div>
                  <ChevronRight size={16} color={T.tx4} style={{ flexShrink: 0 }} />
                </motion.div>
              );
            })}
          </div>
          {filtered.length > 0 && <p style={{ fontSize: 10, color: T.tx4, textAlign: "center", marginTop: 8 }}>Showing {filtered.length} reward{filtered.length !== 1 ? "s" : ""}</p>}
        </div>
      </div>

      {/* ── ISLAND TAB BAR ── */}
      <div style={{ flexShrink: 0, display: "flex", justifyContent: "center", padding: "8px 0 28px", background: T.bg }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4, background: T.navy2, borderRadius: 99, padding: "5px 6px", boxShadow: "0 8px 24px rgba(0,0,0,.22), 0 2px 8px rgba(0,0,0,.12)" }}>
          {TABS.map(({ id, icon: Icon, label, count }) => {
            const active = filterStatus === id;
            return (
              <button key={id} onClick={() => setFilterStatus(id)}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, height: 36, padding: "0 16px", borderRadius: 99, border: "none", background: active ? T.blue : "transparent", cursor: "pointer", transition: "background .2s" }}
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

      {/* ── DETAIL SHEET ── */}
      <BottomSheet isOpen={!!selectedR} onClose={() => setSelectedR(null)} title="Reward Details">
        {selectedR && (
          <div>
            <div style={{ display: "flex", gap: 14, marginBottom: 20 }}>
              <div style={{ width: 64, height: 64, borderRadius: 14, background: T.purpleL, overflow: "hidden", flexShrink: 0, border: `1px solid ${T.purpleB}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {selectedR.imageUrl ? <img src={selectedR.imageUrl} alt={selectedR.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Gift size={24} color={T.purple} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: T.tx1, marginBottom: 4 }}>{selectedR.title}</h3>
                <p style={{ fontSize: 14, fontWeight: 900, color: T.purple }}>{fmtPts(selectedR.pointsrequired)}</p>
              </div>
            </div>
            {selectedR.description && (
              <div style={{ padding: "12px 14px", background: T.bg, borderRadius: 12, marginBottom: 14 }}>
                <p style={{ fontSize: 13, color: T.tx1, lineHeight: 1.6 }}>{selectedR.description}</p>
              </div>
            )}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const, marginBottom: 16 }}>
              <span style={{ fontSize: 9, fontWeight: 800, padding: "3px 9px", borderRadius: 99, background: selectedR.isActive ? T.greenL : T.redL, color: selectedR.isActive ? T.green : T.red, border: `1px solid ${selectedR.isActive ? T.greenB : T.redB}` }}>
                {selectedR.isActive ? "Active" : "Inactive"}
              </span>
              <span style={{ fontSize: 9, fontWeight: 800, padding: "3px 9px", borderRadius: 99, background: (selectedR as any).isRedeemable !== false ? T.greenL : T.amberL, color: (selectedR as any).isRedeemable !== false ? T.green : T.amber }}>
                {(selectedR as any).isRedeemable !== false ? "In Catalog" : "Direct Only"}
              </span>
            </div>
            {canMutate && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <button onClick={() => { setSelectedR(null); setTimeout(() => setEditR(selectedR), 300); }} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: 14, background: T.blueL, color: T.blueD, border: "none", borderRadius: 12, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                  <Edit3 size={14} /> Edit
                </button>
                <button onClick={() => { setSelectedR(null); setTimeout(() => setDeleteR(selectedR), 300); }} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: 14, background: T.redL, color: T.red, border: "none", borderRadius: 12, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            )}
          </div>
        )}
      </BottomSheet>

      {/* ── FORM SHEET ── */}
      <BottomSheet isOpen={!!editR} onClose={() => setEditR(null)} title={editR === "new" ? "Add New Reward" : "Edit Reward"} fullHeight>
        {editR !== null && (
          <RewardFormSheet
            reward={editR === "new" ? null : editR}
            onClose={() => setEditR(null)}
            onSaved={() => {}}
            showToast={showToast}
          />
        )}
      </BottomSheet>

      {/* ── DELETE CONFIRM ── */}
      {deleteR && (
        <AnimatePresence>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, zIndex: 10998, background: "rgba(0,0,0,.4)", backdropFilter: "blur(4px)" }}
            onClick={() => !deleteLoading && setDeleteR(null)} />
          <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 360, damping: 36 }}
            style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 10999, background: T.surface, borderRadius: "24px 24px 0 0", padding: "16px 20px 48px" }}
          >
            <div style={{ width: 36, height: 4, borderRadius: 99, background: T.border2, margin: "0 auto 20px" }} />
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 20 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: T.redL, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <AlertCircle size={18} color={T.red} />
              </div>
              <div>
                <p style={{ fontSize: 15, fontWeight: 800, color: T.tx1, marginBottom: 4 }}>Delete Reward?</p>
                <p style={{ fontSize: 13, color: T.tx3 }}>"{deleteR.title}" will be permanently deleted.</p>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setDeleteR(null)} disabled={deleteLoading} style={{ flex: 1, padding: 14, borderRadius: 14, border: `1px solid ${T.border2}`, background: "transparent", fontSize: 13, fontWeight: 700, color: T.tx2, cursor: "pointer" }}>Cancel</button>
              <button onClick={handleDelete} disabled={deleteLoading} style={{ flex: 2, padding: 14, borderRadius: 14, border: "none", background: T.red, fontSize: 13, fontWeight: 800, color: "#fff", cursor: "pointer", opacity: deleteLoading ? .7 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                {deleteLoading && <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: .9, ease: "linear" }}><Activity size={14} color="#fff" /></motion.div>}
                {deleteLoading ? "Deleting…" : "Yes, Delete"}
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      )}

      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", bottom: 100, left: "50%", transform: "translateX(-50%)", zIndex: 9999, padding: "12px 18px", borderRadius: 14, background: toast.type === "success" ? T.navy2 : T.red, color: "#fff", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 8, boxShadow: "0 8px 24px rgba(0,0,0,.24)", whiteSpace: "nowrap" as const }}
          >
            {toast.type === "success" ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      <style dangerouslySetInnerHTML={{ __html: `.scrollbar-hide::-webkit-scrollbar{display:none}.scrollbar-hide{-ms-overflow-style:none;scrollbar-width:none}@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}` }} />
    </div>
  );
}