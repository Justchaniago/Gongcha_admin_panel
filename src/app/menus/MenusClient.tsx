"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebaseClient";
import { ProductItem } from "@/types/firestore";
import { createMenu, updateMenu, deleteMenu } from "@/actions/menuActions";

type ProductWithId = ProductItem & { id: string };
type SyncStatus = "connecting" | "live" | "error";

const C = {
  bg: '#F4F6FB', white: '#FFFFFF', border: '#EAECF2', border2: '#F0F2F7',
  tx1: '#0F1117', tx2: '#4A5065', tx3: '#9299B0', tx4: '#BCC1D3',
  blue: '#4361EE', blueL: '#EEF2FF',
  green: '#12B76A', greenBg: '#ECFDF3',
  orange: '#F79009', orangeBg: '#FFFAEB',
  red: '#C8102E', redBg: '#FEF3F2',
  shadow: '0 1px 3px rgba(16,24,40,.06), 0 1px 2px rgba(16,24,40,.04)',
  shadowLg: '0 20px 60px rgba(16,24,40,.18), 0 4px 12px rgba(16,24,40,.08)',
} as const;
const font = "'Plus Jakarta Sans', system-ui, sans-serif";

// ── Image Compression Utility (WebP) ───────────────────────────────────────────
const compressImageToWebP = (file: File, maxWidth = 800, maxHeight = 800, quality = 0.8): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = URL.createObjectURL(file);
    img.onload = () => {
      let { width, height } = img;

      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      
      if (!ctx) {
        reject(new Error("Gagal menginisialisasi Canvas API"));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Gagal mengonversi gambar"));
        },
        "image/webp",
        quality
      );
    };
    img.onerror = () => reject(new Error("Gagal membaca file gambar"));
  });
};

