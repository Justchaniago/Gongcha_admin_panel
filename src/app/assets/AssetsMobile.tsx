"use client";

import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { useMobileSidebar } from "@/components/layout/AdminShell";
import {
  Menu as MenuIcon, Search, X, Plus, ChevronRight,
  Folder, Image as ImageIcon, Upload, Trash2, Edit3,
  CheckCircle2, AlertCircle, RefreshCw, Copy, ExternalLink,
  FolderPlus, Activity,
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
  tx1:     "#111827",
  tx2:     "#374151",
  tx3:     "#6B7280",
  tx4:     "#9CA3AF",
  border:  "#F3F4F6",
  border2: "#E5E7EB",
  r12: 12, r16: 16,
} as const;

type AssetItem   = { root: string; name: string; path: string; fullPath: string; folderPath: string; sizeBytes: number; updatedAt: string | null; url: string; };
type AssetFolder = { root: string; name: string; path: string; fullPath: string; };
type AssetListing = { availableRoots: { name: string }[]; currentRoot: string; currentFolder: string; breadcrumb: { label: string; path: string }[]; folders: AssetFolder[]; assets: AssetItem[]; };

const EMPTY: AssetListing = { availableRoots: [{ name: "products" }, { name: "rewards" }], currentRoot: "products", currentFolder: "", breadcrumb: [{ label: "products", path: "" }], folders: [], assets: [] };

