"use client";
// src/app/rewards/RewardsClient.tsx — TICKET REDESIGN (FIXED COLLECTION & IMAGE UPLOAD)

import React, { useState, useMemo, useEffect, useCallback } from "react";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebaseClient";
import { useAuth } from "@/context/AuthContext";
import { Reward, rewardConverter } from "@/types/firestore";

// ── TYPES & CONSTANTS ─────────────────────────────────────────────────────────
type RewardWithId = Reward; // Reward interface dari firestore.ts sudah punya 'id'
type SyncStatus = 'connecting' | 'live' | 'error';
type Category = 'Drink' | 'Topping' | 'Discount';

const font = "'Inter', system-ui, sans-serif";
const fontMono = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";

const C = {
  blue: '#2563EB', blueL: '#EFF6FF', blueMid: '#BFDBFE',
  red: '#DC2626', redBg: '#FEF2F2',
  green: '#059669', greenBg: '#F0FDF4',
  orange: '#D97706', orangeBg: '#FFFBEB',
  white: '#FFFFFF', bg: '#F9FAFB', bgSub: '#F3F4F6',
  tx1: '#111827', tx2: '#4B5563', tx3: '#6B7280', tx4: '#9CA3AF',
  border: '#E5E7EB', border2: '#F3F4F6',
  shadow: '0 1px 3px rgba(0,0,0,.05), 0 1px 2px rgba(0,0,0,.04)',
  shadowLg: '0 20px 60px rgba(0,0,0,.12), 0 4px 16px rgba(0,0,0,.08)',
};

const CAT_CFG: Record<Category, { bg: string; color: string; label: string }> = {
  Drink:    { bg: '#EFF6FF', color: '#2563EB', label: 'Drink' },
  Topping:  { bg: '#FFFBEB', color: '#D97706', label: 'Topping' },
  Discount: { bg: '#F0FDF4', color: '#059669', label: 'Discount' },
};

const globalStyles = `
  @keyframes gcFadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes gcRise { from { opacity: 0; transform: translateY(16px) scale(.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
  @keyframes gcSlideUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes toastIn { 0% { opacity: 0; transform: translateY(16px) scale(.95); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
  .gc-input:focus { border-color: ${C.blue} !important; box-shadow: 0 0 0 3px ${C.blueMid} !important; }
  .gc-select { appearance: none; background-image: url("data:image/svg+xml,%3Csvg width='10' height='10' viewBox='0 0 12 12' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M2.5 4.5L6 8L9.5 4.5' stroke='%236B7280' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 14px center; }
  .gc-search:focus-within { border-color: ${C.blue} !important; box-shadow: 0 0 0 3px ${C.blueMid} !important; }
  .gc-ticket:hover { transform: translateY(-2px); box-shadow: 0 10px 25px rgba(0,0,0,.08); border-color: ${C.blueMid}; }
  .gc-ticket { transition: all .2s cubic-bezier(.34,1.56,.64,1); }
  .gc-action-edit:hover { background: ${C.bgSub} !important; border-color: #D1D5DB !important; color: ${C.tx1} !important; }
  .gc-action-delete:hover { background: ${C.redBg} !important; border-color: ${C.red}40 !important; color: ${C.red} !important; }
  .gc-add-ticket:hover { border-color: ${C.blue} !important; background: ${C.blueL} !important; }
  .gc-add-ticket:hover div { background: ${C.blue} !important; color: #fff !important; }
`;

// ── UTILITIES ─────────────────────────────────────────────────────────────────
function compressImageToWebP(file: File, maxWidth: number, maxHeight: number, quality: number = 0.8): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;
        if (width > height && width > maxWidth) { height *= maxWidth / width; width = maxWidth; }
        else if (height > maxHeight) { width *= maxHeight / height; height = maxHeight; }
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => { if (blob) resolve(blob); else reject(new Error("Compression failed")); }, "image/webp", quality);
      };
    };
    reader.onerror = error => reject(error);
  });
}

function getPointsCost(reward: RewardWithId): number {
  return Number(reward.pointsRequired ?? reward.pointsCost ?? 0);
}