// ── Primitives ─────────────────────────────────────────────────────────────────
function LiveBadge({ status }: { status: SyncStatus }) {
  const cfg = { connecting: { color: C.orange, label: "Connecting…" }, live: { color: C.green, label: "Live" }, error: { color: C.red, label: "Error" } }[status];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: cfg.color }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: cfg.color, boxShadow: status === 'live' ? '0 0 0 3px rgba(18,183,106,.2)' : 'none', animation: status === 'connecting' ? 'pulse .9s infinite' : 'none' }}/>
      {cfg.label}
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.25}}`}</style>
    </span>
  );
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 11px', borderRadius: 99, background: active ? C.greenBg : C.border2, color: active ? '#027A48' : C.tx3, fontSize: 11, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase' }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: active ? C.green : C.tx4 }}/>
      {active ? 'Tersedia' : 'Kosong'}
    </span>
  );
}

function FL({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label style={{ display: 'block', marginBottom: 6, fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: C.tx3 }}>
      {children}{required && <span style={{ color: C.red, marginLeft: 3 }}>*</span>}
    </label>
  );
}

function GcInput({ style, ...p }: React.InputHTMLAttributes<HTMLInputElement>) {
  const [f, setF] = useState(false);
  return (
    <input {...p} onFocus={e => { setF(true); p.onFocus?.(e); }} onBlur={e => { setF(false); p.onBlur?.(e); }}
      style={{ width: '100%', height: 42, borderRadius: 9, outline: 'none', border: `1.5px solid ${f ? C.blue : C.border}`, background: f ? C.white : C.bg, boxShadow: f ? '0 0 0 3px rgba(67,97,238,.1)' : 'none', padding: '0 13px', fontFamily: font, fontSize: 13.5, color: C.tx1, transition: 'all .14s', boxSizing: 'border-box', ...style }}
    />
  );
}

function GcTextarea({ style, ...p }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const [f, setF] = useState(false);
  return (
    <textarea {...p} rows={3} onFocus={e => { setF(true); p.onFocus?.(e); }} onBlur={e => { setF(false); p.onBlur?.(e); }}
      style={{ width: '100%', borderRadius: 9, outline: 'none', resize: 'vertical', border: `1.5px solid ${f ? C.blue : C.border}`, background: f ? C.white : C.bg, boxShadow: f ? '0 0 0 3px rgba(67,97,238,.1)' : 'none', padding: '10px 13px', fontFamily: font, fontSize: 13.5, color: C.tx1, lineHeight: 1.5, transition: 'all .14s', boxSizing: 'border-box', ...style }}
    />
  );
}

function GcSelect({ style, ...p }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const [f, setF] = useState(false);
  return (
    <select {...p} onFocus={e => { setF(true); p.onFocus?.(e); }} onBlur={e => { setF(false); p.onBlur?.(e); }}
      style={{ width: '100%', height: 42, borderRadius: 9, outline: 'none', border: `1.5px solid ${f ? C.blue : C.border}`, background: f ? C.white : C.bg, boxShadow: f ? '0 0 0 3px rgba(67,97,238,.1)' : 'none', padding: '0 13px', fontFamily: font, fontSize: 13.5, color: C.tx1, transition: 'all .14s', cursor: 'pointer', ...style }}
    />
  );
}

function Toast({ msg, type, onDone }: { msg: string; type: 'success'|'error'; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 3200); return () => clearTimeout(t); }, [onDone]);
  return (
    <div style={{ position: 'fixed', bottom: 28, right: 28, zIndex: 999, padding: '13px 20px', borderRadius: 13, fontFamily: font, fontSize: 13.5, fontWeight: 600, color: '#fff', background: type === 'success' ? C.green : C.red, boxShadow: '0 8px 32px rgba(0,0,0,.22)', display: 'flex', alignItems: 'center', gap: 10, animation: 'gcRise .28s ease' }}>
      {type === 'success' ? '✓' : '✕'} {msg}
      <style>{`@keyframes gcRise{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}`}</style>
    </div>
  );
}

function formatRp(num: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);
}

// ── Delete Modal ───────────────────────────────────────────────────────────────
function DeleteModal({ menu, onClose, onDeleted }: { menu: ProductWithId; onClose: () => void; onDeleted: (msg: string) => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function confirm() {
    setLoading(true); setError('');
    try {
      await deleteMenu(menu.id);
      onDeleted(`"${menu.name}" berhasil dihapus.`);
      onClose();
    } catch (e: any) { setError(e.message); setLoading(false); }
  }

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }} style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'rgba(10,12,20,.52)', backdropFilter: 'blur(8px)', fontFamily: font }}>
      <div style={{ background: C.white, borderRadius: 20, width: '100%', maxWidth: 420, boxShadow: C.shadowLg, padding: '32px 28px', animation: 'gcRise .22s ease' }}>
        <div style={{ width: 52, height: 52, borderRadius: 14, background: C.redBg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
          <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke={C.red} strokeWidth={2}><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: C.tx1, marginBottom: 8 }}>Hapus Produk?</h2>
        <p style={{ fontSize: 13.5, color: C.tx2, lineHeight: 1.6, marginBottom: 6 }}>Menu <strong>"{menu.name}"</strong> akan dihapus permanen dari Firestore (koleksi products).</p>
        <code style={{ fontSize: 11, color: C.tx3, background: C.bg, padding: '4px 8px', borderRadius: 6, display: 'inline-block', marginBottom: 18 }}>ID: {menu.id}</code>
        {error && <div style={{ padding: '10px 14px', background: C.redBg, border: '1px solid #FECDD3', borderRadius: 9, fontSize: 12.5, color: '#B42318', marginBottom: 14 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ height: 40, padding: '0 20px', borderRadius: 9, border: `1.5px solid ${C.border}`, background: C.white, color: C.tx2, fontFamily: font, fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>Batal</button>
          <button onClick={confirm} disabled={loading} style={{ height: 40, padding: '0 20px', borderRadius: 9, border: 'none', background: loading ? '#fca5a5' : C.red, color: '#fff', fontFamily: font, fontSize: 13.5, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer' }}>
            {loading ? 'Menghapus…' : 'Ya, Hapus'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Menu Modal ─────────────────────────────────────────────────────────────────
type MenuForm = {
  name: string;
  description: string;
  mediumPrice: string;
  category: string;
  image: string;
  rating: string;
  isAvailable: boolean;
  availableHot: boolean;
  availableLarge: boolean;
};

function MenuModal({ menu, onClose, onSaved }: {
  menu: ProductWithId | null; onClose: () => void; onSaved: (msg: string) => void;
}) {
  const isNew = !menu;

  const [form, setForm] = useState<MenuForm>({
    name:           menu?.name ?? '',
    description:    menu?.description ?? '',
    mediumPrice:    menu?.mediumPrice ? String(menu.mediumPrice) : '',
    category:       menu?.category ?? 'MilkTea',
    image:          menu?.image ?? '',
    rating:         menu?.rating ? String(menu.rating) : '5.0',
    isAvailable:    menu?.isAvailable ?? true,
    availableHot:   menu?.availableHot ?? false,
    availableLarge: menu?.availableLarge ?? true,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [processingImage, setProcessingImage] = useState(false);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const set = (k: keyof MenuForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));

  // Logic Upload & Compress ke Firebase Storage
  const handleImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Batas file asli sebelum kompresi diubah menjadi 15MB
    if (file.size > 15 * 1024 * 1024) {
      setError("Ukuran gambar asli maksimal 15MB.");
      return;
    }

    setError('');
    setProcessingImage(true);

    try {
      // 1. Kompres dan convert ke WebP (Max 800px, 80% quality)
      const compressedBlob = await compressImageToWebP(file, 800, 800, 0.8);
      
      // 2. Upload blob WebP ke Firebase Storage
      const fileName = `products/${Date.now()}_${Math.random().toString(36).substring(2, 8)}.webp`;
      const storageRef = ref(storage, fileName);

      const uploadTask = uploadBytesResumable(storageRef, compressedBlob);
      setUploadProgress(0);
      setProcessingImage(false);

      uploadTask.on("state_changed",
        (snapshot) => {
          const prog = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(prog);
        },
        (err) => {
          setError("Gagal upload gambar: " + err.message);
          setUploadProgress(null);
        },
        async () => {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          setForm(p => ({ ...p, image: url }));
          setUploadProgress(null);
        }
      );
    } catch (err: any) {
      setError(err.message || "Gagal memproses gambar");
      setProcessingImage(false);
    }
  };

  async function handleSave() {
    if (!form.name.trim()) { setError('Nama produk wajib diisi.'); return; }
    if (!form.mediumPrice.trim() || isNaN(Number(form.mediumPrice))) { setError('Harga harus berupa angka yang valid.'); return; }
    if (uploadProgress !== null || processingImage) { setError('Tunggu proses gambar selesai.'); return; }

    setLoading(true); setError('');
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        mediumPrice: Number(form.mediumPrice),
        category: form.category,
        image: form.image.trim(),
        rating: Number(form.rating) || 5.0,
        isAvailable: form.isAvailable,
        availableHot: form.availableHot,
        availableLarge: form.availableLarge,
      };

      if (isNew) {
        await createMenu(payload);
      } else {
        await updateMenu(menu!.id, payload);
      }

      onSaved(isNew ? `Produk "${form.name}" berhasil ditambahkan!` : `"${form.name}" berhasil diperbarui.`);
      onClose();
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  }

  const section = (label: string) => (
    <p style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: C.tx3, marginBottom: 14, paddingBottom: 10, borderBottom: `1px solid ${C.border2}`, marginTop: 4 }}>{label}</p>
  );

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }} style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'rgba(10,12,20,.52)', backdropFilter: 'blur(8px)', animation: 'gcFadeIn .18s ease', fontFamily: font }}>
      <div style={{ background: C.white, borderRadius: 22, width: '100%', maxWidth: 560, maxHeight: '92vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: C.shadowLg, animation: 'gcRise .26s cubic-bezier(.22,.68,0,1.15) both' }}>
        
        {/* Head */}
        <div style={{ padding: '24px 28px 18px', borderBottom: `1px solid ${C.border2}`, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <p style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: C.blue, marginBottom: 4 }}>{isNew ? 'Produk Baru' : 'Edit Produk'}</p>
            <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.02em', color: C.tx1, margin: 0 }}>{isNew ? 'Tambah Produk' : menu!.name}</h2>
          </div>
          <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: 9, cursor: 'pointer', border: `1.5px solid ${C.border}`, background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onMouseOver={e => (e.currentTarget.style.background = C.bg)}
            onMouseOut={e  => (e.currentTarget.style.background = 'transparent')}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1 1l10 10M11 1L1 11" stroke={C.tx3} strokeWidth="1.7" strokeLinecap="round"/></svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {section('Informasi Dasar')}
          <div>
            <FL required>Nama Produk (name)</FL>
            <GcInput placeholder="Misal: Pearl Milk Tea" value={form.name} onChange={set('name')}/>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <FL required>Kategori (category)</FL>
              <GcSelect value={form.category} onChange={set('category')}>
                <option value="Signature">Signature</option>
                <option value="MilkTea">Milk Tea</option>
                <option value="Coffee">Coffee</option>
                <option value="Matcha">Matcha</option>
                <option value="Mint">Mint</option>
                <option value="BrownSugar">Brown Sugar</option>
                <option value="CreativeMix">Creative Mix</option>
                <option value="BrewedTea">Brewed Tea</option>
                <option value="Topping">Topping</option>
              </GcSelect>
            </div>
            <div>
              <FL required>Harga M (mediumPrice)</FL>
              <GcInput type="number" placeholder="29000" value={form.mediumPrice} onChange={set('mediumPrice')}/>
            </div>
          </div>
          <div>
            <FL>Deskripsi Modal (description)</FL>
            <GcTextarea placeholder="Penjelasan minuman..." value={form.description} onChange={set('description')}/>
          </div>

          {section('Opsi Minuman App Customer')}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 10, background: C.bg, border: `1px solid ${C.border}` }}>
              <div>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: C.tx1, display: 'block' }}>🔥 HOT (availableHot)</span>
              </div>
              <button type="button" onClick={() => setForm(p => ({ ...p, availableHot: !p.availableHot }))}
                style={{ width: 36, height: 20, borderRadius: 99, border: 'none', cursor: 'pointer', background: form.availableHot ? '#E11D48' : C.border, position: 'relative', transition: 'background .2s' }}>
                <span style={{ position: 'absolute', top: 2, borderRadius: '50%', width: 16, height: 16, background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,.2)', left: form.availableHot ? 18 : 2, transition: 'left .2s cubic-bezier(.34,1.56,.64,1)' }}/>
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 10, background: C.bg, border: `1px solid ${C.border}` }}>
               <div>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: C.tx1, display: 'block' }}>🥤 LARGE (availableLarge)</span>
              </div>
              <button type="button" onClick={() => setForm(p => ({ ...p, availableLarge: !p.availableLarge }))}
                style={{ width: 36, height: 20, borderRadius: 99, border: 'none', cursor: 'pointer', background: form.availableLarge ? '#2563EB' : C.border, position: 'relative', transition: 'background .2s' }}>
                <span style={{ position: 'absolute', top: 2, borderRadius: '50%', width: 16, height: 16, background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,.2)', left: form.availableLarge ? 18 : 2, transition: 'left .2s cubic-bezier(.34,1.56,.64,1)' }}/>
              </button>
            </div>
          </div>

          {section('Media & Meta')}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14 }}>
            <div>
              <FL>Upload Gambar Produk (WebP)</FL>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                {form.image && (
                  <img
                    src={form.image}
                    alt={form.name}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain', // ubah dari 'cover' ke 'contain'
                      maxWidth: 44,         // tambahkan ini
                      maxHeight: 44         // tambahkan ini
                    }}
                  />
                )}
                <div style={{ flex: 1 }}>
                  {processingImage ? (
                    <div style={{ width: '100%', height: 42, borderRadius: 9, background: C.bg, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: C.orange }}>Mengompresi ke WebP...</span>
                    </div>
                  ) : uploadProgress !== null ? (
                    <div style={{ width: '100%', height: 42, borderRadius: 9, background: C.bg, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', padding: '0 10px', position: 'relative', overflow: 'hidden' }}>
                      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, background: C.blueL, width: `${uploadProgress}%`, transition: 'width 0.2s ease' }} />
                      <span style={{ position: 'relative', zIndex: 1, fontSize: 12, fontWeight: 700, color: C.blue }}>Mengunggah... {Math.round(uploadProgress)}%</span>
                    </div>
                  ) : (
                    <div style={{ position: 'relative', height: 42, display: 'flex', alignItems: 'center' }}>
                      <input type="file" accept="image/*" onChange={handleImageFile} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', zIndex: 10 }} />
                      <div style={{ width: '100%', height: '100%', borderRadius: 9, background: C.bg, border: `1.5px dashed ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 12.5, fontWeight: 600, color: C.tx2, transition: 'all .2s' }}>
                        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
                        Pilih File Gambar
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div>
              <FL>Rating Default</FL>
              <GcInput type="number" step="0.1" placeholder="5.0" value={form.rating} onChange={set('rating')}/>
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderRadius: 12, background: C.bg, border: `1px solid ${C.border}`, marginTop: 6 }}>
            <div>
              <p style={{ fontSize: 13.5, fontWeight: 600, color: C.tx1, marginBottom: 2 }}>Ketersediaan Stok Outlet</p>
              <p style={{ fontSize: 12, color: C.tx3 }}>Matikan jika barang sedang habis nasional</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <StatusPill active={form.isAvailable !== false}/>
              <button type="button" onClick={() => setForm(p => ({ ...p, isAvailable: !p.isAvailable }))}
                style={{ width: 42, height: 24, borderRadius: 99, border: 'none', cursor: 'pointer', background: form.isAvailable ? C.green : C.border, position: 'relative', transition: 'background .2s' }}>
                <span style={{ position: 'absolute', top: 3, borderRadius: '50%', width: 18, height: 18, background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,.2)', left: form.isAvailable ? 21 : 3, transition: 'left .2s cubic-bezier(.34,1.56,.64,1)', display: 'block' }}/>
              </button>
            </div>
          </div>

          {error && <div style={{ padding: '11px 14px', background: C.redBg, border: '1px solid #FECDD3', borderRadius: 9, fontSize: 12.5, color: '#B42318' }}>{error}</div>}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 28px 24px', borderTop: `1px solid ${C.border2}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <p style={{ fontSize: 11.5, color: C.tx3 }}>Kolom <span style={{ color: C.red }}>*</span> wajib diisi</p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={{ height: 40, padding: '0 20px', borderRadius: 9, border: `1.5px solid ${C.border}`, background: C.white, color: C.tx2, fontFamily: font, fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>Batal</button>
            <button onClick={handleSave} disabled={loading || uploadProgress !== null || processingImage}
              style={{ height: 40, padding: '0 22px', borderRadius: 9, border: 'none', background: (loading || uploadProgress !== null || processingImage) ? '#9ca3af' : C.tx1, color: '#fff', fontFamily: font, fontSize: 13.5, fontWeight: 600, cursor: (loading || uploadProgress !== null || processingImage) ? 'not-allowed' : 'pointer', transition: 'all .15s' }}>
              {loading ? 'Menyimpan…' : isNew ? '+ Tambah Produk' : 'Simpan Perubahan'}
            </button>
          </div>
        </div>
      </div>
      <style>{`@keyframes gcFadeIn{from{opacity:0}to{opacity:1}}@keyframes gcRise{from{opacity:0;transform:translateY(18px) scale(.97)}to{opacity:1;transform:none}}`}</style>
    </div>
  );
}

