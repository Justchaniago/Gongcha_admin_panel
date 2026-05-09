"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { font } from "@/lib/design-tokens";
import {
  GcPage, GcPageHeader, GcPanel, GcEmptyState, GcFieldLabel,
  GcToast, GcModalShell, GcButton, GcInput,
} from "@/components/ui/gc";
import { useAuth } from "@/context/AuthContext";
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { storage } from "@/lib/firebaseClient";
import { db } from "@/lib/firebaseClient";
import { Promotion, promotionConverter, PromotionType } from "@/types/firestore";
import { query, collection, orderBy, onSnapshot } from "firebase/firestore";
import { C as baseC } from "../../lib/design-tokens";

const C = { ...baseC, border2: "#E5E7EB", bgSub: "#F3F4F6", blueMid: "#2563EB", blueHov: "#2563EB", bluePale: "#DBEAFE" };

type SyncStatus = "connecting" | "live" | "error";
type Tab = PromotionType;

const TAB_LABELS: Record<Tab, string> = {
  carousel: "Carousel Banners",
  modal_ad: "Modal Ads",
};

const TAB_DESCRIPTIONS: Record<Tab, string> = {
  carousel: "Tampil di HomeScreen — banner horizontal yang bisa di-swipe member.",
  modal_ad: "Muncul saat member login atau kembali ke app — full-screen ad pop-up.",
};

const globalStyles = `
  @keyframes gcRise    { from { opacity:0; transform:translateY(14px) scale(.98) } to { opacity:1; transform:none } }
  @keyframes pulseDot  { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(.82)} }
  @keyframes toastIn   { from{opacity:0;transform:translateY(10px) scale(.96)} to{opacity:1;transform:none} }
  .promo-row { transition: box-shadow .18s ease, border-color .18s ease !important; }
  .promo-row:hover { box-shadow: 0 4px 18px rgba(0,0,0,.07) !important; border-color: ${C.blueMid} !important; }
  .promo-tab { transition: all .15s ease !important; cursor: pointer; user-select: none; }
  .promo-tab:hover { background: ${C.bgSub} !important; }
  .promo-icon-btn { transition: all .12s ease !important; }
  .promo-icon-btn:hover { background: ${C.bgSub} !important; }
`;

// ── Compress to WebP ──────────────────────────────────────────────────────────
const compressImageToWebP = (file: File, maxWidth = 1200, maxHeight = 1200, quality = 0.82): Promise<Blob> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.src = URL.createObjectURL(file);
    img.onload = () => {
      let { width, height } = img;
      if (width > maxWidth) { height = Math.round((height * maxWidth) / width); width = maxWidth; }
      if (height > maxHeight) { width = Math.round((width * maxHeight) / height); height = maxHeight; }
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("Canvas init failed")); return; }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Blob conversion failed")), "image/webp", quality);
    };
    img.onerror = () => reject(new Error("Failed to read image"));
  });

// ── Live Badge ────────────────────────────────────────────────────────────────
function LiveBadge({ status }: { status: SyncStatus }) {
  const map = { connecting: { color: C.orange, label: "Syncing" }, live: { color: C.green, label: "Live" }, error: { color: C.red, label: "Error" } };
  const { color, label } = map[status];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 600, color, fontFamily: font }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0, animation: status === "live" ? "pulseDot 2s ease-in-out infinite" : "none" }} />
      {label}
    </span>
  );
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ msg, type, onDone }: { msg: string; type: "success" | "error"; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 3500); return () => clearTimeout(t); }, [onDone]);
  return (
    <div style={{ position: "fixed", bottom: 28, right: 28, zIndex: 9999, padding: "12px 18px", borderRadius: 12, background: type === "success" ? C.green : C.red, color: "#fff", fontSize: 13.5, fontWeight: 600, fontFamily: font, boxShadow: C.shadowLg, animation: "toastIn .22s ease" }}>
      {msg}
    </div>
  );
}

