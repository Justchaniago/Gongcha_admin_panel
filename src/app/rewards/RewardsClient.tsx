"use client";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { font } from "@/lib/design-tokens";
import { GcPage, GcPageHeader, GcPanel, GcEmptyState } from "@/components/ui/gc";
import { useAuth } from "@/context/AuthContext";

// Firebase/Firestore imports
import { ref, uploadBytesResumable, getDownloadURL, listAll } from "firebase/storage";
import { storage } from "@/lib/firebaseClient";
import {
  GcFieldLabel,
  GcToast,
  GcModalShell,
  GcButton,
  GcInput,
  GcTextarea,
} from "@/components/ui/gc";
import { db } from "@/lib/firebaseClient";
import { Reward, rewardConverter } from "@/types/firestore"; // 🔥 IMPORT FROM THE GOD SCHEMA
import { query, collection, orderBy, onSnapshot } from "firebase/firestore";

type SyncStatus = "connecting" | "live" | "error";

import { C as baseC } from "../../lib/design-tokens";
const C = {
  ...baseC,
  blueMid: "#2563EB",
  blueHov: "#2563EB",
  bgSub: "#F3F4F6",
  bluePale: "#DBEAFE",
  border2: "#E5E7EB",
};

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

// ── Global CSS ─────────────────────────────────────────────────────────────────
const globalStyles = `
  @keyframes gcRise    { from { opacity:0; transform:translateY(14px) scale(.98) } to { opacity:1; transform:none } }
  @keyframes gcFadeIn  { from { opacity:0 } to { opacity:1 } }
  @keyframes gcSlideUp { from { opacity:0; transform:translateY(6px) } to { opacity:1; transform:none } }
  @keyframes pulseDot  { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(.82)} }
  @keyframes toastIn   { from{opacity:0;transform:translateY(10px) scale(.96)} to{opacity:1;transform:none} }

  .gc-ticket { transition: box-shadow .18s ease, transform .18s ease, border-color .18s ease !important; }
  .gc-ticket:hover { box-shadow: 0 6px 28px rgba(58,86,232,.09), 0 2px 8px rgba(13,15,23,.05) !important; transform: translateY(-1px) !important; border-color: ${C.blueMid} !important; }
  .gc-btn-primary { transition: all .15s ease !important; }
  .gc-btn-primary:hover { background: ${C.blueHov} !important; box-shadow: 0 4px 20px rgba(58,86,232,.38) !important; transform: translateY(-1px) !important; }
  .gc-btn-ghost:hover { background: ${C.bgSub} !important; }
  .gc-input:focus { border-color: ${C.blue} !important; box-shadow: 0 0 0 3px rgba(58,86,232,.12) !important; background: ${C.white} !important; }
  .gc-search:focus-within { border-color: ${C.blue} !important; box-shadow: 0 0 0 3px rgba(58,86,232,.1) !important; }
  .gc-add-ticket:hover { border-color:${C.blue}!important; background:${C.bluePale}!important; }
  .gc-stat-card { transition: box-shadow .15s; }
  .gc-stat-card:hover { box-shadow: ${C.shadowMd} !important; }
  .gc-modal-close:hover { background: ${C.bgSub} !important; }

  .gc-select {
    appearance: none !important;
    background-image: url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%238C91AC' stroke-width='1.4' stroke-linecap='round'/%3E%3C/svg%3E") !important;
    background-repeat: no-repeat !important;
    background-position: right 12px center !important;
    padding-right: 32px !important;
  }
`;

// ── Primitives ─────────────────────────────────────────────────────────────────
function LiveBadge({ status }: { status: SyncStatus }) {
  const map = { connecting:{color:C.orange,label:'Syncing'}, live:{color:C.green,label:'Live'}, error:{color:C.red,label:'Error'} };
  const { color, label } = map[status];
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:11.5, fontWeight:600, color, fontFamily:font }}>
      <span style={{ width:6, height:6, borderRadius:'50%', background:color, flexShrink:0,
        animation: status==='live' ? 'pulseDot 2s ease-in-out infinite' : 'none',
        boxShadow: status==='live' ? `0 0 0 2px ${color}30` : 'none',
      }}/>
      {label}
    </span>
  );
}