// ── Table Row ──────────────────────────────────────────────────────────────────
function MenuRow({ menu, isLast, onEdit, onDelete }: { menu: ProductWithId; isLast: boolean; onEdit: () => void; onDelete: () => void }) {
  const [h, setH] = useState(false);
  const [bh, setBH] = useState(false);
  const [dh, setDH] = useState(false);

  return (
    <tr onMouseOver={() => setH(true)} onMouseOut={() => setH(false)} style={{ borderBottom: isLast ? 'none' : `1px solid ${C.border2}`, background: h ? '#F8F9FC' : C.white, transition: 'background .1s' }}>
      <td style={{ padding: '14px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: C.bg, overflow: 'hidden', border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {menu.image ? (
              <img
                src={menu.image}
                alt={menu.name}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain', // ubah dari 'cover' ke 'contain'
                  maxWidth: 44,         // tambahkan ini
                  maxHeight: 44         // tambahkan ini
                }}
              />
            ) : (
              <span style={{ color: C.tx4, fontSize: 10, fontWeight: 600 }}>No Img</span>
            )}
          </div>
          <div>
            <p style={{ fontSize: 13.5, fontWeight: 800, color: C.tx1, marginBottom: 2 }}>{menu.name}</p>
            {menu.description && <p style={{ fontSize: 11.5, color: C.tx3, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{menu.description}</p>}
          </div>
        </div>
      </td>
      <td style={{ padding: '14px 18px', fontSize: 12.5, color: C.tx2 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ padding: '4px 10px', borderRadius: 8, background: C.bg, border: `1px solid ${C.border2}`, fontSize: 11.5, fontWeight: 700, color: C.tx2 }}>{menu.category}</span>
          {menu.availableHot && <span title="Bisa Panas" style={{ padding: '4px 8px', borderRadius: 8, background: '#FFF1F2', color: '#E11D48', fontSize: 10.5, fontWeight: 800 }}>HOT</span>}
          {menu.availableLarge && <span title="Tersedia ukuran Large" style={{ padding: '4px 8px', borderRadius: 8, background: '#EFF6FF', color: '#2563EB', fontSize: 10.5, fontWeight: 800 }}>LARGE</span>}
        </div>
      </td>
      <td style={{ padding: '14px 18px', fontSize: 13.5, fontWeight: 800, color: C.tx1 }}>{formatRp(menu.mediumPrice)}</td>
      <td style={{ padding: '14px 18px' }}><StatusPill active={menu.isAvailable !== false}/></td>
      <td style={{ padding: '14px 18px' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={onEdit} onMouseOver={() => setBH(true)} onMouseOut={() => setBH(false)}
            style={{ height: 32, padding: '0 12px', borderRadius: 7, fontFamily: font, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `1.5px solid ${bh ? C.blue : C.border}`, background: bh ? C.blueL : C.white, color: bh ? C.blue : C.tx2, display: 'inline-flex', alignItems: 'center', gap: 5, transition: 'all .13s' }}>
            <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
            Edit
          </button>
          <button onClick={onDelete} onMouseOver={() => setDH(true)} onMouseOut={() => setDH(false)}
            style={{ height: 32, padding: '0 12px', borderRadius: 7, fontFamily: font, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `1.5px solid ${dh ? C.red : C.border}`, background: dh ? C.redBg : C.white, color: dh ? C.red : C.tx2, display: 'inline-flex', alignItems: 'center', gap: 5, transition: 'all .13s' }}>
            <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M9 6V4h6v2"/></svg>
            Hapus
          </button>
        </div>
      </td>
    </tr>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function MenusClient({ initialMenus, showAddTrigger }: { initialMenus: ProductWithId[]; showAddTrigger?: boolean }) {
  const [menus, setMenus] = useState<ProductWithId[]>(initialMenus);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("connecting");
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all'|'available'|'unavailable'>('all');
  const [editTarget, setEditTarget] = useState<ProductWithId | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProductWithId | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [toast, setToast] = useState<{msg:string;type:'success'|'error'}|null>(null);
  const [searchFocus, setSearchFocus] = useState(false);

  const showToast = useCallback((msg: string, type: 'success'|'error' = 'success') => setToast({ msg, type }), []);

  useEffect(() => {
    const q = query(collection(db, "products"), orderBy("name"));
    const unsub = onSnapshot(q,
      snap => { setMenus(snap.docs.map(d => ({ id: d.id, ...d.data() } as ProductWithId))); setSyncStatus("live"); },
      err => { console.error("[products onSnapshot]", err); setSyncStatus("error"); }
    );
    return () => unsub();
  }, []);

  const filtered = useMemo(() => menus.filter(m => {
    const q = search.toLowerCase();
    const ok = !q || m.name.toLowerCase().includes(q) || m.category.toLowerCase().includes(q);
    const f = filter === 'all' || (filter === 'available' ? m.isAvailable !== false : m.isAvailable === false);
    return ok && f;
  }), [menus, search, filter]);

  if (showAddTrigger) {
    return (
      <>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <LiveBadge status={syncStatus}/>
          <button onClick={() => setShowAdd(true)} style={{ height: 42, padding: '0 20px', borderRadius: 10, border: 'none', background: C.tx1, color: '#fff', fontFamily: font, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8, transition: 'all .15s' }}
            onMouseOver={e => { e.currentTarget.style.background = C.red; e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseOut={e  => { e.currentTarget.style.background = C.tx1; e.currentTarget.style.transform = 'none'; }}>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>
            Tambah Produk
          </button>
        </div>
        {showAdd && <MenuModal menu={null} onClose={() => setShowAdd(false)} onSaved={msg => { showToast(msg); setShowAdd(false); }}/>}
        {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)}/>}
      </>
    );
  }

  return (
    <>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 40, padding: '0 13px', minWidth: 240, background: C.white, border: `1.5px solid ${searchFocus ? C.blue : C.border}`, borderRadius: 10, boxShadow: searchFocus ? '0 0 0 3px rgba(67,97,238,.1)' : 'none', transition: 'all .14s' }}>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke={C.tx3} strokeWidth={2.2}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontFamily: font, fontSize: 13.5, color: C.tx1 }} placeholder="Cari nama atau kategori…" value={search} onChange={e => setSearch(e.target.value)} onFocus={() => setSearchFocus(true)} onBlur={() => setSearchFocus(false)}/>
            {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.tx3, fontSize: 15, padding: 0 }}>✕</button>}
          </div>
          <div style={{ display: 'flex', background: C.bg, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: 3 }}>
            {(['all', 'available', 'unavailable'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{ padding: '5px 14px', borderRadius: 7, border: 'none', fontFamily: font, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', transition: 'all .13s', background: filter === f ? C.white : 'transparent', color: filter === f ? C.tx1 : C.tx3, boxShadow: filter === f ? C.shadow : 'none' }}>
                {f === 'all' ? 'Semua' : f === 'available' ? 'Tersedia' : 'Kosong'}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <LiveBadge status={syncStatus}/>
          <span style={{ fontSize: 12.5, color: C.tx3 }}>{filtered.length} produk</span>
        </div>
      </div>

      {/* Table */}
      <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 18, boxShadow: C.shadow, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: font }}>
          <thead>
            <tr style={{ background: '#F8F9FC' }}>
              {['Detail Produk', 'Kategori & Info', 'Harga M (Rp)', 'Status', ''].map((h, i) => (
                <th key={i} style={{ padding: '11px 18px', textAlign: 'left', fontSize: 10.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: C.tx3, borderBottom: `1px solid ${C.border2}`, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: C.tx3 }}>Tidak ada produk ditemukan.</td></tr>
            ) : filtered.map((m, i) => (
              <MenuRow key={m.id} menu={m} isLast={i === filtered.length - 1} onEdit={() => setEditTarget(m)} onDelete={() => setDeleteTarget(m)} />
            ))}
          </tbody>
        </table>
      </div>

      {editTarget && <MenuModal menu={editTarget} onClose={() => setEditTarget(null)} onSaved={msg => { showToast(msg); setEditTarget(null); }}/>}
      {showAdd && <MenuModal menu={null} onClose={() => setShowAdd(false)} onSaved={msg => { showToast(msg); setShowAdd(false); }}/>}
      {deleteTarget && <DeleteModal menu={deleteTarget} onClose={() => setDeleteTarget(null)} onDeleted={msg => { showToast(msg); setDeleteTarget(null); }}/>}
      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)}/>}
    </>
  );
}