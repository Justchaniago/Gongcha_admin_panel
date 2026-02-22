"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import {
  collection, onSnapshot, query, doc, updateDoc, orderBy,
  QuerySnapshot, DocumentData,
} from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { User, Staff, UserTier, UserRole, StaffRole } from "@/types/firestore";

type UserWithUid  = User  & { uid: string };
type StaffWithUid = Staff & { uid: string };
type SyncStatus   = "connecting" | "live" | "error";

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  bg: '#F4F6FB', white: '#FFFFFF', border: '#EAECF2', border2: '#F0F2F7',
  tx1: '#0F1117', tx2: '#4A5065', tx3: '#9299B0', tx4: '#BCC1D3',
  blue: '#4361EE', blueL: '#EEF2FF', blueD: '#3A0CA3',
  green: '#12B76A', greenBg: '#ECFDF3',
  amber: '#F79009', amberBg: '#FFFAEB',
  red: '#C8102E', redBg: '#FEF3F2',
  purple: '#7C3AED',
  shadow: '0 1px 3px rgba(16,24,40,.06), 0 1px 2px rgba(16,24,40,.04)',
  shadowLg: '0 20px 60px rgba(16,24,40,.18), 0 4px 12px rgba(16,24,40,.08)',
} as const;
const font = "'Plus Jakarta Sans', system-ui, sans-serif";

const TIER_CFG: Record<string, { bg: string; color: string; ring: string }> = {
  Platinum: { bg: '#F5F3FF', color: '#5B21B6', ring: '#DDD6FE' },
  Gold:     { bg: '#FFFBEB', color: '#92400E', ring: '#FDE68A' },
  Silver:   { bg: '#F8FAFC', color: '#475569', ring: '#E2E8F0' },
};
const STAFF_CFG: Record<string, { bg: string; color: string; label: string; code: string }> = {
  cashier:       { bg: C.blueL,   color: C.blueD,  label: 'Kasir',   code: 'POS' },
  store_manager: { bg: C.greenBg, color: '#027A48', label: 'Manajer', code: 'MGT' },
  admin:         { bg: C.redBg,   color: C.red,     label: 'Admin',   code: 'ADM' },
};

// ── Primitives ─────────────────────────────────────────────────────────────────
function LiveBadge({ status }: { status: SyncStatus }) {
  const cfg = {
    connecting: { color: C.amber, label: "Connecting…" },
    live:       { color: C.green, label: "Live"        },
    error:      { color: C.red,   label: "Error"       },
  }[status];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: cfg.color }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: cfg.color, boxShadow: status === 'live' ? '0 0 0 3px rgba(18,183,106,.2)' : 'none', animation: status === 'connecting' ? 'pulse .9s infinite' : 'none' }}/>
      {cfg.label}
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.25}}`}</style>
    </span>
  );
}

function Avatar({ name, size = 36 }: { name?: string; size?: number }) {
  const char = (name ?? '?')[0].toUpperCase();
  const code = (name ?? 'A').charCodeAt(0);
  const g = [['#4361EE','#3A0CA3'],['#7C3AED','#4361EE'],['#059669','#0D9488'],['#D97706','#B45309'],['#DC2626','#B91C1C']];
  const [a, b] = g[code % g.length];
  return (
    <div style={{ width: size, height: size, borderRadius: size < 40 ? 10 : 14, background: `linear-gradient(135deg,${a},${b})`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: size * 0.38, fontFamily: font }}>
      {char}
    </div>
  );
}

function FL({ children }: { children: React.ReactNode }) {
  return <label style={{ display: 'block', marginBottom: 6, fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: C.tx3 }}>{children}</label>;
}

function GcInput({ style, ...p }: React.InputHTMLAttributes<HTMLInputElement>) {
  const [f, setF] = useState(false);
  return <input {...p} onFocus={e => { setF(true); p.onFocus?.(e); }} onBlur={e => { setF(false); p.onBlur?.(e); }} style={{ width: '100%', height: 42, borderRadius: 9, outline: 'none', border: `1.5px solid ${f ? C.blue : C.border}`, background: f ? C.white : C.bg, boxShadow: f ? '0 0 0 3px rgba(67,97,238,.1)' : 'none', padding: '0 13px', fontFamily: font, fontSize: 13.5, color: C.tx1, transition: 'all .14s', ...style }} />;
}

function GcSelect({ style, ...p }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const [f, setF] = useState(false);
  return <select {...p} onFocus={e => { setF(true); p.onFocus?.(e); }} onBlur={e => { setF(false); p.onBlur?.(e); }} style={{ width: '100%', height: 42, borderRadius: 9, outline: 'none', border: `1.5px solid ${f ? C.blue : C.border}`, background: f ? C.white : C.bg, boxShadow: f ? '0 0 0 3px rgba(67,97,238,.1)' : 'none', padding: '0 13px', fontFamily: font, fontSize: 13.5, color: C.tx1, appearance: 'none', cursor: 'pointer', transition: 'all .14s', ...style }} />;
}

function GcBtn({ variant = 'ghost', children, disabled, onClick, style, fw }: {
  variant?: 'ghost' | 'primary' | 'blue'; children: React.ReactNode;
  disabled?: boolean; onClick?: () => void; style?: React.CSSProperties; fw?: boolean;
}) {
  const [h, setH] = useState(false);
  const v = {
    ghost:   { background: h ? C.bg : C.white, color: C.tx2, border: `1.5px solid ${C.border}` },
    primary: { background: h ? '#A50D25' : C.tx1, color: '#fff', transform: h ? 'translateY(-1px)' as const : 'none' },
    blue:    { background: `linear-gradient(135deg,${C.blue},${C.blueD})`, color: '#fff', boxShadow: h ? '0 6px 20px rgba(67,97,238,.35)' : '0 2px 8px rgba(67,97,238,.2)', transform: h ? 'translateY(-1px)' as const : 'none' },
  };
  return (
    <button onClick={disabled ? undefined : onClick} onMouseOver={() => setH(true)} onMouseOut={() => setH(false)} style={{ height: 40, padding: '0 20px', borderRadius: 9, fontFamily: font, fontSize: 13.5, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer', border: 'none', display: 'inline-flex', alignItems: 'center', gap: 7, transition: 'all .15s', opacity: disabled ? .55 : 1, width: fw ? '100%' : undefined, justifyContent: fw ? 'center' : undefined, ...v[variant], ...style }}>
      {children}
    </button>
  );
}

function ActionBtn({ onClick, label }: { onClick: () => void; label: string }) {
  const [h, setH] = useState(false);
  return (
    <button onClick={onClick} onMouseOver={() => setH(true)} onMouseOut={() => setH(false)} style={{ height: 32, padding: '0 14px', borderRadius: 8, fontFamily: font, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', transition: 'all .13s', border: `1.5px solid ${h ? C.blue : C.border}`, background: h ? C.blueL : C.white, color: h ? C.blue : C.tx2, display: 'inline-flex', alignItems: 'center' }}>
      {label}
    </button>
  );
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ msg, type, onDone }: { msg: string; type: 'success' | 'error'; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 3200); return () => clearTimeout(t); }, [onDone]);
  return (
    <div style={{ position: 'fixed', bottom: 28, right: 28, zIndex: 999, padding: '13px 20px', borderRadius: 13, fontFamily: font, fontSize: 13.5, fontWeight: 600, color: '#fff', background: type === 'success' ? C.green : C.red, boxShadow: '0 8px 32px rgba(0,0,0,.22)', display: 'flex', alignItems: 'center', gap: 10, animation: 'gcRise .28s cubic-bezier(.22,.68,0,1.15)' }}>
      {type === 'success' ? '✓' : '✕'} {msg}
      <style>{`@keyframes gcRise{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  );
}