function formatBytes(b: number) {
  if (!b || b <= 0) return "0 B";
  const u = ["B", "KB", "MB", "GB"]; let v = b, i = 0;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v >= 100 || i === 0 ? v.toFixed(0) : v.toFixed(1)} ${u[i]}`;
}

// ── HEADER ──
const PageHeader = ({ left, title, right }: { left: React.ReactNode; title: string; right: React.ReactNode }) => (
  <div style={{ flexShrink: 0, background: T.surface, borderBottom: `1px solid ${T.border}`, padding: "48px 16px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", zIndex: 30 }}>
    <div style={{ width: 36, flexShrink: 0 }}>{left}</div>
    <p style={{ fontSize: 14, fontWeight: 800, color: T.tx1, letterSpacing: "-.01em" }}>{title}</p>
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
          style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: T.surface, borderRadius: "24px 24px 0 0", padding: "20px 20px 48px", zIndex: 9999, maxHeight: fullHeight ? "92dvh" : "88dvh", overflowY: "auto" }}
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
      {type === "success" ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
      {msg}
    </motion.div>
  );
};

export default function AssetsMobile() {
  const { openDrawer } = useMobileSidebar();

  const [listing,       setListing]       = useState<AssetListing>(EMPTY);
  const [loading,       setLoading]       = useState(true);
  const [search,        setSearch]        = useState("");
  const [searchOpen,    setSearchOpen]    = useState(false);
  const [toast,         setToast]         = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<AssetItem | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<AssetFolder | null>(null);
  const [showUpload,    setShowUpload]    = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [deleteTarget,  setDeleteTarget]  = useState<{ type: "asset" | "folder"; item: any } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [renderLimit,   setRenderLimit]   = useState(24);

  // Upload form
  const [uploadFiles,   setUploadFiles]   = useState<File[]>([]);
  const [uploading,     setUploading]     = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // New folder form
  const [newFolderName, setNewFolderName] = useState("");
  const [folderLoading, setFolderLoading] = useState(false);

  // Delete confirm
  const [confirmText, setConfirmText]   = useState("");
  const [acknowledged, setAcknowledged] = useState(false);

  const showToast = useCallback((msg: string, type: "success" | "error" = "success") => setToast({ msg, type }), []);

  const load = useCallback(async (root = listing.currentRoot, folder = "") => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (root)   p.set("root", root);
      if (folder) p.set("folder", folder);
      const res = await fetch(`/api/assets?${p}`, { cache: "no-store", credentials: "include" });
      if (!res.ok) throw new Error();
      setListing(await res.json());
      setRenderLimit(24);
    } catch { showToast("Failed to load assets.", "error"); }
    finally { setLoading(false); }
  }, [listing.currentRoot]);

  useEffect(() => { load(); }, []);

  const visibleFolders = useMemo(() => {
    if (!search.trim()) return listing.folders;
    return listing.folders.filter(f => f.name.toLowerCase().includes(search.toLowerCase()));
  }, [listing.folders, search]);

  const visibleAssets = useMemo(() => {
    if (!search.trim()) return listing.assets;
    return listing.assets.filter(a => a.name.toLowerCase().includes(search.toLowerCase()));
  }, [listing.assets, search]);

  const renderedAssets = visibleAssets.slice(0, renderLimit);

  // Upload
  const handleUpload = async () => {
    if (!uploadFiles.length) return;
    setUploading(true);
    try {
      for (const file of uploadFiles) {
        const fd = new FormData();
        fd.set("action", "upload"); fd.set("root", listing.currentRoot);
        fd.set("folder", listing.currentFolder); fd.set("file", file);
        const r = await fetch("/api/assets", { method: "POST", credentials: "include", body: fd });
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message ?? `Failed: ${file.name}`);
      }
      showToast(`${uploadFiles.length} file${uploadFiles.length > 1 ? "s" : ""} uploaded!`, "success");
      setUploadFiles([]); setShowUpload(false);
      await load(listing.currentRoot, listing.currentFolder);
    } catch (e: any) { showToast(e.message, "error"); }
    finally { setUploading(false); }
  };

  // Create folder
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    setFolderLoading(true);
    try {
      const r = await fetch("/api/assets", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create-folder", root: listing.currentRoot, parentFolder: listing.currentFolder, folderName: newFolderName.trim() }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message);
      showToast("Folder created!", "success");
      setNewFolderName(""); setShowNewFolder(false);
      await load(listing.currentRoot, listing.currentFolder);
    } catch (e: any) { showToast(e.message, "error"); }
    finally { setFolderLoading(false); }
  };

  // Delete
  const handleDelete = async () => {
    if (!deleteTarget) return;
    const isFolder = deleteTarget.type === "folder";
    const phrase   = isFolder ? "delete" : "delete";
    if (confirmText.toLowerCase().trim() !== phrase || !acknowledged) return;
    setDeleteLoading(true);
    try {
      const r = await fetch("/api/assets", {
        method: "DELETE", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: isFolder ? "folder" : "asset", path: deleteTarget.item.fullPath, confirmName: confirmText, acknowledged }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message);
      showToast(`${isFolder ? "Folder" : "Asset"} deleted.`, "success");
      setDeleteTarget(null); setConfirmText(""); setAcknowledged(false);
      setSelectedAsset(null); setSelectedFolder(null);
      await load(listing.currentRoot, listing.currentFolder);
    } catch (e: any) { showToast(e.message, "error"); }
    finally { setDeleteLoading(false); }
  };

  // Copy URL
  const copyUrl = async (asset: AssetItem) => {
    try { await navigator.clipboard.writeText(asset.url); showToast("URL copied!", "success"); }
    catch { showToast("Failed to copy.", "error"); }
  };

  const currentPath = listing.currentFolder ? `${listing.currentRoot}/${listing.currentFolder}` : listing.currentRoot;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: T.bg, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif", WebkitFontSmoothing: "antialiased", overflowX: "hidden" }}>

      <PageHeader
        left={
          <button onClick={openDrawer} style={{ width: 36, height: 36, borderRadius: 11, border: `1px solid ${T.border2}`, background: T.surface, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <MenuIcon size={18} color={T.tx1} strokeWidth={2} />
          </button>
        }
        title="Asset Library"
        right={
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setSearchOpen(v => !v)} style={{ width: 36, height: 36, borderRadius: 11, background: searchOpen ? T.navy2 : T.border, border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              {searchOpen ? <X size={16} color="#fff" strokeWidth={2.5} /> : <Search size={16} color={T.tx2} strokeWidth={2} />}
            </button>
            <button onClick={() => setShowUpload(true)} style={{ width: 36, height: 36, borderRadius: 11, background: T.blue, border: "none", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              <Plus size={18} strokeWidth={2.5} />
            </button>
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
              <Search size={14} color={T.tx4} style={{ flexShrink: 0 }} />
              <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Search files or folders…"
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

          {/* BENTO */}
          <BentoRow>
            <BentoCard label="Folders" value={listing.folders.length} color={T.amber}  bg={T.amberL} icon={Folder}    delay={0}    />
            <BentoCard label="Assets"  value={listing.assets.length}  color={T.blue}   bg={T.blueL}  icon={ImageIcon} delay={0.05} />
            <BentoCard label="Root"    value={`/${listing.currentRoot}`} color={T.green} bg={T.greenL} icon={FolderPlus} delay={0.1} />
          </BentoRow>

          {/* Root selector */}
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            {listing.availableRoots.map(r => (
              <button key={r.name} onClick={() => load(r.name, "")}
                style={{ flex: 1, padding: "8px 0", borderRadius: 10, border: "none", background: r.name === listing.currentRoot ? T.green : T.surface, color: r.name === listing.currentRoot ? "#fff" : T.tx3, fontSize: 12, fontWeight: 700, cursor: "pointer", border2: `1px solid ${T.border}` } as any}
              >
                /{r.name}
              </button>
            ))}
          </div>

          {/* Breadcrumb */}
          <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" as const, marginBottom: 8 }}>
            {listing.breadcrumb.map((crumb, i) => (
              <React.Fragment key={crumb.path || "root"}>
                {i > 0 && <span style={{ fontSize: 11, color: T.tx4 }}>/</span>}
                <button onClick={() => load(listing.currentRoot, crumb.path)}
                  style={{ fontSize: 12, fontWeight: 700, color: i === listing.breadcrumb.length - 1 ? T.tx1 : T.blue, background: "none", border: "none", cursor: "pointer", padding: 0 }}
                >
                  {crumb.label}
                </button>
              </React.Fragment>
            ))}
          </div>

          {/* Action row */}
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <button onClick={() => setShowNewFolder(true)} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px 0", borderRadius: 10, border: `1px solid ${T.border2}`, background: T.surface, color: T.tx2, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              <FolderPlus size={14} /> New Folder
            </button>
            <button onClick={() => load(listing.currentRoot, listing.currentFolder)} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px 0", borderRadius: 10, border: `1px solid ${T.border2}`, background: T.surface, color: T.tx2, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
              <RefreshCw size={20} color={T.tx4} />
            </motion.div>
          </div>
        ) : (
          <div style={{ padding: "0 14px 24px" }}>

            {/* Folders */}
            {visibleFolders.length > 0 && (
              <>
                <p style={{ fontSize: 9, fontWeight: 800, color: T.tx4, textTransform: "uppercase" as const, letterSpacing: ".14em", marginBottom: 8 }}>Folders ({visibleFolders.length})</p>
                <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r16, overflow: "hidden", marginBottom: 14 }}>
                  {visibleFolders.map((f, i) => (
                    <div key={f.fullPath} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderBottom: i < visibleFolders.length - 1 ? `1px solid ${T.border}` : "none" }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: T.amberL, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Folder size={18} color={T.amber} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => load(f.root, f.path)}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: T.tx1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.name}</p>
                        <p style={{ fontSize: 10, color: T.tx4 }}>/{f.fullPath}</p>
                      </div>
                      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                        <button onClick={() => load(f.root, f.path)} style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${T.border2}`, background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                          <ChevronRight size={14} color={T.tx3} />
                        </button>
                        <button onClick={() => { setSelectedFolder(f); }}
                          style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${T.border2}`, background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                          <Edit3 size={13} color={T.tx3} />
                        </button>
                        <button onClick={() => { setDeleteTarget({ type: "folder", item: f }); setConfirmText(""); setAcknowledged(false); }}
                          style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${T.redB}`, background: T.redL, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                          <Trash2 size={13} color={T.red} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Assets grid */}
            {visibleAssets.length > 0 && (
              <>
                <p style={{ fontSize: 9, fontWeight: 800, color: T.tx4, textTransform: "uppercase" as const, letterSpacing: ".14em", marginBottom: 8 }}>Assets ({visibleAssets.length})</p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
                  {renderedAssets.map((a, i) => (
                    <motion.div key={a.fullPath} initial={{ opacity: 0, scale: .95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: Math.min(i * .02, .3) }}
                      onClick={() => setSelectedAsset(a)}
                      style={{ background: T.surface, borderRadius: T.r16, border: `1px solid ${T.border}`, overflow: "hidden", cursor: "pointer" }}
                    >
                      <div style={{ aspectRatio: "1", background: "linear-gradient(135deg, #F8FAFC, #F1F5F9)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                        <img src={a.url} alt={a.name} style={{ width: "100%", height: "100%", objectFit: "contain", padding: 8 }} />
                      </div>
                      <div style={{ padding: "8px 10px" }}>
                        <p style={{ fontSize: 11, fontWeight: 700, color: T.tx1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.name}</p>
                        <p style={{ fontSize: 9, color: T.tx4, marginTop: 2 }}>{formatBytes(a.sizeBytes)}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
                {renderedAssets.length < visibleAssets.length && (
                  <button onClick={() => setRenderLimit(v => v + 24)} style={{ width: "100%", padding: "12px 0", marginTop: 10, borderRadius: 12, border: `1px solid ${T.border2}`, background: T.surface, color: T.blue, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                    Load more ({visibleAssets.length - renderedAssets.length} remaining)
                  </button>
                )}
              </>
            )}

            {visibleFolders.length === 0 && visibleAssets.length === 0 && !loading && (
              <div style={{ textAlign: "center", padding: "40px 0" }}>
                <p style={{ fontSize: 12, color: T.tx4 }}>{search ? `No results for "${search}"` : "Empty folder"}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── ASSET DETAIL SHEET ── */}
      <BottomSheet isOpen={!!selectedAsset} onClose={() => setSelectedAsset(null)} title="Asset Details">
        {selectedAsset && (
          <div>
            <div style={{ aspectRatio: "1", background: "linear-gradient(135deg, #F8FAFC, #F1F5F9)", borderRadius: 14, overflow: "hidden", marginBottom: 16, maxHeight: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <img src={selectedAsset.url} alt={selectedAsset.name} style={{ width: "100%", height: "100%", objectFit: "contain", padding: 12 }} />
            </div>
            <p style={{ fontSize: 15, fontWeight: 800, color: T.tx1, marginBottom: 4 }}>{selectedAsset.name}</p>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const, marginBottom: 14 }}>
              <span style={{ fontSize: 9, fontWeight: 800, padding: "3px 8px", borderRadius: 6, background: T.blueL, color: T.blueD }}>{selectedAsset.root}</span>
              <span style={{ fontSize: 9, color: T.tx4, padding: "3px 8px", borderRadius: 6, background: T.bg }}>{formatBytes(selectedAsset.sizeBytes)}</span>
            </div>
            <div style={{ padding: "10px 14px", background: T.bg, borderRadius: 10, marginBottom: 14 }}>
              <p style={{ fontSize: 10, color: T.tx4, marginBottom: 2 }}>Path</p>
              <p style={{ fontSize: 11, color: T.tx1, fontWeight: 600, wordBreak: "break-all" as const }}>{selectedAsset.fullPath}</p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <button onClick={() => copyUrl(selectedAsset)} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: 12, borderRadius: 10, border: `1px solid ${T.border2}`, background: T.bg, color: T.tx2, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                <Copy size={13} /> Copy URL
              </button>
              <button onClick={() => window.open(selectedAsset.url, "_blank")} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: 12, borderRadius: 10, border: `1px solid ${T.border2}`, background: T.bg, color: T.tx2, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                <ExternalLink size={13} /> Open
              </button>
              <button onClick={() => { setSelectedAsset(null); setTimeout(() => { setDeleteTarget({ type: "asset", item: selectedAsset }); setConfirmText(""); setAcknowledged(false); }, 300); }}
                style={{ gridColumn: "span 2", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: 12, borderRadius: 10, border: "none", background: T.redL, color: T.red, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
              >
                <Trash2 size={13} /> Delete Asset
              </button>
            </div>
          </div>
        )}
      </BottomSheet>

      {/* ── UPLOAD SHEET ── */}
      <BottomSheet isOpen={showUpload} onClose={() => { setShowUpload(false); setUploadFiles([]); }} title="Upload Images">
        <div>
          <div onClick={() => fileRef.current?.click()}
            style={{ border: `2px dashed ${uploadFiles.length ? T.blue : T.border2}`, borderRadius: 14, padding: "28px 16px", textAlign: "center", cursor: "pointer", background: uploadFiles.length ? T.blueL : T.bg, marginBottom: 14 }}
          >
            <Upload size={24} color={uploadFiles.length ? T.blue : T.tx4} style={{ margin: "0 auto 8px" }} />
            <p style={{ fontSize: 13, fontWeight: 700, color: uploadFiles.length ? T.blueD : T.tx2 }}>
              {uploadFiles.length ? `${uploadFiles.length} file${uploadFiles.length > 1 ? "s" : ""} selected` : "Tap to select images"}
            </p>
            <p style={{ fontSize: 11, color: T.tx4 }}>Current folder: /{listing.currentFolder || listing.currentRoot}</p>
            <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={e => setUploadFiles(Array.from(e.target.files ?? []).filter(f => f.type.startsWith("image/")))} />
          </div>
          {uploadFiles.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 14 }}>
              {uploadFiles.slice(0, 6).map((f, i) => (
                <div key={i} style={{ borderRadius: 8, overflow: "hidden", aspectRatio: "1", background: T.bg }}>
                  <img src={URL.createObjectURL(f)} alt={f.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
              ))}
            </div>
          )}
          <button onClick={handleUpload} disabled={!uploadFiles.length || uploading}
            style={{ width: "100%", padding: 16, background: uploadFiles.length ? T.navy2 : T.border2, color: uploadFiles.length ? "#fff" : T.tx4, border: "none", borderRadius: 14, fontWeight: 800, fontSize: 14, cursor: uploadFiles.length ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
          >
            {uploading ? <><motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: .9, ease: "linear" }}><Activity size={14} color="#fff" /></motion.div> Uploading…</> : `Upload ${uploadFiles.length || ""} File${uploadFiles.length !== 1 ? "s" : ""}`}
          </button>
        </div>
      </BottomSheet>

      {/* ── NEW FOLDER SHEET ── */}
      <BottomSheet isOpen={showNewFolder} onClose={() => { setShowNewFolder(false); setNewFolderName(""); }} title="Create Folder">
        <div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 9, fontWeight: 800, color: T.tx4, textTransform: "uppercase" as const, letterSpacing: ".14em", marginBottom: 6 }}>Folder Name</label>
            <input autoFocus value={newFolderName} onChange={e => setNewFolderName(e.target.value)} placeholder="homepage-banners"
              style={{ width: "100%", background: T.bg, border: `1px solid ${T.border2}`, borderRadius: 12, padding: "12px 14px", fontSize: 14, color: T.tx1, outline: "none", boxSizing: "border-box" as const }}
            />
            <p style={{ fontSize: 10, color: T.tx4, marginTop: 4 }}>Parent: /{listing.currentFolder || listing.currentRoot}</p>
          </div>
          <button onClick={handleCreateFolder} disabled={!newFolderName.trim() || folderLoading}
            style={{ width: "100%", padding: 16, background: newFolderName.trim() ? T.navy2 : T.border2, color: newFolderName.trim() ? "#fff" : T.tx4, border: "none", borderRadius: 14, fontWeight: 800, fontSize: 14, cursor: "pointer" }}
          >
            {folderLoading ? "Creating…" : "Create Folder"}
          </button>
        </div>
      </BottomSheet>

      {/* ── DELETE CONFIRM ── */}
      {deleteTarget && (
        <AnimatePresence>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, zIndex: 10998, background: "rgba(0,0,0,.4)", backdropFilter: "blur(4px)" }}
            onClick={() => !deleteLoading && setDeleteTarget(null)} />
          <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 360, damping: 36 }}
            style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 10999, background: T.surface, borderRadius: "24px 24px 0 0", padding: "16px 20px 48px" }}
          >
            <div style={{ width: 36, height: 4, borderRadius: 99, background: T.border2, margin: "0 auto 20px" }} />
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: T.redL, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <AlertCircle size={18} color={T.red} />
              </div>
              <div>
                <p style={{ fontSize: 15, fontWeight: 800, color: T.tx1, marginBottom: 4 }}>Delete {deleteTarget.type === "folder" ? "Folder" : "Asset"}?</p>
                <p style={{ fontSize: 12, color: T.tx3 }}>"{deleteTarget.item.name}" will be permanently deleted{deleteTarget.type === "folder" ? " along with all its contents" : ""}.</p>
              </div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 9, fontWeight: 800, color: T.tx4, textTransform: "uppercase" as const, letterSpacing: ".14em", marginBottom: 6 }}>Type 'delete' to confirm</label>
              <input value={confirmText} onChange={e => setConfirmText(e.target.value)} placeholder="delete"
                style={{ width: "100%", background: T.bg, border: `1px solid ${T.border2}`, borderRadius: 12, padding: "12px 14px", fontSize: 14, color: T.tx1, outline: "none", boxSizing: "border-box" as const }}
              />
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, cursor: "pointer" }}>
              <input type="checkbox" checked={acknowledged} onChange={e => setAcknowledged(e.target.checked)} />
              <span style={{ fontSize: 12, color: T.tx2 }}>I understand this cannot be undone.</span>
            </label>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setDeleteTarget(null)} disabled={deleteLoading} style={{ flex: 1, padding: 14, borderRadius: 14, border: `1px solid ${T.border2}`, background: "transparent", fontSize: 13, fontWeight: 700, color: T.tx2, cursor: "pointer" }}>Cancel</button>
              <button onClick={handleDelete} disabled={deleteLoading || confirmText.toLowerCase().trim() !== "delete" || !acknowledged}
                style={{ flex: 2, padding: 14, borderRadius: 14, border: "none", background: confirmText.toLowerCase().trim() === "delete" && acknowledged ? T.red : T.border2, color: confirmText.toLowerCase().trim() === "delete" && acknowledged ? "#fff" : T.tx4, fontSize: 13, fontWeight: 800, cursor: "pointer", opacity: deleteLoading ? .7 : 1 }}
              >
                {deleteLoading ? "Deleting…" : "Delete Permanently"}
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      )}

      <AnimatePresence>
        {toast && <MToast key="toast" msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
      </AnimatePresence>

      <style dangerouslySetInnerHTML={{ __html: `.scrollbar-hide::-webkit-scrollbar{display:none}.scrollbar-hide{-ms-overflow-style:none;scrollbar-width:none}` }} />
    </div>
  );
}