export function FL({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return <GcFieldLabel required={required}>{children}</GcFieldLabel>;
}

function ToolbarSelect({
  value, onChange, children,
}: { value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <div style={{ position:'relative', display:'inline-flex' }}>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="gc-select"
        style={{
          height:36, borderRadius:9, outline:'none',
          border:`1.5px solid ${C.border}`, background:C.white,
          padding:'0 30px 0 12px', fontFamily:font, fontSize:12.5,
          fontWeight:500, color: value === 'all' ? C.tx2 : C.blue,
          cursor:'pointer', transition:'all .15s',
          boxShadow: value !== 'all' ? `0 0 0 2px ${C.blueMid}` : 'none',
          minWidth:130,
        }}
      >
        {children}
      </select>
    </div>
  );
}

function Toast({ msg, type, onDone }: { msg:string; type:'success'|'error'; onDone:()=>void }) {
  useEffect(() => { const t = setTimeout(onDone, 3200); return () => clearTimeout(t); }, [onDone]);
  return (
    <div style={{ position:'fixed', bottom:28, right:28, zIndex:999 }}>
      <GcToast msg={msg} type={type} />
    </div>
  );
}

function StatCard({ label, value, color, bg, icon }: { label:string; value:number; color:string; bg:string; icon:React.ReactNode }) {
  return (
    <div className="gc-stat-card" style={{ background:C.white, borderRadius:16, padding:'16px 20px', border:`1px solid ${C.border}`, display:'flex', alignItems:'center', gap:14 }}>
      <div style={{ width:44, height:44, borderRadius:12, background:bg, color:color, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
        {icon}
      </div>
      <div>
        <p style={{ fontSize:12, fontWeight:600, color:C.tx3, marginBottom:2, fontFamily:font }}>{label}</p>
        <p style={{ fontSize:22, fontWeight:700, color:C.tx1, fontFamily:font, lineHeight:1, letterSpacing:'-.02em' }}>{value.toLocaleString('id')}</p>
      </div>
    </div>
  );
}

// ── Modals ────────────────────────────────────────────────────────────────────
function DeleteModal({ reward, onClose, onDeleted }: { reward:Reward; onClose:()=>void; onDeleted:(msg:string)=>void }) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  async function confirm() {
    setLoading(true); setError('');
    try {
      const r = await fetch(`/api/rewards/${reward.id}`, { method:'DELETE' });
      if (!r.ok) throw new Error((await r.json().catch(()=>({}))).message ?? 'Failed to delete.');
      onDeleted(`"${reward.title}" successfully deleted.`); onClose();
    } catch (e:any) { setError(e.message); setLoading(false); }
  }

  useEffect(() => {
    const h = (e:KeyboardEvent) => { if (e.key==='Escape') onClose(); };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <GcModalShell
      onClose={onClose}
      title="Delete this reward?"
      eyebrow="Destructive Action"
      description={<><strong style={{ color:C.tx1 }}>"{reward.title}"</strong> will be permanently deleted from Firestore.</>}
      maxWidth={420}
      footer={
        <>
          <GcButton variant="ghost" size="lg" onClick={onClose}>Cancel</GcButton>
          <GcButton variant="danger" size="lg" onClick={confirm} loading={loading}>Yes, Delete</GcButton>
        </>
      }
    >
      <code style={{ fontSize:10.5, color:C.tx3, background:C.bg, padding:'4px 9px', borderRadius:6, display:'inline-block', marginBottom:20, fontFamily:font, border:`1px solid ${C.border}` }}>
        {reward.id}
      </code>
      {error && <div style={{ padding:'10px 14px', background:C.redBg, border:`1px solid ${C.red}30`, borderRadius:9, fontSize:12.5, color:C.red, marginBottom:14 }}>{error}</div>}
    </GcModalShell>
  );
}

// 🔥 PERBAIKAN STATE FORM: Standarisasi penamaan menggunakan format dari firestore.ts
type RewardForm = { rewardId:string; title:string; description:string; pointsrequired:string; isActive:boolean; imageUrl:string; };

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14, marginTop:4 }}>
      <p style={{ fontSize:10.5, fontWeight:700, letterSpacing:'.12em', textTransform:'uppercase', color:C.tx3, fontFamily:font, margin:0, whiteSpace:'nowrap' }}>{children}</p>
      <div style={{ flex:1, height:1, background:C.border2 }}/>
    </div>
  );
}