function getImageUrl(reward: RewardWithId): string {
  return String(reward.imageUrl ?? reward.imageURL ?? "");
}

// ── REUSABLE UI COMPONENTS ────────────────────────────────────────────────────
function LiveBadge({ status }: { status: SyncStatus }) {
  const map = {
    connecting: { bg: C.orangeBg, color: C.orange, label: 'Connecting…', pulse: true },
    live:       { bg: C.greenBg,  color: C.green,  label: 'Live Sync',    pulse: false },
    error:      { bg: C.redBg,    color: C.red,    label: 'Disconnected', pulse: false },
  };
  const cfg = map[status];
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:6, background:cfg.bg, color:cfg.color, padding:'4px 10px', borderRadius:99, fontSize:11, fontWeight:700, fontFamily:font, letterSpacing:'.03em' }}>
      <span style={{ width:6, height:6, borderRadius:'50%', background:'currentColor', opacity:cfg.pulse?0.6:1, animation:cfg.pulse?'gcFadeIn .8s alternate infinite':undefined }}/>
      {cfg.label}
    </span>
  );
}

function CategoryChip({ category }: { category: Category }) {
  const cfg = CAT_CFG[category] ?? CAT_CFG.Drink;
  return (
    <span style={{ background:cfg.bg, color:cfg.color, padding:'2.5px 8px', borderRadius:6, fontSize:10.5, fontWeight:700, fontFamily:font, letterSpacing:'.05em' }}>
      {cfg.label}
    </span>
  );
}

function StatusPill({ active }: { active: boolean }) {
  const cfg = active ? { bg: C.greenBg, color: C.green, label: 'ACTIVE' } : { bg: C.bgSub, color: C.tx3, label: 'INACTIVE' };
  return (
    <span style={{ background:cfg.bg, color:cfg.color, padding:'3px 8px', borderRadius:6, fontSize:10, fontWeight:800, fontFamily:font, letterSpacing:'.08em' }}>
      {cfg.label}
    </span>
  );
}

export function FL({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label style={{ display:'block', marginBottom:7, fontSize:11, fontWeight:700, letterSpacing:'.07em', textTransform:'uppercase', color:C.tx3, fontFamily:font }}>
      {children}{required && <span style={{ color:C.red, marginLeft:3 }}>*</span>}
    </label>
  );
}

export function GcInput({ style, ...p }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input className="gc-input" {...p} style={{ width:'100%', height:42, borderRadius:10, outline:'none', border:`1.5px solid ${C.border}`, background:C.bg, padding:'0 14px', fontFamily:font, fontSize:13.5, color:C.tx1, transition:'all .15s', boxSizing:'border-box', ...style }}/>
  );
}

function GcTextarea({ style, ...p }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea className="gc-input" {...p} rows={3} style={{ width:'100%', borderRadius:10, outline:'none', resize:'vertical', border:`1.5px solid ${C.border}`, background:C.bg, padding:'11px 14px', fontFamily:font, fontSize:13.5, color:C.tx1, lineHeight:1.55, transition:'all .15s', boxSizing:'border-box', ...style }}/>
  );
}

export function GcSelect({ style, ...p }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className="gc-input gc-select" {...p} style={{ width:'100%', height:42, borderRadius:10, outline:'none', border:`1.5px solid ${C.border}`, background:C.bg, padding:'0 14px', fontFamily:font, fontSize:13.5, color:C.tx1, transition:'all .15s', cursor:'pointer', ...style }}/>
  );
}

function ToolbarSelect({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <div style={{ position:'relative', display:'inline-flex' }}>
      <select value={value} onChange={e => onChange(e.target.value)} className="gc-select" style={{ height:36, borderRadius:9, outline:'none', border:`1.5px solid ${C.border}`, background:C.white, padding:'0 30px 0 12px', fontFamily:font, fontSize:12.5, fontWeight:500, color: value === 'all' ? C.tx2 : C.blue, cursor:'pointer', transition:'all .15s', boxShadow: value !== 'all' ? `0 0 0 2px ${C.blueMid}` : 'none', minWidth:130 }}>
        {children}
      </select>
    </div>
  );
}

