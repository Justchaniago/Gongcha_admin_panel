"use client";
// src/app/dashboard/stores/StoresClient.tsx

import { useState, useMemo, useEffect, useCallback } from "react";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { Store } from "@/types/firestore";

type StoreWithId = Store & { id: string };
type SyncStatus  = "connecting" | "live" | "error";
type StatusOverride = "open" | "closed" | "almost_close";

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
      {active ? 'Aktif' : 'Nonaktif'}
    </span>
  );
}

function StatusOverridePill({ status }: { status: StatusOverride }) {
  const cfg = {
    open:         { label: 'Buka',        color: '#027A48', bg: C.greenBg  },
    almost_close: { label: 'Mau Tutup',   color: '#92400E', bg: C.orangeBg },
    closed:       { label: 'Tutup',       color: '#B42318', bg: C.redBg    },
  }[status] ?? { label: status, color: C.tx3, bg: C.border2 };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 9px', borderRadius: 99, background: cfg.bg, color: cfg.color, fontSize: 11, fontWeight: 700, letterSpacing: '.04em' }}>
      {cfg.label}
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

// ── Delete Modal ───────────────────────────────────────────────────────────────
function DeleteModal({ store, onClose, onDeleted }: { store: StoreWithId; onClose: () => void; onDeleted: (msg: string) => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function confirm() {
    setLoading(true); setError('');
    try {
      const r = await fetch(`/api/stores/${store.id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message ?? 'Gagal menghapus.');
      onDeleted(`"${store.name}" berhasil dihapus.`);
      onClose();
    } catch (e: any) { setError(e.message); setLoading(false); }
  }

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }} style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'rgba(10,12,20,.52)', backdropFilter: 'blur(8px)', fontFamily: font }}>
      <div style={{ background: C.white, borderRadius: 20, width: '100%', maxWidth: 420, boxShadow: C.shadowLg, padding: '32px 28px', animation: 'gcRise .22s ease' }}>
        <div style={{ width: 52, height: 52, borderRadius: 14, background: C.redBg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
          <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke={C.red} strokeWidth={2}><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: C.tx1, marginBottom: 8 }}>Hapus Outlet?</h2>
        <p style={{ fontSize: 13.5, color: C.tx2, lineHeight: 1.6, marginBottom: 6 }}>Outlet <strong>"{store.name}"</strong> akan dihapus permanen dari Firestore.</p>
        <code style={{ fontSize: 11, color: C.tx3, background: C.bg, padding: '4px 8px', borderRadius: 6, display: 'inline-block', marginBottom: 18 }}>ID: {store.id}</code>
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

// ── Store Modal ────────────────────────────────────────────────────────────────
// Form fields = exact Firestore document fields
type StoreForm = {
  storeId:        string;   // document ID (hanya saat create)
  name:           string;
  address:        string;
  latitude:       string;
  longitude:      string;
  openHours:      string;
  statusOverride: StatusOverride;
  isActive:       boolean;
};

function StoreModal({ store, onClose, onSaved }: {
  store: StoreWithId | null; onClose: () => void; onSaved: (msg: string) => void;
}) {
  const isNew = !store;

  const [form, setForm] = useState<StoreForm>({
    storeId:        store?.id              ?? '',
    name:           store?.name            ?? '',
    address:        store?.address         ?? '',
    latitude:       store?.latitude  != null ? String(store.latitude)  : '',
    longitude:      store?.longitude != null ? String(store.longitude) : '',
    openHours:      store?.openHours       ?? '',
    statusOverride: (store?.statusOverride as StatusOverride) ?? 'open',
    isActive:       store?.isActive        ?? true,
  });

  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [idTouched, setIdTouched] = useState(false);

  // Auto-generate ID suggestion dari nama
  useEffect(() => {
    if (!isNew || idTouched) return;
    const suggested = 'store_' + form.name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .trim()
      .split(/\s+/)
      .map(w => w.slice(0, 3))
      .join('')
      .slice(0, 10);
    setForm(p => ({ ...p, storeId: suggested }));
  }, [form.name, isNew, idTouched]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const set = (k: keyof StoreForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));

  async function handleSave() {
    if (!form.name.trim()) { setError('Nama outlet wajib diisi.'); return; }
    if (isNew && !form.storeId.trim()) { setError('Store ID wajib diisi.'); return; }

    setLoading(true); setError('');
    try {
      const method = isNew ? 'POST' : 'PATCH';
      const url    = isNew ? '/api/stores' : `/api/stores/${store!.id}`;

      const payload = {
        ...(isNew ? { storeId: form.storeId.trim() } : {}),
        name:           form.name.trim(),
        address:        form.address.trim(),
        latitude:       form.latitude  !== '' ? Number(form.latitude)  : null,
        longitude:      form.longitude !== '' ? Number(form.longitude) : null,
        openHours:      form.openHours.trim(),
        statusOverride: form.statusOverride,
        isActive:       form.isActive,
      };

      const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message ?? 'Gagal menyimpan.');

      onSaved(isNew ? `Outlet "${form.name}" berhasil ditambahkan!` : `"${form.name}" berhasil diperbarui.`);
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
            <p style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: C.blue, marginBottom: 4 }}>{isNew ? 'Outlet Baru' : 'Edit Outlet'}</p>
            <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.02em', color: C.tx1, margin: 0 }}>{isNew ? 'Tambah Store' : store!.name}</h2>
            {!isNew && <code style={{ fontSize: 11, color: C.tx3, background: C.bg, padding: '2px 8px', borderRadius: 6, border: `1px solid ${C.border2}`, display: 'inline-block', marginTop: 4 }}>ID: {store!.id}</code>}
          </div>
          <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: 9, cursor: 'pointer', border: `1.5px solid ${C.border}`, background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onMouseOver={e => (e.currentTarget.style.background = C.bg)}
            onMouseOut={e  => (e.currentTarget.style.background = 'transparent')}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1 1l10 10M11 1L1 11" stroke={C.tx3} strokeWidth="1.7" strokeLinecap="round"/></svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* ── Document ID (hanya saat create) ── */}
          {isNew && (
            <div>
              {section('Document ID')}
              <div>
                <FL required>Store ID</FL>
                <GcInput
                  placeholder="store_abc (huruf kecil, angka, underscore)"
                  value={form.storeId}
                  onChange={e => { setIdTouched(true); setForm(p => ({ ...p, storeId: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '') })); }}
                />
                <p style={{ fontSize: 11.5, color: C.tx3, marginTop: 5 }}>
                  Akan menjadi document ID di Firestore. Contoh: <code style={{ background: C.bg, padding: '1px 5px', borderRadius: 4, border: `1px solid ${C.border2}` }}>store_tp6</code>. Tidak bisa diubah setelah disimpan.
                </p>
              </div>
            </div>
          )}

          {/* ── Info Outlet ── */}
          {section('Informasi Outlet')}
          <div>
            <FL required>Nama Outlet</FL>
            <GcInput placeholder="Gong Cha Grand Indonesia" value={form.name} onChange={set('name')}/>
          </div>
          <div>
            <FL>Alamat Lengkap</FL>
            <GcTextarea placeholder="Lt. 3 Grand Indonesia, Jl. M.H. Thamrin No.1, Jakarta..." value={form.address} onChange={set('address')}/>
          </div>

          {/* ── GPS ── */}
          {section('Koordinat GPS')}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <FL>Latitude</FL>
              <GcInput type="number" step="any" placeholder="-6.195123" value={form.latitude} onChange={set('latitude')}/>
            </div>
            <div>
              <FL>Longitude</FL>
              <GcInput type="number" step="any" placeholder="106.821456" value={form.longitude} onChange={set('longitude')}/>
            </div>
          </div>
          {form.latitude && form.longitude && (
            <a href={`https://maps.google.com/?q=${form.latitude},${form.longitude}`} target="_blank" rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 600, color: C.blue, textDecoration: 'none', padding: '8px 14px', borderRadius: 9, background: C.blueL, border: `1.5px solid rgba(67,97,238,.2)`, width: 'fit-content' }}>
              <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
              Preview di Google Maps ↗
            </a>
          )}

          {/* ── Operasional ── */}
          {section('Operasional')}
          <div>
            <FL>Jam Buka (openHours)</FL>
            <GcInput placeholder="10:00 - 22:00" value={form.openHours} onChange={set('openHours')}/>
            <p style={{ fontSize: 11.5, color: C.tx3, marginTop: 4 }}>Format bebas, misal: "10:00 - 22:00" atau "10:00 - 21:45"</p>
          </div>
          <div>
            <FL>Status Override (statusOverride)</FL>
            <GcSelect value={form.statusOverride} onChange={set('statusOverride')}>
              <option value="open">open — Sedang buka normal</option>
              <option value="almost_close">almost_close — Hampir tutup</option>
              <option value="closed">closed — Tutup</option>
            </GcSelect>
            <p style={{ fontSize: 11.5, color: C.tx3, marginTop: 4 }}>Ditampilkan di aplikasi member sebagai status real-time outlet.</p>
          </div>

          {/* ── isActive toggle ── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderRadius: 12, background: C.bg, border: `1.5px solid ${C.border}` }}>
            <div>
              <p style={{ fontSize: 13.5, fontWeight: 600, color: C.tx1, marginBottom: 2 }}>isActive</p>
              <p style={{ fontSize: 12, color: C.tx3 }}>{form.isActive ? 'Outlet terlihat di aplikasi member' : 'Outlet disembunyikan dari aplikasi'}</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <StatusPill active={form.isActive}/>
              <button type="button" onClick={() => setForm(p => ({ ...p, isActive: !p.isActive }))}
                style={{ width: 42, height: 24, borderRadius: 99, border: 'none', cursor: 'pointer', background: form.isActive ? C.blue : C.border, position: 'relative', transition: 'background .2s' }}>
                <span style={{ position: 'absolute', top: 3, borderRadius: '50%', width: 18, height: 18, background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,.2)', left: form.isActive ? 21 : 3, transition: 'left .2s cubic-bezier(.34,1.56,.64,1)', display: 'block' }}/>
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
            <button onClick={handleSave} disabled={loading}
              style={{ height: 40, padding: '0 22px', borderRadius: 9, border: 'none', background: loading ? '#9ca3af' : C.tx1, color: '#fff', fontFamily: font, fontSize: 13.5, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', transition: 'all .15s', display: 'inline-flex', alignItems: 'center', gap: 7 }}>
              {loading ? 'Menyimpan…' : isNew ? '+ Tambah Outlet' : 'Simpan Perubahan'}
            </button>
          </div>
        </div>
      </div>
      <style>{`@keyframes gcFadeIn{from{opacity:0}to{opacity:1}}@keyframes gcRise{from{opacity:0;transform:translateY(18px) scale(.97)}to{opacity:1;transform:none}}`}</style>
    </div>
  );
}

// ── Table Row ──────────────────────────────────────────────────────────────────
function StoreRow({ store, isLast, onEdit, onDelete }: { store: StoreWithId; isLast: boolean; onEdit: () => void; onDelete: () => void }) {
  const [h, setH]   = useState(false);
  const [bh, setBH] = useState(false);
  const [dh, setDH] = useState(false);
  const hasGPS = !!(store.latitude && store.longitude);

  return (
    <tr onMouseOver={() => setH(true)} onMouseOut={() => setH(false)}
      style={{ borderBottom: isLast ? 'none' : `1px solid ${C.border2}`, background: h ? '#F8F9FC' : C.white, transition: 'background .1s' }}>
      <td style={{ padding: '14px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: C.blueL, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke={C.blue} strokeWidth={2}><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>
          </div>
          <div>
            <p style={{ fontSize: 13.5, fontWeight: 700, color: C.tx1, marginBottom: 1 }}>{store.name ?? '—'}</p>
            <code style={{ fontSize: 10, color: C.tx3, background: C.bg, padding: '1px 5px', borderRadius: 4, border: `1px solid ${C.border2}` }}>{store.id}</code>
          </div>
        </div>
      </td>
      <td style={{ padding: '14px 18px', fontSize: 12.5, color: C.tx2 }}>{store.address ? <span style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{store.address}</span> : <span style={{ color: C.tx4 }}>—</span>}</td>
      <td style={{ padding: '14px 18px', fontSize: 12.5, color: C.tx2 }}>{store.openHours || <span style={{ color: C.tx4 }}>—</span>}</td>
      <td style={{ padding: '14px 18px' }}>
        {hasGPS ? (
          <a href={`https://maps.google.com/?q=${store.latitude},${store.longitude}`} target="_blank" rel="noopener noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 600, color: C.blue, textDecoration: 'none', padding: '3px 9px', borderRadius: 6, background: C.blueL, border: `1px solid rgba(67,97,238,.15)` }}>
            <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
            {Number(store.latitude).toFixed(3)}, {Number(store.longitude).toFixed(3)}
          </a>
        ) : <span style={{ fontSize: 11.5, color: C.tx4, padding: '3px 9px', borderRadius: 6, background: C.bg, border: `1px solid ${C.border2}` }}>Belum diset</span>}
      </td>
      <td style={{ padding: '14px 18px' }}><StatusOverridePill status={(store.statusOverride as StatusOverride) ?? 'open'}/></td>
      <td style={{ padding: '14px 18px' }}><StatusPill active={store.isActive !== false}/></td>
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
export default function StoresClient({ initialStores, showAddTrigger }: { initialStores: StoreWithId[]; showAddTrigger?: boolean }) {
  const [stores,       setStores]       = useState<StoreWithId[]>(initialStores);
  const [syncStatus,   setSyncStatus]   = useState<SyncStatus>("connecting");
  const [search,       setSearch]       = useState('');
  const [filter,       setFilter]       = useState<'all'|'active'|'inactive'>('all');
  const [editTarget,   setEditTarget]   = useState<StoreWithId | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StoreWithId | null>(null);
  const [showAdd,      setShowAdd]      = useState(false);
  const [toast,        setToast]        = useState<{msg:string;type:'success'|'error'}|null>(null);
  const [searchFocus,  setSearchFocus]  = useState(false);

  const showToast = useCallback((msg: string, type: 'success'|'error' = 'success') => setToast({ msg, type }), []);

  // ── Realtime onSnapshot ─────────────────────────────────────────────────────
  useEffect(() => {
    const q = query(collection(db, "stores"), orderBy("name"));
    const unsub = onSnapshot(q,
      snap => { setStores(snap.docs.map(d => ({ id: d.id, ...d.data() } as StoreWithId))); setSyncStatus("live"); },
      err  => { console.error("[stores onSnapshot]", err); setSyncStatus("error"); }
    );
    return () => unsub();
  }, []);

  const filtered = useMemo(() => stores.filter(s => {
    const q  = search.toLowerCase();
    const ok = !q || s.name?.toLowerCase().includes(q) || s.id?.toLowerCase().includes(q) || s.address?.toLowerCase().includes(q);
    const f  = filter === 'all' || (filter === 'active' ? s.isActive !== false : s.isActive === false);
    return ok && f;
  }), [stores, search, filter]);

  // Header trigger mode
  if (showAddTrigger) {
    return (
      <>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <LiveBadge status={syncStatus}/>
          <button onClick={() => setShowAdd(true)} style={{ height: 42, padding: '0 20px', borderRadius: 10, border: 'none', background: C.tx1, color: '#fff', fontFamily: font, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8, transition: 'all .15s' }}
            onMouseOver={e => { e.currentTarget.style.background = C.red; e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseOut={e  => { e.currentTarget.style.background = C.tx1; e.currentTarget.style.transform = 'none'; }}>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>
            Tambah Outlet
          </button>
        </div>
        {showAdd && <StoreModal store={null} onClose={() => setShowAdd(false)} onSaved={msg => { showToast(msg); setShowAdd(false); }}/>}
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
            <input style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontFamily: font, fontSize: 13.5, color: C.tx1 }} placeholder="Cari nama, ID, alamat…" value={search} onChange={e => setSearch(e.target.value)} onFocus={() => setSearchFocus(true)} onBlur={() => setSearchFocus(false)}/>
            {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.tx3, fontSize: 15, padding: 0 }}>✕</button>}
          </div>
          <div style={{ display: 'flex', background: C.bg, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: 3 }}>
            {(['all', 'active', 'inactive'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{ padding: '5px 14px', borderRadius: 7, border: 'none', fontFamily: font, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', transition: 'all .13s', background: filter === f ? C.white : 'transparent', color: filter === f ? C.tx1 : C.tx3, boxShadow: filter === f ? C.shadow : 'none' }}>
                {f === 'all' ? 'Semua' : f === 'active' ? 'Aktif' : 'Nonaktif'}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <LiveBadge status={syncStatus}/>
          <span style={{ fontSize: 12.5, color: C.tx3 }}>{filtered.length} / {stores.length} outlet</span>
        </div>
      </div>

      {/* Table */}
      <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 18, boxShadow: C.shadow, overflow: 'hidden' }}>
        {filtered.length === 0 ? (
          <div style={{ padding: '60px 24px', textAlign: 'center' }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: C.tx1, marginBottom: 6 }}>Outlet tidak ditemukan</p>
            <p style={{ fontSize: 13, color: C.tx3 }}>{syncStatus === 'connecting' ? 'Memuat data…' : search ? `Tidak ada hasil untuk "${search}"` : 'Belum ada outlet terdaftar.'}</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: font }}>
            <thead>
              <tr style={{ background: '#F8F9FC' }}>
                {['Outlet / ID', 'Alamat', 'Jam Buka', 'GPS', 'Status Override', 'isActive', ''].map((h, i) => (
                  <th key={i} style={{ padding: '11px 18px', textAlign: 'left', fontSize: 10.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: C.tx3, borderBottom: `1px solid ${C.border2}`, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, i) => (
                <StoreRow key={s.id} store={s} isLast={i === filtered.length - 1}
                  onEdit={() => setEditTarget(s)}
                  onDelete={() => setDeleteTarget(s)}
                />
              ))}
            </tbody>
          </table>
        )}

        <div style={{ padding: '12px 18px', borderTop: `1px solid ${C.border2}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ fontSize: 12, color: C.tx3 }}>
            <strong style={{ color: C.tx2 }}>{stores.filter(s => s.isActive !== false).length}</strong> aktif ·{' '}
            <strong style={{ color: C.tx2 }}>{stores.filter(s => s.isActive === false).length}</strong> nonaktif ·{' '}
            <strong style={{ color: C.tx2 }}>{stores.filter(s => s.latitude && s.longitude).length}</strong> dengan GPS
          </p>
          <button onClick={() => { /* refresh */ }} style={{ height: 34, padding: '0 16px', borderRadius: 8, background: C.bg, color: C.tx2, border: `1px solid ${C.border}`, fontFamily: font, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, marginRight: 10 }} >
            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
            Refresh
          </button>
          <button onClick={() => setShowAdd(true)} style={{ height: 34, padding: '0 16px', borderRadius: 8, background: C.tx1, color: '#fff', border: 'none', fontFamily: font, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
            onMouseOver={e => (e.currentTarget.style.background = C.red)}
            onMouseOut={e  => (e.currentTarget.style.background = C.tx1)}>
            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>
            Tambah Outlet
          </button>
        </div>
      </div>

      {editTarget   && <StoreModal store={editTarget}   onClose={() => setEditTarget(null)}    onSaved={msg => { showToast(msg); setEditTarget(null); }}/>}
      {showAdd      && <StoreModal store={null}          onClose={() => setShowAdd(false)}       onSaved={msg => { showToast(msg); setShowAdd(false); }}/>}
      {deleteTarget && <DeleteModal store={deleteTarget} onClose={() => setDeleteTarget(null)}   onDeleted={msg => { showToast(msg); setDeleteTarget(null); }}/>}

      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)}/>}
    </>
  );
}