function RewardModal({ reward, onClose, onSaved }: { reward:Reward|null; onClose:()=>void; onSaved:(msg:string)=>void }) {
  const isNew = !reward;
  const [form, setForm] = useState<RewardForm>({
    rewardId:       reward?.id ?? '',
    title:          reward?.title ?? '',
    description:    reward?.description ?? '',
    pointsrequired: reward ? String(reward.pointsrequired) : '', // 🔥 DARI SKEMA
    isActive:       reward?.isActive ?? true,
    imageUrl:       reward ? reward.imageUrl : '',               // 🔥 DARI SKEMA
  });
  
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [idTouched, setIdTouched] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [processingImage, setProcessingImage] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryError, setLibraryError] = useState('');
  const [libraryImages, setLibraryImages] = useState<Array<{ path: string; name: string; url: string }>>([]);

  useEffect(() => {
    if (!isNew || idTouched) return;
    const slug = form.title.toLowerCase().replace(/[^a-z0-9\s]/g,'').trim().split(/\s+/).filter(Boolean).map(w=>w.slice(0,4)).join('_').slice(0,20);
    setForm(p => ({ ...p, rewardId: slug ? 'rw_'+slug : '' }));
  }, [form.title, isNew, idTouched]);

  useEffect(() => {
    const h = (e:KeyboardEvent) => { if (e.key==='Escape') onClose(); };
    window.addEventListener('keydown',h); return () => window.removeEventListener('keydown',h);
  }, [onClose]);

  const set = (k:keyof RewardForm) => (e:React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>) =>
    setForm(p => ({ ...p, [k]:e.target.value }));

  const handleImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) { setError("Ukuran gambar asli maksimal 15MB."); return; }
    setError(''); setProcessingImage(true);

    try {
      const compressedBlob = await compressImageToWebP(file, 800, 800, 0.8);
      const fileName = `rewards/${Date.now()}_${Math.random().toString(36).substring(2, 8)}.webp`;
      const storageRef = ref(storage, fileName);
      const uploadTask = uploadBytesResumable(storageRef, compressedBlob);
      
      setUploadProgress(0); setProcessingImage(false);

      uploadTask.on("state_changed",
        (snapshot) => { setUploadProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100); },
        (err) => { setError("Failed to upload image: " + err.message); setUploadProgress(null); },
        async () => {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          setForm(p => ({ ...p, imageUrl: url })); // 🔥 Standard
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
    setLibraryError(''); setLibraryLoading(true);
    try {
      const rootRef = ref(storage, 'rewards');
      const listing = await listAll(rootRef);
      const ordered = [...listing.items].reverse().slice(0, 48);
      const resolved = await Promise.all(
        ordered.map(async (itemRef) => ({ path: itemRef.fullPath, name: itemRef.name, url: await getDownloadURL(itemRef) }))
      );
      setLibraryImages(resolved);
      if (resolved.length === 0) setLibraryError('No images found in /rewards folder.');
    } catch (err: any) {
      setLibraryError(err?.code === 'storage/unauthorized' ? 'Storage access denied.' : (err?.message ?? 'Failed to load storage gallery.'));
    } finally {
      setLibraryLoading(false);
    }
  }, [libraryLoading]);

  const toggleStorageLibrary = useCallback(async () => {
    const next = !showLibrary;
    setShowLibrary(next);
    if (next && libraryImages.length === 0) await loadStorageLibrary();
  }, [showLibrary, libraryImages.length, loadStorageLibrary]);

  async function handleSave() {
    if (!form.title.trim())             { setError('Reward name is required.'); return; }
    if (isNew && !form.rewardId.trim()) { setError('Reward ID is required.'); return; }
    const cost = Number(form.pointsrequired);
    if (form.pointsrequired !== '' && (isNaN(cost)||cost<0)) { setError('Points required must be a positive number.'); return; }
    if (uploadProgress !== null || processingImage) { setError('Wait for image processing to complete.'); return; }
    
    setLoading(true); setError('');
    try {
      const method = isNew ? 'POST' : 'PATCH';
      const url    = isNew ? '/api/rewards' : `/api/rewards/${reward!.id}`;
      // 🔥 Payload tersinkronisasi 100% dengan firestore.ts
      const payload = { 
        ...(isNew ? { rewardId: form.rewardId.trim() } : {}), 
        title: form.title.trim(), 
        description: form.description.trim(), 
        pointsrequired: form.pointsrequired !== '' ? Number(form.pointsrequired) : 0,
        isActive: form.isActive, 
        imageUrl: form.imageUrl.trim() 
      };
      
      const r = await fetch(url, { method, headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
      if (!r.ok) throw new Error((await r.json().catch(()=>({}))).message ?? 'Failed to save.');
      onSaved(isNew ? `Reward "${form.title}" successfully added!` : `"${form.title}" successfully updated.`);
      onClose();
    } catch (e:any) { setError(e.message); setLoading(false); }
  }

  return (
    <GcModalShell
      onClose={onClose}
      title={isNew ? 'Add Voucher' : reward!.title}
      eyebrow={isNew ? 'New Reward' : 'Edit Reward'}
      description={!isNew ? <code style={{ fontSize:10.5, color:C.tx3, background:C.bg, padding:'2px 8px', borderRadius:5, fontFamily:font, border:`1px solid ${C.border}`, display:'inline-block' }}>{reward!.id}</code> : undefined}
      maxWidth={540}
      footer={
        <>
          <p style={{ fontSize:11.5, color:C.tx4, marginRight:'auto' }}><span style={{ color:C.red }}>*</span> required</p>
          <GcButton variant="ghost" size="lg" onClick={onClose}>Batal</GcButton>
          <GcButton variant="blue" size="lg" onClick={handleSave} disabled={uploadProgress !== null || processingImage} loading={loading}>
            {isNew ? '+ Add Reward' : 'Save Changes'}
          </GcButton>
        </>
      }
    >
      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          {isNew && (
            <div>
              <SectionLabel>Document ID</SectionLabel>
              <FL required>Reward ID</FL>
              <GcInput placeholder="rw_free_drink" value={form.rewardId}
                onChange={e => { setIdTouched(true); setForm(p=>({...p,rewardId:e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g,'')})); }}/>
              <p style={{ fontSize:11.5, color:C.tx3, marginTop:5 }}>Cannot be changed after saving.</p>
            </div>
          )}
          <div>
            <SectionLabel>Reward Information</SectionLabel>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div><FL required>Voucher Name</FL><GcInput placeholder="Free Drink Any Size" value={form.title} onChange={set('title')}/></div>
              <div><FL>Description</FL><GcTextarea placeholder="Redeem your points for free drinks..." value={form.description} onChange={set('description')}/></div>
            </div>
          </div>
          <div>
            <SectionLabel>Points Cost</SectionLabel>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div>
                <FL required>Points Required</FL>
                {/* 🔥 Menggunakan pointsrequired */}
                <GcInput type="number" min="0" step="1" placeholder="500" value={form.pointsrequired} onChange={set('pointsrequired')}/>
                <p style={{ fontSize:11.5, color:C.tx3, marginTop:5 }}>0 = free</p>
              </div>
            </div>
          </div>

          <div>
            <SectionLabel>Media (Optional)</SectionLabel>
            <FL>Upload Voucher Image (WebP)</FL>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              {form.imageUrl && (
                <img
                  src={form.imageUrl}
                  alt={form.title}
                  style={{ width: '100%', height: '100%', objectFit: 'contain', maxWidth: 44, maxHeight: 44, borderRadius: 8, border: `1px solid ${C.border}` }}
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
                      {form.imageUrl ? "Change Voucher Image" : "Select Image File"}
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
                  Firebase Storage /rewards ({libraryImages.length})
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
                        <button
                          key={img.path} type="button" title={img.name}
                          onClick={() => setForm(p => ({ ...p, imageUrl: img.url }))}
                          style={{ border: selected ? `2px solid ${C.blue}` : `1px solid ${C.border}`, borderRadius: 9, background: selected ? C.blueL : C.bg, cursor: 'pointer', padding: 4, display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'stretch' }}
                        >
                          <img src={img.url} alt={img.name} style={{ width: '100%', height: 56, objectFit: 'cover', borderRadius: 6, background: C.white }} />
                          <span style={{ fontSize: 10, color: C.tx3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'left' }}>{img.name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
            <p style={{ fontSize:11.5, color:C.tx4, marginTop:5 }}>If empty, the application will use the default image.</p>
          </div>
          
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'13px 16px', borderRadius:12, background:C.bg, border:`1.5px solid ${C.border}` }}>
            <div>
              <p style={{ fontSize:13.5, fontWeight:600, color:C.tx1, marginBottom:2 }}>Active Status</p>
              <p style={{ fontSize:12, color:C.tx3 }}>{form.isActive ? 'Can be redeemed by members' : 'Hidden from members'}</p>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <button type="button" onClick={() => setForm(p=>({...p,isActive:!p.isActive}))} style={{ width:44, height:25, borderRadius:99, border:'none', cursor:'pointer', background:form.isActive?C.blue:C.bgSub, position:'relative', transition:'background .2s', flexShrink:0, boxShadow:form.isActive?'0 2px 8px rgba(58,86,232,.30)':'none' }}>
                <span style={{ position:'absolute', top:3.5, borderRadius:'50%', width:18, height:18, background:'#fff', boxShadow:'0 1px 4px rgba(0,0,0,.18)', left:form.isActive?23:3, transition:'left .2s cubic-bezier(.34,1.56,.64,1)', display:'block' }}/>
              </button>
            </div>
          </div>
          {error && <div style={{ padding:'11px 14px', background:C.redBg, border:`1px solid ${C.red}30`, borderRadius:9, fontSize:12.5, color:C.red }}>{error}</div>}
      </div>
    </GcModalShell>
  );
}

// ── TICKET CARD (Dibesihkan dari Action Button & Status Pill) ──────────────────
function RewardCard({ reward, onEdit }: { reward:Reward; onEdit:()=>void }) {
  // Menggunakan warna default karena category sudah dihapus dari skema
  const cat = undefined; // or a default color/value if needed
  const notch = 14;

  return (
    <div 
      className="gc-ticket" 
      onClick={onEdit}
      style={{
      background: C.white,
      borderRadius: 16,
      border: `1px solid ${C.border}`,
      boxShadow: C.shadow,
      display: 'flex',
      overflow: 'visible',
      position: 'relative',
      cursor: 'pointer',
    }}>

      {/* ── LEFT STUB ── */}
      <div style={{
        width: 110,
        flexShrink: 0,
        background: cat.bg,
        borderRadius: '15px 0 0 15px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '14px 10px',
        position: 'relative',
        gap: 6,
      }}>
        <div style={{ textAlign: 'center' }}>
          {/* 🔥 Menggunakan pointsrequired langsung dari skema */}
          {reward.pointsrequired === 0 ? (
            <p style={{ fontSize: 16, fontWeight: 800, color: C.green, letterSpacing: '-.02em', lineHeight: 1, fontFamily: font, margin: 0 }}>FREE</p>
          ) : (
            <>
              <p style={{
                fontSize: reward.pointsrequired >= 10000 ? 14 : reward.pointsrequired >= 1000 ? 17 : 20,
                fontWeight: 800, color: cat.color, letterSpacing: '-.03em', lineHeight: 1,
                fontFamily: font, margin: 0,
              }}>
                {reward.pointsrequired.toLocaleString('id')}
              </p>
              <p style={{ fontSize: 9, fontWeight: 700, color: cat.color, opacity:.6, letterSpacing:'.07em', textTransform:'uppercase', fontFamily:font, margin: '3px 0 0' }}>pts</p>
            </>
          )}
        </div>
        <div style={{
          position: 'absolute', right: -notch/2, top: '50%',
          transform: 'translateY(-50%)',
          width: notch, height: notch*2,
          background: C.bg,
          borderRadius: `0 ${notch}px ${notch}px 0`,
          border: `1px solid ${C.border}`,
          borderLeft: 'none',
          zIndex: 2,
        }}/>
      </div>

      {/* ── SEPARATOR ── */}
      <div style={{
        position: 'absolute', left: 110, top: 10, bottom: 10, width: 0, borderLeft: `1.5px dashed ${C.border}`, zIndex: 1,
      }}/>

      {/* ── RIGHT BODY ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '14px 16px 12px 20px', minWidth: 0 }}>
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:8, marginBottom:5 }}>
          <p style={{ fontSize:13.5, fontWeight:700, color:C.tx1, lineHeight:1.3, letterSpacing:'-.015em', fontFamily:font, margin:0, flex:1, minWidth:0 }}>
            {reward.title}
          </p>
        </div>
        <p style={{ fontSize:12, color:C.tx3, lineHeight:1.55, fontFamily:font, margin:0, marginBottom:10, flex:1, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' as any }}>
          {reward.description || <span style={{ fontStyle:'italic', color:C.tx4 }}>No description.</span>}
        </p>

        {/* 🔥 Menggunakan imageUrl langsung dari skema */}
        <div style={{ display:'flex', alignItems:'center', gap:7, flexWrap:'wrap' }}>
          {reward.imageUrl && (
            <div style={{ width:22, height:22, borderRadius:4, overflow:'hidden', border:`1px solid ${C.border2}`, flexShrink:0 }}>
              <img src={reward.imageUrl} alt={reward.title} style={{ width:'100%', height:'100%', objectFit:'contain' }}/>
            </div>
          )}
          <code style={{ fontSize:9.5, color:C.tx4, background:C.bg, padding:'2px 7px', borderRadius:5, fontFamily:font, border:`1px solid ${C.border2}`, flexShrink:0 }}>
            {reward.id}
          </code>
          <div style={{ flex:1 }}/>
        </div>
      </div>
    </div>
  );
}

// ── Add Ticket ─────────────────────────────────────────────────────────────────
function AddTicket({ onClick }: { onClick: () => void }) {
  return (
    <div onClick={onClick} className="gc-add-ticket" style={{
      border:`1.5px dashed ${C.border}`, borderRadius:16, background:'transparent',
      display:'flex', alignItems:'center', justifyContent:'center',
      height:88, cursor:'pointer', transition:'all .18s', gap:12,
    }}>
      <div style={{ width:30, height:30, borderRadius:9, background:C.bgSub, display:'flex', alignItems:'center', justifyContent:'center', color:C.tx3, transition:'all .18s', flexShrink:0 }}>
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </div>
      <div>
        <p style={{ fontSize:12.5, fontWeight:600, color:C.tx3, margin:0, fontFamily:font }}>Add New Voucher</p>
        <p style={{ fontSize:11, color:C.tx4, margin:'2px 0 0', fontFamily:font }}>Click to add reward</p>
      </div>
    </div>
  );
}

// ── Showcase Card (staff view, no actions) ────────────────────────────────────
function ShowcaseRewardCard({ reward }: { reward: Reward }) {
  const cat = CAT_CFG.Drink; // Default fallback as category is removed
  const pts = reward.pointsrequired;
  const img = reward.imageUrl;
  const [h, setH] = useState(false);
  return (
    <div
      onMouseOver={() => setH(true)}
      onMouseOut={() => setH(false)}
      style={{
        background: C.white,
        borderRadius: 16,
        border: `1px solid ${h ? cat.color + '44' : C.border}`,
        boxShadow: h ? `0 8px 28px rgba(13,15,23,.10), 0 2px 6px rgba(13,15,23,.04)` : C.shadow,
        overflow: 'hidden',
        transition: 'all .18s ease',
        transform: h ? 'translateY(-3px)' : 'none',
        display: 'flex',
        flexDirection: 'column',
        cursor: 'default',
        height: '100%',
      }}
    >
      {/* Image / color banner */}
      <div style={{ height: 160, background: img ? 'linear-gradient(135deg, #F4F6FB 0%, #E8EBF4 100%)' : cat.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', flexShrink: 0, overflow: 'hidden' }}>
        {img ? (
          <img src={img} alt={reward.title} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 14 }} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, opacity: .7 }}>
            <svg width="38" height="38" fill="none" viewBox="0 0 24 24" stroke={cat.color} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/>
              <path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z"/>
            </svg>
            <div style={{ textAlign: 'center' }}>
              {pts === 0 ? (
                <p style={{ fontSize: 18, fontWeight: 800, color: C.green, letterSpacing: '-.02em', lineHeight: 1, fontFamily: font, margin: 0 }}>FREE</p>
              ) : (
                <>
                  <p style={{ fontSize: pts >= 10000 ? 18 : 22, fontWeight: 800, color: cat.color, letterSpacing: '-.03em', lineHeight: 1, fontFamily: font, margin: 0 }}>{pts.toLocaleString('id')}</p>
                  <p style={{ fontSize: 10, fontWeight: 700, color: cat.color, opacity: .65, letterSpacing: '.09em', textTransform: 'uppercase', fontFamily: font, margin: '4px 0 0' }}>pts</p>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: '14px 16px 16px', flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <p style={{ fontSize: 14.5, fontWeight: 800, color: C.tx1, margin: 0, lineHeight: 1.3, fontFamily: font }}>{reward.title}</p>
        {reward.description && (
          <p style={{ fontSize: 12, color: C.tx3, margin: 0, lineHeight: 1.55, fontFamily: font, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>{reward.description}</p>
        )}
        <div style={{ marginTop: 'auto', paddingTop: 10, borderTop: `1px solid ${C.border2}`, display: 'flex', alignItems: 'baseline', gap: 6 }}>
          {pts === 0 ? (
            <p style={{ fontSize: 16, fontWeight: 800, color: C.green, margin: 0, fontFamily: font }}>Gratis</p>
          ) : (
            <>
              <p style={{ fontSize: 16, fontWeight: 800, color: cat.color, margin: 0, fontFamily: font }}>{pts.toLocaleString('id')}</p>
              <span style={{ fontSize: 11, color: C.tx3, fontWeight: 600, fontFamily: font }}>poin</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function RewardsClient({ initialRewards = [], showAddTrigger }:
  { initialRewards?: Reward[]; showAddTrigger?: boolean }) {
  const { user } = useAuth();
  const canMutate = user?.role === "SUPER_ADMIN";
  const [rewards,      setRewards]      = useState<Reward[]>(initialRewards); // 🔥 The God Schema
  const [syncStatus,   setSyncStatus]   = useState<SyncStatus>('connecting');
  const [search,       setSearch]       = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [editTarget,   setEditTarget]   = useState<Reward | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Reward | null>(null);
  const [showAdd,      setShowAdd]      = useState(false);
  const [toast,        setToast]        = useState<{ msg:string; type:'success'|'error' } | null>(null);

  const showToast = useCallback((msg:string, type:'success'|'error'='success') => setToast({msg,type}), []);

  const fetchRewardsFromApi = useCallback(async () => {
    try {
      const res = await fetch('/api/rewards', { cache: 'no-store' });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message ?? 'Failed to load rewards.');
      const payload = await res.json();
      const rows = Array.isArray(payload?.rewards) ? payload.rewards : [];
      setRewards(rows as Reward[]);
      setSyncStatus('live');
    } catch (apiErr) {
      console.error('[RewardsClient] API fallback failed:', apiErr);
      setSyncStatus('error');
    }
  }, []);

  useEffect(() => {
    const q = query(collection(db,'rewards').withConverter(rewardConverter), orderBy('title'));
    const unsub = onSnapshot(
      q,
      snap => {
        setRewards(snap.docs.map(d => d.data() as Reward));
        setSyncStatus('live');
      },
      async (err: any) => {
        if (err?.code === 'permission-denied') {
          console.warn('[RewardsClient] Firestore permission denied, falling back to /api/rewards');
          await fetchRewardsFromApi();
          return;
        }

        console.error(err);
        setSyncStatus('error');
      }
    );
    return () => unsub();
  }, [fetchRewardsFromApi]);


  const filtered = useMemo(() => rewards.filter(r => {
    const q = search.toLowerCase();
    const ms = !q || r.title?.toLowerCase().includes(q) || r.id?.toLowerCase().includes(q) || r.description?.toLowerCase().includes(q);
    const mf = filterStatus==='all' || (filterStatus==='active'?r.isActive:!r.isActive);
    return ms && mf; // Kategori filter dihapus
  }), [rewards, search, filterStatus]);

  const total     = rewards.length;
  const activeAmt = rewards.filter(r=>r.isActive).length;
  const inactive  = rewards.filter(r=>!r.isActive).length;

  if (showAddTrigger) {
    return (
      <>
        <style>{globalStyles}</style>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <LiveBadge status={syncStatus}/>
          <GcButton variant="blue" size="lg" disabled={!canMutate} onClick={() => canMutate && setShowAdd(true)}>
            Add Voucher
          </GcButton>
        </div>
        {showAdd && <RewardModal reward={null} onClose={()=>setShowAdd(false)} onSaved={msg=>{showToast(msg);setShowAdd(false);}}/>}
        {toast && <Toast msg={toast.msg} type={toast.type} onDone={()=>setToast(null)}/>}
      </>
    );
  }

  if (!canMutate) {
    return (
      <GcPage>
        <style>{globalStyles}</style>
        <GcPageHeader
          eyebrow="Voucher Studio"
          title="Rewards & Voucher Catalog"
          description="Katalog reward dan voucher yang tersedia untuk ditukarkan oleh member."
          actions={<LiveBadge status={syncStatus}/>}
        />
        <div className="gc-grid-4" style={{ gap:12, marginBottom:22 }}>
          <StatCard label="Total Reward" value={total} color={C.blue} bg={C.blueL}
            icon={<svg width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z"/></svg>}
          />
          <StatCard label="Aktif" value={activeAmt} color={C.green} bg={C.greenBg}
            icon={<svg width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>}
          />
          <StatCard label="Nonaktif" value={inactive} color={C.red} bg={C.redBg}
            icon={<svg width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>}
          />
        </div>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18, gap:10, flexWrap:'wrap' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
            <div className="gc-search" style={{ display:'flex', alignItems:'center', gap:8, height:36, padding:'0 12px', background:C.white, border:`1.5px solid ${C.border}`, borderRadius:9, transition:'all .15s', minWidth:200 }}>
              <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke={C.tx3} strokeWidth={2} strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
              <input type="text" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari reward..." style={{ border:'none', outline:'none', background:'transparent', fontSize:13, color:C.tx1, width:150, fontFamily:font }}/>
              {search && (
                <button onClick={()=>setSearch('')} style={{ background:'none', border:'none', cursor:'pointer', color:C.tx3, padding:0, lineHeight:1, display:'flex' }}>
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>
                </button>
              )}
            </div>
            <ToolbarSelect value={filterStatus} onChange={setFilterStatus}>
              <option value="all">Semua Status</option>
              <option value="active">Aktif</option>
              <option value="inactive">Nonaktif</option>
            </ToolbarSelect>
          </div>
          <span style={{ fontSize:12, color:C.tx3, fontFamily:font, fontWeight:500 }}>
            {filtered.length}{filtered.length!==rewards.length?` / ${rewards.length}`:''} reward
          </span>
        </div>
        {filtered.length === 0 ? (
          <GcPanel style={{ padding:'50px 24px', textAlign:'center' }}>
            <GcEmptyState title="Tidak ada reward" description={syncStatus==='connecting'?'Memuat data…':'Tidak ada reward yang sesuai filter.'} icon={syncStatus==='connecting'?'⏳':'📭'} />
          </GcPanel>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(210px, 1fr))', gap:16 }}>
            {filtered.map((reward, i) => (
              <div key={reward.id} style={{ animation:`gcSlideUp .24s ease both`, animationDelay:`${i*25}ms` }}>
                <ShowcaseRewardCard reward={reward} />
              </div>
            ))}
          </div>
        )}
        {toast && <Toast msg={toast.msg} type={toast.type} onDone={()=>setToast(null)}/>}
      </GcPage>
    );
  }

  return (
    <GcPage>
      <style>{globalStyles}</style>

      <GcPageHeader
        eyebrow="Voucher Studio"
        title="Rewards & Voucher Catalog"
        description="Manage the rewards catalog, active states, and voucher publishing with Gong Cha's consistent visual language."
        actions={
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <LiveBadge status={syncStatus}/>
            {canMutate && (
              <GcButton variant="blue" size="lg" onClick={() => setShowAdd(true)}>
                Add Voucher
              </GcButton>
            )}
          </div>
        }
      />

      {/* Stats */}
      <div className="gc-grid-4" style={{ gap:12, marginBottom:22 }}>
        <StatCard label="Total Reward" value={total} color={C.blue} bg={C.blueL}
          icon={<svg width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z"/></svg>}
        />
        <StatCard label="Aktif" value={activeAmt} color={C.green} bg={C.greenBg}
          icon={<svg width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>}
        />
        <StatCard label="Nonaktif" value={inactive} color={C.red} bg={C.redBg}
          icon={<svg width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>}
        />
      </div>

      {/* Toolbar */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18, gap:10, flexWrap:'wrap' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>

          {/* Search */}
          <div className="gc-search" style={{ display:'flex', alignItems:'center', gap:8, height:36, padding:'0 12px', background:C.white, border:`1.5px solid ${C.border}`, borderRadius:9, transition:'all .15s', minWidth:200 }}>
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke={C.tx3} strokeWidth={2} strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
            <input type="text" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search reward..." style={{ border:'none', outline:'none', background:'transparent', fontSize:13, color:C.tx1, width:150, fontFamily:font }}/>
            {search && (
              <button onClick={()=>setSearch('')} style={{ background:'none', border:'none', cursor:'pointer', color:C.tx3, padding:0, lineHeight:1, display:'flex' }}>
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>
              </button>
            )}
          </div>

          {/* Status dropdown */}
          <ToolbarSelect value={filterStatus} onChange={setFilterStatus}>
            <option value="all">Semua Status</option>
            <option value="active">Aktif</option>
            <option value="inactive">Nonaktif</option>
          </ToolbarSelect>
        </div>

        {/* Right */}
        <div style={{ display:'flex', alignItems:'center', gap:14, flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ fontSize:12, color:C.tx3, fontFamily:font, fontWeight: 500 }}>
              {filtered.length}{filtered.length!==rewards.length?` / ${rewards.length}`:''} reward
            </span>
          </div>
        </div>
      </div>

      {/* Ticket list */}
      {rewards.length===0 && syncStatus!=='connecting' ? (
        <GcPanel style={{ padding:'70px 24px', textAlign:'center' }}>
          <GcEmptyState title="No rewards yet" description="Start adding your first voucher." />
          <div style={{ marginTop: 22 }}>
            <GcButton variant="blue" size="lg" disabled={!canMutate} onClick={()=>canMutate && setShowAdd(true)}>
            + Add First Voucher
            </GcButton>
          </div>
        </GcPanel>
      ) : filtered.length===0 ? (
        <GcPanel style={{ padding:'50px 24px', textAlign:'center' }}>
          <GcEmptyState
            title="No results"
            description={syncStatus==='connecting' ? 'Loading data…' : 'No rewards match this filter.'}
            icon={syncStatus==='connecting' ? '⏳' : '📭'}
          />
        </GcPanel>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {filtered.map((reward, i) => (
            <div key={reward.id} style={{ animation:`gcSlideUp .24s ease both`, animationDelay:`${i*30}ms` }}>
              <RewardCard 
                reward={reward} 
                onEdit={() => canMutate && setEditTarget(reward)} // 🔥 Klik di mana saja di Card akan membuka Modal Edit (jika admin)
              />
            </div>
          ))}
          <div style={{ animation:`gcSlideUp .24s ease both`, animationDelay:`${filtered.length*30}ms` }}>
            {canMutate && <AddTicket onClick={()=>setShowAdd(true)}/>} 
          </div>
        </div>
      )}

      {/* Modals */}
      {canMutate && editTarget   && <RewardModal reward={editTarget} onClose={()=>setEditTarget(null)} onSaved={msg=>{showToast(msg);setEditTarget(null);}}/>}
      {canMutate && showAdd      && <RewardModal reward={null} onClose={()=>setShowAdd(false)} onSaved={msg=>{showToast(msg);setShowAdd(false);}}/>}
      {canMutate && deleteTarget && <DeleteModal reward={deleteTarget} onClose={()=>setDeleteTarget(null)} onDeleted={msg=>{showToast(msg);setDeleteTarget(null);}}/>}
      {toast        && <Toast msg={toast.msg} type={toast.type} onDone={()=>setToast(null)}/>}
    </GcPage>
  );
}