// ── Delete Confirm Modal ──────────────────────────────────────────────────────
function DeleteModal({ promo, onClose, onDeleted }: { promo: Promotion; onClose: () => void; onDeleted: (msg: string) => void }) {
  const [loading, setLoading] = useState(false);

  const confirm = async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/promotions/${promo.id}`, { method: "DELETE" });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body.message ?? "Gagal menghapus.");

      if (promo.storagePath) {
        try { await deleteObject(ref(storage, promo.storagePath)); } catch { /* storage cleanup best-effort */ }
      }

      onDeleted(`"${promo.title}" berhasil dihapus.`);
    } catch (err: any) {
      onDeleted(`Error: ${err.message}`);
    } finally {
      setLoading(false);
      onClose();
    }
  };

  return (
    <GcModalShell
      onClose={onClose}
      title="Hapus promo ini?"
      eyebrow="Destructive Action"
      description={<><strong style={{ color: C.tx1 }}>"{promo.title}"</strong> akan dihapus permanen dari Firestore dan Storage.</>}
      maxWidth={420}
      footer={
        <>
          <GcButton variant="ghost" size="lg" onClick={onClose}>Batal</GcButton>
          <GcButton variant="danger" size="lg" onClick={confirm} loading={loading}>Ya, Hapus</GcButton>
        </>
      }
    >{null}</GcModalShell>
  );
}

// ── Add / Edit Modal ──────────────────────────────────────────────────────────
interface FormState {
  title: string;
  imageUrl: string;
  storagePath: string;
  isActive: boolean;
}

function PromoFormModal({
  tab,
  editing,
  onClose,
  onSaved,
}: {
  tab: Tab;
  editing: Promotion | null;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const isEdit = editing !== null;
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<FormState>({
    title: editing?.title ?? "",
    imageUrl: editing?.imageUrl ?? "",
    storagePath: editing?.storagePath ?? "",
    isActive: editing?.isActive ?? true,
  });
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) { setUploadError("File harus berupa gambar."); return; }
    setUploadError(null);
    setUploadProgress(0);
    try {
      const compressed = await compressImageToWebP(file);
      const fileName = `promotions/${tab}/${Date.now()}_${file.name.replace(/\.[^.]+$/, "")}.webp`;
      const storageRef = ref(storage, fileName);
      const task = uploadBytesResumable(storageRef, compressed);
      task.on(
        "state_changed",
        (snap) => setUploadProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
        (err) => { setUploadError(err.message); setUploadProgress(null); },
        async () => {
          const url = await getDownloadURL(task.snapshot.ref);
          setForm((p) => ({ ...p, imageUrl: url, storagePath: fileName }));
          setUploadProgress(null);
        },
      );
    } catch (err: any) {
      setUploadError(err.message);
      setUploadProgress(null);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (uploadProgress !== null) return;
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleSave = async () => {
    setFormError(null);
    if (!form.title.trim()) { setFormError("Title wajib diisi."); return; }
    if (!form.imageUrl) { setFormError("Upload gambar terlebih dahulu."); return; }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        title: form.title.trim(),
        imageUrl: form.imageUrl,
        storagePath: form.storagePath,
        isActive: form.isActive,
        type: tab,
      };

      if (isEdit) {
        const r = await fetch(`/api/promotions/${editing!.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(body.message ?? "Gagal menyimpan.");
      } else {
        const r = await fetch("/api/promotions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, order: 9999 }),
        });
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(body.message ?? "Gagal menyimpan.");
      }

      onSaved(isEdit ? `"${form.title}" diperbarui.` : `"${form.title}" ditambahkan.`);
      onClose();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <GcModalShell
      onClose={onClose}
      title={isEdit ? "Edit Promo" : `Tambah ${TAB_LABELS[tab]}`}
      eyebrow={TAB_LABELS[tab]}
      maxWidth={520}
      footer={
        <>
          <GcButton variant="ghost" size="lg" onClick={onClose}>Batal</GcButton>
          <GcButton variant="primary" size="lg" onClick={handleSave} loading={saving} disabled={uploadProgress !== null}>
            {isEdit ? "Simpan Perubahan" : "Tambah"}
          </GcButton>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Title */}
        <div>
          <GcFieldLabel>Label Promo (admin only)</GcFieldLabel>
          <GcInput
            value={form.title}
            onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
            placeholder="Contoh: Promo Matcha Summer 2025"
            style={{ marginTop: 6 }}
          />
        </div>

        {/* Image Upload */}
        <div>
          <GcFieldLabel>Gambar{tab === "carousel" ? " (rasio 16:9 atau landscape)" : " (portrait/square)"}</GcFieldLabel>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: "none" }} />

          {form.imageUrl ? (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragEnter={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              style={{ marginTop: 6, position: "relative", borderRadius: 10, overflow: "hidden", border: `2px solid ${dragging ? C.blueMid : C.border2}`, maxHeight: 220, transition: "border-color .15s" }}
            >
              <img src={form.imageUrl} alt="preview" style={{ width: "100%", height: 220, objectFit: "cover", display: "block" }} />
              {dragging && (
                <div style={{ position: "absolute", inset: 0, background: "rgba(37,99,235,.18)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#fff", textShadow: "0 1px 4px rgba(0,0,0,.5)" }}>Lepas untuk ganti gambar</span>
                </div>
              )}
              {!dragging && (
                <button
                  onClick={() => fileRef.current?.click()}
                  style={{ position: "absolute", bottom: 10, right: 10, background: "rgba(0,0,0,.62)", color: "#fff", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: font }}
                >
                  Ganti Gambar
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragEnter={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              disabled={uploadProgress !== null}
              style={{ marginTop: 6, width: "100%", padding: "28px 0", border: `2px dashed ${dragging ? C.blueMid : C.border2}`, borderRadius: 10, background: dragging ? C.bluePale : C.bgSub, cursor: uploadProgress !== null ? "default" : "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, fontFamily: font, transition: "border-color .15s, background .15s" }}
            >
              <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke={dragging ? C.blueMid : C.tx3} strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              <span style={{ fontSize: 13, color: dragging ? C.blueMid : C.tx2, fontWeight: 500 }}>
                {uploadProgress !== null ? `Uploading… ${uploadProgress}%` : dragging ? "Lepas untuk upload" : "Drag & drop atau klik untuk upload"}
              </span>
              <span style={{ fontSize: 11, color: C.tx3 }}>JPG, PNG, WEBP — otomatis dikompresi ke WebP</span>
            </button>
          )}

          {uploadProgress !== null && (
            <div style={{ marginTop: 8, height: 4, borderRadius: 2, background: C.border2, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${uploadProgress}%`, background: C.blue, transition: "width .2s ease", borderRadius: 2 }} />
            </div>
          )}
          {uploadError && <p style={{ fontSize: 12, color: C.red, marginTop: 6, fontFamily: font }}>{uploadError}</p>}
        </div>

        {/* Active Toggle */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderRadius: 10, border: `1px solid ${C.border2}`, background: C.bgSub }}>
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: C.tx1, fontFamily: font }}>Status Aktif</p>
            <p style={{ fontSize: 11.5, color: C.tx2, fontFamily: font }}>Jika off, promo tidak tampil di app</p>
          </div>
          <button
            onClick={() => setForm((p) => ({ ...p, isActive: !p.isActive }))}
            style={{ width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer", background: form.isActive ? C.green : C.grayBorder, transition: "background .15s", position: "relative", flexShrink: 0 }}
          >
            <span style={{ position: "absolute", top: 3, left: form.isActive ? 22 : 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left .15s", boxShadow: "0 1px 3px rgba(0,0,0,.2)" }} />
          </button>
        </div>

        {/* Scheduling — skeleton (future) */}
        <div style={{ padding: "12px 14px", borderRadius: 10, border: `1px dashed ${C.border2}`, background: "#FAFAFA" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: C.tx3, fontFamily: font, letterSpacing: ".05em", textTransform: "uppercase" }}>Scheduling</p>
            <span style={{ fontSize: 10, fontWeight: 700, color: C.orange, background: C.orangeBg, border: `1px solid ${C.orangeBorder}`, borderRadius: 6, padding: "2px 7px", fontFamily: font }}>Coming Soon</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, opacity: 0.45, pointerEvents: "none" }}>
            <div>
              <GcFieldLabel>Tanggal Mulai</GcFieldLabel>
              <GcInput type="date" disabled style={{ marginTop: 4 }} />
            </div>
            <div>
              <GcFieldLabel>Tanggal Selesai</GcFieldLabel>
              <GcInput type="date" disabled style={{ marginTop: 4 }} />
            </div>
          </div>
        </div>

        {formError && (
          <div style={{ padding: "10px 14px", borderRadius: 8, background: C.redBg, border: `1px solid ${C.redBorder}`, fontSize: 13, color: C.red, fontFamily: font }}>
            {formError}
          </div>
        )}
      </div>
    </GcModalShell>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function PromotionsDesktop() {
  const { can } = useAuth();
  const canMutate = can("promo.create") || can("promo.update") || can("promo.delete");

  const [promos, setPromos] = useState<Promotion[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("connecting");
  const [activeTab, setActiveTab] = useState<Tab>("carousel");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Promotion | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Promotion | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [reorderingId, setReorderingId] = useState<string | null>(null);

  const showToast = useCallback((msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
  }, []);

  // Realtime listener
  useEffect(() => {
    const q = query(collection(db, "promotions").withConverter(promotionConverter), orderBy("order", "asc"));
    const unsub = onSnapshot(
      q,
      (snap) => { setPromos(snap.docs.map((d) => d.data())); setSyncStatus("live"); },
      () => setSyncStatus("error"),
    );
    return unsub;
  }, []);

  const filtered = promos.filter((p) => p.type === activeTab);

  const handleToggleActive = async (promo: Promotion) => {
    if (togglingId) return;
    setTogglingId(promo.id);
    try {
      const r = await fetch(`/api/promotions/${promo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !promo.isActive }),
      });
      if (!r.ok) throw new Error("Gagal update status.");
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setTogglingId(null);
    }
  };

  const handleReorder = async (promo: Promotion, direction: "up" | "down") => {
    if (reorderingId) return;
    const idx = filtered.findIndex((p) => p.id === promo.id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= filtered.length) return;

    const target = filtered[swapIdx];
    setReorderingId(promo.id);
    try {
      await Promise.all([
        fetch(`/api/promotions/${promo.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order: target.order }) }),
        fetch(`/api/promotions/${target.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order: promo.order }) }),
      ]);
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setReorderingId(null);
    }
  };

  const openAdd = () => { setEditing(null); setShowForm(true); };
  const openEdit = (p: Promotion) => { setEditing(p); setShowForm(true); };

  return (
    <GcPage>
      <style>{globalStyles}</style>

      <GcPageHeader
        title="Promo Management"
        eyebrow="Marketing"
        description={TAB_DESCRIPTIONS[activeTab]}
        meta={<LiveBadge status={syncStatus} />}
        actions={
          canMutate ? (
            <GcButton variant="primary" size="md" onClick={openAdd}>
              + Tambah Promo
            </GcButton>
          ) : undefined
        }
      />

      <GcPanel style={{ padding: 0 }}>
        {/* Tab bar */}
        <div style={{ display: "flex", borderBottom: `1px solid ${C.border}`, paddingInline: 20 }}>
          {(["carousel", "modal_ad"] as Tab[]).map((tab) => {
            const active = tab === activeTab;
            const count = promos.filter((p) => p.type === tab).length;
            return (
              <button
                key={tab}
                className="promo-tab"
                onClick={() => setActiveTab(tab)}
                style={{ padding: "14px 18px", border: "none", background: "transparent", borderBottom: active ? `2px solid ${C.blue}` : "2px solid transparent", color: active ? C.blue : C.tx2, fontSize: 13.5, fontWeight: active ? 700 : 500, fontFamily: font, marginBottom: -1, display: "flex", alignItems: "center", gap: 8 }}
              >
                {TAB_LABELS[tab]}
                <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 8, background: active ? C.blueLight : C.bgSub, color: active ? C.blue : C.tx3 }}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* List */}
        <div style={{ padding: 20 }}>
          {filtered.length === 0 ? (
            <GcEmptyState
              title={`Belum ada ${TAB_LABELS[activeTab]}`}
              description="Klik '+ Tambah Promo' untuk menambahkan materi promo pertama."
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {filtered.map((promo, idx) => (
                <div
                  key={promo.id}
                  className="promo-row"
                  style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 14px", borderRadius: 12, border: `1px solid ${C.border}`, background: C.white }}
                >
                  {/* Order badge */}
                  <span style={{ minWidth: 24, height: 24, borderRadius: 6, background: C.bgSub, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: C.tx2, fontFamily: font, flexShrink: 0 }}>
                    {idx + 1}
                  </span>

                  {/* Thumbnail */}
                  <div style={{ width: activeTab === "carousel" ? 120 : 72, height: 64, borderRadius: 8, overflow: "hidden", background: C.bgSub, flexShrink: 0 }}>
                    {promo.imageUrl ? (
                      <img src={promo.imageUrl} alt={promo.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke={C.tx3} strokeWidth={1.5}><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.4"/><path d="M21 16l-5.25-5.25a1.5 1.5 0 00-2.12 0L8 16"/></svg>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13.5, fontWeight: 700, color: C.tx1, fontFamily: font, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{promo.title}</p>
                    <p style={{ fontSize: 11.5, color: C.tx3, fontFamily: font, marginTop: 2 }}>
                      {promo.startDate ? `${promo.startDate} → ${promo.endDate ?? "∞"}` : "No schedule"}
                    </p>
                  </div>

                  {/* Active badge */}
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 8, background: promo.isActive ? C.greenBg : C.grayBg, color: promo.isActive ? C.green : C.gray, fontFamily: font, flexShrink: 0, border: `1px solid ${promo.isActive ? C.greenBorder : C.grayBorder}` }}>
                    {promo.isActive ? "Active" : "Inactive"}
                  </span>

                  {/* Actions */}
                  {canMutate && (
                    <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                      {/* Reorder */}
                      <button
                        className="promo-icon-btn"
                        onClick={() => handleReorder(promo, "up")}
                        disabled={idx === 0 || !!reorderingId}
                        title="Naik"
                        style={{ width: 30, height: 30, border: `1px solid ${C.border}`, borderRadius: 7, background: "transparent", cursor: idx === 0 ? "default" : "pointer", opacity: idx === 0 ? 0.3 : 1, display: "flex", alignItems: "center", justifyContent: "center" }}
                      >
                        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}><path d="M5 15l7-7 7 7" /></svg>
                      </button>
                      <button
                        className="promo-icon-btn"
                        onClick={() => handleReorder(promo, "down")}
                        disabled={idx === filtered.length - 1 || !!reorderingId}
                        title="Turun"
                        style={{ width: 30, height: 30, border: `1px solid ${C.border}`, borderRadius: 7, background: "transparent", cursor: idx === filtered.length - 1 ? "default" : "pointer", opacity: idx === filtered.length - 1 ? 0.3 : 1, display: "flex", alignItems: "center", justifyContent: "center" }}
                      >
                        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}><path d="M19 9l-7 7-7-7" /></svg>
                      </button>

                      {/* Toggle active */}
                      <button
                        className="promo-icon-btn"
                        onClick={() => handleToggleActive(promo)}
                        disabled={togglingId === promo.id}
                        title={promo.isActive ? "Nonaktifkan" : "Aktifkan"}
                        style={{ width: 30, height: 30, border: `1px solid ${C.border}`, borderRadius: 7, background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: promo.isActive ? C.green : C.tx3 }}
                      >
                        {promo.isActive
                          ? <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          : <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}><circle cx="12" cy="12" r="9" /><path d="M9 9l6 6M15 9l-6 6" /></svg>
                        }
                      </button>

                      {/* Edit */}
                      <button
                        className="promo-icon-btn"
                        onClick={() => openEdit(promo)}
                        title="Edit"
                        style={{ width: 30, height: 30, border: `1px solid ${C.border}`, borderRadius: 7, background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: C.tx2 }}
                      >
                        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      </button>

                      {/* Delete */}
                      <button
                        className="promo-icon-btn"
                        onClick={() => setDeleteTarget(promo)}
                        title="Hapus"
                        style={{ width: 30, height: 30, border: `1px solid ${C.redBorder}`, borderRadius: 7, background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: C.red }}
                      >
                        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" /></svg>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </GcPanel>

      {/* Modals */}
      {showForm && (
        <PromoFormModal
          tab={activeTab}
          editing={editing}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={(msg) => showToast(msg)}
        />
      )}
      {deleteTarget && (
        <DeleteModal
          promo={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={(msg) => { showToast(msg, msg.startsWith("Error") ? "error" : "success"); setDeleteTarget(null); }}
        />
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
    </GcPage>
  );
}
