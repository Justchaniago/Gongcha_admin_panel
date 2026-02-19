"use client";

import { useState, useMemo } from "react";
import { Store } from "@/types/firestore";

type StoreWithId = Store & { id: string };

const C = {
  bg:      '#F4F6FB',
  white:   '#FFFFFF',
  border:  '#EAECF2',
  border2: '#F0F2F7',
  tx1:     '#0F1117',
  tx2:     '#4A5065',
  tx3:     '#9299B0',
  tx4:     '#BCC1D3',
  blue:    '#4361EE',
  blueL:   '#EEF2FF',
  blueD:   '#3A0CA3',
  green:   '#12B76A',
  greenBg: '#ECFDF3',
  red:     '#C8102E',
  redBg:   '#FEF3F2',
  shadow:  '0 1px 3px rgba(16,24,40,.06), 0 1px 2px rgba(16,24,40,.04)',
  shadowLg:'0 20px 60px rgba(16,24,40,.18), 0 4px 12px rgba(16,24,40,.08)',
} as const;

const font = "'Plus Jakarta Sans', system-ui, sans-serif";

// ── Primitives ────────────────────────────────────────────────────────────────

function StatusPill({ active }: { active: boolean }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '4px 11px', borderRadius: 99,
      background: active ? C.greenBg : C.border2,
      color: active ? '#027A48' : C.tx3,
      fontSize: 11, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase',
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: active ? C.green : C.tx4 }} />
      {active ? 'Aktif' : 'Nonaktif'}
    </span>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label style={{
      display: 'block', marginBottom: 6, fontSize: 11, fontWeight: 700,
      letterSpacing: '.06em', textTransform: 'uppercase', color: C.tx3,
    }}>{children}</label>
  );
}

