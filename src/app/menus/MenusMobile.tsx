"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { ref, getDownloadURL, listAll } from "firebase/storage";
import { db, storage } from "@/lib/firebaseClient";
import { useAuth } from "@/context/AuthContext";
import { useMobileSidebar } from "@/components/layout/AdminShell";
import { createMenu, updateMenu, deleteMenu } from "@/actions/menuActions";
import {
  Menu as MenuIcon, Search, Coffee, Plus, X,
  ChevronRight, Edit3, Trash2, CheckCircle2, XCircle,
  AlertCircle, Image as ImageIcon, List, FolderOpen, RefreshCw,
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
  amber:   "#D97706",
  amberL:  "#FFFBEB",
  amberB:  "#FDE68A",
  red:     "#DC2626",
  redL:    "#FEF2F2",
  redB:    "#FECACA",
  green:   "#059669",
  greenL:  "#ECFDF5",
  greenB:  "#6EE7B7",
  tx1:     "#111827",
  tx2:     "#374151",
  tx3:     "#6B7280",
  tx4:     "#9CA3AF",
  border:  "#F3F4F6",
  border2: "#E5E7EB",
  r12: 12, r16: 16,
} as const;

const fmtRp = (n: number) =>
  "Rp\u00A0" + Math.round(n || 0).toLocaleString("id-ID");

// ── PAGE HEADER ──
const PageHeader = ({
  left, title, subtitle, right,
}: {
  left: React.ReactNode; title: string; subtitle?: React.ReactNode; right: React.ReactNode;
}) => (
  <div style={{
    flexShrink: 0, background: T.surface, borderBottom: `1px solid ${T.border}`,
    padding: "48px 16px 12px", display: "flex", alignItems: "center",
    justifyContent: "space-between", zIndex: 30,
  }}>
    <div style={{ width: 36, flexShrink: 0 }}>{left}</div>
    <div style={{ flex: 1, textAlign: "center", padding: "0 8px" }}>
      <p style={{ fontSize: 14, fontWeight: 800, color: T.tx1, letterSpacing: "-.01em", lineHeight: 1 }}>{title}</p>
      {subtitle && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5, marginTop: 4 }}>
          {subtitle}
        </div>
      )}
    </div>
    <div style={{ flexShrink: 0, display: "flex", justifyContent: "flex-end" }}>{right}</div>
  </div>
);

