"use client";
// src/app/dashboard/stores/StoresClient.tsx

import { useState, useMemo, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { Store, storeConverter } from "@/types/firestore";
import { createStore, updateStore, deleteStore } from "@/actions/storeActions";
import { useAuth } from "@/context/AuthContext";
import { GcButton, GcEmptyState, GcFieldLabel, GcInput, GcModalShell, GcPage, GcPageHeader, GcPanel, GcSelect, GcTextarea, GcToast } from "@/components/ui/gc";

const StoreMapPicker = dynamic(() => import("./StoreMapPicker"), { ssr: false });

type StoreWithId = Store & { id: string };
type SyncStatus  = "connecting" | "live" | "error";
type StatusOverride = "open" | "closed";

function parseTimeToMinutes(value?: string): number | null {
  if (!value) return null;
  const [h, m] = value.split(":").map(Number);
  if (!Number.isInteger(h) || !Number.isInteger(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

function getStoreOpenStatus(store: StoreWithId): "BUKA" | "TUTUP" {
  if (store.isForceClosed) return "TUTUP";

  const openMinutes = parseTimeToMinutes(store.operationalHours?.open);
  const closeMinutes = parseTimeToMinutes(store.operationalHours?.close);

  if (openMinutes === null || closeMinutes === null) return "TUTUP";

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  if (openMinutes === closeMinutes) return "BUKA";

  if (openMinutes < closeMinutes) {
    return nowMinutes >= openMinutes && nowMinutes < closeMinutes ? "BUKA" : "TUTUP";
  }

  return nowMinutes >= openMinutes || nowMinutes < closeMinutes ? "BUKA" : "TUTUP";
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
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

function StatusOverridePill({ status }: { status: StatusOverride }) {
  const cfg = {
    open:         { label: 'BUKA',  color: '#027A48', bg: C.greenBg  },
    closed:       { label: 'TUTUP', color: '#B42318', bg: C.redBg    },
  }[status] ?? { label: status, color: C.tx3, bg: C.border2 };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 9px', borderRadius: 99, background: cfg.bg, color: cfg.color, fontSize: 11, fontWeight: 700, letterSpacing: '.04em' }}>
      {cfg.label}
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

// ── Delete Modal ───────────────────────────────────────────────────────────────
function DeleteModal({ store, onClose, onDeleted }: { store: StoreWithId; onClose: () => void; onDeleted: (msg: string) => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function confirm() {
    setLoading(true); setError('');
    try {
      await deleteStore(store.id); // Memanggil Server Action
      onDeleted(`"${store.name}" successfully deleted.`);
      onClose();
    } catch (e: any) { setError(e.message); setLoading(false); }
  }

  return (
    <GcModalShell
      onClose={onClose}
      title="Delete Store?"
      eyebrow="Destructive Action"
      description={<>Store <strong>"{store.name}"</strong> will be permanently deleted from Firestore.</>}
      maxWidth={440}
      footer={
        <>
          <GcButton variant="ghost" size="lg" onClick={onClose}>Cancel</GcButton>
          <GcButton variant="danger" size="lg" onClick={confirm} loading={loading}>Yes, Delete</GcButton>
        </>
      }
    >
      <code style={{ fontSize: 11, color: C.tx3, background: C.bg, padding: '4px 8px', borderRadius: 6, display: 'inline-block', marginBottom: 18 }}>ID: {store.id}</code>
      {error && <div style={{ padding: '10px 14px', background: C.redBg, border: '1px solid #FECDD3', borderRadius: 9, fontSize: 12.5, color: '#B42318', marginBottom: 14 }}>{error}</div>}
    </GcModalShell>
  );
}

// ── Store Modal ────────────────────────────────────────────────────────────────
// Form fields = exact Firestore document fields
type StoreForm = {
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
    name:           store?.name            ?? '',
    address:        store?.address         ?? '',
    latitude:       store?.location?.latitude  != null ? String(store.location.latitude)  : '',
    longitude:      store?.location?.longitude != null ? String(store.location.longitude) : '',
    openHours:      store?.operationalHours ? `${store.operationalHours.open} - ${store.operationalHours.close}` : '',
    statusOverride: store?.isForceClosed ? 'closed' : 'open',
    isActive:       store?.isActive        ?? true,
  });

  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const selectedPoint = useMemo(() => {
    if (form.latitude === '' || form.longitude === '') return null;
    const lat = Number(form.latitude);
    const lng = Number(form.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  }, [form.latitude, form.longitude]);

  const initialMapPoint = useMemo(() => {
    const lat = Number(store?.location?.latitude);
    const lng = Number(store?.location?.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    return null;
  }, [store?.location?.latitude, store?.location?.longitude]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const set = (k: keyof StoreForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));

  async function handleSave() {
    if (!form.name.trim()) { setError('Store name is required.'); return; }

    setLoading(true); setError('');
    try {
      const payload = {
        name: form.name.trim(),
        address: form.address.trim(),
        latitude: form.latitude !== '' ? form.latitude : null,
        longitude: form.longitude !== '' ? form.longitude : null,
        openHours: form.openHours.trim(),
        statusOverride: form.statusOverride,
        isActive: form.isActive,
      };

      if (isNew) {
        await createStore(payload);
      } else {
        await updateStore(store!.id, payload);
      }

      onSaved(isNew ? `Outlet "${form.name}" successfully added!` : `"${form.name}" successfully updated.`);
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
      title={isNew ? 'Add Store' : store!.name}
      eyebrow={isNew ? 'New Store' : 'Edit Store'}
      description={!isNew ? <code style={{ fontSize: 11, color: C.tx3, background: C.bg, padding: '2px 8px', borderRadius: 6, border: `1px solid ${C.border2}`, display: 'inline-block' }}>ID: {store!.id}</code> : undefined}
      maxWidth={560}
      footer={
        <>
          <p style={{ fontSize: 11.5, color: C.tx3, marginRight: 'auto' }}>Fields marked <span style={{ color: C.red }}>*</span> are required</p>
          <GcButton variant="ghost" size="lg" onClick={onClose}>Cancel</GcButton>
          <GcButton variant="blue" size="lg" onClick={handleSave} loading={loading}>
            {isNew ? '+ Add Store' : 'Save Changes'}
          </GcButton>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {isNew && (
            <p style={{ fontSize: 12, color: C.tx3, background: C.bg, border: `1px solid ${C.border2}`, borderRadius: 10, padding: '10px 12px' }}>
              Document ID will be generated automatically from <strong>Store Name</strong> (format: <code style={{ background: '#fff', padding: '1px 5px', borderRadius: 4, border: `1px solid ${C.border2}` }}>store_your_store_name</code>).
            </p>
          )}

          {/* ── Store Information ── */}
          {section('Store Information')}
          <div>
            <FL required>Store Name</FL>
            <GcInput placeholder="Gong Cha Grand Indonesia" value={form.name} onChange={set('name')}/>
          </div>
          <div>
            <FL>Full Address</FL>
            <GcTextarea placeholder="Lt. 3 Grand Indonesia, Jl. M.H. Thamrin No.1, Jakarta..." value={form.address} onChange={set('address')}/>
          </div>

          {/* ── GPS ── */}
          {section('GPS Coordinates')}
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
          <StoreMapPicker
            initialPoint={initialMapPoint}
            selectedPoint={selectedPoint}
            onPick={(point) => {
              setForm((p) => ({
                ...p,
                latitude: point.lat.toFixed(6),
                longitude: point.lng.toFixed(6),
              }));
            }}
          />
          {form.latitude && form.longitude && (
            <a href={`https://maps.google.com/?q=${form.latitude},${form.longitude}`} target="_blank" rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 600, color: C.blue, textDecoration: 'none', padding: '8px 14px', borderRadius: 9, background: C.blueL, border: `1.5px solid rgba(67,97,238,.2)`, width: 'fit-content' }}>
              <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
              Preview on Google Maps ↗
            </a>
          )}

          {/* ── Operations ── */}
          {section('Operations')}
          <div>
            <FL>Opening Hours (openHours)</FL>
            <GcInput placeholder="10:00 - 22:00" value={form.openHours} onChange={set('openHours')}/>
            <p style={{ fontSize: 11.5, color: C.tx3, marginTop: 4 }}>Free format, for example: "10:00 - 22:00" or "10:00 - 21:45"</p>
          </div>
          <div>
            <FL>Status Override (statusOverride)</FL>
            <GcSelect value={form.statusOverride} onChange={set('statusOverride')}>
              <option value="open">open — Currently open normal</option>
              <option value="almost_close">almost_close — Almost closed</option>
              <option value="closed">closed — Closed</option>
            </GcSelect>
            <p style={{ fontSize: 11.5, color: C.tx3, marginTop: 4 }}>Displayed in member app as real-time store status.</p>
          </div>

          {/* ── isActive toggle ── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderRadius: 12, background: C.bg, border: `1.5px solid ${C.border}` }}>
            <div>
              <p style={{ fontSize: 13.5, fontWeight: 600, color: C.tx1, marginBottom: 2 }}>isActive</p>
              <p style={{ fontSize: 12, color: C.tx3 }}>{form.isActive ? 'Store is visible in member app' : 'Store is hidden from member app'}</p>
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
    </GcModalShell>
  );
}

// ── Table Row ──────────────────────────────────────────────────────────────────
function StoreRow({ store, isLast, onEdit, onDelete, canManage }: { store: StoreWithId; isLast: boolean; onEdit: () => void; onDelete: () => void; canManage: boolean }) {
  const [h, setH]   = useState(false);
  const [bh, setBH] = useState(false);
  const [dh, setDH] = useState(false);
  const hasGPS = !!(store.location?.latitude && store.location?.longitude);
  const dynamicStatus = getStoreOpenStatus(store);

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
      <td style={{ padding: '14px 18px', fontSize: 12.5, color: C.tx2 }}>{store.operationalHours ? `${store.operationalHours.open} - ${store.operationalHours.close}` : <span style={{ color: C.tx4 }}>—</span>}</td>
      <td style={{ padding: '14px 18px' }}>
        {hasGPS ? (
          <a href={`https://maps.google.com/?q=${store.location.latitude},${store.location.longitude}`} target="_blank" rel="noopener noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 600, color: C.blue, textDecoration: 'none', padding: '3px 9px', borderRadius: 6, background: C.blueL, border: `1px solid rgba(67,97,238,.15)` }}>
            <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
            {Number(store.location.latitude).toFixed(3)}, {Number(store.location.longitude).toFixed(3)}
          </a>
        ) : <span style={{ fontSize: 11.5, color: C.tx4, padding: '3px 9px', borderRadius: 6, background: C.bg, border: `1px solid ${C.border2}` }}>Not set</span>}
      </td>
      <td style={{ padding: '14px 18px' }}><StatusOverridePill status={dynamicStatus === 'BUKA' ? 'open' : 'closed'}/></td>
      <td style={{ padding: '14px 18px' }}><StatusPill active={store.isActive !== false}/></td>
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
              Delete
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function StoresClient({ initialStores = [], showAddTrigger }: { initialStores?: StoreWithId[]; showAddTrigger?: boolean }) {
  const [stores,       setStores]       = useState<StoreWithId[]>(initialStores);
  const [syncStatus,   setSyncStatus]   = useState<SyncStatus>("connecting");
  const [search,       setSearch]       = useState('');
  const [filter,       setFilter]       = useState<'all'|'active'|'inactive'>('all');
  const [editTarget,   setEditTarget]   = useState<StoreWithId | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StoreWithId | null>(null);
  const [showAdd,      setShowAdd]      = useState(false);
  const [toast,        setToast]        = useState<{msg:string;type:'success'|'error'}|null>(null);
  const [searchFocus,  setSearchFocus]  = useState(false);
  const { user } = useAuth();
  const canManageStores = user?.role !== "STAFF";

  const showToast = useCallback((msg: string, type: 'success'|'error' = 'success') => setToast({ msg, type }), []);

  // ── Realtime onSnapshot ─────────────────────────────────────────────────────
  useEffect(() => {
    const storesRef = collection(db, "stores").withConverter(storeConverter);
    const q = query(storesRef, orderBy("name"));
    const unsub = onSnapshot(q,
      snap => { setStores(snap.docs.map(d => d.data())); setSyncStatus("live"); },
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
          {canManageStores && (
            <GcButton variant="blue" size="lg" onClick={() => setShowAdd(true)}>
              Add Store
            </GcButton>
          )}
        </div>
        {canManageStores && showAdd && <StoreModal store={null} onClose={() => setShowAdd(false)} onSaved={msg => { showToast(msg); setShowAdd(false); }}/>} 
        {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)}/>}
      </>
    );
  }

  return (
    <GcPage style={{ background: C.bg }}>
      <GcPageHeader
        eyebrow="Gong Cha Admin"
        title="Stores & Operational Status"
        description="Manage outlets, GPS coordinates, operating hours, and status overrides with a consistent visual system."
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <LiveBadge status={syncStatus}/>
            {canManageStores && (
              <GcButton variant="blue" size="lg" onClick={() => setShowAdd(true)}>
                Add Store
              </GcButton>
            )}
          </div>
        }
      />

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 12, flexWrap: 'wrap', padding: '10px 12px', borderRadius: 14, border: '1px solid rgba(15,17,23,.08)', background: 'rgba(255,255,255,.72)', backdropFilter: 'saturate(160%) blur(8px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 40, padding: '0 13px', minWidth: 240, background: C.white, border: `1px solid ${searchFocus ? 'rgba(59,130,246,.48)' : 'rgba(15,17,23,.10)'}`, borderRadius: 10, boxShadow: searchFocus ? '0 0 0 3px rgba(59,130,246,.10)' : 'none', transition: 'all .14s' }}>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke={C.tx3} strokeWidth={2.2}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontFamily: font, fontSize: 13.5, color: C.tx1 }} placeholder="Search name, ID, address…" value={search} onChange={e => setSearch(e.target.value)} onFocus={() => setSearchFocus(true)} onBlur={() => setSearchFocus(false)}/>
            {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.tx3, fontSize: 15, padding: 0 }}>✕</button>}
          </div>
          <div style={{ display: 'flex', background: '#F6F7FB', border: '1px solid rgba(15,17,23,.08)', borderRadius: 10, padding: 3 }}>
            {(['all', 'active', 'inactive'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{ padding: '5px 14px', borderRadius: 7, border: 'none', fontFamily: font, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', transition: 'all .13s', background: filter === f ? C.white : 'transparent', color: filter === f ? C.tx1 : C.tx3, boxShadow: filter === f ? '0 1px 2px rgba(15,17,23,.06)' : 'none' }}>
                {f === 'all' ? 'All' : f === 'active' ? 'Active' : 'Inactive'}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12.5, color: C.tx3 }}>{filtered.length} / {stores.length} stores</span>
        </div>
      </div>

      {/* Table */}
      <GcPanel style={{ borderRadius: 18, overflow: 'hidden', border: '1px solid rgba(15,17,23,.08)', boxShadow: '0 1px 2px rgba(15,17,23,.04)' }}>
        {filtered.length === 0 ? (
          <GcEmptyState
            title="Store not found"
            description={syncStatus === 'connecting' ? 'Loading data…' : search ? `No results for "${search}"` : 'No registered outlets yet.'}
            icon={syncStatus === 'connecting' ? '⏳' : '📭'}
          />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 980, borderCollapse: 'collapse', fontFamily: font }}>
              <thead>
                <tr style={{ background: '#FAFBFE' }}>
                  {['Store / ID', 'Address', 'Opening Hours', 'GPS', 'Status Override', 'isActive', ''].map((h, i) => (
                    <th key={i} style={{ padding: '11px 18px', textAlign: 'left', fontSize: 10.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: C.tx3, borderBottom: `1px solid ${C.border2}`, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((s, i) => (
                  <StoreRow key={s.id} store={s} isLast={i === filtered.length - 1}
                    onEdit={() => setEditTarget(s)}
                    onDelete={() => setDeleteTarget(s)}
                    canManage={canManageStores}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ padding: '12px 18px', borderTop: '1px solid rgba(15,17,23,.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#FCFDFF' }}>
          <p style={{ fontSize: 12, color: C.tx3 }}>
            <strong style={{ color: C.tx2 }}>{stores.filter(s => s.isActive !== false).length}</strong> active ·{' '}
            <strong style={{ color: C.tx2 }}>{stores.filter(s => s.isActive === false).length}</strong> inactive ·{' '}
            <strong style={{ color: C.tx2 }}>{stores.filter(s => s.location?.latitude && s.location?.longitude).length}</strong> with GPS
          </p>
          {canManageStores && (
            <GcButton variant="blue" size="sm" onClick={() => setShowAdd(true)}>
              Add Store
            </GcButton>
          )}
        </div>
      </GcPanel>

      {canManageStores && editTarget   && <StoreModal store={editTarget}   onClose={() => setEditTarget(null)}    onSaved={msg => { showToast(msg); setEditTarget(null); }}/>} 
      {canManageStores && showAdd      && <StoreModal store={null}          onClose={() => setShowAdd(false)}       onSaved={msg => { showToast(msg); setShowAdd(false); }}/>} 
      {canManageStores && deleteTarget && <DeleteModal store={deleteTarget} onClose={() => setDeleteTarget(null)}   onDeleted={msg => { showToast(msg); setDeleteTarget(null); }}/>} 

      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)}/>}
    </GcPage>
  );
}