// ── Modal shell ───────────────────────────────────────────────────────────────
function Modal({ children, onClose, maxW = 520 }: { children: React.ReactNode; onClose: () => void; maxW?: number }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }} style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'rgba(10,12,20,.52)', backdropFilter: 'blur(8px)', animation: 'gcFadeIn .18s ease', fontFamily: font }}>
      <div style={{ background: C.white, borderRadius: 22, width: '100%', maxWidth: maxW, maxHeight: '92vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: C.shadowLg, animation: 'gcRise .26s cubic-bezier(.22,.68,0,1.15) both' }}>
        {children}
      </div>
      <style>{`@keyframes gcFadeIn{from{opacity:0}to{opacity:1}}@keyframes gcRise{from{opacity:0;transform:translateY(18px) scale(.97)}to{opacity:1;transform:none}}`}</style>
    </div>
  );
}
function MHead({ eyebrow, title, onClose }: { eyebrow: string; title: string; onClose: () => void }) {
  const [h, setH] = useState(false);
  return (
    <div style={{ padding: '24px 28px 18px', borderBottom: `1px solid ${C.border2}`, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexShrink: 0 }}>
      <div>
        <p style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: C.blue, marginBottom: 4 }}>{eyebrow}</p>
        <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.02em', color: C.tx1, margin: 0 }}>{title}</h2>
      </div>
      <button onClick={onClose} onMouseOver={() => setH(true)} onMouseOut={() => setH(false)} style={{ width: 34, height: 34, borderRadius: 9, border: `1.5px solid ${C.border}`, background: h ? C.bg : 'transparent', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background .13s' }}>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1 1l10 10M11 1L1 11" stroke={C.tx3} strokeWidth="1.7" strokeLinecap="round"/></svg>
      </button>
    </div>
  );
}
function MBody({ children }: { children: React.ReactNode }) {
  return <div style={{ overflowY: 'auto', flex: 1, padding: '22px 28px' }}>{children}</div>;
}
function MFoot({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: '16px 28px 24px', borderTop: `1px solid ${C.border2}`, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, flexShrink: 0 }}>{children}</div>;
}
function SL({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: C.tx3, marginBottom: 14, paddingBottom: 10, borderBottom: `1px solid ${C.border2}` }}>{children}</p>;
}
function ErrBox({ msg }: { msg: string }) {
  return <div style={{ marginTop: 14, padding: '10px 14px', background: C.redBg, border: '1px solid #FECDD3', borderRadius: 9, fontSize: 12.5, color: '#B42318' }}>{msg}</div>;
}