// ── BOTTOM SHEET ──
const BottomSheet = ({
  isOpen, onClose, children, title,
}: {
  isOpen: boolean; onClose: () => void; children: React.ReactNode; title: string;
}) => (
  <AnimatePresence>
    {isOpen && (
      <>
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.32)", backdropFilter: "blur(4px)", zIndex: 9998 }}
        />
        <motion.div
          initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 28, stiffness: 300 }}
          style={{
            position: "fixed", bottom: 0, left: 0, right: 0, background: T.surface,
            borderRadius: "24px 24px 0 0", padding: "20px 24px 48px", zIndex: 9999,
            maxHeight: "90vh", overflowY: "auto",
          }}
        >
          <div style={{ width: 36, height: 4, background: T.border2, borderRadius: 10, margin: "0 auto 20px" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
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

// ── FIELD ──
const Field = ({ label, required, ...props }: { label: string; required?: boolean; [k: string]: any }) => (
  <div style={{ marginBottom: 14 }}>
    <label style={{ display: "block", fontSize: 9, fontWeight: 800, color: T.tx4, textTransform: "uppercase" as const, letterSpacing: ".14em", marginBottom: 6 }}>
      {label}{required && <span style={{ color: T.red }}> *</span>}
    </label>
    <input
      style={{
        width: "100%", background: T.bg, border: `1px solid ${T.border2}`,
        borderRadius: 12, padding: "12px 14px", fontSize: 14, color: T.tx1,
        outline: "none", boxSizing: "border-box" as const,
      }}
      {...props}
    />
  </div>
);

// ── STORAGE PICKER SHEET ──
// Full-screen bottom sheet untuk memilih gambar dari Firebase Storage.
// Muncul di atas form sheet (zIndex lebih tinggi), dengan confirm button.
type StorageImage = { path: string; name: string; url: string };

function StoragePickerSheet({
  isOpen,
  currentUrl,
  onConfirm,
  onClose,
}: {
  isOpen:     boolean;
  currentUrl: string;
  onConfirm:  (url: string) => void;
  onClose:    () => void;
}) {
  const [images,   setImages]   = useState<StorageImage[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [selected, setSelected] = useState(currentUrl);

  // Reset selection setiap kali sheet dibuka
  useEffect(() => {
    if (isOpen) {
      setSelected(currentUrl);
      if (images.length === 0) loadImages();
    }
  }, [isOpen]);

  const loadImages = async () => {
    setLoading(true);
    setError("");
    try {
      const folders = ["product", "products"];
      const listed  = await Promise.all(
        folders.map(async folder => {
          try { return (await listAll(ref(storage, folder))).items; }
          catch { return []; }
        }),
      );
      const merged = listed.flat();
      const seen   = new Set<string>();
      const unique = merged.filter(item => {
        if (seen.has(item.fullPath)) return false;
        seen.add(item.fullPath);
        return true;
      });
      const resolved = await Promise.all(
        [...unique].reverse().slice(0, 80).map(async itemRef => ({
          path: itemRef.fullPath,
          name: itemRef.name,
          url:  await getDownloadURL(itemRef),
        })),
      );
      setImages(resolved);
      if (resolved.length === 0) setError("No images found in /product or /products.");
    } catch (e: any) {
      setError(e?.code === "storage/unauthorized"
        ? "Storage access denied. Check Firebase rules."
        : e?.message ?? "Failed to load gallery.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop — lebih gelap, zIndex di atas form sheet */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)", zIndex: 10998 }}
          />

          {/* Sheet — hampir full height */}
          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 320 }}
            style={{
              position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 10999,
              background: T.surface, borderRadius: "24px 24px 0 0",
              display: "flex", flexDirection: "column",
              height: "88dvh",
            }}
          >
            {/* Handle */}
            <div style={{ width: 36, height: 4, background: T.border2, borderRadius: 10, margin: "16px auto 0" }} />

            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px 12px", borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
              <div>
                <p style={{ fontSize: 15, fontWeight: 800, color: T.tx1 }}>Firebase Storage</p>
                <p style={{ fontSize: 10, color: T.tx4, marginTop: 2 }}>
                  {images.length > 0 ? `${images.length} images · /product & /products` : "Loading…"}
                </p>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={loadImages} disabled={loading}
                  style={{ width: 32, height: 32, borderRadius: 10, border: `1px solid ${T.border2}`, background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", opacity: loading ? .5 : 1 }}
                >
                  <RefreshCw size={14} color={T.tx3} style={{ animation: loading ? "storageSpin 1s linear infinite" : "none" }} />
                </button>
                <button
                  onClick={onClose}
                  style={{ width: 32, height: 32, borderRadius: 10, background: T.bg, border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                >
                  <X size={15} color={T.tx3} />
                </button>
              </div>
            </div>

            {/* Selected preview bar */}
            {selected && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 20px", background: T.blueL, borderBottom: `1px solid #BFDBFE`, flexShrink: 0 }}>
                <img src={selected} alt="selected" style={{ width: 36, height: 36, borderRadius: 8, objectFit: "cover", border: `2px solid ${T.blue}` }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: T.blueD }}>Selected</p>
                  <p style={{ fontSize: 9, color: T.blue, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{selected.split("/").pop()?.split("?")[0]}</p>
                </div>
              </div>
            )}

            {/* Grid — scrollable */}
            <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
              {loading ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 10 }}>
                  <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                    <RefreshCw size={20} color={T.tx4} />
                  </motion.div>
                  <p style={{ fontSize: 12, color: T.tx4 }}>Loading images…</p>
                </div>
              ) : error ? (
                <div style={{ padding: "16px", background: T.redL, borderRadius: 12, border: `1px solid ${T.redB}` }}>
                  <p style={{ fontSize: 12, color: T.red }}>{error}</p>
                  <button onClick={loadImages} style={{ marginTop: 8, fontSize: 11, fontWeight: 700, color: T.red, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                    Try again
                  </button>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                  {images.map((img, i) => {
                    const isSelected = selected === img.url;
                    return (
                      <motion.button
                        key={img.path}
                        initial={{ opacity: 0, scale: .95 }} animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: Math.min(i * .015, .3) }}
                        onClick={() => setSelected(img.url)}
                        style={{
                          position: "relative", border: `${isSelected ? 2 : 1}px solid ${isSelected ? T.blue : T.border2}`,
                          borderRadius: 12, background: isSelected ? T.blueL : T.bg,
                          cursor: "pointer", padding: 0, overflow: "hidden",
                          display: "flex", flexDirection: "column",
                        }}
                      >
                        <img
                          src={img.url} alt={img.name}
                          style={{ width: "100%", aspectRatio: "1", objectFit: "cover" }}
                        />
                        {isSelected && (
                          <div style={{ position: "absolute", top: 5, right: 5, width: 20, height: 20, borderRadius: "50%", background: T.blue, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <CheckCircle2 size={12} color="#fff" strokeWidth={3} />
                          </div>
                        )}
                        <p style={{ fontSize: 9, color: T.tx4, padding: "4px 6px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const, textAlign: "left" }}>
                          {img.name}
                        </p>
                      </motion.button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer — confirm button */}
            <div style={{ padding: "12px 20px 36px", borderTop: `1px solid ${T.border}`, flexShrink: 0, display: "flex", gap: 10 }}>
              <button
                onClick={onClose}
                style={{ flex: 1, padding: 14, background: "transparent", color: T.tx2, border: `1px solid ${T.border2}`, borderRadius: 12, fontWeight: 700, fontSize: 13, cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                onClick={() => { onConfirm(selected); onClose(); }}
                disabled={!selected}
                style={{ flex: 2, padding: 14, background: selected ? T.blue : T.border2, color: selected ? "#fff" : T.tx4, border: "none", borderRadius: 12, fontWeight: 800, fontSize: 13, cursor: selected ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
              >
                <CheckCircle2 size={15} />
                Use this image
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ── MAIN ──
export default function MenusMobile({
  initialMenus = [],
  categories   = [],
}: {
  initialMenus?: any[];
  categories?:   string[];
}) {
  const { user }       = useAuth();
  const { openDrawer } = useMobileSidebar();
  const canManage      = user?.role !== "STAFF";

  const [menus,         setMenus]         = useState<any[]>(initialMenus);
  const [search,        setSearch]        = useState("");
  const [searchOpen,    setSearchOpen]    = useState(false);
  const [catFilter,     setCatFilter]     = useState<string>("all");
  const [availFilter,   setAvailFilter]   = useState<"all" | "available" | "soldout">("all");

  const [selectedMenu,  setSelectedMenu]  = useState<any>(null);
  const [formMenu,      setFormMenu]      = useState<any>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<any>(null);
  const [formLoading,        setFormLoading]        = useState(false);
  const [storagePickerOpen,  setStoragePickerOpen]  = useState(false);
  const [customCategory,     setCustomCategory]     = useState(false);

  const [formData, setFormData] = useState({
    name: "", category: "", price: "", description: "",
    imageUrl: "", isAvailable: true, isHotAvailable: false, isLargeAvailable: true,
  });

  // Firestore real-time
  useEffect(() => {
    const q = query(collection(db, "products"), orderBy("name"));
    const unsub = onSnapshot(q,
      snap => setMenus(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      err  => console.warn("MenusMobile listener:", err),
    );
    return () => unsub();
  }, []);

  const allCats = useMemo<string[]>(() => {
    if (categories.length > 0) return categories;
    return Array.from(new Set(menus.map((m: any) => m.category).filter(Boolean))) as string[];
  }, [menus, categories]);

  const filtered = useMemo(() => menus.filter((m: any) => {
    const q  = search.toLowerCase();
    const ok = !q || m.name?.toLowerCase().includes(q) || m.category?.toLowerCase().includes(q);
    const c  = catFilter === "all" || m.category === catFilter;
    const a  = availFilter === "all"
      || (availFilter === "available" ? m.isAvailable !== false : m.isAvailable === false);
    return ok && c && a;
  }), [menus, search, catFilter, availFilter]);

  const availCount = menus.filter((m: any) => m.isAvailable !== false).length;
  const soldCount  = menus.length - availCount;

  const openForm = (m: any) => {
    setStoragePickerOpen(false);
    setCustomCategory(false);
    if (m === "new") {
      setFormData({ name: "", category: allCats[0] || "", price: "", description: "", imageUrl: "", isAvailable: true, isHotAvailable: false, isLargeAvailable: true });
    } else {
      setFormData({
        name:             m.name        || "",
        category:         m.category    || "",
        price:            m.basePrice   ? String(m.basePrice) : m.price ? String(m.price) : "",
        description:      m.description || "",
        imageUrl:         m.imageUrl    || "",
        isAvailable:      m.isAvailable      ?? true,
        isHotAvailable:   m.isHotAvailable   ?? false,
        isLargeAvailable: m.isLargeAvailable ?? true,
      });
    }
    setFormMenu(m);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) return alert("Nama menu wajib diisi");
    if (!formData.price || isNaN(Number(formData.price))) return alert("Harga harus berupa angka");
    setFormLoading(true);
    try {
      const payload = {
        name:             formData.name.trim(),
        category:         formData.category,
        basePrice:        Number(formData.price),
        description:      formData.description.trim(),
        imageUrl:         formData.imageUrl.trim(),
        isAvailable:      formData.isAvailable,
        isHotAvailable:   formData.isHotAvailable,
        isLargeAvailable: formData.isLargeAvailable,
      };
      if (formMenu === "new") await createMenu(payload);
      else await updateMenu(formMenu.id, payload);
      setFormMenu(null);
      setSelectedMenu(null);
    } catch (e: any) { alert(e.message); }
    finally { setFormLoading(false); }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setFormLoading(true);
    try {
      await deleteMenu(deleteConfirm.id);
      setDeleteConfirm(null);
      setSelectedMenu(null);
    } catch (e: any) { alert(e.message); }
    finally { setFormLoading(false); }
  };

  const toggleAvailability = useCallback(async (m: any) => {
    if (!canManage) return;
    try { await updateMenu(m.id, { isAvailable: !m.isAvailable }); }
    catch { alert("Gagal update status"); }
  }, [canManage]);

  const TABS = [
    { id: "all"       as const, icon: List,         label: "All",       count: menus.length },
    { id: "available" as const, icon: CheckCircle2, label: "Available", count: availCount   },
    { id: "soldout"   as const, icon: XCircle,      label: "Sold Out",  count: soldCount    },
  ];

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100dvh", background: T.bg,
      fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', sans-serif",
      WebkitFontSmoothing: "antialiased", overflowX: "hidden",
    }}>

      {/* ── HEADER ── */}
      <PageHeader
        left={
          <button onClick={openDrawer} style={{ width: 36, height: 36, borderRadius: 11, border: `1px solid ${T.border2}`, background: T.surface, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <MenuIcon size={18} color={T.tx1} strokeWidth={2} />
          </button>
        }
        title="Menu"
        right={
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => setSearchOpen(v => !v)}
              style={{ width: 36, height: 36, borderRadius: 11, background: searchOpen ? T.navy2 : T.border, border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
            >
              {searchOpen
                ? <X size={16} color="#fff" strokeWidth={2.5} />
                : <Search size={16} color={T.tx2} strokeWidth={2} />}
            </button>
            {canManage && (
              <button onClick={() => openForm("new")} style={{ width: 36, height: 36, borderRadius: 11, background: T.blue, border: "none", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                <Plus size={18} strokeWidth={2.5} />
              </button>
            )}
          </div>
        }
      />

      {/* ── SEARCH BAR ── */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: .18 }}
            style={{ flexShrink: 0, background: T.surface, borderBottom: `1px solid ${T.border}`, overflow: "hidden" }}
          >
            <div style={{ padding: "8px 14px", display: "flex", alignItems: "center", gap: 8 }}>
              <Search size={14} color={T.tx4} strokeWidth={2} style={{ flexShrink: 0 }} />
              <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Search menu name or category…" style={{ flex: 1, border: "none", background: "transparent", outline: "none", fontSize: 13, color: T.tx1 }} />
              {search && <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}><X size={14} color={T.tx4} /></button>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── CONTENT ── */}
      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
        <div style={{ padding: "14px 14px 0" }}>

          {/* STATS BENTO */}
          <BentoRow>
            <BentoCard label="Total Items" value={menus.length} color={T.blue}  bg={T.blueL}  icon={Coffee}       delay={0}    />
            <BentoCard label="Available"   value={availCount}   color={T.green} bg={T.greenL} icon={CheckCircle2} delay={0.05} />
            <BentoCard label="Sold Out"    value={soldCount}    color={T.red}   bg={T.redL}   icon={XCircle}      delay={0.1}  />
          </BentoRow>

          {/* CATEGORY PILLS */}
          {allCats.length > 0 && (
            <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 14 }} className="scrollbar-hide">
              {(["all", ...allCats] as string[]).map(cat => (
                <button key={cat} onClick={() => setCatFilter(cat)}
                  style={{ flexShrink: 0, padding: "5px 12px", borderRadius: 99, fontSize: 11, fontWeight: 700, border: `1.5px solid ${catFilter === cat ? T.blue : T.border2}`, background: catFilter === cat ? T.blueL : T.surface, color: catFilter === cat ? T.blueD : T.tx3, cursor: "pointer", whiteSpace: "nowrap" as const }}
                >
                  {cat === "all" ? "All categories" : cat}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── MENU LIST ── */}
        <div style={{ padding: "0 14px 24px" }}>
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r16, overflow: "hidden" }}>
            {filtered.length === 0 ? (
              <div style={{ padding: "40px 0", textAlign: "center" }}>
                <p style={{ fontSize: 12, color: T.tx4 }}>{search ? `No results for "${search}"` : "No menu items found"}</p>
              </div>
            ) : filtered.map((m: any, i: number) => {
              const avail = m.isAvailable !== false;
              return (
                <motion.div key={m.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.025 }}
                  onClick={() => setSelectedMenu(m)}
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderBottom: i < filtered.length - 1 ? `1px solid ${T.border}` : "none", cursor: "pointer" }}
                >
                  <div style={{ width: 52, height: 52, borderRadius: 12, background: T.bg, flexShrink: 0, overflow: "hidden", border: `1px solid ${T.border}` }}>
                    {m.imageUrl
                      ? <img src={m.imageUrl} alt={m.name} style={{ width: "100%", height: "100%", objectFit: "cover", opacity: avail ? 1 : 0.4 }} />
                      : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}><ImageIcon size={20} color={T.tx4} /></div>
                    }
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: avail ? T.tx1 : T.tx3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginBottom: 3 }}>{m.name}</p>
                    <p style={{ fontSize: 12, fontWeight: 800, color: avail ? T.blue : T.tx4, marginBottom: 4 }}>{fmtRp(m.basePrice ?? m.price ?? 0)}</p>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" as const }}>
                      <span style={{ fontSize: 9, fontWeight: 700, color: T.tx3, background: T.bg, padding: "2px 7px", borderRadius: 6, border: `1px solid ${T.border2}` }}>{m.category}</span>
                      {!avail && <span style={{ fontSize: 9, fontWeight: 800, color: T.red, background: T.redL, padding: "2px 7px", borderRadius: 6, border: `1px solid ${T.redB}` }}>Sold Out</span>}
                      {m.isHotAvailable   && <span style={{ fontSize: 9, fontWeight: 800, color: "#E11D48", background: "#FFF1F2", padding: "2px 6px", borderRadius: 6 }}>HOT</span>}
                      {m.isLargeAvailable && <span style={{ fontSize: 9, fontWeight: 800, color: T.blueD,   background: T.blueL,   padding: "2px 6px", borderRadius: 6 }}>LARGE</span>}
                    </div>
                  </div>
                  <ChevronRight size={16} color={T.tx4} style={{ flexShrink: 0 }} />
                </motion.div>
              );
            })}
          </div>
          {filtered.length > 0 && (
            <p style={{ fontSize: 10, color: T.tx4, textAlign: "center", marginTop: 8 }}>
              Showing {filtered.length} item{filtered.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>
      </div>

      {/* ── ISLAND TAB BAR ── */}
      <div style={{ flexShrink: 0, display: "flex", justifyContent: "center", padding: "8px 0 28px", background: T.bg }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4, background: T.navy2, borderRadius: 99, padding: "5px 6px", boxShadow: "0 8px 24px rgba(0,0,0,.22), 0 2px 8px rgba(0,0,0,.12)" }}>
          {TABS.map(({ id, icon: Icon, label, count }) => {
            const active = availFilter === id;
            return (
              <button key={id} onClick={() => setAvailFilter(id)}
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

      {/* ── BOTTOM SHEET: DETAIL ── */}
      <BottomSheet isOpen={!!selectedMenu} onClose={() => setSelectedMenu(null)} title="Menu Details">
        {selectedMenu && (
          <div>
            <div style={{ display: "flex", gap: 14, marginBottom: 20 }}>
              <div style={{ width: 72, height: 72, borderRadius: 16, background: T.bg, overflow: "hidden", flexShrink: 0, border: `1px solid ${T.border2}` }}>
                {selectedMenu.imageUrl
                  ? <img src={selectedMenu.imageUrl} alt={selectedMenu.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}><ImageIcon size={28} color={T.tx4} /></div>
                }
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 9, fontWeight: 800, color: T.tx4, textTransform: "uppercase" as const, letterSpacing: ".14em", marginBottom: 4 }}>{selectedMenu.category}</p>
                <h3 style={{ fontSize: 17, fontWeight: 800, color: T.tx1, lineHeight: 1.3, marginBottom: 6 }}>{selectedMenu.name}</h3>
                <p style={{ fontSize: 15, fontWeight: 900, color: T.blue }}>{fmtRp(selectedMenu.basePrice ?? selectedMenu.price ?? 0)}</p>
              </div>
            </div>

            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const, marginBottom: 16 }}>
              {selectedMenu.isAvailable !== false
                ? <span style={{ fontSize: 9, fontWeight: 800, padding: "3px 9px", borderRadius: 99, background: T.greenL, color: T.green, border: `1px solid ${T.greenB}` }}>Available</span>
                : <span style={{ fontSize: 9, fontWeight: 800, padding: "3px 9px", borderRadius: 99, background: T.redL, color: T.red, border: `1px solid ${T.redB}` }}>Sold Out</span>
              }
              {selectedMenu.isHotAvailable   && <span style={{ fontSize: 9, fontWeight: 800, padding: "3px 9px", borderRadius: 99, background: "#FFF1F2", color: "#E11D48", border: "1px solid #FECDD3" }}>HOT</span>}
              {selectedMenu.isLargeAvailable && <span style={{ fontSize: 9, fontWeight: 800, padding: "3px 9px", borderRadius: 99, background: T.blueL,   color: T.blueD,   border: "1px solid #BFDBFE" }}>LARGE</span>}
            </div>

            {selectedMenu.description && (
              <div style={{ padding: "12px 14px", background: T.bg, borderRadius: 12, marginBottom: 16 }}>
                <p style={{ fontSize: 9, fontWeight: 800, color: T.tx4, textTransform: "uppercase" as const, letterSpacing: ".14em", marginBottom: 4 }}>Description</p>
                <p style={{ fontSize: 13, color: T.tx1, lineHeight: 1.6 }}>{selectedMenu.description}</p>
              </div>
            )}

            {canManage && (
              <>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", background: selectedMenu.isAvailable !== false ? T.greenL : T.redL, borderRadius: 12, marginBottom: 16, border: `1px solid ${selectedMenu.isAvailable !== false ? T.greenB : T.redB}` }}>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 800, color: selectedMenu.isAvailable !== false ? T.green : T.red }}>{selectedMenu.isAvailable !== false ? "In Stock" : "Sold Out"}</p>
                    <p style={{ fontSize: 10, color: selectedMenu.isAvailable !== false ? T.green : T.red, opacity: .7, marginTop: 2 }}>Tap to toggle availability</p>
                  </div>
                  <button
                    onClick={() => { toggleAvailability(selectedMenu); setSelectedMenu((s: any) => ({ ...s, isAvailable: !s.isAvailable })); }}
                    style={{ width: 44, height: 24, borderRadius: 99, border: "none", background: selectedMenu.isAvailable !== false ? T.green : T.tx4, position: "relative", cursor: "pointer", transition: "background .2s", flexShrink: 0 }}
                  >
                    <span style={{ position: "absolute", top: 2, left: selectedMenu.isAvailable !== false ? 22 : 2, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left .2s", boxShadow: "0 1px 3px rgba(0,0,0,.2)" }} />
                  </button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <button onClick={() => { setSelectedMenu(null); setTimeout(() => openForm(selectedMenu), 300); }}
                    style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: 14, background: T.blueL, color: T.blueD, border: "none", borderRadius: 12, fontWeight: 700, fontSize: 13, cursor: "pointer" }}
                  ><Edit3 size={14} /> Edit</button>
                  <button onClick={() => { setSelectedMenu(null); setTimeout(() => setDeleteConfirm(selectedMenu), 300); }}
                    style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: 14, background: T.redL, color: T.red, border: "none", borderRadius: 12, fontWeight: 700, fontSize: 13, cursor: "pointer" }}
                  ><Trash2 size={14} /> Delete</button>
                </div>
              </>
            )}
          </div>
        )}
      </BottomSheet>

      {/* ── BOTTOM SHEET: FORM ADD/EDIT ── */}
      <BottomSheet isOpen={!!formMenu} onClose={() => { setFormMenu(null); setStoragePickerOpen(false); }} title={formMenu === "new" ? "Add New Item" : "Edit Item"}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <Field label="Item Name" required placeholder="e.g. Brown Sugar Milk Tea" value={formData.name} onChange={(e: any) => setFormData({ ...formData, name: e.target.value })} />

          {/* CATEGORY — full width dengan opsi manual */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 9, fontWeight: 800, color: T.tx4, textTransform: "uppercase" as const, letterSpacing: ".14em", marginBottom: 6 }}>
              Category
            </label>
            {!customCategory ? (
              <div style={{ display: "flex", gap: 8 }}>
                <select
                  style={{ flex: 1, appearance: "none" as const, background: T.bg, border: `1px solid ${T.border2}`, borderRadius: 12, padding: "12px 14px", fontSize: 14, color: T.tx1, outline: "none" }}
                  value={formData.category}
                  onChange={(e: any) => setFormData({ ...formData, category: e.target.value })}
                >
                  <option value="">Select…</option>
                  {allCats.map((c: string) => <option key={c} value={c}>{c}</option>)}
                </select>
                <button
                  onClick={() => { setCustomCategory(true); setFormData(f => ({ ...f, category: "" })); }}
                  style={{ flexShrink: 0, height: 46, padding: "0 14px", borderRadius: 12, border: `1px solid ${T.border2}`, background: T.bg, color: T.tx2, fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" as const }}
                >
                  + New
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  autoFocus
                  placeholder="Type new category…"
                  value={formData.category}
                  onChange={(e: any) => setFormData({ ...formData, category: e.target.value })}
                  style={{ flex: 1, background: T.bg, border: `1.5px solid ${T.blue}`, borderRadius: 12, padding: "12px 14px", fontSize: 14, color: T.tx1, outline: "none" }}
                />
                <button
                  onClick={() => { setCustomCategory(false); if (!formData.category) setFormData(f => ({ ...f, category: allCats[0] || "" })); }}
                  style={{ flexShrink: 0, height: 46, padding: "0 12px", borderRadius: 12, border: `1px solid ${T.border2}`, background: T.bg, color: T.tx3, fontSize: 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" as const }}
                >
                  Pick list
                </button>
              </div>
            )}
            {customCategory && formData.category && (
              <p style={{ fontSize: 10, color: T.blue, marginTop: 5, fontWeight: 600 }}>
                New category <strong>"{formData.category}"</strong> will be created on save
              </p>
            )}
          </div>

          <Field label="Price (Rp)" type="number" required placeholder="25000" value={formData.price} onChange={(e: any) => setFormData({ ...formData, price: e.target.value })} />

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 9, fontWeight: 800, color: T.tx4, textTransform: "uppercase" as const, letterSpacing: ".14em", marginBottom: 6 }}>Description</label>
            <textarea rows={3}
              style={{ width: "100%", background: T.bg, border: `1px solid ${T.border2}`, borderRadius: 12, padding: "12px 14px", fontSize: 14, color: T.tx1, outline: "none", boxSizing: "border-box" as const, resize: "none" }}
              placeholder="Short description…" value={formData.description} onChange={(e: any) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          {/* IMAGE SECTION */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 9, fontWeight: 800, color: T.tx4, textTransform: "uppercase" as const, letterSpacing: ".14em", marginBottom: 6 }}>Product Image</label>

            {/* Preview + URL row */}
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, overflow: "hidden", flexShrink: 0, border: `1px solid ${T.border2}`, background: T.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {formData.imageUrl
                  ? <img src={formData.imageUrl} alt="preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <ImageIcon size={18} color={T.tx4} />
                }
              </div>
              <input
                placeholder="https://… or choose from storage"
                value={formData.imageUrl}
                onChange={(e: any) => setFormData({ ...formData, imageUrl: e.target.value })}
                style={{ flex: 1, background: T.bg, border: `1px solid ${T.border2}`, borderRadius: 12, padding: "12px 14px", fontSize: 13, color: T.tx1, outline: "none" }}
              />
            </div>

            {/* Open storage picker */}
            <button
              onClick={() => setStoragePickerOpen(true)}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", padding: "11px 0", borderRadius: 12, border: `1px solid ${T.border2}`, background: T.bg, color: T.tx2, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
            >
              <FolderOpen size={14} color={T.tx3} />
              Choose from Firebase Storage
            </button>
          </div>

          {/* TOGGLES */}
          {([
            { key: "isAvailable",      label: "Item is Available",    sub: "Visible & orderable by members", color: T.blue    },
            { key: "isHotAvailable",   label: "Hot Size Available",   sub: "Serve as hot drink option",      color: "#E11D48" },
            { key: "isLargeAvailable", label: "Large Size Available", sub: "Serve as large drink option",    color: T.blueD  },
          ] as const).map(({ key, label, sub, color }) => {
            const val = (formData as any)[key] as boolean;
            return (
              <div key={key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", background: T.bg, borderRadius: 12, marginBottom: 10 }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: T.tx1 }}>{label}</p>
                  <p style={{ fontSize: 10, color: T.tx4, marginTop: 1 }}>{sub}</p>
                </div>
                <button onClick={() => setFormData({ ...formData, [key]: !val })}
                  style={{ width: 44, height: 24, borderRadius: 99, border: "none", background: val ? color : T.tx4, position: "relative", cursor: "pointer", transition: "background .2s", flexShrink: 0 }}
                >
                  <span style={{ position: "absolute", top: 2, left: val ? 22 : 2, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left .2s", boxShadow: "0 1px 3px rgba(0,0,0,.2)" }} />
                </button>
              </div>
            );
          })}

          <button onClick={handleSave} disabled={formLoading}
            style={{ width: "100%", padding: 16, background: T.navy2, color: "#fff", border: "none", borderRadius: 14, fontWeight: 800, fontSize: 14, marginTop: 10, cursor: formLoading ? "default" : "pointer", opacity: formLoading ? .7 : 1 }}
          >
            {formLoading ? "Saving…" : "Save Item"}
          </button>
        </div>
      </BottomSheet>

      {/* ── BOTTOM SHEET: DELETE CONFIRM ── */}
      <BottomSheet isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Delete Item?">
        <div style={{ textAlign: "center", padding: "8px 0" }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: T.redL, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", border: `1px solid ${T.redB}` }}>
            <AlertCircle size={28} color={T.red} strokeWidth={2} />
          </div>
          <p style={{ fontSize: 13, color: T.tx2, lineHeight: 1.6, marginBottom: 24 }}>
            Are you sure you want to delete <strong style={{ color: T.tx1 }}>{deleteConfirm?.name}</strong>?<br />
            <span style={{ color: T.tx4 }}>This action cannot be undone.</span>
          </p>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setDeleteConfirm(null)}
              style={{ flex: 1, padding: 14, background: "transparent", color: T.tx2, border: `1px solid ${T.border2}`, borderRadius: 12, fontWeight: 700, fontSize: 13, cursor: "pointer" }}
            >Cancel</button>
            <button onClick={handleDelete} disabled={formLoading}
              style={{ flex: 2, padding: 14, background: T.red, color: "#fff", border: "none", borderRadius: 12, fontWeight: 800, fontSize: 13, cursor: formLoading ? "default" : "pointer", opacity: formLoading ? .7 : 1 }}
            >{formLoading ? "Deleting…" : "Yes, Delete"}</button>
          </div>
        </div>
      </BottomSheet>

      <style dangerouslySetInnerHTML={{ __html: `.scrollbar-hide::-webkit-scrollbar{display:none}.scrollbar-hide{-ms-overflow-style:none;scrollbar-width:none}@keyframes storageSpin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}` }} />

      {/* ── STORAGE PICKER SHEET — bertumpuk di atas form sheet ── */}
      <StoragePickerSheet
        isOpen={storagePickerOpen}
        currentUrl={formData.imageUrl}
        onConfirm={url => setFormData(f => ({ ...f, imageUrl: url }))}
        onClose={() => setStoragePickerOpen(false)}
      />
    </div>
  );
}