function GcInput({ style, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  const [focus, setFocus] = useState(false);
  return (
    <input {...props}
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
      style={{
        width: '100%', height: 42, borderRadius: 9, outline: 'none',
        border: `1.5px solid ${focus ? C.blue : C.border}`,
        background: focus ? C.white : C.bg,
        boxShadow: focus ? '0 0 0 3px rgba(67,97,238,.1)' : 'none',
        padding: '0 13px', fontFamily: font, fontSize: 13.5, color: C.tx1,
        transition: 'border-color .14s, box-shadow .14s, background .14s',
        ...style,
      }}
    />
  );
}

function GcTextarea({ style, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const [focus, setFocus] = useState(false);
  return (
    <textarea {...props} rows={3}
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
      style={{
        width: '100%', borderRadius: 9, outline: 'none', resize: 'vertical',
        border: `1.5px solid ${focus ? C.blue : C.border}`,
        background: focus ? C.white : C.bg,
        boxShadow: focus ? '0 0 0 3px rgba(67,97,238,.1)' : 'none',
        padding: '10px 13px', fontFamily: font, fontSize: 13.5,
        color: C.tx1, lineHeight: 1.5,
        transition: 'border-color .14s, box-shadow .14s, background .14s',
        ...style,
      }}
    />
  );
}

function GcBtn({ variant = 'ghost', children, disabled, onClick, style }: {
  variant?: 'ghost' | 'primary'; children: React.ReactNode;
  disabled?: boolean; onClick?: () => void; style?: React.CSSProperties;
}) {
  const [h, setH] = useState(false);
  return (
    <button onClick={disabled ? undefined : onClick}
      onMouseOver={() => setH(true)} onMouseOut={() => setH(false)}
      style={{
        height: 40, padding: '0 20px', borderRadius: 9, fontFamily: font,
        fontSize: 13.5, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'inline-flex', alignItems: 'center', gap: 7,
        transition: 'all .15s', opacity: disabled ? .55 : 1,
        ...(variant === 'ghost'
          ? { background: h ? C.bg : C.white, color: C.tx2, border: `1.5px solid ${C.border}` }
          : { background: h ? C.red : C.tx1, color: '#fff', transform: h ? 'translateY(-1px)' : 'none',
              boxShadow: h ? '0 4px 14px rgba(200,16,46,.28)' : 'none' }),
        ...style,
      }}>
      {children}
    </button>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────
function StoreModal({ store, onClose, onSaved }: {
  store: StoreWithId | null; onClose: () => void; onSaved: (s: StoreWithId) => void;
}) {
  const isNew = !store;
  const [form, setForm] = useState({
    name:      store?.name       ?? '',
    address:   store?.address    ?? '',
    city:      (store as any)?.city       ?? '',
    phone:     (store as any)?.phone      ?? '',
    latitude:  store?.latitude   ?? '',
    longitude: store?.longitude  ?? '',
    isActive:  store?.isActive   ?? true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  async function handleSave() {
    if (!form.name.trim()) { setError('Nama outlet wajib diisi.'); return; }
    setLoading(true); setError('');
    try {
      const method = isNew ? 'POST' : 'PATCH';
      const url    = isNew ? '/api/stores' : `/api/stores/${store!.id}`;
      const res    = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error('Gagal menyimpan.');
      const saved = await res.json();
      // Ensure all required Store fields are present
      const base: Partial<Store> = store ?? {};
      onSaved({
        id: saved.id ?? store?.id ?? crypto.randomUUID(),
        name: form.name,
        address: form.address,
        latitude: form.latitude === '' ? 0 : Number(form.latitude),
        longitude: form.longitude === '' ? 0 : Number(form.longitude),
        isActive: form.isActive,
        openHours: (base as any).openHours ?? '',
        statusOverride: (base as any).statusOverride ?? 'open',
      });
    } catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  }

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }} style={{
      position: 'fixed', inset: 0, zIndex: 50,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      background: 'rgba(10,12,20,.52)', backdropFilter: 'blur(8px)',
      animation: 'gcFadeIn .18s ease', fontFamily: font,
    }}>
      <div style={{
        background: C.white, borderRadius: 22, width: '100%', maxWidth: 520,
        maxHeight: '92vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
        boxShadow: C.shadowLg, animation: 'gcRise .26s cubic-bezier(.22,.68,0,1.15) both',
      }}>
        {/* Head */}
        <div style={{
          padding: '24px 28px 18px', borderBottom: `1px solid ${C.border2}`,
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexShrink: 0,
        }}>
          <div>
            <p style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.14em',
              textTransform: 'uppercase', color: C.blue, marginBottom: 4 }}>
              {isNew ? 'Outlet Baru' : 'Edit Outlet'}
            </p>
            <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.02em', color: C.tx1, margin: 0 }}>
              {isNew ? 'Tambah Store' : store!.name}
            </h2>
          </div>
          <button onClick={onClose} style={{
            width: 34, height: 34, borderRadius: 9, cursor: 'pointer',
            border: `1.5px solid ${C.border}`, background: 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
            onMouseOver={e => (e.currentTarget.style.background = C.bg)}
            onMouseOut={e => (e.currentTarget.style.background = 'transparent')}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M1 1l10 10M11 1L1 11" stroke={C.tx3} strokeWidth="1.7" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '22px 28px' }}>
          {/* Info */}
          <p style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase',
            color: C.tx3, marginBottom: 14, paddingBottom: 10, borderBottom: `1px solid ${C.border2}` }}>
            Informasi Outlet
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 22 }}>
            <div>
              <FieldLabel>Nama Outlet *</FieldLabel>
              <GcInput placeholder="Gong Cha Grand Indonesia" value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <FieldLabel>Kota</FieldLabel>
                <GcInput placeholder="Jakarta" value={form.city}
                  onChange={e => setForm(p => ({ ...p, city: e.target.value }))} />
              </div>
              <div>
                <FieldLabel>No. Telepon</FieldLabel>
                <GcInput placeholder="+62 21 xxxx" value={form.phone}
                  onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
              </div>
            </div>
            <div>
              <FieldLabel>Alamat Lengkap</FieldLabel>
              <GcTextarea placeholder="Lt. 3 Grand Indonesia, Jakarta..." value={form.address}
                onChange={e => setForm(p => ({ ...p, address: e.target.value }))} />
            </div>
          </div>

          {/* GPS */}
          <p style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase',
            color: C.tx3, marginBottom: 14, paddingBottom: 10, borderBottom: `1px solid ${C.border2}` }}>
            Koordinat GPS
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
            <div>
              <FieldLabel>Latitude</FieldLabel>
              <GcInput type="number" step="any" placeholder="-6.195123"
                value={String(form.latitude)}
                onChange={e => setForm(p => ({ ...p, latitude: e.target.value }))} />
            </div>
            <div>
              <FieldLabel>Longitude</FieldLabel>
              <GcInput type="number" step="any" placeholder="106.821456"
                value={String(form.longitude)}
                onChange={e => setForm(p => ({ ...p, longitude: e.target.value }))} />
            </div>
          </div>

          {form.latitude && form.longitude && (
            <a href={`https://maps.google.com/?q=${form.latitude},${form.longitude}`}
              target="_blank" rel="noopener noreferrer" style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                fontSize: 12.5, fontWeight: 600, color: C.blue, textDecoration: 'none',
                padding: '8px 14px', borderRadius: 9,
                background: C.blueL, border: `1.5px solid rgba(67,97,238,.2)`,
                marginBottom: 20,
              }}>
              <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
              </svg>
              Preview di Google Maps ↗
            </a>
          )}

          {/* Status toggle */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 16px', borderRadius: 12, background: C.bg, border: `1.5px solid ${C.border}`,
          }}>
            <div>
              <p style={{ fontSize: 13.5, fontWeight: 600, color: C.tx1, marginBottom: 2 }}>Status Operasional</p>
              <p style={{ fontSize: 12, color: C.tx3 }}>
                {form.isActive ? 'Aktif dan terlihat di aplikasi member' : 'Disembunyikan dari aplikasi'}
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <StatusPill active={form.isActive} />
              <button type="button" onClick={() => setForm(p => ({ ...p, isActive: !p.isActive }))} style={{
                width: 42, height: 24, borderRadius: 99, border: 'none', cursor: 'pointer',
                background: form.isActive ? C.blue : C.border, position: 'relative', transition: 'background .2s',
              }}>
                <span style={{
                  position: 'absolute', top: 3, borderRadius: '50%',
                  width: 18, height: 18, background: '#fff',
                  boxShadow: '0 1px 4px rgba(0,0,0,.2)',
                  left: form.isActive ? 21 : 3,
                  transition: 'left .2s cubic-bezier(.34,1.56,.64,1)', display: 'block',
                }} />
              </button>
            </div>
          </div>

          {error && (
            <div style={{ marginTop: 14, padding: '11px 14px', background: C.redBg,
              border: '1px solid #FECDD3', borderRadius: 9, fontSize: 12.5, color: '#B42318' }}>
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 28px 24px', borderTop: `1px solid ${C.border2}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
        }}>
          <p style={{ fontSize: 11.5, color: C.tx3 }}>
            Kolom <span style={{ color: C.red }}>*</span> wajib diisi
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <GcBtn variant="ghost" onClick={onClose}>Batal</GcBtn>
            <GcBtn variant="primary" onClick={handleSave} disabled={loading}>
              {loading ? 'Menyimpan…' : isNew ? 'Tambah Outlet' : 'Simpan Perubahan'}
            </GcBtn>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes gcFadeIn { from{opacity:0}to{opacity:1} }
        @keyframes gcRise { from{opacity:0;transform:translateY(18px) scale(.97)}to{opacity:1;transform:translateY(0) scale(1)} }
      `}</style>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function StoresClient({
  initialStores,
  showAddTrigger,
}: {
  initialStores: StoreWithId[];
  showAddTrigger?: boolean;
}) {
  const [stores, setStores]         = useState<StoreWithId[]>(initialStores);
  const [search, setSearch]         = useState('');
  const [filter, setFilter]         = useState<'all'|'active'|'inactive'>('all');
  const [editTarget, setEditTarget] = useState<StoreWithId | null>(null);
  const [showAdd, setShowAdd]       = useState(false);
  const [searchFocus, setSearchFocus] = useState(false);

  const filtered = useMemo(() => stores.filter(s => {
    const q = search.toLowerCase();
    const ok = !q || s.name?.toLowerCase().includes(q) || s.id?.toLowerCase().includes(q) || (s as any).city?.toLowerCase().includes(q);
    const f  = filter === 'all' || (filter === 'active' ? s.isActive !== false : s.isActive === false);
    return ok && f;
  }), [stores, search, filter]);

  function handleSaved(updated: StoreWithId) {
    setStores(prev =>
      prev.some(s => s.id === updated.id)
        ? prev.map(s => s.id === updated.id ? updated : s)
        : [...prev, updated]
    );
    setEditTarget(null); setShowAdd(false);
  }

  // Header-only Add button (used in page.tsx header)
  if (showAddTrigger) {
    return (
      <>
        <button onClick={() => setShowAdd(true)} style={{
          height: 42, padding: '0 20px', borderRadius: 10, border: 'none',
          background: C.tx1, color: '#fff', fontFamily: font, fontSize: 13.5,
          fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8,
          transition: 'all .15s', boxShadow: C.shadow,
        }}
          onMouseOver={e => { e.currentTarget.style.background = C.red; e.currentTarget.style.transform = 'translateY(-1px)'; }}
          onMouseOut={e => { e.currentTarget.style.background = C.tx1; e.currentTarget.style.transform = 'translateY(0)'; }}>
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15"/>
          </svg>
          Add New Store
        </button>
        {showAdd && <StoreModal store={null} onClose={() => setShowAdd(false)} onSaved={handleSaved} />}
      </>
    );
  }

  return (
    <>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Search */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, height: 40, padding: '0 13px', minWidth: 240,
            background: C.white, border: `1.5px solid ${searchFocus ? C.blue : C.border}`, borderRadius: 10,
            boxShadow: searchFocus ? '0 0 0 3px rgba(67,97,238,.1)' : 'none', transition: 'all .14s',
          }}>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke={C.tx3} strokeWidth={2.2}>
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input style={{
              flex: 1, border: 'none', background: 'transparent', outline: 'none',
              fontFamily: font, fontSize: 13.5, color: C.tx1,
            }} placeholder="Cari outlet, kota…" value={search}
              onChange={e => setSearch(e.target.value)}
              onFocus={() => setSearchFocus(true)}
              onBlur={() => setSearchFocus(false)} />
            {search && (
              <button onClick={() => setSearch('')} style={{
                background: 'none', border: 'none', cursor: 'pointer', color: C.tx3, fontSize: 15, padding: 0,
              }}>✕</button>
            )}
          </div>

          {/* Filter tabs */}
          <div style={{
            display: 'flex', background: C.bg, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: 3,
          }}>
            {(['all', 'active', 'inactive'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{
                padding: '5px 16px', borderRadius: 7, border: 'none', fontFamily: font,
                fontSize: 12.5, fontWeight: 600, cursor: 'pointer', transition: 'all .13s',
                background: filter === f ? C.white : 'transparent',
                color: filter === f ? C.tx1 : C.tx3,
                boxShadow: filter === f ? C.shadow : 'none',
              }}>
                {f === 'all' ? 'Semua' : f === 'active' ? 'Aktif' : 'Nonaktif'}
              </button>
            ))}
          </div>
        </div>

        <span style={{ fontSize: 12.5, color: C.tx3, fontWeight: 500 }}>
          {filtered.length} dari {stores.length} outlet
        </span>
      </div>

      {/* Table */}
      <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 18, boxShadow: C.shadow, overflow: 'hidden' }}>
        {filtered.length === 0 ? (
          <div style={{ padding: '60px 24px', textAlign: 'center' }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: C.blueL,
              margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke={C.blue} strokeWidth={1.8}>
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
              </svg>
            </div>
            <p style={{ fontSize: 15, fontWeight: 700, color: C.tx1, marginBottom: 6 }}>Outlet tidak ditemukan</p>
            <p style={{ fontSize: 13, color: C.tx3 }}>
              {search ? `Tidak ada hasil untuk "${search}"` : 'Belum ada outlet yang terdaftar.'}
            </p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: font }}>
            <thead>
              <tr style={{ background: '#F8F9FC' }}>
                {['Outlet', 'Kota', 'Alamat', 'Koordinat GPS', 'Status', ''].map((h, i) => (
                  <th key={i} style={{
                    padding: '11px 20px', textAlign: 'left',
                    fontSize: 11, fontWeight: 700, letterSpacing: '.08em',
                    textTransform: 'uppercase', color: C.tx3,
                    borderBottom: `1px solid ${C.border2}`,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((store, i) => (
                <StoreRow key={store.id} store={store}
                  isLast={i === filtered.length - 1}
                  onEdit={() => setEditTarget(store)} />
              ))}
            </tbody>
          </table>
        )}

        <div style={{ padding: '12px 20px', borderTop: `1px solid ${C.border2}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ fontSize: 12, color: C.tx3 }}>
            <strong style={{ color: C.tx2 }}>{stores.filter(s => s.isActive !== false).length}</strong> aktif ·{' '}
            <strong style={{ color: C.tx2 }}>{stores.filter(s => s.isActive === false).length}</strong> nonaktif ·{' '}
            <strong style={{ color: C.tx2 }}>{stores.filter(s => s.latitude && s.longitude).length}</strong> dengan GPS
          </p>
          <button onClick={() => setShowAdd(true)} style={{
            height: 34, padding: '0 16px', borderRadius: 8, background: C.tx1, color: '#fff',
            border: 'none', fontFamily: font, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 6, transition: 'background .13s',
          }}
            onMouseOver={e => (e.currentTarget.style.background = C.red)}
            onMouseOut={e => (e.currentTarget.style.background = C.tx1)}>
            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15"/>
            </svg>
            Add Store
          </button>
        </div>
      </div>

      {editTarget && <StoreModal store={editTarget} onClose={() => setEditTarget(null)} onSaved={handleSaved} />}
      {showAdd    && <StoreModal store={null}        onClose={() => setShowAdd(false)}   onSaved={handleSaved} />}
    </>
  );
}

