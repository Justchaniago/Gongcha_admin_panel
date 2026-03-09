"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebaseClient";
import { ProductItem } from "@/types/firestore";
import { createMenu, updateMenu, deleteMenu } from "@/actions/menuActions";
import { useAuth } from "@/context/AuthContext";
import { Search, X, UtensilsCrossed } from "lucide-react";

// Import UI Components dari shared UI folder
import { LiveBadge, StatusBadge, EmptyState, PageHeader } from "@/components/ui";

type ProductWithId = ProductItem & { id: string };
type SyncStatus = "connecting" | "live" | "error";

// --- Design tokens & Utilities ---
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

const compressImageToWebP = (file: File, maxWidth = 800, maxHeight = 800, quality = 0.8): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = URL.createObjectURL(file);
    img.onload = () => {
      let { width, height } = img;
      if (width > height) {
        if (width > maxWidth) { height = Math.round((height * maxWidth) / width); width = maxWidth; }
      } else {
        if (height > maxHeight) { width = Math.round((width * maxHeight) / height); height = maxHeight; }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Failed to initialize Canvas API"));
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Failed to convert")), "image/webp", quality);
    };
    img.onerror = () => reject(new Error("Failed to read image file"));
  });
};

// --- Primitives untuk Modal ---
function FL({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return <label style={{ display: 'block', marginBottom: 6, fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: C.tx3 }}>{children}{required && <span style={{ color: C.red, marginLeft: 3 }}>*</span>}</label>;
}
function GcInput({ style, ...p }: React.InputHTMLAttributes<HTMLInputElement>) {
  const [f, setF] = useState(false);
  return <input {...p} onFocus={e => { setF(true); p.onFocus?.(e); }} onBlur={e => { setF(false); p.onBlur?.(e); }} style={{ width: '100%', height: 42, borderRadius: 9, outline: 'none', border: `1.5px solid ${f ? C.blue : C.border}`, background: f ? C.white : C.bg, boxShadow: f ? '0 0 0 3px rgba(67,97,238,.1)' : 'none', padding: '0 13px', fontFamily: font, fontSize: 13.5, color: C.tx1, transition: 'all .14s', boxSizing: 'border-box', ...style }} />;
}
function GcTextarea({ style, ...p }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const [f, setF] = useState(false);
  return <textarea {...p} rows={3} onFocus={e => { setF(true); p.onFocus?.(e); }} onBlur={e => { setF(false); p.onBlur?.(e); }} style={{ width: '100%', borderRadius: 9, outline: 'none', resize: 'vertical', border: `1.5px solid ${f ? C.blue : C.border}`, background: f ? C.white : C.bg, boxShadow: f ? '0 0 0 3px rgba(67,97,238,.1)' : 'none', padding: '10px 13px', fontFamily: font, fontSize: 13.5, color: C.tx1, lineHeight: 1.5, transition: 'all .14s', boxSizing: 'border-box', ...style }} />;
}
function GcSelect({ style, ...p }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const [f, setF] = useState(false);
  return <select {...p} onFocus={e => { setF(true); p.onFocus?.(e); }} onBlur={e => { setF(false); p.onBlur?.(e); }} style={{ width: '100%', height: 42, borderRadius: 9, outline: 'none', border: `1.5px solid ${f ? C.blue : C.border}`, background: f ? C.white : C.bg, boxShadow: f ? '0 0 0 3px rgba(67,97,238,.1)' : 'none', padding: '0 13px', fontFamily: font, fontSize: 13.5, color: C.tx1, transition: 'all .14s', cursor: 'pointer', ...style }} />;
}
function Toast({ msg, type, onDone }: { msg: string; type: 'success'|'error'; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 3200); return () => clearTimeout(t); }, [onDone]);
  return <div style={{ position: 'fixed', bottom: 28, right: 28, zIndex: 999, padding: '13px 20px', borderRadius: 13, fontFamily: font, fontSize: 13.5, fontWeight: 600, color: '#fff', background: type === 'success' ? C.green : C.red, boxShadow: '0 8px 32px rgba(0,0,0,.22)', display: 'flex', alignItems: 'center', gap: 10, animation: 'gcRise .28s ease' }}>{type === 'success' ? '✓' : '✕'} {msg}<style>{`@keyframes gcRise{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}`}</style></div>;
}
function formatRp(num: number) { return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num); }