// ── Modals ────────────────────────────────────────────────────────────────────
function MemberDetailModal({ user, onClose, onEdit }: { user: UserWithUid; onClose: () => void; onEdit: () => void }) {
  const tier = TIER_CFG[user.tier] ?? TIER_CFG.Silver;
  return (
    <Modal onClose={onClose} maxW={540}>
      <MHead eyebrow="Detail Member" title={user.name ?? '—'} onClose={onClose} />
      <MBody>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 18px', background: C.bg, borderRadius: 14, border: `1px solid ${C.border}`, marginBottom: 20 }}>
          <Avatar name={user.name} size={52} />
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 16, fontWeight: 700, color: C.tx1, marginBottom: 3 }}>{user.name}</p>
            <p style={{ fontSize: 12.5, color: C.tx3, marginBottom: 2 }}>{user.email}</p>
            <p style={{ fontSize: 12.5, color: C.tx3 }}>{user.phoneNumber}</p>
          </div>
          <span style={{ padding: '5px 12px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: tier.bg, color: tier.color, border: `1.5px solid ${tier.ring}` }}>{user.tier}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 20 }}>
          {[
            { label: 'Poin Aktif',  value: (user.currentPoints  ?? 0).toLocaleString('id'), color: C.blue   },
            { label: 'Lifetime XP', value: (user.lifetimePoints ?? 0).toLocaleString('id'), color: C.purple },
            { label: 'Voucher',     value: String(user.vouchers?.length ?? 0),               color: C.green  },
          ].map(s => (
            <div key={s.label} style={{ textAlign: 'center', padding: '14px 10px', background: C.bg, border: `1px solid ${C.border2}`, borderRadius: 12 }}>
              <p style={{ fontSize: 22, fontWeight: 800, color: s.color, lineHeight: 1, marginBottom: 5 }}>{s.value}</p>
              <p style={{ fontSize: 10.5, color: C.tx3, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase' }}>{s.label}</p>
            </div>
          ))}
        </div>
        <SL>Informasi Akun</SL>
        <div style={{ marginBottom: 20 }}>
          {[
            { label: 'UID',       value: <code style={{ fontSize: 11, background: C.blueL, padding: '2px 8px', borderRadius: 6, color: C.blue }}>{user.uid}</code> },
            { label: 'Role',      value: user.role },
            { label: 'Bergabung', value: user.joinedDate ? new Date(user.joinedDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '—' },
          ].map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid ${C.border2}` }}>
              <span style={{ fontSize: 12.5, color: C.tx3, fontWeight: 500 }}>{r.label}</span>
              <span style={{ fontSize: 12.5, color: C.tx1, fontWeight: 600 }}>{r.value}</span>
            </div>
          ))}
        </div>
        {(user as any).xpHistory?.length > 0 && (
          <><SL>Riwayat XP (5 terbaru)</SL>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {[...(user as any).xpHistory].reverse().slice(0, 5).map((x: any) => (
              <div key={x.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: C.bg, borderRadius: 10, border: `1px solid ${C.border2}` }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: C.tx1, marginBottom: 2 }}>{x.context}</p>
                  <p style={{ fontSize: 11, color: C.tx3 }}>{x.location} · {new Date(x.date).toLocaleDateString('id-ID')}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: x.type === 'earn' ? '#027A48' : C.red, marginBottom: 3 }}>{x.type === 'earn' ? '+' : '-'}{x.amount.toLocaleString('id')} pts</p>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: x.status === 'verified' ? C.greenBg : x.status === 'pending' ? C.amberBg : C.redBg, color: x.status === 'verified' ? '#027A48' : x.status === 'pending' ? '#B54708' : '#B42318' }}>{x.status}</span>
                </div>
              </div>
            ))}
          </div></>
        )}
        {user.vouchers?.filter((v: any) => !v.isUsed).length > 0 && (
          <><SL>Voucher Aktif</SL>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {user.vouchers.filter((v: any) => !v.isUsed).map((v: any) => (
              <div key={v.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', border: `1.5px solid ${C.border}`, borderRadius: 10 }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: C.tx1, marginBottom: 2 }}>{v.title}</p>
                  <code style={{ fontSize: 11, background: C.blueL, padding: '2px 7px', borderRadius: 5, color: C.blue }}>{v.code}</code>
                </div>
                <p style={{ fontSize: 11.5, color: C.tx3 }}>Exp: {new Date(v.expiresAt).toLocaleDateString('id-ID')}</p>
              </div>
            ))}
          </div></>
        )}
      </MBody>
      <MFoot><GcBtn variant="ghost" onClick={onClose}>Tutup</GcBtn><GcBtn variant="blue" onClick={onEdit}>Edit Member</GcBtn></MFoot>
    </Modal>
  );
}

function EditMemberModal({ user, onClose, onSaved }: { user: UserWithUid; onClose: () => void; onSaved: (msg: string) => void }) {
  const [form, setForm] = useState({ name: user.name ?? '', tier: user.tier ?? 'Silver', currentPoints: user.currentPoints ?? 0, lifetimePoints: user.lifetimePoints ?? 0, role: user.role ?? 'member', phoneNumber: user.phoneNumber ?? '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    if (!form.name.trim()) { setError('Nama tidak boleh kosong.'); return; }
    setLoading(true); setError('');
    try {
      // Write directly to Firestore — onSnapshot auto-updates the table
      await updateDoc(doc(db, 'users', user.uid), {
        name: form.name, phoneNumber: form.phoneNumber,
        tier: form.tier, currentPoints: Number(form.currentPoints),
        lifetimePoints: Number(form.lifetimePoints), role: form.role,
      });
      onSaved('Member berhasil diperbarui ✓'); onClose();
    } catch {
      // Fallback to API route (e.g. if Firestore rules require server auth)
      try {
        const r = await fetch(`/api/members/${user.uid}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message ?? 'Gagal menyimpan');
        onSaved('Member berhasil diperbarui ✓'); onClose();
      } catch (e2) { setError(String(e2)); }
    } finally { setLoading(false); }
  }

  return (
    <Modal onClose={onClose}>
      <MHead eyebrow="Edit Akun" title="Edit Member" onClose={onClose} />
      <MBody>
        <SL>Informasi Pribadi</SL>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 22 }}>
          <div><FL>Nama</FL><GcInput value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}/></div>
          <div><FL>No. HP</FL><GcInput value={form.phoneNumber} onChange={e => setForm(p => ({ ...p, phoneNumber: e.target.value }))}/></div>
        </div>
        <SL>Tier & Poin</SL>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 22 }}>
          <div><FL>Tier</FL>
            <GcSelect value={form.tier} onChange={e => setForm(p => ({ ...p, tier: e.target.value as UserTier }))}>
              {['Silver','Gold','Platinum'].map(t => <option key={t}>{t}</option>)}
            </GcSelect>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div><FL>Poin Aktif</FL><GcInput type="number" value={form.currentPoints} onChange={e => setForm(p => ({ ...p, currentPoints: Number(e.target.value) }))}/></div>
            <div><FL>Lifetime Points</FL><GcInput type="number" value={form.lifetimePoints} onChange={e => setForm(p => ({ ...p, lifetimePoints: Number(e.target.value) }))}/></div>
          </div>
          <div><FL>Role</FL>
            <GcSelect value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value as UserRole }))}>
              {['member','admin','trial','master'].map(r => <option key={r}>{r}</option>)}
            </GcSelect>
          </div>
        </div>
        {error && <ErrBox msg={error}/>}
      </MBody>
      <MFoot><GcBtn variant="ghost" onClick={onClose}>Batal</GcBtn><GcBtn variant="primary" onClick={save} disabled={loading}>{loading ? 'Menyimpan…' : 'Simpan'}</GcBtn></MFoot>
    </Modal>
  );
}

