"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { Promotion, promotionConverter, PromotionType } from "@/types/firestore";
import { useAuth } from "@/context/AuthContext";
import { useMobileSidebar } from "@/components/layout/AdminShell";
import { FastApiAdminGateway } from "@/lib/api/FastApiAdminGateway";
import { Menu as MenuIcon, Plus, X, ChevronUp, ChevronDown, Edit3, Trash2, CheckCircle2, XCircle, Activity } from "lucide-react";

const T = {
  bg: "#F4F5F7", surface: "#FFFFFF", blue: "#3B82F6", blueL: "#EFF6FF", blueD: "#1D4ED8",
  red: "#DC2626", redL: "#FEF2F2", redB: "#FECACA", green: "#059669", greenL: "#ECFDF5",
  greenB: "#6EE7B7", amber: "#D97706", amberL: "#FFFBEB", tx1: "#111827", tx2: "#374151",
  tx3: "#6B7280", tx4: "#9CA3AF", border: "#F3F4F6", border2: "#E5E7EB",
} as const;

type Tab = PromotionType;

const TAB_LABELS: Record<Tab, string> = { carousel: "Carousel", modal_ad: "Modal Ads" };

const compressToWebP = (file: File): Promise<Blob> => new Promise((resolve, reject) => {
  const img = new Image();
  img.src = URL.createObjectURL(file);
  img.onload = () => {
    const max = 1200;
    let { width, height } = img;
    if (width > max) { height = Math.round(height * max / width); width = max; }
    if (height > max) { width = Math.round(width * max / height); height = max; }
    const canvas = document.createElement("canvas");
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) { reject(new Error("Canvas failed")); return; }
    ctx.drawImage(img, 0, 0, width, height);
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Blob failed")), "image/webp", 0.82);
  };
  img.onerror = () => reject(new Error("Image load failed"));
});

