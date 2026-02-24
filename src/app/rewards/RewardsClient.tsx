"use client";
// src/app/rewards/RewardsClient.tsx — TICKET REDESIGN (FIXED COLLECTION)

import { useState, useMemo, useEffect, useCallback } from "react";
// Pastikan import ini tidak error jika file InjectVoucherModal tidak ada
// import InjectVoucherModal from "./InjectVoucherModal"; 
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { Reward } from "@/types/firestore";

type RewardWithId = Reward & { id: string };
type SyncStatus   = "connecting" | "live" | "error";
type Category     = "Drink" | "Topping" | "Discount";

// ── Design System ──────────────────────────────────────────────────────────────
const C = {
  bg:       '#F7F8FC',
  bgSub:    '#EDEEF5',
  white:    '#FFFFFF',
  border:   '#E4E6F0',
  border2:  '#EDEFF7',
  tx1:      '#0D0F17',
  tx2:      '#3D4259',
  tx3:      '#8C91AC',
  tx4:      '#C2C6D9',
  blue:     '#3A56E8',
  blueHov:  '#2E47D4',
  blueL:    '#EBF0FF',
  blueMid:  '#B8C8FF',
  bluePale: '#F0F4FF',
  green:    '#0BA853',
  greenBg:  '#EAFAF2',
  orange:   '#E07B12',
  orangeBg: '#FFF4E6',
  red:      '#D11B3B',
  redBg:    '#FEF1F3',
  shadow:   '0 1px 4px rgba(13,15,23,.05), 0 0 0 1px rgba(13,15,23,.04)',
  shadowMd: '0 4px 16px rgba(13,15,23,.08), 0 1px 4px rgba(13,15,23,.04)',
  shadowLg: '0 24px 64px rgba(13,15,23,.14), 0 6px 16px rgba(13,15,23,.06)',
} as const;

const font     = "'Instrument Sans', 'DM Sans', system-ui, sans-serif";
const fontMono = "'JetBrains Mono', 'Fira Code', monospace";

const CAT_CFG: Record<Category, { bg: string; color: string; dot: string; label: string }> = {
  Drink:    { bg: '#EBF3FF', color: '#1D5FCC', dot: '#3A8EF6', label: 'Drink'    },
  Topping:  { bg: '#F3EDFF', color: '#6B2FCC', dot: '#8B5CF6', label: 'Topping'  },
  Discount: { bg: '#EDFFF6', color: '#0A7A44', dot: '#10B981', label: 'Discount' },
};

// ── Global CSS ─────────────────────────────────────────────────────────────────
const globalStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=DM+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

  @keyframes gcRise    { from { opacity:0; transform:translateY(14px) scale(.98) } to { opacity:1; transform:none } }
  @keyframes gcFadeIn  { from { opacity:0 } to { opacity:1 } }
  @keyframes gcSlideUp { from { opacity:0; transform:translateY(6px) } to { opacity:1; transform:none } }
  @keyframes pulseDot  { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(.82)} }
  @keyframes toastIn   { from{opacity:0;transform:translateY(10px) scale(.96)} to{opacity:1;transform:none} }

  /* Ticket hover */
  .gc-ticket {
    transition: box-shadow .18s ease, transform .18s ease, border-color .18s ease !important;
  }
  .gc-ticket:hover {
    box-shadow: 0 6px 28px rgba(58,86,232,.09), 0 2px 8px rgba(13,15,23,.05) !important;
    transform: translateY(-1px) !important;
    border-color: ${C.blueMid} !important;
  }

  .gc-btn-primary { transition: all .15s ease !important; }
  .gc-btn-primary:hover { background: ${C.blueHov} !important; box-shadow: 0 4px 20px rgba(58,86,232,.38) !important; transform: translateY(-1px) !important; }

  .gc-btn-ghost:hover { background: ${C.bgSub} !important; }
  .gc-input:focus { border-color: ${C.blue} !important; box-shadow: 0 0 0 3px rgba(58,86,232,.12) !important; background: ${C.white} !important; }
  .gc-search:focus-within { border-color: ${C.blue} !important; box-shadow: 0 0 0 3px rgba(58,86,232,.1) !important; }

  .gc-action-edit:hover       { background:${C.bluePale}!important; color:${C.blue}!important; border-color:${C.blueMid}!important; }
  .gc-action-deactivate:hover { background:${C.redBg}!important; color:${C.red}!important; border-color:#F5A3AE!important; }
  .gc-action-activate:hover   { background:${C.greenBg}!important; color:${C.green}!important; border-color:#7FD8A8!important; }
  .gc-action-delete:hover     { background:${C.redBg}!important; color:${C.red}!important; border-color:#F5A3AE!important; }

  .gc-add-ticket:hover { border-color:${C.blue}!important; background:${C.bluePale}!important; }
  .gc-stat-card { transition: box-shadow .15s; }
  .gc-stat-card:hover { box-shadow: ${C.shadowMd} !important; }
  .gc-modal-close:hover { background: ${C.bgSub} !important; }

  /* Custom select arrow */
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

function StatusPill({ active }: { active: boolean }) {
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:4,
      padding:'2px 8px', borderRadius:99,
      background: active ? C.greenBg : C.bgSub,
      color: active ? '#0A6E3F' : C.tx3,
      fontSize:10, fontWeight:700, letterSpacing:'.07em', textTransform:'uppercase', fontFamily:font,
    }}>
      <span style={{ width:4, height:4, borderRadius:'50%', background: active ? C.green : C.tx4 }}/>
      {active ? 'Aktif' : 'Nonaktif'}
    </span>
  );
}