function EditStaffModal({ staff, storeIds, onClose, onSaved }: { staff: StaffWithUid; storeIds: string[]; onClose: () => void; onSaved: (msg: string) => void }) {
  const [form, setForm] = useState({ name: staff.name ?? '', role: staff.role ?? 'cashier', storeLocation: staff.storeLocation ?? '', isActive: staff.isActive ?? true });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    if (!form.name.trim()) { setError('Nama tidak boleh kosong.'); return; }
    setLoading(true); setError('');
    try {
      await updateDoc(doc(db, 'staff', staff.uid), { name: form.name, role: form.role, storeLocation: form.storeLocation, isActive: form.isActive });
      onSaved('Staff berhasil diperbarui ✓'); onClose();
    } catch {
      try {
        const r = await fetch(`/api/staff/${staff.uid}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message ?? 'Gagal menyimpan');
        onSaved('Staff berhasil diperbarui ✓'); onClose();
      } catch (e2) { setError(String(e2)); }
    } finally { setLoading(false); }
  }

  return (
    <Modal onClose={onClose}>
      <MHead eyebrow="Edit Akun" title="Edit Staff" onClose={onClose} />
      <MBody>
        <SL>Informasi Staff</SL>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 22 }}>
          <div><FL>Nama</FL><GcInput value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}/></div>
          <div><FL>Role</FL>
            <GcSelect value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value as StaffRole }))}>
              <option value="cashier">Kasir</option><option value="store_manager">Store Manager</option><option value="admin">Admin</option>
            </GcSelect>
          </div>
          {storeIds.length > 0 && <div><FL>Outlet</FL>
            <GcSelect value={form.storeLocation} onChange={e => setForm(p => ({ ...p, storeLocation: e.target.value }))}>
              {storeIds.map(id => <option key={id} value={id}>{id}</option>)}
            </GcSelect>
          </div>}
        </div>
        <SL>Status Akun</SL>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderRadius: 12, background: C.bg, border: `1.5px solid ${C.border}` }}>
          <div>
            <p style={{ fontSize: 13.5, fontWeight: 600, color: C.tx1, marginBottom: 2 }}>Status Aktif</p>
            <p style={{ fontSize: 12, color: C.tx3 }}>{form.isActive ? 'Staff aktif dan dapat login' : 'Akses staff dinonaktifkan'}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99, background: form.isActive ? C.greenBg : C.border2, color: form.isActive ? '#027A48' : C.tx3 }}>{form.isActive ? 'Aktif' : 'Nonaktif'}</span>
            <button type="button" onClick={() => setForm(p => ({ ...p, isActive: !p.isActive }))} style={{ width: 42, height: 24, borderRadius: 99, border: 'none', cursor: 'pointer', background: form.isActive ? C.blue : C.border, position: 'relative', transition: 'background .2s' }}>
              <span style={{ position: 'absolute', top: 3, borderRadius: '50%', width: 18, height: 18, background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,.2)', display: 'block', left: form.isActive ? 21 : 3, transition: 'left .2s cubic-bezier(.34,1.56,.64,1)' }}/>
            </button>
          </div>
        </div>
        {error && <ErrBox msg={error}/>}
      </MBody>
      <MFoot><GcBtn variant="ghost" onClick={onClose}>Batal</GcBtn><GcBtn variant="primary" onClick={save} disabled={loading}>{loading ? 'Menyimpan…' : 'Simpan'}</GcBtn></MFoot>
    </Modal>
  );
}

function CreateModal({ storeIds, onClose, onCreated }: { storeIds: string[]; onClose: () => void; onCreated: (msg: string) => void }) {
  const [type, setType] = useState<'member'|'staff'>('member');
  const [form, setForm] = useState({ name: '', email: '', phoneNumber: '', tier: 'Silver', role: 'member', staffRole: 'cashier', storeLocation: storeIds[0] ?? '', password: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function create() {
    if (!form.name || !form.email || !form.password) { setError('Nama, email, dan password wajib diisi.'); return; }
    if (form.password !== form.confirm) { setError('Password tidak cocok.'); return; }
    if (form.password.length < 8) { setError('Password minimal 8 karakter.'); return; }
    setLoading(true); setError('');
    try {
      const url     = type === 'member' ? '/api/members' : '/api/staff';
      const payload = type === 'member'
        ? { name: form.name, email: form.email, phoneNumber: form.phoneNumber, tier: form.tier, role: form.role, password: form.password }
        : { name: form.name, email: form.email, role: form.staffRole, storeLocation: form.storeLocation, password: form.password };
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message ?? 'Gagal membuat akun.');
      onCreated(`${type === 'member' ? 'Member' : 'Staff'} baru berhasil dibuat ✓`);
      onClose();
    } catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  }

  return (
    <Modal onClose={onClose}>
      <MHead eyebrow="Akun Baru" title="Tambah Akun" onClose={onClose} />
      <MBody>
        <div style={{ display: 'flex', background: C.bg, border: `1.5px solid ${C.border}`, borderRadius: 12, padding: 4, marginBottom: 22 }}>
          {(['member','staff'] as const).map(t => (
            <button key={t} onClick={() => setType(t)} style={{ flex: 1, height: 36, borderRadius: 9, border: 'none', fontFamily: font, fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all .15s', background: type === t ? C.white : 'transparent', color: type === t ? C.tx1 : C.tx3, boxShadow: type === t ? C.shadow : 'none' }}>
              {t === 'member' ? '👤 Member' : '🏷️ Staff & Admin'}
            </button>
          ))}
        </div>
        {type === 'member' ? (
          <><SL>Informasi Member</SL>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 22 }}>
            <div><FL>Nama *</FL><GcInput placeholder="Budi Santoso" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}/></div>
            <div><FL>Email *</FL><GcInput type="email" placeholder="budi@email.com" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}/></div>
            <div><FL>No. HP</FL><GcInput placeholder="+62 812 xxxx" value={form.phoneNumber} onChange={e => setForm(p => ({ ...p, phoneNumber: e.target.value }))}/></div>
            <div><FL>Tier Awal</FL><GcSelect value={form.tier} onChange={e => setForm(p => ({ ...p, tier: e.target.value }))}>{['Silver','Gold','Platinum'].map(t => <option key={t}>{t}</option>)}</GcSelect></div>
          </div></>
        ) : (
          <><SL>Informasi Staff</SL>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 22 }}>
            <div><FL>Nama *</FL><GcInput placeholder="Siti Rahayu" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}/></div>
            <div><FL>Email *</FL><GcInput type="email" placeholder="siti@gongcha.id" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}/></div>
            <div><FL>Role</FL>
              <GcSelect value={form.staffRole} onChange={e => setForm(p => ({ ...p, staffRole: e.target.value }))}>
                <option value="cashier">Kasir</option><option value="store_manager">Store Manager</option><option value="admin">Admin</option>
              </GcSelect>
            </div>
            {storeIds.length > 0 && <div><FL>Outlet</FL><GcSelect value={form.storeLocation} onChange={e => setForm(p => ({ ...p, storeLocation: e.target.value }))}>{storeIds.map(id => <option key={id} value={id}>{id}</option>)}</GcSelect></div>}
          </div></>
        )}
        <SL>Password</SL>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div><FL>Password *</FL><GcInput type="password" placeholder="Min. 8 karakter" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))}/></div>
          <div>
            <FL>Konfirmasi Password *</FL>
            <GcInput type="password" placeholder="Ulangi password" value={form.confirm} onChange={e => setForm(p => ({ ...p, confirm: e.target.value }))} style={{ borderColor: form.confirm && form.password !== form.confirm ? '#F04438' : undefined }}/>
            {form.confirm && form.password !== form.confirm && <p style={{ fontSize: 11.5, color: '#B42318', marginTop: 5 }}>Password tidak cocok</p>}
          </div>
        </div>
        {error && <ErrBox msg={error}/>}
      </MBody>
      <MFoot>
        <p style={{ flex: 1, fontSize: 11.5, color: C.tx3 }}>Kolom <span style={{ color: C.red }}>*</span> wajib diisi</p>
        <GcBtn variant="ghost" onClick={onClose}>Batal</GcBtn>
        <GcBtn variant="blue" onClick={create} disabled={loading}>{loading ? 'Membuat…' : `Buat ${type === 'member' ? 'Member' : 'Staff'}`}</GcBtn>
      </MFoot>
    </Modal>
  );
}

// ── Table rows — own components so useState is legal ─────────────────────────
function UserRow({ u, isLast, onDetail, onEdit }: { u: UserWithUid; isLast: boolean; onDetail: () => void; onEdit: () => void }) {
  const [hov, setHov] = useState(false);
  const tier = TIER_CFG[u.tier] ?? TIER_CFG.Silver;
  return (
    <tr onMouseOver={() => setHov(true)} onMouseOut={() => setHov(false)} onClick={onDetail} style={{ borderBottom: isLast ? 'none' : `1px solid ${C.border2}`, background: hov ? '#F8F9FC' : C.white, transition: 'background .1s', cursor: 'pointer' }}>
      <td style={{ padding: '14px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Avatar name={u.name} size={36}/>
          <div>
            <p style={{ fontSize: 13.5, fontWeight: 700, color: C.tx1, marginBottom: 2 }}>{u.name}</p>
            <code style={{ fontSize: 10.5, color: C.tx3, background: C.bg, padding: '1px 6px', borderRadius: 5, border: `1px solid ${C.border2}` }}>{u.uid.slice(0, 12)}…</code>
          </div>
        </div>
      </td>
      <td style={{ padding: '14px 20px', fontSize: 13, color: C.tx2 }}>{u.email}</td>
      <td style={{ padding: '14px 20px' }}><span style={{ padding: '4px 11px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: tier.bg, color: tier.color, border: `1.5px solid ${tier.ring}` }}>{u.tier}</span></td>
      <td style={{ padding: '14px 20px', fontSize: 14, fontWeight: 800, color: C.blue }}>{(u.currentPoints ?? 0).toLocaleString('id')}</td>
      <td style={{ padding: '14px 20px', fontSize: 13, color: C.tx2 }}>{(u.lifetimePoints ?? 0).toLocaleString('id')}</td>
      <td style={{ padding: '14px 20px', fontSize: 12.5, color: C.tx2, fontWeight: 500 }}>{u.role}</td>
      <td style={{ padding: '14px 20px' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', gap: 6 }}>
          <ActionBtn onClick={onDetail} label="Detail"/>
          <ActionBtn onClick={onEdit} label="Edit"/>
        </div>
      </td>
    </tr>
  );
}

function StaffRow({ s, isLast, onEdit }: { s: StaffWithUid; isLast: boolean; onEdit: () => void }) {
  const [hov, setHov] = useState(false);
  const r = STAFF_CFG[s.role] ?? STAFF_CFG.cashier;
  return (
    <tr onMouseOver={() => setHov(true)} onMouseOut={() => setHov(false)} style={{ borderBottom: isLast ? 'none' : `1px solid ${C.border2}`, background: hov ? '#F8F9FC' : C.white, transition: 'background .1s' }}>
      <td style={{ padding: '14px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Avatar name={s.name} size={36}/>
          <div>
            <p style={{ fontSize: 13.5, fontWeight: 700, color: C.tx1, marginBottom: 2 }}>{s.name}</p>
            <code style={{ fontSize: 10.5, color: C.tx3, background: C.bg, padding: '1px 6px', borderRadius: 5, border: `1px solid ${C.border2}` }}>{s.uid.slice(0, 12)}…</code>
          </div>
        </div>
      </td>
      <td style={{ padding: '14px 20px', fontSize: 13, color: C.tx2 }}>{s.email}</td>
      <td style={{ padding: '14px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ padding: '3px 9px', borderRadius: 99, fontSize: 10, fontWeight: 700, letterSpacing: '.06em', background: r.bg, color: r.color }}>{r.code}</span>
          <span style={{ fontSize: 13, color: C.tx2, fontWeight: 500 }}>{r.label}</span>
        </div>
      </td>
      <td style={{ padding: '14px 20px' }}><code style={{ fontSize: 12, background: C.blueL, padding: '3px 9px', borderRadius: 6, color: C.blue, border: `1px solid rgba(67,97,238,.15)` }}>{s.storeLocation || '—'}</code></td>
      <td style={{ padding: '14px 20px', fontSize: 12.5, color: C.tx2, fontWeight: 500 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 11px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: s.isActive ? C.greenBg : C.border2, color: s.isActive ? '#027A48' : C.tx3 }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: s.isActive ? C.green : C.tx4 }}/>{s.isActive ? 'Aktif' : 'Nonaktif'}
        </span>
      </td>
      <td style={{ padding: '14px 20px' }}><ActionBtn onClick={onEdit} label="Edit"/></td>
    </tr>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function MembersClient({ initialUsers, initialStaff, storeIds, currentUserRole }: {
  initialUsers: UserWithUid[];
  initialStaff: StaffWithUid[];
  storeIds: string[];
  currentUserRole: string;
}) {
  // ── Realtime Firestore listeners ──────────────────────────────────────────
  const [users,       setUsers]       = useState<UserWithUid[]>(initialUsers);
  const [staff,       setStaff]       = useState<StaffWithUid[]>(initialStaff);
  const [liveStoreIds,setLiveStoreIds]= useState<string[]>(storeIds);
  const [userStatus,  setUserStatus]  = useState<SyncStatus>('connecting');
  const [staffStatus, setStaffStatus] = useState<SyncStatus>('connecting');

  useEffect(() => {
    const unsubUsers = onSnapshot(
      query(collection(db, 'users')),
      snap => { setUsers(snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserWithUid))); setUserStatus('live'); },
      () => setUserStatus('error'),
    );
    const unsubStaff = onSnapshot(
      query(collection(db, 'staff')),
      snap => { setStaff(snap.docs.map(d => ({ uid: d.id, ...d.data() } as StaffWithUid))); setStaffStatus('live'); },
      () => setStaffStatus('error'),
    );
    const unsubStores = onSnapshot(
      query(collection(db, 'stores')),
      snap => setLiveStoreIds(snap.docs.map(d => d.id)),
    );
    return () => { unsubUsers(); unsubStaff(); unsubStores(); };
  }, []);

  const syncStatus: SyncStatus = userStatus === 'live' && staffStatus === 'live' ? 'live'
    : userStatus === 'error' || staffStatus === 'error' ? 'error' : 'connecting';

  // ── UI state ──────────────────────────────────────────────────────────────
  const [tab,    setTab]    = useState<'member'|'staff'>('member');
  const [search, setSearch] = useState('');
  const [tierF,  setTierF]  = useState('All');
  const [sf,     setSF]     = useState(false);

  const [detailUser,  setDetailUser]  = useState<UserWithUid  | null>(null);
  const [editUser,    setEditUser]    = useState<UserWithUid  | null>(null);
  const [editStaff,   setEditStaff]   = useState<StaffWithUid | null>(null);
  const [showCreate,  setShowCreate]  = useState(false);
  const [toast,       setToast]       = useState<{ msg: string; type: 'success'|'error' } | null>(null);

  const showToast = useCallback((msg: string, type: 'success'|'error' = 'success') => setToast({ msg, type }), []);

  // ── Filtered lists ────────────────────────────────────────────────────────
  const fUsers = useMemo(() => users.filter(u => {
    const q = search.toLowerCase();
    return (!q || u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || u.phoneNumber?.includes(q)) && (tierF === 'All' || u.tier === tierF);
  }), [users, search, tierF]);

  const fStaff = useMemo(() => staff.filter(s => {
    const q = search.toLowerCase();
    return !q || s.name?.toLowerCase().includes(q) || s.email?.toLowerCase().includes(q);
  }), [staff, search]);

  // currentUserRole is now available for use in this component
  return (
    <div style={{ padding: '28px 32px', maxWidth: 1400, fontFamily: font, WebkitFontSmoothing: 'antialiased' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: C.tx3, marginBottom: 5 }}>Gong Cha Admin</p>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-.025em', color: C.tx1, lineHeight: 1.1, margin: 0 }}>User & Staff Management</h1>
          <p style={{ fontSize: 14, color: C.tx2, marginTop: 5, display: 'flex', alignItems: 'center', gap: 10 }}>
            Kelola member, tier, poin, dan akses staff.
            <LiveBadge status={syncStatus}/>
          </p>
        </div>
        <GcBtn variant="blue" onClick={() => setShowCreate(true)}>
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>
          Tambah Akun
        </GcBtn>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'Total Member', value: users.length,                                color: C.blue,    bg: C.blueL    },
          { label: 'Platinum',     value: users.filter(u => u.tier === 'Platinum').length, color: '#5B21B6', bg: '#F5F3FF' },
          { label: 'Gold',         value: users.filter(u => u.tier === 'Gold').length,     color: '#92400E', bg: '#FFFBEB' },
          { label: 'Silver',       value: users.filter(u => u.tier === 'Silver').length,   color: '#475569', bg: '#F8FAFC' },
          { label: 'Total Staff',  value: staff.length,                                color: C.green,   bg: C.greenBg  },
        ].map(s => (
          <div key={s.label} style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 18, boxShadow: C.shadow, padding: '20px 22px' }}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: C.tx3, marginBottom: 10 }}>{s.label}</p>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: s.color, opacity: .7 }}/>
            </div>
            <p style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-.02em', color: s.color, lineHeight: 1 }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs + toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', background: C.bg, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: 3 }}>
            {([{ k: 'member', l: 'Member', c: fUsers.length }, { k: 'staff', l: 'Staff', c: fStaff.length }] as const).map(t => (
              <button key={t.k} onClick={() => { setTab(t.k as any); setSearch(''); }} style={{ padding: '6px 18px', borderRadius: 7, border: 'none', fontFamily: font, fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all .13s', background: tab === t.k ? C.white : 'transparent', color: tab === t.k ? C.tx1 : C.tx3, boxShadow: tab === t.k ? C.shadow : 'none', display: 'flex', alignItems: 'center', gap: 7 }}>
                {t.l}<span style={{ padding: '1px 7px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: tab === t.k ? C.blueL : C.border2, color: tab === t.k ? C.blue : C.tx3 }}>{t.c}</span>
              </button>
            ))}
          </div>
          {tab === 'member' && (
            <div style={{ display: 'flex', background: C.bg, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: 3 }}>
              {['All','Platinum','Gold','Silver'].map(t => (
                <button key={t} onClick={() => setTierF(t)} style={{ padding: '5px 14px', borderRadius: 7, border: 'none', fontFamily: font, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', transition: 'all .13s', background: tierF === t ? C.white : 'transparent', color: tierF === t ? C.tx1 : C.tx3, boxShadow: tierF === t ? C.shadow : 'none' }}>{t}</button>
              ))}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 40, padding: '0 13px', minWidth: 240, background: C.white, border: `1.5px solid ${sf ? C.blue : C.border}`, borderRadius: 10, transition: 'all .14s', boxShadow: sf ? '0 0 0 3px rgba(67,97,238,.1)' : 'none' }}>
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke={C.tx3} strokeWidth={2.2}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontFamily: font, fontSize: 13.5, color: C.tx1 }} placeholder={`Cari ${tab === 'member' ? 'member' : 'staff'}…`} value={search} onChange={e => setSearch(e.target.value)} onFocus={() => setSF(true)} onBlur={() => setSF(false)}/>
          {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.tx3, fontSize: 15, padding: 0 }}>✕</button>}
        </div>
      </div>

      {/* Member table */}
      {tab === 'member' && (
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 18, boxShadow: C.shadow, overflow: 'hidden' }}>
          {fUsers.length === 0 ? (
            <div style={{ padding: '60px 24px', textAlign: 'center' }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: C.tx1, marginBottom: 6 }}>Tidak ada member</p>
              <p style={{ fontSize: 13, color: C.tx3 }}>{syncStatus === 'connecting' ? 'Memuat data…' : search || tierF !== 'All' ? 'Tidak ada yang cocok dengan filter.' : 'Belum ada member terdaftar.'}</p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: font }}>
              <thead><tr style={{ background: '#F8F9FC' }}>
                {['Member','Email','Tier','Poin','Lifetime','Role','Aksi'].map(h => (
                  <th key={h} style={{ padding: '11px 20px', textAlign: 'left', fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: C.tx3, borderBottom: `1px solid ${C.border2}` }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {fUsers.map((u, i) => (
                  <UserRow key={u.uid} u={u} isLast={i === fUsers.length - 1} onDetail={() => setDetailUser(u)} onEdit={() => setEditUser(u)}/>
                ))}
              </tbody>
            </table>
          )}
          <div style={{ padding: '12px 20px', borderTop: `1px solid ${C.border2}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ fontSize: 12, color: C.tx3 }}><strong style={{ color: C.tx2 }}>{fUsers.length}</strong> dari <strong style={{ color: C.tx2 }}>{users.length}</strong> member</p>
            <LiveBadge status={userStatus}/>
          </div>
        </div>
      )}

      {/* Staff table */}
      {tab === 'staff' && (
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 18, boxShadow: C.shadow, overflow: 'hidden' }}>
          {fStaff.length === 0 ? (
            <div style={{ padding: '60px 24px', textAlign: 'center' }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: C.tx1, marginBottom: 6 }}>Tidak ada staff</p>
              <p style={{ fontSize: 13, color: C.tx3 }}>{syncStatus === 'connecting' ? 'Memuat data…' : search ? 'Tidak ada yang cocok.' : 'Belum ada staff terdaftar.'}</p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: font }}>
              <thead><tr style={{ background: '#F8F9FC' }}>
                {['Staff','Email','Role','Outlet','Status','Aksi'].map(h => (
                  <th key={h} style={{ padding: '11px 20px', textAlign: 'left', fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: C.tx3, borderBottom: `1px solid ${C.border2}` }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {fStaff.map((s, i) => (
                  <StaffRow key={s.uid} s={s} isLast={i === fStaff.length - 1} onEdit={() => setEditStaff(s)}/>
                ))}
              </tbody>
            </table>
          )}
          <div style={{ padding: '12px 20px', borderTop: `1px solid ${C.border2}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ fontSize: 12, color: C.tx3 }}><strong style={{ color: C.tx2 }}>{fStaff.length}</strong> dari <strong style={{ color: C.tx2 }}>{staff.length}</strong> staff</p>
            <LiveBadge status={staffStatus}/>
          </div>
        </div>
      )}

      {/* Modals */}
      {detailUser && !editUser && (
        <MemberDetailModal user={detailUser} onClose={() => setDetailUser(null)} onEdit={() => { setEditUser(detailUser); setDetailUser(null); }}/>
      )}
      {editUser && (
        <EditMemberModal user={editUser} onClose={() => setEditUser(null)} onSaved={msg => { showToast(msg); setEditUser(null); }}/>
      )}
      {editStaff && (
        <EditStaffModal staff={editStaff} storeIds={liveStoreIds} onClose={() => setEditStaff(null)} onSaved={msg => { showToast(msg); setEditStaff(null); }}/>
      )}
      {showCreate && (
        <CreateModal storeIds={liveStoreIds} onClose={() => setShowCreate(false)} onCreated={msg => showToast(msg)}/>
      )}

      {/* Toast */}
      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)}/>}
    </div>
  );
}