export default function PromotionsMobile() {
  const { can } = useAuth();
  const { openDrawer } = useMobileSidebar();
  const canMutate = can("promo.create") || can("promo.update") || can("promo.delete");

  const [promos, setPromos] = useState<Promotion[]>([]);
  const [syncOk, setSyncOk] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("carousel");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Promotion | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Promotion | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const pushToast = useCallback((msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3200);
  }, []);

  const loadPromotions = async () => {
    try {
      const fetchedPromos = await FastApiAdminGateway.getPromotions();
      setPromos(fetchedPromos.map((p: any) => ({
        id: p.id || p.code || "promo-" + Math.random(),
        code: p.code,
        title: p.title,
        subtitle: p.subtitle || "",
        imageUrl: p.image_url || "",
        isActive: p.is_active !== false,
        type: p.banner_type === "modal_ad" ? "modal_ad" : "carousel",
        order: 0,
      } as any)));
      setSyncOk(true);
    } catch (err) {
      console.warn("PromotionsMobile getPromotions:", err);
      setSyncOk(false);
    }
  };

  useEffect(() => {
    loadPromotions();
  }, []);

  const filtered = promos.filter((p) => p.type === activeTab);

  const handleToggle = async (promo: Promotion) => {
    if (busy) return;
    setBusy(promo.id);
    const r = await fetch(`/api/promotions/${promo.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !promo.isActive }) });
    setBusy(null);
    if (!r.ok) pushToast("Gagal update status.", false);
  };

  const handleReorder = async (promo: Promotion, dir: "up" | "down") => {
    if (busy) return;
    const idx = filtered.findIndex((p) => p.id === promo.id);
    const swapIdx = dir === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= filtered.length) return;
    const target = filtered[swapIdx];
    setBusy(promo.id);
    await Promise.all([
      fetch(`/api/promotions/${promo.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order: target.order }) }),
      fetch(`/api/promotions/${target.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order: promo.order }) }),
    ]);
    setBusy(null);
  };

  const handleDelete = async (promo: Promotion) => {
    setBusy(promo.id);
    try {
      await FastApiAdminGateway.deletePromotion(promo.id);
      if (promo.storagePath) {
        try {
          await fetch("/api/assets", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ target: "asset", path: promo.storagePath, confirmName: "delete", acknowledged: true }),
          });
        } catch { /* best-effort */ }
      }
      pushToast(`"${promo.title}" dihapus.`);
    } catch {
      pushToast("Gagal menghapus.", false);
    }
    setBusy(null);
    setDeleteTarget(null);
  };

  return (
    <div style={{ minHeight: "100dvh", background: T.bg, fontFamily: "Inter, system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ position: "sticky", top: 0, zIndex: 50, background: T.surface, borderBottom: `1px solid ${T.border}`, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={openDrawer} style={{ width: 36, height: 36, border: "none", background: T.bg, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <MenuIcon size={18} color={T.tx2} />
        </button>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 15, fontWeight: 800, color: T.tx1 }}>Promo Management</p>
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 1 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: syncOk ? T.green : T.amber, display: "inline-block" }} />
            <span style={{ fontSize: 10.5, color: T.tx4 }}>{syncOk ? "Live" : "Syncing…"}</span>
          </div>
        </div>
        {canMutate && (
          <button onClick={() => { setEditing(null); setShowForm(true); }} style={{ width: 36, height: 36, border: "none", background: T.blue, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <Plus size={18} color="#fff" />
          </button>
        )}
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", background: T.surface, borderBottom: `1px solid ${T.border}`, paddingInline: 16 }}>
        {(["carousel", "modal_ad"] as Tab[]).map((tab) => {
          const active = tab === activeTab;
          const count = promos.filter((p) => p.type === tab).length;
          return (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{ flex: 1, padding: "12px 0", border: "none", background: "transparent", borderBottom: active ? `2px solid ${T.blue}` : "2px solid transparent", color: active ? T.blue : T.tx3, fontSize: 13, fontWeight: active ? 700 : 500, marginBottom: -1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              {TAB_LABELS[tab]}
              <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 6, background: active ? T.blueL : T.bg, color: active ? T.blue : T.tx4 }}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* List */}
      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 0" }}>
            <Activity size={32} color={T.tx4} style={{ marginBottom: 10 }} />
            <p style={{ fontSize: 14, fontWeight: 600, color: T.tx3 }}>Belum ada {TAB_LABELS[activeTab]}</p>
            <p style={{ fontSize: 12, color: T.tx4, marginTop: 4 }}>Tap + untuk menambahkan promo.</p>
          </div>
        ) : filtered.map((promo, idx) => (
          <div key={promo.id} style={{ background: T.surface, borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,.06)" }}>
            {promo.imageUrl && (
              <img src={promo.imageUrl} alt={promo.title} style={{ width: "100%", height: 130, objectFit: "cover", display: "block" }} />
            )}
            <div style={{ padding: "10px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <p style={{ fontSize: 13.5, fontWeight: 700, color: T.tx1, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{promo.title}</p>
                <span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 7, background: promo.isActive ? T.greenL : T.bg, color: promo.isActive ? T.green : T.tx4, border: `1px solid ${promo.isActive ? T.greenB : T.border2}`, flexShrink: 0 }}>
                  {promo.isActive ? "Active" : "Inactive"}
                </span>
              </div>
              {canMutate && (
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button onClick={() => handleReorder(promo, "up")} disabled={idx === 0 || !!busy} style={{ flex: 1, padding: "7px 0", border: `1px solid ${T.border2}`, borderRadius: 8, background: "transparent", cursor: idx === 0 ? "default" : "pointer", opacity: idx === 0 ? 0.35 : 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <ChevronUp size={14} color={T.tx3} />
                  </button>
                  <button onClick={() => handleReorder(promo, "down")} disabled={idx === filtered.length - 1 || !!busy} style={{ flex: 1, padding: "7px 0", border: `1px solid ${T.border2}`, borderRadius: 8, background: "transparent", cursor: idx === filtered.length - 1 ? "default" : "pointer", opacity: idx === filtered.length - 1 ? 0.35 : 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <ChevronDown size={14} color={T.tx3} />
                  </button>
                  <button onClick={() => handleToggle(promo)} disabled={busy === promo.id} style={{ flex: 1, padding: "7px 0", border: `1px solid ${promo.isActive ? T.greenB : T.border2}`, borderRadius: 8, background: promo.isActive ? T.greenL : "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {promo.isActive ? <CheckCircle2 size={14} color={T.green} /> : <XCircle size={14} color={T.tx4} />}
                  </button>
                  <button onClick={() => { setEditing(promo); setShowForm(true); }} style={{ flex: 1, padding: "7px 0", border: `1px solid ${T.border2}`, borderRadius: 8, background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Edit3 size={14} color={T.tx3} />
                  </button>
                  <button onClick={() => setDeleteTarget(promo)} style={{ flex: 1, padding: "7px 0", border: `1px solid ${T.redB}`, borderRadius: 8, background: T.redL, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Trash2 size={14} color={T.red} />
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Delete confirm sheet */}
      {deleteTarget && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,.45)", display: "flex", alignItems: "flex-end" }} onClick={() => setDeleteTarget(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: T.surface, borderRadius: "18px 18px 0 0", padding: "24px 20px 40px", width: "100%" }}>
            <p style={{ fontSize: 15, fontWeight: 800, color: T.tx1, marginBottom: 6 }}>Hapus "{deleteTarget.title}"?</p>
            <p style={{ fontSize: 13, color: T.tx3, marginBottom: 20 }}>Tindakan ini tidak bisa dibatalkan.</p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setDeleteTarget(null)} style={{ flex: 1, padding: "13px 0", border: `1px solid ${T.border2}`, borderRadius: 12, background: "transparent", fontSize: 14, fontWeight: 600, color: T.tx2, cursor: "pointer" }}>Batal</button>
              <button onClick={() => handleDelete(deleteTarget)} disabled={!!busy} style={{ flex: 1, padding: "13px 0", border: "none", borderRadius: 12, background: T.red, fontSize: 14, fontWeight: 700, color: "#fff", cursor: "pointer", opacity: busy ? 0.6 : 1 }}>
                {busy ? "Menghapus…" : "Hapus"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit sheet */}
      {showForm && (
        <PromoFormSheet
          tab={activeTab}
          editing={editing}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={(msg) => pushToast(msg)}
        />
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", bottom: 24, left: 16, right: 16, zIndex: 9999, padding: "13px 18px", borderRadius: 12, background: toast.ok ? T.green : T.red, color: "#fff", fontSize: 13.5, fontWeight: 600, boxShadow: "0 8px 32px rgba(0,0,0,.18)", textAlign: "center" }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

// ── Form Sheet ────────────────────────────────────────────────────────────────
function PromoFormSheet({
  tab, editing, onClose, onSaved,
}: {
  tab: Tab; editing: Promotion | null; onClose: () => void; onSaved: (msg: string) => void;
}) {
  const isEdit = editing !== null;
  const fileRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState(editing?.title ?? "");
  const [imageUrl, setImageUrl] = useState(editing?.imageUrl ?? "");
  const [storagePath, setStoragePath] = useState(editing?.storagePath ?? "");
  const [isActive, setIsActive] = useState(editing?.isActive ?? true);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadErr(null); setUploadPct(10);
    try {
      const blob = await compressToWebP(file);
      const fileName = `${Date.now()}_${file.name.replace(/\.[^.]+$/, "")}.webp`;

      setUploadPct(50);
      const formData = new FormData();
      formData.append("action", "upload");
      formData.append("root", "promotions");
      formData.append("folder", tab);
      formData.append("file", blob, fileName);
      formData.append("fileName", fileName);

      const res = await fetch("/api/assets", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      setUploadPct(90);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message ?? "Failed to upload image.");

      setImageUrl(data.asset.url);
      setStoragePath(`promotions/${tab}/${fileName}`);
      setUploadPct(100);
      setTimeout(() => setUploadPct(null), 400);
    } catch (e: any) { setUploadErr(e.message); setUploadPct(null); }
  };

  const handleSave = async () => {
    setErr(null);
    if (!title.trim()) { setErr("Title wajib diisi."); return; }
    if (!imageUrl) { setErr("Upload gambar terlebih dahulu."); return; }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        code: isEdit ? editing!.id : "promo_" + title.toLowerCase().replace(/[^a-z0-9]/g, "_"),
        title: title.trim(),
        subtitle: "",
        image_url: imageUrl,
        banner_type: tab === "modal_ad" ? "modal_ad" : "carousel",
        active: isActive,
      };

      await FastApiAdminGateway.createPromotion(payload as any);

      onSaved(isEdit ? `"${title.trim()}" diperbarui.` : `"${title.trim()}" ditambahkan.`);
      onClose();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  const T2 = { bg: "#F4F5F7", surface: "#FFFFFF", blue: "#3B82F6", blueL: "#EFF6FF", red: "#DC2626", redL: "#FEF2F2", redB: "#FECACA", green: "#059669", tx1: "#111827", tx2: "#374151", tx3: "#6B7280", tx4: "#9CA3AF", border: "#F3F4F6", border2: "#E5E7EB", amber: "#D97706", amberL: "#FFFBEB", amberB: "#FDE68A" };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,.45)", display: "flex", alignItems: "flex-end" }}>
      <div style={{ background: T2.surface, borderRadius: "18px 18px 0 0", padding: "24px 20px 40px", width: "100%", maxHeight: "88dvh", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <p style={{ fontSize: 16, fontWeight: 800, color: T2.tx1 }}>{isEdit ? "Edit Promo" : `Tambah Promo`}</p>
          <button onClick={onClose} style={{ width: 32, height: 32, border: "none", background: T2.bg, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <X size={16} color={T2.tx3} />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: T2.tx3, marginBottom: 6, letterSpacing: ".07em", textTransform: "uppercase" }}>Label Promo</p>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Contoh: Promo Matcha Summer" style={{ width: "100%", padding: "11px 14px", border: `1px solid ${T2.border2}`, borderRadius: 10, fontSize: 14, color: T2.tx1, background: T2.surface, boxSizing: "border-box" }} />
          </div>

          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: T2.tx3, marginBottom: 6, letterSpacing: ".07em", textTransform: "uppercase" }}>Gambar</p>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: "none" }} />
            {imageUrl ? (
              <div style={{ position: "relative", borderRadius: 10, overflow: "hidden" }}>
                <img src={imageUrl} alt="preview" style={{ width: "100%", height: 160, objectFit: "cover", display: "block" }} />
                <button onClick={() => fileRef.current?.click()} style={{ position: "absolute", bottom: 8, right: 8, background: "rgba(0,0,0,.6)", color: "#fff", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  Ganti
                </button>
              </div>
            ) : (
              <button onClick={() => fileRef.current?.click()} disabled={uploadPct !== null} style={{ width: "100%", padding: "28px 0", border: `2px dashed ${T2.border2}`, borderRadius: 10, background: T2.bg, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 13, color: T2.tx3, fontWeight: 500 }}>{uploadPct !== null ? `Uploading… ${uploadPct}%` : "Tap untuk upload gambar"}</span>
              </button>
            )}
            {uploadPct !== null && (
              <div style={{ marginTop: 8, height: 4, borderRadius: 2, background: T2.border2, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${uploadPct}%`, background: T2.blue, transition: "width .2s ease" }} />
              </div>
            )}
            {uploadErr && <p style={{ fontSize: 12, color: T2.red, marginTop: 4 }}>{uploadErr}</p>}
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderRadius: 10, border: `1px solid ${T2.border2}`, background: T2.bg }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: T2.tx1 }}>Status Aktif</p>
            <button onClick={() => setIsActive(!isActive)} style={{ width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer", background: isActive ? T2.green : T2.border2, position: "relative", flexShrink: 0 }}>
              <span style={{ position: "absolute", top: 3, left: isActive ? 22 : 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left .15s", boxShadow: "0 1px 3px rgba(0,0,0,.2)" }} />
            </button>
          </div>

          {/* Scheduling placeholder */}
          <div style={{ padding: "12px 14px", borderRadius: 10, border: `1px dashed ${T2.border2}`, background: "#FAFAFA", opacity: 0.7 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: T2.tx3, textTransform: "uppercase", letterSpacing: ".07em" }}>Scheduling</p>
              <span style={{ fontSize: 10, fontWeight: 700, color: T2.amber, background: T2.amberL, border: `1px solid ${T2.amberB}`, borderRadius: 6, padding: "2px 7px" }}>Coming Soon</span>
            </div>
          </div>

          {err && <div style={{ padding: "10px 14px", borderRadius: 8, background: T2.redL, border: `1px solid ${T2.redB}`, fontSize: 13, color: T2.red }}>{err}</div>}

          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <button onClick={onClose} style={{ flex: 1, padding: "14px 0", border: `1px solid ${T2.border2}`, borderRadius: 12, background: "transparent", fontSize: 14, fontWeight: 600, color: T2.tx2, cursor: "pointer" }}>Batal</button>
            <button onClick={handleSave} disabled={saving || uploadPct !== null} style={{ flex: 1, padding: "14px 0", border: "none", borderRadius: 12, background: T2.blue, fontSize: 14, fontWeight: 700, color: "#fff", cursor: "pointer", opacity: (saving || uploadPct !== null) ? 0.7 : 1 }}>
              {saving ? "Menyimpan…" : isEdit ? "Simpan" : "Tambah"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
