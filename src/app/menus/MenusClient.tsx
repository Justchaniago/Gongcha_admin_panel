"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL, listAll } from "firebase/storage";
import { db, storage } from "@/lib/firebaseClient";
import { Product, productConverter } from "@/types/firestore";
import { createMenu, updateMenu, deleteMenu } from "@/actions/menuActions";
import { useAuth } from "@/context/AuthContext";
import { GcButton, GcEmptyState, GcFieldLabel, GcInput, GcModalShell, GcPage, GcPageHeader, GcPanel, GcSelect, GcTextarea, GcToast } from "@/components/ui/gc";

type ProductWithId = Product;
type SyncStatus = "connecting" | "live" | "error";

function generateProductId(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s_-]/g, "")
    .replace(/[\s-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

const C = {
  bg: '#F4F6FB', white: '#FFFFFF', border: '#EAECF2', border2: '#F0F2F7',
  tx1: '#0F1117', tx2: '#4A5065', tx3: '#9299B0', tx4: '#BCC1D3',
  blue: '#3B82F6', blueL: '#EFF6FF',
  green: '#12B76A', greenBg: '#ECFDF3',
  orange: '#F79009', orangeBg: '#FFFAEB',
  red: '#C8102E', redBg: '#FEF3F2',
  shadow: '0 1px 3px rgba(16,24,40,.06), 0 1px 2px rgba(16,24,40,.04)',
  shadowLg: '0 20px 60px rgba(16,24,40,.18), 0 4px 12px rgba(16,24,40,.08)',
} as const;
const font = "Inter, system-ui, sans-serif";

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
        reject(new Error("Failed to initialize Canvas API"));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Failed to convert image"));
        },
        "image/webp",
        quality
      );
    };
    img.onerror = () => reject(new Error("Failed to read image file"));
  });
};

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
      {active ? 'Available' : 'Archived / Out'}
    </span>
  );
}

function FL({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return <GcFieldLabel required={required}>{children}</GcFieldLabel>;
}

function Toast({ msg, type, onDone }: { msg: string; type: 'success'|'error'; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 3200); return () => clearTimeout(t); }, [onDone]);
  return (
    <div style={{ position: 'fixed', bottom: 28, right: 28, zIndex: 999 }}>
      <GcToast msg={msg} type={type} />
    </div>
  );
}

function formatRp(num: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);
}