function CategoryChip({ category }: { category: Category }) {
  const cfg = CAT_CFG[category] ?? CAT_CFG.Drink;
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:4,
      padding:'3px 9px', borderRadius:6,
      background:cfg.bg, color:cfg.color,
      fontSize:10.5, fontWeight:600, letterSpacing:'.03em', fontFamily:font,
      border:`1px solid ${cfg.color}22`,
    }}>
      <span style={{ width:4, height:4, borderRadius:'50%', background:cfg.dot }}/>
      {cfg.label}
    </span>
  );
}

export function FL({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label style={{ display:'block', marginBottom:7, fontSize:11, fontWeight:700,
      letterSpacing:'.07em', textTransform:'uppercase', color:C.tx3, fontFamily:font }}>
      {children}{required && <span style={{ color:C.red, marginLeft:3 }}>*</span>}
    </label>
  );
}

export function GcInput({ style, ...p }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input className="gc-input" {...p} style={{
      width:'100%', height:42, borderRadius:10, outline:'none',
      border:`1.5px solid ${C.border}`, background:C.bg,
      padding:'0 14px', fontFamily:font, fontSize:13.5, color:C.tx1,
      transition:'all .15s', boxSizing:'border-box', ...style,
    }}/>
  );
}

function GcTextarea({ style, ...p }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea className="gc-input" {...p} rows={3} style={{
      width:'100%', borderRadius:10, outline:'none', resize:'vertical',
      border:`1.5px solid ${C.border}`, background:C.bg,
      padding:'11px 14px', fontFamily:font, fontSize:13.5, color:C.tx1,
      lineHeight:1.55, transition:'all .15s', boxSizing:'border-box', ...style,
    }}/>
  );
}

export function GcSelect({ style, ...p }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className="gc-input gc-select" {...p} style={{
      width:'100%', height:42, borderRadius:10, outline:'none',
      border:`1.5px solid ${C.border}`, background:C.bg,
      padding:'0 14px', fontFamily:font, fontSize:13.5, color:C.tx1,
      transition:'all .15s', cursor:'pointer', ...style,
    }}/>
  );
}

// Compact toolbar select
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
    <div style={{
      position:'fixed', bottom:28, right:28, zIndex:999,
      padding:'13px 20px', borderRadius:14, fontFamily:font,
      fontSize:13.5, fontWeight:600, color:'#fff',
      background: type==='success' ? 'linear-gradient(135deg,#0BA853,#09934A)' : 'linear-gradient(135deg,#D11B3B,#B81532)',
      boxShadow: type==='success' ? '0 8px 32px rgba(11,168,83,.30)' : '0 8px 32px rgba(209,27,59,.30)',
      display:'flex', alignItems:'center', gap:10, animation:'toastIn .25s ease',
    }}>
      <span style={{ width:20, height:20, borderRadius:'50%', background:'rgba(255,255,255,.2)',
        display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:11 }}>
        {type==='success' ? '✓' : '✕'}
      </span>
      {msg}
    </div>
  );
}