// --- Delete Modal ---
function DeleteModal({ menu, onClose, onDeleted }: { menu: ProductWithId; onClose: () => void; onDeleted: (msg: string) => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  async function confirm() {
    setLoading(true); setError('');
    try { await deleteMenu(menu.id); onDeleted(`"${menu.name}" successfully deleted.`); onClose(); } 
    catch (e: any) { setError(e.message); setLoading(false); }
  }
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }} style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'rgba(10,12,20,.52)', backdropFilter: 'blur(8px)', fontFamily: font }}>
      <div style={{ background: C.white, borderRadius: 20, width: '100%', maxWidth: 420, boxShadow: C.shadowLg, padding: '32px 28px', animation: 'gcRise .22s ease' }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: C.tx1, marginBottom: 8 }}>Hapus Produk?</h2>
        <p style={{ fontSize: 13.5, color: C.tx2, lineHeight: 1.6, marginBottom: 18 }}>Produk <strong>"{menu.name}"</strong> akan dihapus permanen.</p>
        {error && <div style={{ padding: '10px 14px', background: C.redBg, border: '1px solid #FECDD3', borderRadius: 9, fontSize: 12.5, color: '#B42318', marginBottom: 14 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ height: 40, padding: '0 20px', borderRadius: 9, border: `1.5px solid ${C.border}`, background: C.white, color: C.tx2, fontWeight: 600, cursor: 'pointer' }}>Batal</button>
          <button onClick={confirm} disabled={loading} style={{ height: 40, padding: '0 20px', borderRadius: 9, border: 'none', background: loading ? '#fca5a5' : C.red, color: '#fff', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer' }}>{loading ? 'Menghapus…' : 'Ya, Hapus'}</button>
        </div>
      </div>
    </div>
  );
}

// --- Menu Modal (Edit/Add) ---
function MenuModal({ menu, onClose, onSaved }: { menu: ProductWithId | null; onClose: () => void; onSaved: (msg: string) => void; }) {
  const isNew = !menu;
  const [form, setForm] = useState({
    name: menu?.name ?? '', description: menu?.description ?? '', mediumPrice: menu?.mediumPrice ? String(menu.mediumPrice) : '', category: menu?.category ?? 'MilkTea', image: menu?.image ?? '', rating: menu?.rating ? String(menu.rating) : '5.0', isAvailable: menu?.isAvailable ?? true, availableHot: menu?.availableHot ?? false, availableLarge: menu?.availableLarge ?? true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [processingImage, setProcessingImage] = useState(false);

  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, [onClose]);
  const set = (k: any) => (e: any) => setForm(p => ({ ...p, [k]: e.target.value }));

  const handleImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) return setError("Ukuran gambar asli maksimal 15MB.");
    setError(''); setProcessingImage(true);
    try {
      const compressedBlob = await compressImageToWebP(file, 800, 800, 0.8);
      const fileName = `products/${Date.now()}_${Math.random().toString(36).substring(2, 8)}.webp`;
      const uploadTask = uploadBytesResumable(ref(storage, fileName), compressedBlob);
      setUploadProgress(0); setProcessingImage(false);
      uploadTask.on("state_changed",
        (snapshot) => setUploadProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100),
        (err) => { setError("Failed to upload image: " + err.message); setUploadProgress(null); },
        () => {
          getDownloadURL(uploadTask.snapshot.ref).then(url => {
            setForm(p => ({ ...p, image: url }));
            setUploadProgress(null);
          });
        }
      );
    } catch (err: any) { setError(err.message || "Failed to process image"); setProcessingImage(false); }
  };

  async function handleSave() {
    if (!form.name.trim()) return setError('Nama produk wajib diisi.');
    if (!form.mediumPrice.trim() || isNaN(Number(form.mediumPrice))) return setError('Harga harus berupa angka yang valid.');
    if (uploadProgress !== null || processingImage) return setError('Tunggu proses gambar selesai.');
    setLoading(true); setError('');
    try {
      const payload = { name: form.name.trim(), description: form.description.trim(), mediumPrice: Number(form.mediumPrice), category: form.category, image: form.image.trim(), rating: Number(form.rating) || 5.0, isAvailable: form.isAvailable, availableHot: form.availableHot, availableLarge: form.availableLarge };
      if (isNew) await createMenu(payload); else await updateMenu(menu!.id, payload);
      onSaved(isNew ? `Produk "${form.name}" berhasil ditambahkan!` : `"${form.name}" berhasil diperbarui.`);
      onClose();
    } catch (e: any) { setError(e.message); setLoading(false); }
  }

  const section = (label: string) => <p style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: C.tx3, marginBottom: 14, paddingBottom: 10, borderBottom: `1px solid ${C.border2}`, marginTop: 4 }}>{label}</p>;

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }} style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'rgba(10,12,20,.52)', backdropFilter: 'blur(8px)', animation: 'gcFadeIn .18s ease', fontFamily: font }}>
      <div style={{ background: C.white, borderRadius: 22, width: '100%', maxWidth: 560, maxHeight: '92vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: C.shadowLg, animation: 'gcRise .26s cubic-bezier(.22,.68,0,1.15) both' }}>
        <div style={{ padding: '24px 28px 18px', borderBottom: `1px solid ${C.border2}`, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <p style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: C.blue, marginBottom: 4 }}>{isNew ? 'Produk Baru' : 'Edit Produk'}</p>
            <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.02em', color: C.tx1, margin: 0 }}>{isNew ? 'Tambah Produk' : menu!.name}</h2>
          </div>
          <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: 9, cursor: 'pointer', border: `1.5px solid ${C.border}`, background: 'transparent' }}>X</button>
        </div>
        <div style={{ overflowY: 'auto', flex: 1, padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {section('Informasi Dasar')}
          <div><FL required>Nama Produk (name)</FL><GcInput value={form.name} onChange={set('name')}/></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div><FL required>Kategori</FL>
              <GcSelect value={form.category} onChange={set('category')}>
                <option value="Signature">Signature</option><option value="MilkTea">Milk Tea</option><option value="Coffee">Coffee</option>
                <option value="Matcha">Matcha</option><option value="Mint">Mint</option><option value="BrownSugar">Brown Sugar</option>
                <option value="CreativeMix">Creative Mix</option><option value="BrewedTea">Brewed Tea</option><option value="Topping">Topping</option>
              </GcSelect>
            </div>
            <div><FL required>Harga Medium (Rp)</FL><GcInput type="number" value={form.mediumPrice} onChange={set('mediumPrice')}/></div>
          </div>
          <div><FL>Deskripsi Singkat</FL><GcTextarea value={form.description} onChange={set('description')}/></div>

          {section('Opsi Aplikasi Pelanggan')}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 10, background: C.bg, border: `1px solid ${C.border}` }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: C.tx1 }}>🔥 BISA HOT</span>
              <input type="checkbox" checked={form.availableHot} onChange={e => setForm(p => ({ ...p, availableHot: e.target.checked }))} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 10, background: C.bg, border: `1px solid ${C.border}` }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: C.tx1 }}>🥤 BISA LARGE</span>
              <input type="checkbox" checked={form.availableLarge} onChange={e => setForm(p => ({ ...p, availableLarge: e.target.checked }))} />
            </div>
          </div>

          {section('Media & Meta')}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14 }}>
            <div>
              <FL>Upload Gambar (WebP Auto-compress)</FL>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                {form.image && <img src={form.image} alt="Preview" style={{ width: 44, height: 44, objectFit: 'contain', borderRadius: 8, border: `1px solid ${C.border}` }}/>}
                <div style={{ flex: 1, position: 'relative', height: 42 }}>
                  <input type="file" accept="image/*" onChange={handleImageFile} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', zIndex: 10 }} />
                  <div style={{ width: '100%', height: '100%', borderRadius: 9, background: C.bg, border: `1.5px dashed ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12.5, fontWeight: 600, color: C.tx2 }}>
                    {processingImage ? 'Mengompres...' : uploadProgress !== null ? `Mengunggah ${Math.round(uploadProgress)}%` : 'Pilih Gambar'}
                  </div>
                </div>
              </div>
            </div>
            <div><FL>Rating Default</FL><GcInput type="number" step="0.1" value={form.rating} onChange={set('rating')}/></div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderRadius: 12, background: C.bg, border: `1px solid ${C.border}`, marginTop: 6 }}>
            <div>
              <p style={{ fontSize: 13.5, fontWeight: 600, color: C.tx1, marginBottom: 2 }}>Ketersediaan Stok Outlet</p>
              <p style={{ fontSize: 12, color: C.tx3 }}>Matikan jika produk sedang habis/sold out</p>
            </div>
            <input type="checkbox" checked={form.isAvailable} onChange={e => setForm(p => ({ ...p, isAvailable: e.target.checked }))} />
          </div>
          {error && <div style={{ padding: '11px 14px', background: C.redBg, border: '1px solid #FECDD3', borderRadius: 9, fontSize: 12.5, color: '#B42318' }}>{error}</div>}
        </div>
        <div style={{ padding: '16px 28px 24px', borderTop: `1px solid ${C.border2}`, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} style={{ height: 40, padding: '0 20px', borderRadius: 9, border: `1.5px solid ${C.border}`, background: C.white, fontWeight: 600 }}>Batal</button>
          <button onClick={handleSave} disabled={loading || uploadProgress !== null || processingImage} style={{ height: 40, padding: '0 22px', borderRadius: 9, border: 'none', background: C.tx1, color: '#fff', fontWeight: 600 }}>{loading ? 'Menyimpan…' : 'Simpan Perubahan'}</button>
        </div>
      </div>
    </div>
  );
}

// ── Main Layout ───────────────────────────────────────────────────────────────────────
export default function MenusClient({ initialMenus }: { initialMenus?: ProductWithId[] }) {
  const [menus, setMenus] = useState<ProductWithId[]>(initialMenus || []);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("connecting");
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'available' | 'unavailable'>('all');
  
  const [editTarget, setEditTarget] = useState<ProductWithId | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProductWithId | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => setToast({ msg, type }), []);
  const { isAdmin } = useAuth();

  useEffect(() => {
    const q = query(collection(db, "products"), orderBy("name"));
    const unsub = onSnapshot(q,
      snap => { 
        setMenus(snap.docs.map(d => ({ id: d.id, ...d.data() } as ProductWithId))); 
        setSyncStatus("live"); 
      },
      err => { console.error("[products onSnapshot]", err); setSyncStatus("error"); }
    );
    return () => unsub();
  }, []);

  const filtered = useMemo(() => menus.filter(m => {
    const q = search.toLowerCase();
    const ok = !q || (m.name && m.name.toLowerCase().includes(q)) || (m.category && m.category.toLowerCase().includes(q));
    const f = filter === 'all' || (filter === 'available' ? m.isAvailable !== false : m.isAvailable === false);
    return ok && f;
  }), [menus, search, filter]);

  const handleToggleStatus = async (menu: ProductWithId) => {
    try {
      await updateMenu(menu.id, { isAvailable: !menu.isAvailable });
      showToast(`${menu.name} sekarang ${!menu.isAvailable ? 'Tersedia' : 'Habis'}`);
    } catch (err: any) { showToast(err.message || 'Gagal mengubah status', 'error'); }
  };

  const totalMenus = menus.length;
  const availableMenus = menus.filter(m => m.isAvailable !== false).length;
  const outOfStockMenus = menus.filter(m => m.isAvailable === false).length;

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* ── HEADER (Menggunakan UI Component) ──────────────────────────────────────────────── */}
      <PageHeader 
        title="Katalog Menu" 
        description="Kelola daftar minuman, harga, dan ketersediaan etalase"
        rightContent={
          <>
            <LiveBadge status={syncStatus} count={totalMenus} />
            {isAdmin && (
              <button 
                onClick={() => setShowAdd(true)}
                className="px-4 py-2 bg-gray-900 text-white text-sm font-bold rounded-xl shadow-sm hover:bg-gray-800 transition-all focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 active:scale-95"
              >
                + Tambah Menu
              </button>
            )}
          </>
        }
      />

      {/* ── STATS CARDS ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-center transition-shadow hover:shadow-md">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">TOTAL PRODUK</span>
          <span className="text-3xl font-black text-gray-900">{totalMenus}</span>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-center transition-shadow hover:shadow-md">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">TERSEDIA</span>
          <span className="text-3xl font-black text-green-600">{availableMenus}</span>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-center transition-shadow hover:shadow-md">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">HABIS (SOLD OUT)</span>
          <span className="text-3xl font-black text-red-600">{outOfStockMenus}</span>
        </div>
      </div>

      {/* ── DATA WRAPPER & TOOLBAR ──────────────────────────────────────── */}
      <div className="flex flex-col shadow-sm">
        <div className="bg-white p-4 rounded-t-2xl border-x border-t border-gray-100 flex flex-col sm:flex-row gap-4 justify-between items-center">
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Cari menu atau kategori..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-8 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 w-full sm:w-[280px] transition-all"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            
            <div className="flex bg-gray-100 rounded-xl p-1 gap-1 w-full sm:w-auto">
              {(['all', 'available', 'unavailable'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                    filter === f
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {f === 'all' ? 'Semua' : f === 'available' ? 'Tersedia' : 'Habis'}
                </button>
              ))}
            </div>
          </div>
          <div className="text-sm font-medium text-gray-500">
            {filtered.length} menu
          </div>
        </div>

        {/* ── TABLE SECTION ──────────────────────────────────────────────────────── */}
        <div className="bg-white border border-gray-100 rounded-b-2xl overflow-hidden">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50/50 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Info Produk</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Kategori & Opsi</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Harga (Medium)</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100/80 bg-white">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-0">
                      {/* Menggunakan EmptyState Component! */}
                      <EmptyState 
                        title="Tidak ada menu ditemukan" 
                        description={search ? "Coba kata kunci lain atau hapus filter" : undefined}
                      />
                    </td>
                  </tr>
                ) : (
                  filtered.map((m) => (
                    <tr key={m.id} className="hover:bg-gray-50/50 transition-colors group">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          {m.image ? (
                            <img src={m.image} alt={m.name} className="w-11 h-11 rounded-lg object-contain bg-gray-50 border border-gray-100 p-1" />
                          ) : (
                            <div className="w-11 h-11 rounded-lg bg-gray-50 flex items-center justify-center border border-gray-100">
                              <UtensilsCrossed className="w-4 h-4 text-gray-300" />
                            </div>
                          )}
                          <div className="flex flex-col max-w-[200px] whitespace-normal">
                            <span className="font-bold text-gray-900 leading-tight">{m.name}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col gap-1.5 items-start">
                          <span className="bg-gray-100 text-gray-700 text-[11px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wide">
                            {m.category}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-900 font-bold">
                        {formatRp(m.mediumPrice)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {/* Menggunakan StatusBadge Component! */}
                        <StatusBadge variant={m.isAvailable !== false ? "success" : "danger"}>
                          {m.isAvailable !== false ? 'AVAILABLE' : 'OUT OF STOCK'}
                        </StatusBadge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                         <div className="flex items-center justify-end gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleToggleStatus(m)} className="px-3 py-1.5 text-xs font-bold rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 transition-all">
                              Toggle
                            </button>
                            {isAdmin && (
                              <>
                                <button onClick={() => setEditTarget(m)} className="px-3 py-1.5 text-xs font-bold rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors">Edit</button>
                                <button onClick={() => setDeleteTarget(m)} className="px-3 py-1.5 text-xs font-bold rounded-lg bg-red-50 text-red-700 hover:bg-red-100 transition-colors">Hapus</button>
                              </>
                            )}
                         </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {editTarget && <MenuModal menu={editTarget} onClose={() => setEditTarget(null)} onSaved={msg => { showToast(msg); setEditTarget(null); }} />}
      {showAdd && <MenuModal menu={null} onClose={() => setShowAdd(false)} onSaved={msg => { showToast(msg); setShowAdd(false); }} />}
      {deleteTarget && <DeleteModal menu={deleteTarget} onClose={() => setDeleteTarget(null)} onDeleted={msg => { showToast(msg); setDeleteTarget(null); }} />}
      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
    </div>
  );
}