// ── Delete Modal (Refactored to Soft Delete Wording) ───────────────
function DeleteModal({ menu, onClose, onDeleted }: { menu: ProductWithId; onClose: () => void; onDeleted: (msg: string) => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function confirm() {
    setLoading(true); setError('');
    try {
      await deleteMenu(menu.id);
      onDeleted(`"${menu.name}" successfully archived.`);
      onClose();
    } catch (e: any) { setError(e.message); setLoading(false); }
  }

  return (
    <GcModalShell
      onClose={onClose}
      title="Archive Product?"
      eyebrow="Soft Delete"
      description={<>Product <strong>"{menu.name}"</strong> will be marked as Unavailable and hidden from Customer App (Delta Sync).</>}
      maxWidth={440}
      footer={
        <>
          <GcButton variant="ghost" size="lg" onClick={onClose}>Cancel</GcButton>
          <GcButton variant="danger" size="lg" onClick={confirm} loading={loading}>Archive Item</GcButton>
        </>
      }
    >
      <code style={{ fontSize: 11, color: C.tx3, background: C.bg, padding: '4px 8px', borderRadius: 6, display: 'inline-block', marginBottom: 18 }}>ID: {menu.id}</code>
      {error && <div style={{ padding: '10px 14px', background: C.redBg, border: '1px solid #FECDD3', borderRadius: 9, fontSize: 12.5, color: '#B42318', marginBottom: 14 }}>{error}</div>}
    </GcModalShell>
  );
}

// ── Menu Modal ─────────────────────────────────────────────────────────────────
type MenuForm = {
  name: string;
  description: string;
  basePrice: string;
  category: string;
  imageUrl: string;
  rating: string;
  isAvailable: boolean;
  isHotAvailable: boolean;
  isLargeAvailable: boolean;
};

function MenuModal({ menu, onClose, onSaved }: {
  menu: ProductWithId | null; onClose: () => void; onSaved: (msg: string) => void;
}) {
  const isNew = !menu;

  const [form, setForm] = useState<MenuForm>({
    name:           menu?.name ?? '',
    description:    (menu as any)?.description ?? '',
    basePrice:      menu?.basePrice ? String(menu.basePrice) : '',
    category:       menu?.category ?? 'MilkTea',
    imageUrl:       menu?.imageUrl ?? '',
    rating:         (menu as any)?.rating ? String((menu as any)?.rating) : '5.0',
    isAvailable:    menu?.isAvailable ?? true,
    isHotAvailable: menu?.isHotAvailable ?? false,
    isLargeAvailable: menu?.isLargeAvailable ?? true,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [processingImage, setProcessingImage] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryError, setLibraryError] = useState('');
  const [libraryImages, setLibraryImages] = useState<Array<{ path: string; name: string; url: string }>>([]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const set = (k: keyof MenuForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));

  const handleImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      setError("Ukuran gambar asli maksimal 15MB.");
      return;
    }

    setError('');
    setProcessingImage(true);

    try {
      const compressedBlob = await compressImageToWebP(file, 800, 800, 0.8);
      const productId = generateProductId(form.name || menu?.name || "product");
      const fileName = `products/${productId || Date.now().toString()}.webp`;
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
          setError("Failed to upload image: " + err.message);
          setUploadProgress(null);
        },
        async () => {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          setForm(p => ({ ...p, imageUrl: url }));
          setUploadProgress(null);
        }
      );
    } catch (err: any) {
      setError(err.message || "Failed to process image");
      setProcessingImage(false);
    }
  };

  const loadStorageLibrary = useCallback(async () => {
    if (libraryLoading) return;
    setLibraryError('');
    setLibraryLoading(true);

    try {
      const folders = ['product', 'products'];
      const listed = await Promise.all(
        folders.map(async (folder) => {
          try {
            const listing = await listAll(ref(storage, folder));
            return listing.items;
          } catch {
            return [];
          }
        })
      );

      const merged = listed.flat();
      const seen = new Set<string>();
      const unique = merged.filter((item) => {
        if (seen.has(item.fullPath)) return false;
        seen.add(item.fullPath);
        return true;
      });

      const ordered = [...unique].reverse().slice(0, 60);
      const resolved = await Promise.all(
        ordered.map(async (itemRef) => ({
          path: itemRef.fullPath,
          name: itemRef.name,
          url: await getDownloadURL(itemRef),
        }))
      );

      setLibraryImages(resolved);
      if (resolved.length === 0) setLibraryError('No images found in /product or /products folder.');
    } catch (err: any) {
      setLibraryError(err?.code === 'storage/unauthorized'
        ? 'Storage access denied. Please check Firebase Storage rules.'
        : (err?.message ?? 'Failed to load storage gallery.'));
    } finally {
      setLibraryLoading(false);
    }
  }, [libraryLoading]);

  const toggleStorageLibrary = useCallback(async () => {
    const next = !showLibrary;
    setShowLibrary(next);
    if (next && libraryImages.length === 0) {
      await loadStorageLibrary();
    }
  }, [showLibrary, libraryImages.length, loadStorageLibrary]);

  async function handleSave() {
    if (!form.name.trim()) { setError('Product name is required.'); return; }
    if (!form.basePrice.trim() || isNaN(Number(form.basePrice))) { setError('Price must be a valid number.'); return; }
    if (uploadProgress !== null || processingImage) { setError('Wait for image processing to complete.'); return; }

    setLoading(true); setError('');
    try {
      const payload = {
        name: form.name.trim(),
        basePrice: Number(form.basePrice),
        category: form.category,
        imageUrl: form.imageUrl.trim(),
        description: form.description.trim(),
        isAvailable: form.isAvailable,
        isHotAvailable: form.isHotAvailable,
        isLargeAvailable: form.isLargeAvailable,
      };

      if (isNew) {
        await createMenu(payload);
      } else {
        await updateMenu(menu!.id, payload);
      }

      onSaved(isNew ? `Product "${form.name}" successfully added!` : `"${form.name}" successfully updated.`);
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
    <GcModalShell
      onClose={onClose}
      title={isNew ? 'Add Product' : menu!.name}
      eyebrow={isNew ? 'New Item' : 'Edit Item'}
      maxWidth={560}
      footer={
        <>
          <p style={{ fontSize: 11.5, color: C.tx3, marginRight: 'auto' }}>Fields marked <span style={{ color: C.red }}>*</span> are required</p>
          <GcButton variant="ghost" size="lg" onClick={onClose}>Cancel</GcButton>
          <GcButton variant="blue" size="lg" onClick={handleSave} disabled={uploadProgress !== null || processingImage} loading={loading}>
            {isNew ? '+ Add Product' : 'Save Changes'}
          </GcButton>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {section('Basic Information')}
          <div>
            <FL required>Product Name (name)</FL>
            <GcInput placeholder="Misal: Pearl Milk Tea" value={form.name} onChange={set('name')}/>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <FL required>Category (category)</FL>
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
              <FL required>Base Price (basePrice)</FL>
              <GcInput type="number" placeholder="29000" value={form.basePrice} onChange={set('basePrice')}/>
            </div>
          </div>
          <div>
            <FL>Description (description)</FL>
            <GcTextarea placeholder="Drink description..." value={form.description} onChange={set('description')}/>
          </div>

          {section('Customer App Options')}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 10, background: C.bg, border: `1px solid ${C.border}` }}>
              <div>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: C.tx1, display: 'block' }}>🔥 HOT (availableHot)</span>
              </div>
              <button type="button" onClick={() => setForm(p => ({ ...p, isHotAvailable: !p.isHotAvailable }))}
                style={{ width: 36, height: 20, borderRadius: 99, border: 'none', cursor: 'pointer', background: form.isHotAvailable ? '#E11D48' : C.border, position: 'relative', transition: 'background .2s' }}>
                <span style={{ position: 'absolute', top: 2, borderRadius: '50%', width: 16, height: 16, background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,.2)', left: form.isHotAvailable ? 18 : 2, transition: 'left .2s cubic-bezier(.34,1.56,.64,1)' }}/>
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 10, background: C.bg, border: `1px solid ${C.border}` }}>
               <div>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: C.tx1, display: 'block' }}>🥤 LARGE (availableLarge)</span>
              </div>
              <button type="button" onClick={() => setForm(p => ({ ...p, isLargeAvailable: !p.isLargeAvailable }))}
                style={{ width: 36, height: 20, borderRadius: 99, border: 'none', cursor: 'pointer', background: form.isLargeAvailable ? '#2563EB' : C.border, position: 'relative', transition: 'background .2s' }}>
                <span style={{ position: 'absolute', top: 2, borderRadius: '50%', width: 16, height: 16, background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,.2)', left: form.isLargeAvailable ? 18 : 2, transition: 'left .2s cubic-bezier(.34,1.56,.64,1)' }}/>
              </button>
            </div>
          </div>

          {section('Media & Meta')}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14 }}>
            <div>
              <FL>Upload Product Image (WebP)</FL>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                {form.imageUrl && (
                  <img
                    src={form.imageUrl}
                    alt={form.name}
                    style={{ width: '100%', height: '100%', objectFit: 'contain', maxWidth: 44, maxHeight: 44 }}
                  />
                )}
                <div style={{ flex: 1 }}>
                  {processingImage ? (
                    <div style={{ width: '100%', height: 42, borderRadius: 9, background: C.bg, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: C.orange }}>Compressing to WebP...</span>
                    </div>
                  ) : uploadProgress !== null ? (
                    <div style={{ width: '100%', height: 42, borderRadius: 9, background: C.bg, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', padding: '0 10px', position: 'relative', overflow: 'hidden' }}>
                      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, background: C.blueL, width: `${uploadProgress}%`, transition: 'width 0.2s ease' }} />
                      <span style={{ position: 'relative', zIndex: 1, fontSize: 12, fontWeight: 700, color: C.blue }}>Uploading... {Math.round(uploadProgress)}%</span>
                    </div>
                  ) : (
                    <div style={{ position: 'relative', height: 42, display: 'flex', alignItems: 'center' }}>
                      <input type="file" accept="image/*" onChange={handleImageFile} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', zIndex: 10 }} />
                      <div style={{ width: '100%', height: '100%', borderRadius: 9, background: C.bg, border: `1.5px dashed ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 12.5, fontWeight: 600, color: C.tx2, transition: 'all .2s' }}>
                        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
                        Choose Image File
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                <GcButton type="button" variant="ghost" size="sm" onClick={toggleStorageLibrary} disabled={processingImage || uploadProgress !== null}>
                  {showLibrary ? 'Hide Storage Gallery' : 'Choose from Storage'}
                </GcButton>
                {showLibrary && (
                  <GcButton type="button" variant="ghost" size="sm" onClick={loadStorageLibrary} disabled={libraryLoading}>
                    {libraryLoading ? 'Loading…' : 'Refresh'}
                  </GcButton>
                )}
              </div>

              {showLibrary && (
                <div style={{ marginTop: 10, border: `1px solid ${C.border}`, borderRadius: 11, background: C.white, overflow: 'hidden' }}>
                  <div style={{ padding: '9px 11px', borderBottom: `1px solid ${C.border2}`, fontSize: 11.5, fontWeight: 700, color: C.tx2 }}>
                    Firebase Storage /product (+ /products) ({libraryImages.length})
                  </div>

                  {libraryLoading ? (
                    <div style={{ padding: '14px 12px', fontSize: 12, color: C.tx3 }}>Loading gallery…</div>
                  ) : libraryError ? (
                    <div style={{ padding: '12px', fontSize: 12, color: C.red, background: C.redBg }}>{libraryError}</div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(92px, 1fr))', gap: 8, padding: 10, maxHeight: 220, overflowY: 'auto' }}>
                      {libraryImages.map((img) => {
                        const selected = form.imageUrl === img.url;
                        return (
                          <button key={img.path} type="button" onClick={() => setForm(p => ({ ...p, imageUrl: img.url }))} title={img.name}
                            style={{ border: selected ? `2px solid ${C.blue}` : `1px solid ${C.border}`, borderRadius: 9, background: selected ? C.blueL : C.bg, cursor: 'pointer', padding: 4, display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'stretch' }}>
                            <img src={img.url} alt={img.name} style={{ width: '100%', height: 56, objectFit: 'cover', borderRadius: 6, background: C.white }}/>
                            <span style={{ fontSize: 10, color: C.tx3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'left' }}>{img.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div>
              <FL>Default Rating</FL>
              <GcInput type="number" step="0.1" placeholder="5.0" value={form.rating} onChange={set('rating')}/>
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderRadius: 12, background: C.bg, border: `1px solid ${C.border}`, marginTop: 6 }}>
            <div>
              <p style={{ fontSize: 13.5, fontWeight: 600, color: C.tx1, marginBottom: 2 }}>Store Stock Availability</p>
              <p style={{ fontSize: 12, color: C.tx3 }}>Turn off if item is out of stock nationwide</p>
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
    </GcModalShell>
  );
}

// ── Showcase Card (staff view) ───────────────────────────────────────────────
function ShowcaseMenuCard({ menu }: { menu: ProductWithId }) {
  const [h, setH] = useState(false);
  const sizeAvailabilityText = menu.isHotAvailable && menu.isLargeAvailable
    ? 'Available on hot and large size'
    : menu.isHotAvailable
      ? 'Available on hot size'
      : menu.isLargeAvailable
        ? 'Available on large size'
        : '';

  return (
    <div
      onMouseOver={() => setH(true)}
      onMouseOut={() => setH(false)}
      style={{
        background: C.white,
        borderRadius: 18,
        border: `1px solid ${h ? 'rgba(15,17,23,.16)' : 'rgba(15,17,23,.08)'}`,
        boxShadow: h ? '0 10px 26px rgba(15,17,23,.09), 0 1px 2px rgba(15,17,23,.05)' : '0 1px 2px rgba(15,17,23,.04)',
        overflow: 'hidden',
        transition: 'all .16s ease',
        transform: h ? 'translateY(-2px)' : 'none',
        display: 'flex',
        flexDirection: 'column',
        cursor: 'default',
        height: '100%',
      }}
    >
      <div style={{ height: 176, background: 'linear-gradient(155deg, #FAFBFE 0%, #F2F4FA 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', flexShrink: 0, overflow: 'hidden', borderBottom: '1px solid rgba(15,17,23,.06)' }}>
        {menu.imageUrl ? (
          <img src={menu.imageUrl} alt={menu.name} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 16 }} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, opacity: .45 }}>
            <svg width="34" height="34" fill="none" viewBox="0 0 24 24" stroke={C.tx3} strokeWidth={1.3}><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></svg>
            <span style={{ fontSize: 10, color: C.tx3, fontWeight: 600, fontFamily: font }}>Tidak ada gambar</span>
          </div>
        )}
        <div style={{ position: 'absolute', top: 12, right: 12 }}><StatusPill active={menu.isAvailable !== false} /></div>
      </div>
      <div style={{ padding: '16px 18px 18px', flex: 1, display: 'flex', flexDirection: 'column', gap: 9 }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span
            title={menu.category}
            style={{
              minHeight: 27,
              maxWidth: 138,
              padding: '0 12px',
              borderRadius: 8,
              background: '#F5F7FC',
              border: '1px solid rgba(15,17,23,.07)',
              color: '#4A5065',
              fontSize: 12,
              fontWeight: 600,
              fontFamily: font,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1,
              letterSpacing: '.01em',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              textAlign: 'center',
            }}
          >
            {menu.category}
          </span>
        </div>
        <p style={{ fontSize: 15, fontWeight: 700, color: '#11131A', margin: 0, lineHeight: 1.34, fontFamily: font }}>{menu.name}</p>
        {(menu as any).description && (
          <p style={{ fontSize: 12.5, color: '#6B7285', margin: 0, lineHeight: 1.56, fontFamily: font, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>{(menu as any).description}</p>
        )}
        {sizeAvailabilityText && (
          <p style={{ margin: 0, fontSize: 11.5, color: '#8B92A6', fontWeight: 500, lineHeight: 1.45, fontFamily: font }}>
            {sizeAvailabilityText}
          </p>
        )}
        <div style={{ marginTop: 'auto', paddingTop: 12, borderTop: '1px solid rgba(15,17,23,.06)', display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <p style={{ fontSize: 16.5, fontWeight: 700, color: '#0F1117', margin: 0, fontFamily: font, letterSpacing: '-.01em' }}>{formatRp(menu.basePrice)}</p>
          <span style={{ fontSize: 11, color: '#8B92A6', fontWeight: 500, fontFamily: font }}>/medium</span>
        </div>
      </div>
    </div>
  );
}

// ── Table Row ──────────────────────────────────────────────────────────────────
function MenuRow({ menu, isLast, onEdit, onDelete, canManage }: { menu: ProductWithId; isLast: boolean; onEdit: () => void; onDelete: () => void; canManage: boolean }) {
  const [h, setH] = useState(false);
  const [bh, setBH] = useState(false);
  const [dh, setDH] = useState(false);

  return (
    <tr onMouseOver={() => setH(true)} onMouseOut={() => setH(false)} style={{ borderBottom: isLast ? 'none' : `1px solid ${C.border2}`, background: h ? '#F8F9FC' : C.white, transition: 'background .1s' }}>
      <td style={{ padding: '14px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: C.bg, overflow: 'hidden', border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {menu.imageUrl ? (
              <img src={menu.imageUrl} alt={menu.name} style={{ width: '100%', height: '100%', objectFit: 'contain', maxWidth: 44, maxHeight: 44 }} />
            ) : (
              <span style={{ color: C.tx4, fontSize: 10, fontWeight: 600 }}>No Img</span>
            )}
          </div>
          <div>
            <p style={{ fontSize: 13.5, fontWeight: 800, color: C.tx1, marginBottom: 2, opacity: menu.isAvailable === false ? 0.6 : 1 }}>{menu.name}</p>
            {(menu as any).description && <p style={{ fontSize: 11.5, color: C.tx3, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(menu as any).description}</p>}
          </div>
        </div>
      </td>
      <td style={{ padding: '14px 18px', fontSize: 12.5, color: C.tx2 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ padding: '4px 10px', borderRadius: 8, background: C.bg, border: `1px solid ${C.border2}`, fontSize: 11.5, fontWeight: 700, color: C.tx2 }}>{menu.category}</span>
          {menu.isHotAvailable && <span title="Bisa Panas" style={{ padding: '4px 8px', borderRadius: 8, background: '#FFF1F2', color: '#E11D48', fontSize: 10.5, fontWeight: 800 }}>HOT</span>}
          {menu.isLargeAvailable && <span title="Large size available" style={{ padding: '4px 8px', borderRadius: 8, background: '#EFF6FF', color: '#2563EB', fontSize: 10.5, fontWeight: 800 }}>LARGE</span>}
        </div>
      </td>
      <td style={{ padding: '14px 18px', fontSize: 13.5, fontWeight: 800, color: C.tx1, opacity: menu.isAvailable === false ? 0.6 : 1 }}>{formatRp(menu.basePrice)}</td>
      <td style={{ padding: '14px 18px' }}><StatusPill active={menu.isAvailable !== false}/></td>
      <td style={{ padding: '14px 18px' }}>
        {canManage && (
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={onEdit} onMouseOver={() => setBH(true)} onMouseOut={() => setBH(false)}
              style={{ height: 32, padding: '0 12px', borderRadius: 7, fontFamily: font, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `1.5px solid ${bh ? C.blue : C.border}`, background: bh ? C.blueL : C.white, color: bh ? C.blue : C.tx2, display: 'inline-flex', alignItems: 'center', gap: 5, transition: 'all .13s' }}>
              <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
              Edit
            </button>
            <button onClick={onDelete} onMouseOver={() => setDH(true)} onMouseOut={() => setDH(false)}
              style={{ height: 32, padding: '0 12px', borderRadius: 7, fontFamily: font, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `1.5px solid ${dh ? C.red : C.border}`, background: dh ? C.redBg : C.white, color: dh ? C.red : C.tx2, display: 'inline-flex', alignItems: 'center', gap: 5, transition: 'all .13s' }}>
              <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M9 6V4h6v2"/></svg>
              Archive
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function MenusClient({ initialMenus = [], showAddTrigger }: { initialMenus?: ProductWithId[]; showAddTrigger?: boolean }) {
  const [menus, setMenus] = useState<ProductWithId[]>(initialMenus);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("connecting");
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all'|'available'|'unavailable'>('available'); // Default langsung "available" aja biar bersih
  const [editTarget, setEditTarget] = useState<ProductWithId | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProductWithId | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [toast, setToast] = useState<{msg:string;type:'success'|'error'}|null>(null);
  const [searchFocus, setSearchFocus] = useState(false);
  const { user } = useAuth();
  const canManageMenus = user?.role !== "STAFF";

  const showToast = useCallback((msg: string, type: 'success'|'error' = 'success') => setToast({ msg, type }), []);

  useEffect(() => {
    const q = query(collection(db, "products").withConverter(productConverter), orderBy("name"));
    const unsub = onSnapshot(q,
      snap => { setMenus(snap.docs.map(d => d.data())); setSyncStatus("live"); },
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
          {canManageMenus && (
            <GcButton variant="blue" size="lg" onClick={() => setShowAdd(true)}>
              Add Product
            </GcButton>
          )}
        </div>
        {canManageMenus && showAdd && <MenuModal menu={null} onClose={() => setShowAdd(false)} onSaved={msg => { showToast(msg); setShowAdd(false); }}/>} 
        {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)}/>}
      </>
    );
  }

  if (!canManageMenus) {
    return (
      <GcPage>
        <GcPageHeader
          eyebrow="Gongcha App Admin"
          title="Menus & Product Availability"
          description="Browse and view all products and menu availability for Gong Cha members."
          actions={<LiveBadge status={syncStatus}/>}
        />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, gap: 12, flexWrap: 'wrap', padding: '10px 12px', borderRadius: 14, border: '1px solid rgba(15,17,23,.08)', background: 'rgba(255,255,255,.72)', backdropFilter: 'saturate(160%) blur(8px)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 40, padding: '0 13px', minWidth: 240, background: C.white, border: `1px solid ${searchFocus ? 'rgba(59,130,246,.48)' : 'rgba(15,17,23,.10)'}`, borderRadius: 10, boxShadow: searchFocus ? '0 0 0 3px rgba(59,130,246,.10)' : 'none', transition: 'all .14s' }}>
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke={C.tx3} strokeWidth={2.2}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <input style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontFamily: font, fontSize: 13.5, color: C.tx1 }} placeholder="Cari nama atau kategori…" value={search} onChange={e => setSearch(e.target.value)} onFocus={() => setSearchFocus(true)} onBlur={() => setSearchFocus(false)}/>
              {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.tx3, fontSize: 15, padding: 0 }}>✕</button>}
            </div>
            <div style={{ display: 'flex', background: '#F6F7FB', border: '1px solid rgba(15,17,23,.08)', borderRadius: 10, padding: 3 }}>
              {(['all', 'available', 'unavailable'] as const).map(f => (
                <button key={f} onClick={() => setFilter(f)} style={{ padding: '5px 14px', borderRadius: 7, border: 'none', fontFamily: font, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', transition: 'all .13s', background: filter === f ? C.white : 'transparent', color: filter === f ? C.tx1 : C.tx3, boxShadow: filter === f ? '0 1px 2px rgba(15,17,23,.06)' : 'none' }}>
                  {f === 'all' ? 'Semua' : f === 'available' ? 'Tersedia' : 'Habis'}
                </button>
              ))}
            </div>
          </div>
          <span style={{ fontSize: 12.5, color: C.tx3, fontFamily: font }}>{filtered.length} produk</span>
        </div>
        {filtered.length === 0 ? (
          <GcPanel style={{ padding: '60px 24px', textAlign: 'center' }}>
            <GcEmptyState title="Tidak ada produk" description={syncStatus === 'connecting' ? 'Memuat katalog produk…' : 'Tidak ada produk yang sesuai filter.'} icon={syncStatus === 'connecting' ? '⏳' : '📭'} />
          </GcPanel>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 16 }}>
            {filtered.map((m, i) => (
              <div key={m.id} style={{ animation: `gcShowcase .22s ease both`, animationDelay: `${i * 25}ms` }}>
                <ShowcaseMenuCard menu={m} />
              </div>
            ))}
          </div>
        )}
        <style>{`@keyframes gcShowcase { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:none} }`}</style>
        {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)}/>}
      </GcPage>
    );
  }

  return (
    <GcPage>
      <GcPageHeader
        eyebrow="Gongcha App Admin"
        title="Menus & Product Availability"
        description="Browse and manage all menu items and products available for members."
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <LiveBadge status={syncStatus}/>
            {canManageMenus && (
              <GcButton variant="blue" size="lg" onClick={() => setShowAdd(true)}>
                Add Product
              </GcButton>
            )}
          </div>
        }
      />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 40, padding: '0 13px', minWidth: 240, background: C.white, border: `1.5px solid ${searchFocus ? C.blue : C.border}`, borderRadius: 10, boxShadow: searchFocus ? '0 0 0 3px rgba(67,97,238,.1)' : 'none', transition: 'all .14s' }}>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke={C.tx3} strokeWidth={2.2}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontFamily: font, fontSize: 13.5, color: C.tx1 }} placeholder="Search name or category…" value={search} onChange={e => setSearch(e.target.value)} onFocus={() => setSearchFocus(true)} onBlur={() => setSearchFocus(false)}/>
            {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.tx3, fontSize: 15, padding: 0 }}>✕</button>}
          </div>
          <div style={{ display: 'flex', background: C.bg, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: 3 }}>
            {(['all', 'available', 'unavailable'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{ padding: '5px 14px', borderRadius: 7, border: 'none', fontFamily: font, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', transition: 'all .13s', background: filter === f ? C.white : 'transparent', color: filter === f ? C.tx1 : C.tx3, boxShadow: filter === f ? C.shadow : 'none' }}>
                {f === 'all' ? 'All' : f === 'available' ? 'Available' : 'Archived'}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12.5, color: C.tx3 }}>{filtered.length} products</span>
        </div>
      </div>

      <GcPanel style={{ borderRadius: 18, overflow: 'hidden' }}>
        {filtered.length === 0 ? (
          <GcEmptyState
            title="No products found"
            description={syncStatus === 'connecting' ? 'Loading product catalog…' : 'No products match the current filter.'}
            icon={syncStatus === 'connecting' ? '⏳' : '📭'}
          />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 860, borderCollapse: 'collapse', fontFamily: font }}>
              <thead>
                <tr style={{ background: '#F8F9FC' }}>
                  {['Product Details', 'Category & Info', 'Medium Price (Rp)', 'Status', ''].map((h, i) => (
                    <th key={i} style={{ padding: '11px 18px', textAlign: 'left', fontSize: 10.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: C.tx3, borderBottom: `1px solid ${C.border2}`, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((m, i) => (
                  <MenuRow key={m.id} menu={m} isLast={i === filtered.length - 1} onEdit={() => setEditTarget(m)} onDelete={() => setDeleteTarget(m)} canManage={canManageMenus} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GcPanel>

      {canManageMenus && editTarget && <MenuModal menu={editTarget} onClose={() => setEditTarget(null)} onSaved={msg => { showToast(msg); setEditTarget(null); }}/>} 
      {canManageMenus && showAdd && <MenuModal menu={null} onClose={() => setShowAdd(false)} onSaved={msg => { showToast(msg); setShowAdd(false); }}/>} 
      {canManageMenus && deleteTarget && <DeleteModal menu={deleteTarget} onClose={() => setDeleteTarget(null)} onDeleted={msg => { showToast(msg); setDeleteTarget(null); }}/>} 
      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)}/>}
    </GcPage>
  );
}