// ── Delete Modal ───────────────────────────────────────────────────────────────
function DeleteModal({ reward, onClose, onDeleted }:
  { reward:RewardWithId; onClose:()=>void; onDeleted:(msg:string)=>void }) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  async function confirm() {
    setLoading(true); setError('');
    try {
      const r = await fetch(`/api/rewards/${reward.id}`, { method:'DELETE' });
      if (!r.ok) throw new Error((await r.json().catch(()=>({}))).message ?? 'Gagal menghapus.');
      onDeleted(`"${reward.title}" berhasil dihapus.`); onClose();
    } catch (e:any) { setError(e.message); setLoading(false); }
  }

  useEffect(() => {
    const h = (e:KeyboardEvent) => { if (e.key==='Escape') onClose(); };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div onClick={e => { if (e.target===e.currentTarget) onClose(); }} style={{
      position:'fixed', inset:0, zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', padding:24,
      background:'rgba(7,9,18,.55)', backdropFilter:'blur(12px)', fontFamily:font, animation:'gcFadeIn .15s ease',
    }}>
      <div style={{
        background:C.white, borderRadius:22, width:'100%', maxWidth:400,
        boxShadow:C.shadowLg, padding:'28px 28px', animation:'gcRise .22s ease',
        border:`1px solid ${C.border}`,
      }}>
        <div style={{ width:46, height:46, borderRadius:13, background:C.redBg, border:`1px solid ${C.red}20`,
          display:'flex', alignItems:'center', justifyContent:'center', marginBottom:18 }}>
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke={C.red} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
          </svg>
        </div>
        <h2 style={{ fontSize:18, fontWeight:700, color:C.tx1, marginBottom:8, letterSpacing:'-.02em' }}>Hapus reward ini?</h2>
        <p style={{ fontSize:13, color:C.tx2, lineHeight:1.65, marginBottom:10 }}>
          <strong style={{ color:C.tx1 }}>"{reward.title}"</strong> akan dihapus permanen dari Firestore.
        </p>
        <code style={{ fontSize:10.5, color:C.tx3, background:C.bg, padding:'4px 9px', borderRadius:6, display:'inline-block', marginBottom:20, fontFamily:fontMono, border:`1px solid ${C.border}` }}>
          {reward.id}
        </code>
        {error && <div style={{ padding:'10px 14px', background:C.redBg, border:`1px solid ${C.red}30`, borderRadius:9, fontSize:12.5, color:C.red, marginBottom:14 }}>{error}</div>}
        <div style={{ display:'flex', gap:9 }}>
          <button onClick={onClose} className="gc-btn-ghost" style={{ flex:1, height:40, borderRadius:10, border:`1.5px solid ${C.border}`, background:C.white, color:C.tx2, fontFamily:font, fontSize:13.5, fontWeight:600, cursor:'pointer', transition:'all .15s' }}>Batal</button>
          <button onClick={confirm} disabled={loading} style={{ flex:1, height:40, borderRadius:10, border:'none', background:loading?'#f5a3ae':C.red, color:'#fff', fontFamily:font, fontSize:13.5, fontWeight:600, cursor:loading?'not-allowed':'pointer', transition:'all .15s' }}>
            {loading ? 'Menghapus…' : 'Ya, Hapus'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Reward Modal ───────────────────────────────────────────────────────────────
type RewardForm = { rewardId:string; title:string; description:string; pointsCost:string; category:Category; isActive:boolean };

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14, marginTop:4 }}>
      <p style={{ fontSize:10.5, fontWeight:700, letterSpacing:'.12em', textTransform:'uppercase', color:C.tx3, fontFamily:font, margin:0, whiteSpace:'nowrap' }}>{children}</p>
      <div style={{ flex:1, height:1, background:C.border2 }}/>
    </div>
  );
}