function Toast({ msg, type, onDone }: { msg:string; type:'success'|'error'; onDone:()=>void }) {
  useEffect(() => { const t = setTimeout(onDone, 3200); return () => clearTimeout(t); }, [onDone]);
  return (
    <div style={{ position:'fixed', bottom:28, right:28, zIndex:999, padding:'13px 20px', borderRadius:14, fontFamily:font, fontSize:13.5, fontWeight:600, color:'#fff', background: type==='success' ? 'linear-gradient(135deg,#0BA853,#09934A)' : 'linear-gradient(135deg,#D11B3B,#B81532)', boxShadow: type==='success' ? '0 8px 32px rgba(11,168,83,.30)' : '0 8px 32px rgba(209,27,59,.30)', display:'flex', alignItems:'center', gap:10, animation:'toastIn .25s ease' }}>
      <span style={{ width:20, height:20, borderRadius:'50%', background:'rgba(255,255,255,.2)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:11 }}>
        {type==='success' ? '✓' : '✕'}
      </span>
      {msg}
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
function DeleteModal({ reward, onClose, onDeleted }: { reward:RewardWithId; onClose:()=>void; onDeleted:(msg:string)=>void }) {
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

  useEffect(() => { const h = (e:KeyboardEvent) => { if (e.key==='Escape') onClose(); }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, [onClose]);

  return (
    <div onClick={e => { if (e.target===e.currentTarget) onClose(); }} style={{ position:'fixed', inset:0, zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', padding:24, background:'rgba(7,9,18,.55)', backdropFilter:'blur(12px)', fontFamily:font, animation:'gcFadeIn .15s ease' }}>
      <div style={{ background:C.white, borderRadius:22, width:'100%', maxWidth:400, boxShadow:C.shadowLg, padding:'28px 28px', animation:'gcRise .22s ease', border:`1px solid ${C.border}` }}>
        <div style={{ width:46, height:46, borderRadius:13, background:C.redBg, border:`1px solid ${C.red}20`, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:18 }}>
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke={C.red} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        </div>
        <h2 style={{ fontSize:18, fontWeight:700, color:C.tx1, marginBottom:8, letterSpacing:'-.02em' }}>Delete this reward?</h2>
        <p style={{ fontSize:13, color:C.tx2, lineHeight:1.65, marginBottom:10 }}><strong style={{ color:C.tx1 }}>"{reward.title}"</strong> will be permanently deleted from Firestore.</p>
        <code style={{ fontSize:10.5, color:C.tx3, background:C.bg, padding:'4px 9px', borderRadius:6, display:'inline-block', marginBottom:20, fontFamily:fontMono, border:`1px solid ${C.border}` }}>{reward.id}</code>
        {error && <div style={{ padding:'10px 14px', background:C.redBg, border:`1px solid ${C.red}30`, borderRadius:9, fontSize:12.5, color:C.red, marginBottom:14 }}>{error}</div>}
        <div style={{ display:'flex', gap:9 }}>
          <button onClick={onClose} className="gc-btn-ghost" style={{ flex:1, height:40, borderRadius:10, border:`1.5px solid ${C.border}`, background:C.white, color:C.tx2, fontFamily:font, fontSize:13.5, fontWeight:600, cursor:'pointer', transition:'all .15s' }}>Cancel</button>
          <button onClick={confirm} disabled={loading} style={{ flex:1, height:40, borderRadius:10, border:'none', background:loading?'#f5a3ae':C.red, color:'#fff', fontFamily:font, fontSize:13.5, fontWeight:600, cursor:loading?'not-allowed':'pointer', transition:'all .15s' }}>{loading ? 'Deleting…' : 'Yes, Delete'}</button>
        </div>
      </div>
    </div>
  );
}

function RewardModal({ reward, onClose, onSaved }: { reward:RewardWithId|null; onClose:()=>void; onSaved:(msg:string)=>void }) {
  const isNew = !reward;
  const [form, setForm] = useState({
    rewardId:    reward?.id ?? '',
    title:       reward?.title ?? '',
    description: reward?.description ?? '',
    pointsCost:  reward ? String(getPointsCost(reward)) : '',
    category:    (reward?.category as Category) ?? 'Drink',
    isActive:    reward?.isActive ?? true,
    imageURL:    reward ? getImageUrl(reward) : '',
  });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [idTouched, setIdTouched] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [processingImage, setProcessingImage] = useState(false);

  useEffect(() => {
    if (!isNew || idTouched) return;
    const slug = form.title.toLowerCase().replace(/[^a-z0-9\s]/g,'').trim().split(/\s+/).filter(Boolean).map(w=>w.slice(0,4)).join('_').slice(0,20);
    setForm(p => ({ ...p, rewardId: slug ? 'rw_'+slug : '' }));
  }, [form.title, isNew, idTouched]);

  const set = (k:any) => (e:React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>) => setForm(p => ({ ...p, [k]:e.target.value }));

  const handleImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) { setError("Ukuran gambar maksimal 15MB."); return; }
    setError(''); setProcessingImage(true);
    try {
      const compressedBlob = await compressImageToWebP(file, 800, 800, 0.8);
      const fileName = `rewards/${Date.now()}_${Math.random().toString(36).substring(2, 8)}.webp`;
      const storageRef = ref(storage, fileName);
      const uploadTask = uploadBytesResumable(storageRef, compressedBlob);
      setUploadProgress(0); setProcessingImage(false);
      uploadTask.on("state_changed",
        (snap) => setUploadProgress((snap.bytesTransferred / snap.totalBytes) * 100),
        (err) => { setError("Upload failed: " + err.message); setUploadProgress(null); },
        async () => { const url = await getDownloadURL(uploadTask.snapshot.ref); setForm(p => ({ ...p, imageURL: url })); setUploadProgress(null); }
      );
    } catch (err: any) { setError(err.message || "Failed to process image"); setProcessingImage(false); }
  };

  async function handleSave() {
    if (!form.title.trim()) { setError('Reward name is required.'); return; }
    if (isNew && !form.rewardId.trim()) { setError('Reward ID is required.'); return; }
    const cost = Number(form.pointsCost);
    if (form.pointsCost !== '' && (isNaN(cost)||cost<0)) { setError('Points cost must be positive.'); return; }
    if (uploadProgress !== null || processingImage) { setError('Wait for image upload.'); return; }
    setLoading(true); setError('');
    try {
      const payload = { 
        ...(isNew?{rewardId:form.rewardId.trim()}:{}), 
        title:form.title.trim(), description:form.description.trim(), 
        pointsRequired:form.pointsCost!==''?Number(form.pointsCost):0,
        category:form.category, isActive:form.isActive, imageUrl:form.imageURL.trim() 
      };
      const r = await fetch(isNew ? '/api/rewards' : `/api/rewards/${reward!.id}`, { method: isNew ? 'POST' : 'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
      if (!r.ok) throw new Error((await r.json().catch(()=>({}))).message ?? 'Failed to save.');
      onSaved(isNew ? `Reward "${form.title}" added!` : `"${form.title}" updated.`); onClose();
    } catch (e:any) { setError(e.message); setLoading(false); }
  }

  const cat = CAT_CFG[form.category as Category] ?? CAT_CFG.Drink;

  return (
    <div onClick={e => { if (e.target===e.currentTarget) onClose(); }} style={{ position:'fixed', inset:0, zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', padding:24, background:'rgba(7,9,18,.55)', backdropFilter:'blur(12px)', animation:'gcFadeIn .15s ease', fontFamily:font }}>
      <div style={{ background:C.white, borderRadius:22, width:'100%', maxWidth:540, maxHeight:'92vh', overflow:'hidden', display:'flex', flexDirection:'column', boxShadow:C.shadowLg, animation:'gcRise .26s cubic-bezier(.22,.68,0,1.15) both', border:`1px solid ${C.border}` }}>
        <div style={{ padding:'22px 26px 18px', borderBottom:`1px solid ${C.border2}`, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <p style={{ fontSize:10.5, fontWeight:700, letterSpacing:'.12em', textTransform:'uppercase', color:C.blue, marginBottom:4 }}>{isNew ? 'New Reward' : 'Edit Reward'}</p>
            <h2 style={{ fontSize:20, fontWeight:700, letterSpacing:'-.025em', color:C.tx1, margin:0 }}>{isNew ? 'Add Voucher' : reward!.title}</h2>
          </div>
          <button className="gc-modal-close" onClick={onClose} style={{ width:34, height:34, borderRadius:9, cursor:'pointer', border:`1.5px solid ${C.border}`, background:'transparent', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1 1l10 10M11 1L1 11" stroke={C.tx3} strokeWidth="1.7" strokeLinecap="round"/></svg>
          </button>
        </div>

        <div style={{ overflowY:'auto', flex:1, padding:'20px 26px', display:'flex', flexDirection:'column', gap:14 }}>
          {isNew && (
            <div>
              <FL required>Reward ID</FL>
              <GcInput placeholder="rw_free_drink" value={form.rewardId} onChange={e => { setIdTouched(true); setForm(p=>({...p,rewardId:e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g,'')})); }}/>
            </div>
          )}
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <div><FL required>Voucher Name</FL><GcInput placeholder="Free Drink" value={form.title} onChange={set('title')}/></div>
            <div><FL>Description</FL><GcTextarea placeholder="Redeem points for..." value={form.description} onChange={set('description')}/></div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div><FL required>Points Cost</FL><GcInput type="number" min="0" placeholder="500" value={form.pointsCost} onChange={set('pointsCost')}/></div>
            <div><FL required>Category</FL><GcSelect value={form.category} onChange={set('category')}><option value="Drink">Drink</option><option value="Topping">Topping</option><option value="Discount">Discount</option></GcSelect></div>
          </div>
          <div>
            <FL>Upload Image (WebP)</FL>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              {form.imageURL && <img src={form.imageURL} alt={form.title} style={{ width: 44, height: 44, objectFit: 'contain', borderRadius: 8, border: `1px solid ${C.border}` }} />}
              <div style={{ flex: 1 }}>
                {processingImage ? <div style={{ height: 42, borderRadius: 9, background: C.bg, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.orange, fontSize:12, fontWeight:700 }}>Compressing...</div>
                : uploadProgress !== null ? <div style={{ height: 42, borderRadius: 9, background: C.bg, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', padding: '0 10px', position: 'relative', overflow: 'hidden' }}><div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, background: C.blueL, width: `${uploadProgress}%` }} /><span style={{ position: 'relative', zIndex: 1, fontSize: 12, fontWeight: 700, color: C.blue }}>Uploading {Math.round(uploadProgress)}%</span></div>
                : <div style={{ position: 'relative', height: 42, display: 'flex', alignItems: 'center' }}><input type="file" accept="image/*" onChange={handleImageFile} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', zIndex: 10 }} /><div style={{ width: '100%', height: '100%', borderRadius: 9, background: C.bg, border: `1.5px dashed ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12.5, fontWeight: 600, color: C.tx2 }}>{form.imageURL ? "Change Image" : "Select Image"}</div></div>}
              </div>
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'13px 16px', borderRadius:12, background:C.bg, border:`1.5px solid ${C.border}` }}>
            <div><p style={{ fontSize:13.5, fontWeight:600, color:C.tx1, marginBottom:2 }}>Active Status</p></div>
            <button type="button" onClick={() => setForm(p=>({...p,isActive:!p.isActive}))} style={{ width:44, height:25, borderRadius:99, border:'none', cursor:'pointer', background:form.isActive?C.blue:C.bgSub, position:'relative', transition:'background .2s' }}><span style={{ position:'absolute', top:3.5, borderRadius:'50%', width:18, height:18, background:'#fff', left:form.isActive?23:3, transition:'left .2s' }}/></button>
          </div>
          {error && <div style={{ padding:'11px 14px', background:C.redBg, border:`1px solid ${C.red}30`, borderRadius:9, fontSize:12.5, color:C.red }}>{error}</div>}
        </div>

        <div style={{ padding:'14px 26px 20px', borderTop:`1px solid ${C.border2}`, display:'flex', alignItems:'center', justifyContent:'flex-end', background:C.bg, gap:9 }}>
          <button onClick={onClose} className="gc-btn-ghost" style={{ height:40, padding:'0 18px', borderRadius:10, border:`1.5px solid ${C.border}`, background:C.white, color:C.tx2, fontFamily:font, fontSize:13.5, fontWeight:600, cursor:'pointer' }}>Batal</button>
          <button onClick={handleSave} disabled={loading || uploadProgress !== null || processingImage} className="gc-btn-primary" style={{ height:40, padding:'0 22px', borderRadius:10, border:'none', background:(loading||uploadProgress!==null||processingImage)?'#9ca3af':C.blue, color:'#fff', fontFamily:font, fontSize:13.5, fontWeight:600, cursor:(loading||uploadProgress!==null||processingImage)?'not-allowed':'pointer' }}>{loading ? 'Saving…' : 'Save Changes'}</button>
        </div>
      </div>
    </div>
  );
}

// ── TICKET CARD & MAIN COMPONENT ──────────────────────────────────────────────
function RewardCard({ reward, onEdit, onDelete, onToggleActive }: { reward:RewardWithId; onEdit:()=>void; onDelete:()=>void; onToggleActive:()=>void }) {
  const cat = CAT_CFG[reward.category as Category] ?? CAT_CFG.Drink;
  return (
    <div className="gc-ticket" style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, boxShadow: C.shadow, display: 'flex', overflow: 'visible', position: 'relative' }}>
      <div style={{ width: 110, flexShrink: 0, background: cat.bg, borderRadius: '15px 0 0 15px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '14px 10px', position: 'relative', gap: 6 }}>
        <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.13em', textTransform: 'uppercase', color: cat.color, opacity: .75, fontFamily: font }}>{cat.label}</span>
        <div style={{ textAlign: 'center' }}>
          {getPointsCost(reward) === 0 ? <p style={{ fontSize: 16, fontWeight: 800, color: C.green, fontFamily: font, margin: 0 }}>FREE</p> : <><p style={{ fontSize: 20, fontWeight: 800, color: cat.color, fontFamily: font, margin: 0 }}>{getPointsCost(reward).toLocaleString('id')}</p><p style={{ fontSize: 9, fontWeight: 700, color: cat.color, margin: '3px 0 0' }}>pts</p></>}
        </div>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: reward.isActive ? C.green : C.red, boxShadow: reward.isActive ? `0 0 0 2px ${C.green}35` : `0 0 0 2px ${C.red}30` }}/>
      </div>
      <div style={{ position: 'absolute', left: 110, top: 10, bottom: 10, width: 0, borderLeft: `1.5px dashed ${C.border}`, zIndex: 1 }}/>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '14px 16px 12px 20px', minWidth: 0 }}>
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:8, marginBottom:5 }}><p style={{ fontSize:13.5, fontWeight:700, color:C.tx1, fontFamily:font, margin:0, flex:1 }}>{reward.title}</p><StatusPill active={reward.isActive}/></div>
        <p style={{ fontSize:12, color:C.tx3, fontFamily:font, margin:0, marginBottom:10, flex:1, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' as any }}>{reward.description}</p>
        <div style={{ display:'flex', alignItems:'center', gap:7, flexWrap:'wrap' }}>
          {getImageUrl(reward) && <img src={getImageUrl(reward)} alt={reward.title} style={{ width:22, height:22, borderRadius:4, border:`1px solid ${C.border2}` }}/>}
          <code style={{ fontSize:9.5, color:C.tx4, background:C.bg, padding:'2px 7px', borderRadius:5, fontFamily:fontMono, border:`1px solid ${C.border2}` }}>{reward.id}</code>
          <div style={{ flex:1 }}/>
          <button onClick={onEdit} className="gc-action-edit" style={{ height:28, padding:'0 10px', borderRadius:7, fontFamily:font, fontSize:11.5, fontWeight:600, cursor:'pointer', border:`1.5px solid ${C.border}`, background:C.white, color:C.tx2, display:'inline-flex', alignItems:'center', gap:4 }}>Edit</button>
          <button onClick={onToggleActive} className={reward.isActive ? 'gc-action-deactivate' : 'gc-action-activate'} style={{ height:28, padding:'0 10px', borderRadius:7, fontFamily:font, fontSize:11.5, fontWeight:600, cursor:'pointer', border:`1.5px solid ${reward.isActive?'#FECACA':'#A7F3D0'}`, background:C.white, color:reward.isActive?'#EF4444':'#16A34A', display:'inline-flex', alignItems:'center', gap:4 }}>{reward.isActive ? 'Nonaktifkan' : 'Aktifkan'}</button>
          <button onClick={onDelete} className="gc-action-delete" style={{ width:28, height:28, borderRadius:7, cursor:'pointer', border:`1.5px solid ${C.border}`, background:C.white, color:C.tx3, display:'inline-flex', alignItems:'center', justifyContent:'center' }}>✕</button>
        </div>
      </div>
    </div>
  );
}

function AddTicket({ onClick }: { onClick: () => void }) {
  return (
    <div onClick={onClick} className="gc-add-ticket" style={{ border:`1.5px dashed ${C.border}`, borderRadius:16, background:'transparent', display:'flex', alignItems:'center', justifyContent:'center', height:88, cursor:'pointer', transition:'all .18s', gap:12 }}>
      <div style={{ width:30, height:30, borderRadius:9, background:C.bgSub, display:'flex', alignItems:'center', justifyContent:'center', color:C.tx3, transition:'all .18s' }}>+</div>
      <div><p style={{ fontSize:12.5, fontWeight:600, color:C.tx3, margin:0, fontFamily:font }}>Add New Voucher</p></div>
    </div>
  );
}

export default function RewardsClient({ initialRewards = [], showAddTrigger }: { initialRewards?: RewardWithId[]; showAddTrigger?: boolean }) {
  const { user } = useAuth();
  const canMutate = user?.role === "SUPER_ADMIN";
  const [rewards, setRewards] = useState<RewardWithId[]>(initialRewards);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('connecting');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [catFilter, setCatFilter] = useState('all');
  const [editTarget, setEditTarget] = useState<RewardWithId | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RewardWithId | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [toast, setToast] = useState<{ msg:string; type:'success'|'error' } | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const showToast = useCallback((msg:string, type:'success'|'error'='success') => setToast({msg,type}), []);

  useEffect(() => {
    const q = query(collection(db,'rewards').withConverter(rewardConverter), orderBy('title'));
    const unsub = onSnapshot(q, snap => { setRewards(snap.docs.map(d => d.data() as RewardWithId)); setSyncStatus('live'); }, err => { console.error(err); setSyncStatus('error'); });
    return () => unsub();
  }, []);

  const handleToggleActive = useCallback(async (reward:RewardWithId) => {
    setTogglingId(reward.id);
    try {
      const r = await fetch(`/api/rewards/${reward.id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({isActive:!reward.isActive}) });
      if (!r.ok) throw new Error((await r.json().catch(()=>({}))).message ?? 'Failed to update.');
      showToast(reward.isActive ? `"${reward.title}" dinonaktifkan.` : `"${reward.title}" diaktifkan.`);
    } catch (e:any) { showToast(e.message,'error'); } finally { setTogglingId(null); }
  }, [showToast]);

  const filtered = useMemo(() => rewards.filter(r => {
    const q = search.toLowerCase();
    const ms = !q || String(r.title||'').toLowerCase().includes(q) || String(r.id||'').toLowerCase().includes(q) || String(r.description||'').toLowerCase().includes(q);
    const mf = filterStatus==='all' || (filterStatus==='active'?r.isActive:!r.isActive);
    const mc = catFilter==='all' || r.category===catFilter;
    return ms && mf && mc;
  }), [rewards, search, filterStatus, catFilter]);

  const total = rewards.length;
  const activeAmt = rewards.filter(r=>r.isActive).length;
  const inactive = rewards.filter(r=>!r.isActive).length;

  if (showAddTrigger) {
    return (
      <>
        <style>{globalStyles}</style>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <LiveBadge status={syncStatus}/>
          <button disabled={!canMutate} onClick={() => canMutate && setShowAdd(true)} className="gc-btn-primary" style={{ height:40, padding:'0 18px', borderRadius:10, border:'none', background:canMutate ? C.blue : C.tx4, color:'#fff', fontFamily:font, fontSize:13.5, fontWeight:600, cursor:canMutate ? 'pointer' : 'not-allowed' }}>
            + Add Voucher
          </button>
        </div>
        {showAdd && <RewardModal reward={null} onClose={()=>setShowAdd(false)} onSaved={msg=>{showToast(msg);setShowAdd(false);}}/>}
        {toast && <Toast msg={toast.msg} type={toast.type} onDone={()=>setToast(null)}/>}
      </>
    );
  }

  return (
    <>
      <style>{globalStyles}</style>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:22 }}>
        <StatCard label="Total Reward" value={total} color={C.blue} bg={C.blueL} icon={<div/>} />
        <StatCard label="Aktif" value={activeAmt} color={C.green} bg={C.greenBg} icon={<div/>} />
        <StatCard label="Nonaktif" value={inactive} color={C.red} bg={C.redBg} icon={<div/>} />
      </div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18, gap:10, flexWrap:'wrap' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
          <div className="gc-search" style={{ display:'flex', alignItems:'center', gap:8, height:36, padding:'0 12px', background:C.white, border:`1.5px solid ${C.border}`, borderRadius:9, minWidth:200 }}>
            <input type="text" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search reward..." style={{ border:'none', outline:'none', background:'transparent', fontSize:13, color:C.tx1, width:150, fontFamily:font }}/>
          </div>
          <ToolbarSelect value={filterStatus} onChange={setFilterStatus}><option value="all">Semua Status</option><option value="active">Aktif</option><option value="inactive">Nonaktif</option></ToolbarSelect>
          <ToolbarSelect value={catFilter} onChange={setCatFilter}><option value="all">Semua Kategori</option><option value="Drink">Drink</option><option value="Topping">Topping</option><option value="Discount">Discount</option></ToolbarSelect>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          <LiveBadge status={syncStatus}/>
          <button disabled={!canMutate} onClick={() => canMutate && setShowAdd(true)} className="gc-btn-primary" style={{ height:36, padding:'0 16px', borderRadius:10, border:'none', background:canMutate ? C.blue : C.tx4, color:'#fff', fontFamily:font, fontSize:13, fontWeight:600, cursor:canMutate ? 'pointer' : 'not-allowed' }}>+ Add Voucher</button>
        </div>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {filtered.map((reward) => (
          <RewardCard key={reward.id} reward={{ ...reward, isActive: togglingId===reward.id ? !reward.isActive : reward.isActive }} onEdit={()=>canMutate && setEditTarget(reward)} onDelete={()=>canMutate && setDeleteTarget(reward)} onToggleActive={()=>canMutate && handleToggleActive(reward)} />
        ))}
        {canMutate && <AddTicket onClick={()=>setShowAdd(true)}/>} 
      </div>
      {canMutate && editTarget && <RewardModal reward={editTarget} onClose={()=>setEditTarget(null)} onSaved={msg=>{showToast(msg);setEditTarget(null);}}/>}
      {canMutate && showAdd && <RewardModal reward={null} onClose={()=>setShowAdd(false)} onSaved={msg=>{showToast(msg);setShowAdd(false);}}/>}
      {canMutate && deleteTarget && <DeleteModal reward={deleteTarget} onClose={()=>setDeleteTarget(null)} onDeleted={msg=>{showToast(msg);setDeleteTarget(null);}}/>}
      {toast && <Toast msg={toast.msg} type={toast.type} onDone={()=>setToast(null)}/>}
    </>
  );
}