// ── Row ───────────────────────────────────────────────────────────────────────
function StoreRow({ store, isLast, onEdit }: {
  store: StoreWithId; isLast: boolean; onEdit: () => void;
}) {
  const [h, setH]   = useState(false);
  const [bh, setBH] = useState(false);
  const hasGPS = !!(store.latitude && store.longitude);

  return (
    <tr onMouseOver={() => setH(true)} onMouseOut={() => setH(false)} style={{
      borderBottom: isLast ? 'none' : `1px solid ${C.border2}`,
      background: h ? '#F8F9FC' : C.white, transition: 'background .1s',
    }}>
      <td style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: C.blueL,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="17" height="17" fill="none" viewBox="0 0 24 24" stroke={C.blue} strokeWidth={2}>
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
            </svg>
          </div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: C.tx1, marginBottom: 2 }}>{store.name ?? '—'}</p>
            <code style={{ fontSize: 10.5, color: C.tx3, background: C.bg, padding: '1px 6px', borderRadius: 5, border: `1px solid ${C.border2}` }}>
              {store.id}
            </code>
          </div>
        </div>
      </td>
      <td style={{ padding: '16px 20px', fontSize: 13.5, color: C.tx2, fontWeight: 500 }}>
        {(store as any).city ?? '—'}
      </td>
      <td style={{ padding: '16px 20px' }}>
        <p style={{ fontSize: 13, color: C.tx2, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {store.address ?? <span style={{ color: C.tx4 }}>Belum diset</span>}
        </p>
      </td>
      <td style={{ padding: '16px 20px' }}>
        {hasGPS ? (
          <a href={`https://maps.google.com/?q=${store.latitude},${store.longitude}`}
            target="_blank" rel="noopener noreferrer" style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12,
              fontWeight: 600, color: C.blue, textDecoration: 'none',
              padding: '4px 10px', borderRadius: 7, fontFamily: 'monospace',
              background: C.blueL, border: `1px solid rgba(67,97,238,.15)`,
            }}>
            <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
            </svg>
            {Number(store.latitude).toFixed(4)}, {Number(store.longitude).toFixed(4)}
          </a>
        ) : (
          <span style={{ fontSize: 12, color: C.tx4, padding: '4px 10px', borderRadius: 7,
            background: C.bg, border: `1px solid ${C.border2}` }}>Belum diset</span>
        )}
      </td>
      <td style={{ padding: '16px 20px' }}><StatusPill active={store.isActive !== false} /></td>
      <td style={{ padding: '16px 20px' }}>
        <button onClick={onEdit}
          onMouseOver={() => setBH(true)} onMouseOut={() => setBH(false)} style={{
            height: 34, padding: '0 16px', borderRadius: 8, fontFamily: font,
            fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
            border: `1.5px solid ${bh ? C.blue : C.border}`,
            background: bh ? C.blueL : C.white, color: bh ? C.blue : C.tx2,
            display: 'inline-flex', alignItems: 'center', gap: 6, transition: 'all .13s',
          }}>
          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
          </svg>
          Edit
        </button>
      </td>
    </tr>
  );
}