function RewardModal({ reward, onClose, onSaved }:
  { reward:RewardWithId|null; onClose:()=>void; onSaved:(msg:string)=>void }) {
  const isNew = !reward;
  const [form, setForm] = useState<RewardForm>({
    rewardId:    reward?.id ?? '',
    title:       reward?.title ?? '',
    description: reward?.description ?? '',
    pointsCost:  reward?.pointsCost != null ? String(reward.pointsCost) : '',
    category:    (reward?.category as Category) ?? 'Drink',
    isActive:    reward?.isActive ?? true,
  });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [idTouched, setIdTouched] = useState(false);

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

  async function handleSave() {
    if (!form.title.trim())             { setError('Nama reward wajib diisi.'); return; }
    if (isNew && !form.rewardId.trim()) { setError('Reward ID wajib diisi.'); return; }
    const cost = Number(form.pointsCost);
    if (form.pointsCost !== '' && (isNaN(cost)||cost<0)) { setError('Biaya poin harus angka positif.'); return; }
    setLoading(true); setError('');
    try {
      const method = isNew ? 'POST' : 'PATCH';
      const url    = isNew ? '/api/rewards' : `/api/rewards/${reward!.id}`;
      const payload = { ...(isNew?{rewardId:form.rewardId.trim()}:{}), title:form.title.trim(), description:form.description.trim(), pointsCost:form.pointsCost!==''?Number(form.pointsCost):0, category:form.category, isActive:form.isActive };
      const r = await fetch(url, { method, headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
      if (!r.ok) throw new Error((await r.json().catch(()=>({}))).message ?? 'Gagal menyimpan.');
      onSaved(isNew ? `Reward "${form.title}" berhasil ditambahkan!` : `"${form.title}" berhasil diperbarui.`);
      onClose();
    } catch (e:any) { setError(e.message); setLoading(false); }
  }

  const cat = CAT_CFG[form.category] ?? CAT_CFG.Drink;

  return (
    <div onClick={e => { if (e.target===e.currentTarget) onClose(); }} style={{
      position:'fixed', inset:0, zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', padding:24,
      background:'rgba(7,9,18,.55)', backdropFilter:'blur(12px)', animation:'gcFadeIn .15s ease', fontFamily:font,
    }}>
      <div style={{
        background:C.white, borderRadius:22, width:'100%', maxWidth:540,
        maxHeight:'92vh', overflow:'hidden', display:'flex', flexDirection:'column',
        boxShadow:C.shadowLg, animation:'gcRise .26s cubic-bezier(.22,.68,0,1.15) both', border:`1px solid ${C.border}`,
      }}>
        {/* Header */}
        <div style={{ padding:'22px 26px 18px', borderBottom:`1px solid ${C.border2}`, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <div>
            <p style={{ fontSize:10.5, fontWeight:700, letterSpacing:'.12em', textTransform:'uppercase', color:C.blue, marginBottom:4 }}>
              {isNew ? 'Reward Baru' : 'Edit Reward'}
            </p>
            <h2 style={{ fontSize:20, fontWeight:700, letterSpacing:'-.025em', color:C.tx1, margin:0 }}>
              {isNew ? 'Tambah Voucher' : reward!.title}
            </h2>
            {!isNew && (
              <code style={{ fontSize:10.5, color:C.tx3, background:C.bg, padding:'2px 8px', borderRadius:5, fontFamily:fontMono, border:`1px solid ${C.border}`, display:'inline-block', marginTop:5 }}>
                {reward!.id}
              </code>
            )}
          </div>
          <button className="gc-modal-close" onClick={onClose} style={{ width:34, height:34, borderRadius:9, cursor:'pointer', border:`1.5px solid ${C.border}`, background:'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, transition:'all .15s' }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1 1l10 10M11 1L1 11" stroke={C.tx3} strokeWidth="1.7" strokeLinecap="round"/></svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ overflowY:'auto', flex:1, padding:'20px 26px', display:'flex', flexDirection:'column', gap:14 }}>
          {isNew && (
            <div>
              <SectionLabel>Document ID</SectionLabel>
              <FL required>Reward ID</FL>
              <GcInput placeholder="rw_free_drink" value={form.rewardId}
                onChange={e => { setIdTouched(true); setForm(p=>({...p,rewardId:e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g,'')})); }}/>
              <p style={{ fontSize:11.5, color:C.tx3, marginTop:5 }}>Tidak bisa diubah setelah disimpan.</p>
            </div>
          )}
          <div>
            <SectionLabel>Informasi Reward</SectionLabel>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div><FL required>Nama Voucher</FL><GcInput placeholder="Free Drink Any Size" value={form.title} onChange={set('title')}/></div>
              <div><FL>Deskripsi</FL><GcTextarea placeholder="Tukarkan poin kamu dengan minuman gratis..." value={form.description} onChange={set('description')}/></div>
            </div>
          </div>
          <div>
            <SectionLabel>Poin & Kategori</SectionLabel>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div>
                <FL required>Biaya Poin</FL>
                <GcInput type="number" min="0" step="1" placeholder="500" value={form.pointsCost} onChange={set('pointsCost')}/>
                <p style={{ fontSize:11.5, color:C.tx3, marginTop:5 }}>0 = gratis</p>
              </div>
              <div>
                <FL required>Kategori</FL>
                <GcSelect value={form.category} onChange={set('category')}>
                  <option value="Drink">Drink</option>
                  <option value="Topping">Topping</option>
                  <option value="Discount">Discount</option>
                </GcSelect>
              </div>
            </div>
          </div>
          {/* Preview */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', borderRadius:12, background:cat.bg, border:`1px solid ${cat.color}25` }}>
            <div>
              <p style={{ fontSize:11.5, fontWeight:700, color:cat.color, marginBottom:2 }}>Preview</p>
              <p style={{ fontSize:13, color:C.tx2 }}>
                {form.title || '(nama reward)'}{' · '}
                <strong style={{ color:cat.color }}>{!form.pointsCost||form.pointsCost==='0'?'Gratis':`${Number(form.pointsCost).toLocaleString('id')} pts`}</strong>
              </p>
            </div>
            <CategoryChip category={form.category}/>
          </div>
          {/* Toggle */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'13px 16px', borderRadius:12, background:C.bg, border:`1.5px solid ${C.border}` }}>
            <div>
              <p style={{ fontSize:13.5, fontWeight:600, color:C.tx1, marginBottom:2 }}>Status Aktif</p>
              <p style={{ fontSize:12, color:C.tx3 }}>{form.isActive ? 'Bisa di-redeem member' : 'Disembunyikan dari member'}</p>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <StatusPill active={form.isActive}/>
              <button type="button" onClick={() => setForm(p=>({...p,isActive:!p.isActive}))} style={{ width:44, height:25, borderRadius:99, border:'none', cursor:'pointer', background:form.isActive?C.blue:C.bgSub, position:'relative', transition:'background .2s', flexShrink:0, boxShadow:form.isActive?'0 2px 8px rgba(58,86,232,.30)':'none' }}>
                <span style={{ position:'absolute', top:3.5, borderRadius:'50%', width:18, height:18, background:'#fff', boxShadow:'0 1px 4px rgba(0,0,0,.18)', left:form.isActive?23:3, transition:'left .2s cubic-bezier(.34,1.56,.64,1)', display:'block' }}/>
              </button>
            </div>
          </div>
          {error && <div style={{ padding:'11px 14px', background:C.redBg, border:`1px solid ${C.red}30`, borderRadius:9, fontSize:12.5, color:C.red }}>{error}</div>}
        </div>

        {/* Footer */}
        <div style={{ padding:'14px 26px 20px', borderTop:`1px solid ${C.border2}`, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0, background:C.bg }}>
          <p style={{ fontSize:11.5, color:C.tx4 }}><span style={{ color:C.red }}>*</span> wajib diisi</p>
          <div style={{ display:'flex', gap:9 }}>
            <button onClick={onClose} className="gc-btn-ghost" style={{ height:40, padding:'0 18px', borderRadius:10, border:`1.5px solid ${C.border}`, background:C.white, color:C.tx2, fontFamily:font, fontSize:13.5, fontWeight:600, cursor:'pointer', transition:'all .15s' }}>Batal</button>
            <button onClick={handleSave} disabled={loading} className="gc-btn-primary" style={{ height:40, padding:'0 22px', borderRadius:10, border:'none', background:loading?'#9ca3af':C.blue, color:'#fff', fontFamily:font, fontSize:13.5, fontWeight:600, cursor:loading?'not-allowed':'pointer', boxShadow:loading?'none':'0 2px 12px rgba(58,86,232,.28)', display:'inline-flex', alignItems:'center', gap:7 }}>
              {loading ? 'Menyimpan…' : isNew ? '+ Tambah Reward' : 'Simpan Perubahan'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── TICKET CARD ────────────────────────────────────────────────────────────────
// Horizontal "ticket" shape: left stub (category + points) | dashed separator | right body (title, desc, actions)
function RewardCard({ reward, onEdit, onDelete, onToggleActive }:
  { reward:RewardWithId; onEdit:()=>void; onDelete:()=>void; onToggleActive:()=>void }) {
  const cat = CAT_CFG[reward.category as Category] ?? CAT_CFG.Drink;

  // notch size
  const notch = 14;

  return (
    <div className="gc-ticket" style={{
      background: C.white,
      borderRadius: 16,
      border: `1px solid ${C.border}`,
      boxShadow: C.shadow,
      display: 'flex',
      overflow: 'visible',
      position: 'relative',
    }}>

      {/* ── LEFT STUB ── colored background, category + points */}
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
        {/* Category label — horizontal, centered */}
        <span style={{
          fontSize: 9, fontWeight: 800, letterSpacing: '.13em', textTransform: 'uppercase',
          color: cat.color, opacity: .75, fontFamily: font, textAlign: 'center',
        }}>
          {cat.label}
        </span>

        {/* Points */}
        <div style={{ textAlign: 'center' }}>
          {reward.pointsCost === 0 ? (
            <p style={{ fontSize: 16, fontWeight: 800, color: C.green, letterSpacing: '-.02em', lineHeight: 1, fontFamily: font, margin: 0 }}>FREE</p>
          ) : (
            <>
              <p style={{
                fontSize: reward.pointsCost >= 10000 ? 14 : reward.pointsCost >= 1000 ? 17 : 20,
                fontWeight: 800, color: cat.color, letterSpacing: '-.03em', lineHeight: 1,
                fontFamily: font, margin: 0,
              }}>
                {reward.pointsCost.toLocaleString('id')}
              </p>
              <p style={{ fontSize: 9, fontWeight: 700, color: cat.color, opacity:.6, letterSpacing:'.07em', textTransform:'uppercase', fontFamily:font, margin: '3px 0 0' }}>pts</p>
            </>
          )}
        </div>

        {/* Status indicator — green = active, red = inactive */}
        <span style={{
          width: 7, height: 7, borderRadius: '50%',
          background: reward.isActive ? C.green : C.red,
          boxShadow: reward.isActive
            ? `0 0 0 2px ${C.green}35`
            : `0 0 0 2px ${C.red}30`,
        }}/>

        {/* Notch */}
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

      {/* ── SEPARATOR (dashed, sits over the notch gap) ── */}
      <div style={{
        position: 'absolute',
        left: 110,
        top: 10,
        bottom: 10,
        width: 0,
        borderLeft: `1.5px dashed ${C.border}`,
        zIndex: 1,
      }}/>

      {/* ── RIGHT BODY ── */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        padding: '14px 16px 12px 20px',
        minWidth: 0,
      }}>

        {/* Top row: title + status */}
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:8, marginBottom:5 }}>
          <p style={{ fontSize:13.5, fontWeight:700, color:C.tx1, lineHeight:1.3, letterSpacing:'-.015em', fontFamily:font, margin:0, flex:1, minWidth:0 }}>
            {reward.title}
          </p>
          <StatusPill active={reward.isActive}/>
        </div>

        {/* Description */}
        <p style={{ fontSize:12, color:C.tx3, lineHeight:1.55, fontFamily:font, margin:0,
          marginBottom:10, flex:1,
          overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' as any,
        }}>
          {reward.description || <span style={{ fontStyle:'italic', color:C.tx4 }}>Tidak ada deskripsi.</span>}
        </p>

        {/* Bottom row: ID + category + actions */}
        <div style={{ display:'flex', alignItems:'center', gap:7, flexWrap:'wrap' }}>
          <code style={{ fontSize:9.5, color:C.tx4, background:C.bg, padding:'2px 7px', borderRadius:5, fontFamily:fontMono, border:`1px solid ${C.border2}`, flexShrink:0 }}>
            {reward.id}
          </code>
          <CategoryChip category={reward.category as Category}/>
          <div style={{ flex:1 }}/>

          {/* Actions */}
          <button onClick={onEdit} className="gc-action-edit" style={{ height:28, padding:'0 10px', borderRadius:7, fontFamily:font, fontSize:11.5, fontWeight:600, cursor:'pointer', border:`1.5px solid ${C.border}`, background:C.white, color:C.tx2, display:'inline-flex', alignItems:'center', gap:4, transition:'all .13s', flexShrink:0 }}>
            <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
            </svg>
            Edit
          </button>

          <button onClick={onToggleActive} className={reward.isActive ? 'gc-action-deactivate' : 'gc-action-activate'} style={{ height:28, padding:'0 10px', borderRadius:7, fontFamily:font, fontSize:11.5, fontWeight:600, cursor:'pointer', transition:'all .13s', border:`1.5px solid ${reward.isActive?'#FECACA':'#A7F3D0'}`, background:C.white, color:reward.isActive?'#EF4444':'#16A34A', display:'inline-flex', alignItems:'center', gap:4, flexShrink:0 }}>
            {reward.isActive ? (
              <><svg width="9" height="9" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>Nonaktifkan</>
            ) : (
              <><svg width="9" height="9" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>Aktifkan</>
            )}
          </button>

          <button onClick={onDelete} className="gc-action-delete" style={{ width:28, height:28, borderRadius:7, cursor:'pointer', border:`1.5px solid ${C.border}`, background:C.white, color:C.tx3, display:'inline-flex', alignItems:'center', justifyContent:'center', flexShrink:0, transition:'all .13s' }}>
            <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M9 6V4h6v2"/>
            </svg>
          </button>
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
        <p style={{ fontSize:12.5, fontWeight:600, color:C.tx3, margin:0, fontFamily:font }}>Tambah Voucher Baru</p>
        <p style={{ fontSize:11, color:C.tx4, margin:'2px 0 0', fontFamily:font }}>Klik untuk menambahkan reward</p>
      </div>
    </div>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, color, bg, icon }:
  { label:string; value:number; color:string; bg:string; icon:React.ReactNode }) {
  return (
    <div className="gc-stat-card" style={{ background:C.white, border:`1px solid ${C.border}`, borderRadius:14, boxShadow:C.shadow, padding:'14px 18px', display:'flex', alignItems:'center', gap:12 }}>
      <div style={{ width:38, height:38, borderRadius:10, background:bg, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', color }}>{icon}</div>
      <div>
        <p style={{ fontSize:10, fontWeight:700, letterSpacing:'.09em', textTransform:'uppercase', color:C.tx3, marginBottom:4, fontFamily:font }}>{label}</p>
        <p style={{ fontSize:26, fontWeight:800, letterSpacing:'-.03em', color, lineHeight:1, fontFamily:font }}>{value}</p>
      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function RewardsClient({ initialRewards = [], showAddTrigger }:
  { initialRewards?:RewardWithId[]; showAddTrigger?:boolean }) {
  const [rewards,      setRewards]      = useState<RewardWithId[]>(initialRewards);
  const [syncStatus,   setSyncStatus]   = useState<SyncStatus>('connecting');
  const [search,       setSearch]       = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [catFilter,    setCatFilter]    = useState('all');
  const [editTarget,   setEditTarget]   = useState<RewardWithId | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RewardWithId | null>(null);
  const [showAdd,      setShowAdd]      = useState(false);
  const [toast,        setToast]        = useState<{ msg:string; type:'success'|'error' } | null>(null);
  const [togglingId,   setTogglingId]   = useState<string | null>(null);

  const showToast = useCallback((msg:string, type:'success'|'error'='success') => setToast({msg,type}), []);

  useEffect(() => {
    // Pastikan collection ini sama persis dengan yang ada di original code kamu
    const q = query(collection(db,'rewards_catalog'), orderBy('title'));
    const unsub = onSnapshot(q, snap => { setRewards(snap.docs.map(d=>({id:d.id,...d.data()} as RewardWithId))); setSyncStatus('live'); }, err => { console.error(err); setSyncStatus('error'); });
    return () => unsub();
  }, []);

  const handleToggleActive = useCallback(async (reward:RewardWithId) => {
    setTogglingId(reward.id);
    try {
      const r = await fetch(`/api/rewards/${reward.id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({isActive:!reward.isActive}) });
      if (!r.ok) throw new Error((await r.json().catch(()=>({}))).message ?? 'Gagal update.');
      showToast(reward.isActive ? `"${reward.title}" dinonaktifkan.` : `"${reward.title}" diaktifkan.`);
    } catch (e:any) { showToast(e.message,'error'); } finally { setTogglingId(null); }
  }, [showToast]);

  const filtered = useMemo(() => rewards.filter(r => {
    const q = search.toLowerCase();
    const ms = !q || r.title?.toLowerCase().includes(q) || r.id?.toLowerCase().includes(q) || r.description?.toLowerCase().includes(q);
    const mf = filterStatus==='all' || (filterStatus==='active'?r.isActive:!r.isActive);
    const mc = catFilter==='all' || r.category===catFilter;
    return ms && mf && mc;
  }), [rewards, search, filterStatus, catFilter]);

  const total     = rewards.length;
  const activeAmt = rewards.filter(r=>r.isActive).length;
  const inactive  = rewards.filter(r=>!r.isActive).length;
  const drinkCnt  = rewards.filter(r=>r.category==='Drink').length;

  if (showAddTrigger) {
    return (
      <>
        <style>{globalStyles}</style>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <LiveBadge status={syncStatus}/>
          <button onClick={() => setShowAdd(true)} className="gc-btn-primary" style={{ height:40, padding:'0 18px', borderRadius:10, border:'none', background:C.blue, color:'#fff', fontFamily:font, fontSize:13.5, fontWeight:600, cursor:'pointer', display:'inline-flex', alignItems:'center', gap:7, boxShadow:'0 2px 12px rgba(58,86,232,.30)' }}>
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M12 4.5v15m7.5-7.5h-15"/></svg>
            Tambah Voucher
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

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:22 }}>
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
            <input type="text" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari reward..." style={{ border:'none', outline:'none', background:'transparent', fontSize:13, color:C.tx1, width:150, fontFamily:font }}/>
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

          {/* Category dropdown */}
          <ToolbarSelect value={catFilter} onChange={setCatFilter}>
            <option value="all">Semua Kategori</option>
            <option value="Drink">Drink</option>
            <option value="Topping">Topping</option>
            <option value="Discount">Discount</option>
          </ToolbarSelect>
        </div>

        {/* Right */}
        <div style={{ display:'flex', alignItems:'center', gap:14, flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ fontSize:12, color:C.tx3, fontFamily:font, fontWeight: 500 }}>
              {filtered.length}{filtered.length!==rewards.length?` / ${rewards.length}`:''} reward
            </span>
            <LiveBadge status={syncStatus}/>
          </div>
          {/* TOMBOL TAMBAH VOUCHER BARU */}
          <button 
            onClick={() => setShowAdd(true)} 
            className="gc-btn-primary" 
            style={{ 
              height:36, padding:'0 16px', borderRadius:10, border:'none', 
              background:C.blue, color:'#fff', fontFamily:font, fontSize:13, 
              fontWeight:600, cursor:'pointer', display:'inline-flex', 
              alignItems:'center', gap:6, boxShadow:'0 2px 10px rgba(58,86,232,.25)' 
            }}
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              <path d="M12 4.5v15m7.5-7.5h-15"/>
            </svg>
            Tambah Voucher
          </button>
        </div>
      </div>

      {/* Ticket list */}
      {rewards.length===0 && syncStatus!=='connecting' ? (
        <div style={{ background:C.white, borderRadius:18, border:`1px solid ${C.border}`, boxShadow:C.shadow, padding:'70px 24px', textAlign:'center' }}>
          <p style={{ fontSize:15, fontWeight:700, color:C.tx1, marginBottom:6, fontFamily:font }}>Belum ada reward</p>
          <p style={{ fontSize:13, color:C.tx3, marginBottom:22, fontFamily:font }}>Mulai tambahkan voucher pertama kamu.</p>
          <button onClick={()=>setShowAdd(true)} className="gc-btn-primary" style={{ height:40, padding:'0 22px', borderRadius:10, border:'none', background:C.blue, color:'#fff', fontFamily:font, fontSize:13.5, fontWeight:600, cursor:'pointer', boxShadow:'0 4px 16px rgba(58,86,232,.30)' }}>
            + Tambah Voucher Pertama
          </button>
        </div>
      ) : filtered.length===0 ? (
        <div style={{ background:C.white, borderRadius:18, border:`1px solid ${C.border}`, boxShadow:C.shadow, padding:'50px 24px', textAlign:'center' }}>
          <p style={{ fontSize:14, fontWeight:700, color:C.tx1, marginBottom:6, fontFamily:font }}>Tidak ada hasil</p>
          <p style={{ fontSize:12.5, color:C.tx3, fontFamily:font }}>{syncStatus==='connecting'?'Memuat data…':'Tidak ada reward yang cocok dengan filter ini.'}</p>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {filtered.map((reward, i) => (
            <div key={reward.id} style={{ animation:`gcSlideUp .24s ease both`, animationDelay:`${i*30}ms` }}>
              <RewardCard
                reward={{ ...reward, isActive: togglingId===reward.id ? !reward.isActive : reward.isActive }}
                onEdit={()=>setEditTarget(reward)}
                onDelete={()=>setDeleteTarget(reward)}
                onToggleActive={()=>handleToggleActive(reward)}
              />
            </div>
          ))}
          <div style={{ animation:`gcSlideUp .24s ease both`, animationDelay:`${filtered.length*30}ms` }}>
            <AddTicket onClick={()=>setShowAdd(true)}/>
          </div>
        </div>
      )}

      {/* Modals */}
      {editTarget   && <RewardModal reward={editTarget} onClose={()=>setEditTarget(null)} onSaved={msg=>{showToast(msg);setEditTarget(null);}}/>}
      {showAdd      && <RewardModal reward={null} onClose={()=>setShowAdd(false)} onSaved={msg=>{showToast(msg);setShowAdd(false);}}/>}
      {deleteTarget && <DeleteModal reward={deleteTarget} onClose={()=>setDeleteTarget(null)} onDeleted={msg=>{showToast(msg);setDeleteTarget(null);}}/>}
      {toast        && <Toast msg={toast.msg} type={toast.type} onDone={()=>setToast(null)}/>}
    </>
  );
}