"use client";
// src/app/dashboard/rewards/RewardsClient.tsx

import { useState, useMemo, useEffect, useCallback } from "react";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { Reward } from "@/types/firestore";

type RewardWithId = Reward & { id: string };
type SyncStatus   = "connecting" | "live" | "error";
type Category     = "Drink" | "Topping" | "Discount";

// ── Design tokens (same as StoresClient) ──────────────────────────────────────
const C = {
  bg:       '#F4F6FB',
  white:    '#FFFFFF',
  border:   '#EAECF2',
  border2:  '#F0F2F7',
  tx1:      '#0F1117',
  tx2:      '#4A5065',
  tx3:      '#9299B0',
  tx4:      '#BCC1D3',
  blue:     '#4361EE',
  blueL:    '#EEF2FF',
  blueMid:  '#C7D2FE',
  purple:   '#6D28D9',
  purpleL:  '#EDE9FE',
  green:    '#12B76A',
  greenBg:  '#ECFDF3',
  orange:   '#F79009',
  orangeBg: '#FFFAEB',
  red:      '#C8102E',
  redBg:    '#FEF3F2',
  shadow:   '0 1px 3px rgba(16,24,40,.06), 0 1px 2px rgba(16,24,40,.04)',
  shadowLg: '0 20px 60px rgba(16,24,40,.18), 0 4px 12px rgba(16,24,40,.08)',
} as const;
const font = "'Plus Jakarta Sans', system-ui, sans-serif";

// ── Category config ───────────────────────────────────────────────────────────
const CAT_CFG: Record<Category, { bg: string; color: string; emoji: string; label: string }> = {
  Drink:    { bg: '#DBEAFE', color: '#2563EB', emoji: '🧋', label: 'Drink'    },
  Topping:  { bg: '#EDE9FE', color: '#6D28D9', emoji: '🧁', label: 'Topping'  },
  Discount: { bg: '#D1FAE5', color: '#059669', emoji: '🎟️', label: 'Discount' },
};

// ── Primitives ─────────────────────────────────────────────────────────────────
function LiveBadge({ status }: { status: SyncStatus }) {
  const cfg = {
    connecting: { color: C.orange, label: 'Connecting…' },
    live:       { color: C.green,  label: 'Live'         },
    error:      { color: C.red,    label: 'Error'        },
  }[status];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: cfg.color }}>
      <span style={{
        width: 7, height: 7, borderRadius: '50%', background: cfg.color,
        boxShadow: status === 'live' ? '0 0 0 3px rgba(18,183,106,.2)' : 'none',
        animation: status === 'connecting' ? 'pulse .9s infinite' : 'none',
      }}/>
      {cfg.label}
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.25}}`}</style>
    </span>
  );
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '4px 11px', borderRadius: 99,
      background: active ? C.greenBg : C.border2,
      color: active ? '#027A48' : C.tx3,
      fontSize: 11, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase',
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: active ? C.green : C.tx4 }}/>
      {active ? 'Aktif' : 'Nonaktif'}
    </span>
  );
}

function CategoryBadge({ category }: { category: Category }) {
  const cfg = CAT_CFG[category] ?? CAT_CFG.Drink;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '4px 11px', borderRadius: 99,
      background: cfg.bg, color: cfg.color,
      fontSize: 11, fontWeight: 700, letterSpacing: '.04em',
    }}>
      {cfg.emoji} {cfg.label}
    </span>
  );
}

function FL({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label style={{
      display: 'block', marginBottom: 6, fontSize: 11, fontWeight: 700,
      letterSpacing: '.06em', textTransform: 'uppercase', color: C.tx3,
    }}>
      {children}{required && <span style={{ color: C.red, marginLeft: 3 }}>*</span>}
    </label>
  );
}

function GcInput({ style, ...p }: React.InputHTMLAttributes<HTMLInputElement>) {
  const [f, setF] = useState(false);
  return (
    <input
      {...p}
      onFocus={e => { setF(true);  p.onFocus?.(e); }}
      onBlur={e  => { setF(false); p.onBlur?.(e);  }}
      style={{
        width: '100%', height: 42, borderRadius: 9, outline: 'none',
        border: `1.5px solid ${f ? C.blue : C.border}`,
        background: f ? C.white : C.bg,
        boxShadow: f ? '0 0 0 3px rgba(67,97,238,.1)' : 'none',
        padding: '0 13px', fontFamily: font, fontSize: 13.5, color: C.tx1,
        transition: 'all .14s', boxSizing: 'border-box', ...style,
      }}
    />
  );
}

function GcTextarea({ style, ...p }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const [f, setF] = useState(false);
  return (
    <textarea
      {...p} rows={3}
      onFocus={e => { setF(true);  p.onFocus?.(e); }}
      onBlur={e  => { setF(false); p.onBlur?.(e);  }}
      style={{
        width: '100%', borderRadius: 9, outline: 'none', resize: 'vertical',
        border: `1.5px solid ${f ? C.blue : C.border}`,
        background: f ? C.white : C.bg,
        boxShadow: f ? '0 0 0 3px rgba(67,97,238,.1)' : 'none',
        padding: '10px 13px', fontFamily: font, fontSize: 13.5, color: C.tx1,
        lineHeight: 1.5, transition: 'all .14s', boxSizing: 'border-box', ...style,
      }}
    />
  );
}

function GcSelect({ style, ...p }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const [f, setF] = useState(false);
  return (
    <select
      {...p}
      onFocus={e => { setF(true);  p.onFocus?.(e); }}
      onBlur={e  => { setF(false); p.onBlur?.(e);  }}
      style={{
        width: '100%', height: 42, borderRadius: 9, outline: 'none',
        border: `1.5px solid ${f ? C.blue : C.border}`,
        background: f ? C.white : C.bg,
        boxShadow: f ? '0 0 0 3px rgba(67,97,238,.1)' : 'none',
        padding: '0 13px', fontFamily: font, fontSize: 13.5, color: C.tx1,
        transition: 'all .14s', cursor: 'pointer', ...style,
      }}
    />
  );
}

function Toast({ msg, type, onDone }: { msg: string; type: 'success' | 'error'; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 3200); return () => clearTimeout(t); }, [onDone]);
  return (
    <div style={{
      position: 'fixed', bottom: 28, right: 28, zIndex: 999,
      padding: '13px 20px', borderRadius: 13, fontFamily: font,
      fontSize: 13.5, fontWeight: 600, color: '#fff',
      background: type === 'success' ? C.green : C.red,
      boxShadow: '0 8px 32px rgba(0,0,0,.22)',
      display: 'flex', alignItems: 'center', gap: 10,
      animation: 'gcRise .28s ease',
    }}>
      {type === 'success' ? '✓' : '✕'} {msg}
      <style>{`@keyframes gcRise{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}`}</style>
    </div>
  );
}

// ── Delete Modal ───────────────────────────────────────────────────────────────
function DeleteModal({
  reward, onClose, onDeleted,
}: { reward: RewardWithId; onClose: () => void; onDeleted: (msg: string) => void }) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  async function confirm() {
    setLoading(true); setError('');
    try {
      const r = await fetch(`/api/rewards/${reward.id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message ?? 'Gagal menghapus.');
      onDeleted(`"${reward.title}" berhasil dihapus.`);
      onClose();
    } catch (e: any) { setError(e.message); setLoading(false); }
  }

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 50, display: 'flex',
        alignItems: 'center', justifyContent: 'center', padding: 24,
        background: 'rgba(10,12,20,.52)', backdropFilter: 'blur(8px)',
        fontFamily: font,
      }}
    >
      <div style={{
        background: C.white, borderRadius: 20, width: '100%', maxWidth: 420,
        boxShadow: C.shadowLg, padding: '32px 28px', animation: 'gcRise .22s ease',
      }}>
        <div style={{
          width: 52, height: 52, borderRadius: 14, background: C.redBg,
          display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18,
        }}>
          <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke={C.red} strokeWidth={2}>
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14H6L5 6"/>
            <path d="M10 11v6M14 11v6"/>
            <path d="M9 6V4h6v2"/>
          </svg>
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: C.tx1, marginBottom: 8 }}>Hapus Reward?</h2>
        <p style={{ fontSize: 13.5, color: C.tx2, lineHeight: 1.6, marginBottom: 6 }}>
          Reward <strong>"{reward.title}"</strong> akan dihapus permanen dari Firestore.
        </p>
        <code style={{ fontSize: 11, color: C.tx3, background: C.bg, padding: '4px 8px', borderRadius: 6, display: 'inline-block', marginBottom: 18 }}>
          ID: {reward.id}
        </code>
        {error && (
          <div style={{ padding: '10px 14px', background: C.redBg, border: '1px solid #FECDD3', borderRadius: 9, fontSize: 12.5, color: '#B42318', marginBottom: 14 }}>
            {error}
          </div>
        )}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{ height: 40, padding: '0 20px', borderRadius: 9, border: `1.5px solid ${C.border}`, background: C.white, color: C.tx2, fontFamily: font, fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}
          >
            Batal
          </button>
          <button
            onClick={confirm}
            disabled={loading}
            style={{ height: 40, padding: '0 20px', borderRadius: 9, border: 'none', background: loading ? '#fca5a5' : C.red, color: '#fff', fontFamily: font, fontSize: 13.5, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer' }}
          >
            {loading ? 'Menghapus…' : 'Ya, Hapus'}
          </button>
        </div>
      </div>
      <style>{`@keyframes gcRise{from{opacity:0;transform:translateY(18px) scale(.97)}to{opacity:1;transform:none}}`}</style>
    </div>
  );
}

// ── Reward Modal ───────────────────────────────────────────────────────────────
type RewardForm = {
  rewardId:   string;
  title:      string;
  description:string;
  pointsCost: string;
  category:   Category;
  isActive:   boolean;
};

function RewardModal({
  reward, onClose, onSaved,
}: { reward: RewardWithId | null; onClose: () => void; onSaved: (msg: string) => void }) {
  const isNew = !reward;

  const [form, setForm] = useState<RewardForm>({
    rewardId:    reward?.id          ?? '',
    title:       reward?.title       ?? '',
    description: reward?.description ?? '',
    pointsCost:  reward?.pointsCost  != null ? String(reward.pointsCost) : '',
    category:    (reward?.category as Category) ?? 'Drink',
    isActive:    reward?.isActive    ?? true,
  });

  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');
  const [idTouched, setIdTouched] = useState(false);

  // Auto-generate ID from title
  useEffect(() => {
    if (!isNew || idTouched) return;
    const slug = form.title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map(w => w.slice(0, 4))
      .join('_')
      .slice(0, 20);
    const suggested = slug ? 'rw_' + slug : '';
    setForm(p => ({ ...p, rewardId: suggested }));
  }, [form.title, isNew, idTouched]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const set = (k: keyof RewardForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm(p => ({ ...p, [k]: e.target.value }));

  async function handleSave() {
    if (!form.title.trim())         { setError('Nama reward wajib diisi.'); return; }
    if (isNew && !form.rewardId.trim()) { setError('Reward ID wajib diisi.'); return; }
    const cost = Number(form.pointsCost);
    if (form.pointsCost !== '' && (isNaN(cost) || cost < 0)) { setError('Biaya poin harus angka positif.'); return; }

    setLoading(true); setError('');
    try {
      const method = isNew ? 'POST' : 'PATCH';
      const url    = isNew ? '/api/rewards' : `/api/rewards/${reward!.id}`;

      const payload = {
        ...(isNew ? { rewardId: form.rewardId.trim() } : {}),
        title:       form.title.trim(),
        description: form.description.trim(),
        pointsCost:  form.pointsCost !== '' ? Number(form.pointsCost) : 0,
        category:    form.category,
        isActive:    form.isActive,
      };

      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message ?? 'Gagal menyimpan.');

      onSaved(isNew
        ? `Reward "${form.title}" berhasil ditambahkan!`
        : `"${form.title}" berhasil diperbarui.`
      );
      onClose();
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  }

  const section = (label: string) => (
    <p style={{
      fontSize: 10.5, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase',
      color: C.tx3, marginBottom: 14, paddingBottom: 10,
      borderBottom: `1px solid ${C.border2}`, marginTop: 4,
    }}>
      {label}
    </p>
  );

  const cat = CAT_CFG[form.category] ?? CAT_CFG.Drink;

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 50, display: 'flex',
        alignItems: 'center', justifyContent: 'center', padding: 24,
        background: 'rgba(10,12,20,.52)', backdropFilter: 'blur(8px)',
        animation: 'gcFadeIn .18s ease', fontFamily: font,
      }}
    >
      <div style={{
        background: C.white, borderRadius: 22, width: '100%', maxWidth: 560,
        maxHeight: '92vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
        boxShadow: C.shadowLg, animation: 'gcRise .26s cubic-bezier(.22,.68,0,1.15) both',
      }}>

        {/* ── Header ── */}
        <div style={{
          padding: '24px 28px 18px', borderBottom: `1px solid ${C.border2}`,
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 14, background: cat.bg,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
              flexShrink: 0,
            }}>
              {cat.emoji}
            </div>
            <div>
              <p style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: C.blue, marginBottom: 4 }}>
                {isNew ? 'Reward Baru' : 'Edit Reward'}
              </p>
              <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.02em', color: C.tx1, margin: 0 }}>
                {isNew ? 'Tambah Voucher' : reward!.title}
              </h2>
              {!isNew && (
                <code style={{ fontSize: 11, color: C.tx3, background: C.bg, padding: '2px 8px', borderRadius: 6, border: `1px solid ${C.border2}`, display: 'inline-block', marginTop: 4 }}>
                  ID: {reward!.id}
                </code>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ width: 34, height: 34, borderRadius: 9, cursor: 'pointer', border: `1.5px solid ${C.border}`, background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
            onMouseOver={e => (e.currentTarget.style.background = C.bg)}
            onMouseOut={e  => (e.currentTarget.style.background = 'transparent')}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M1 1l10 10M11 1L1 11" stroke={C.tx3} strokeWidth="1.7" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* ── Body ── */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Document ID (create only) */}
          {isNew && (
            <div>
              {section('Document ID')}
              <div>
                <FL required>Reward ID</FL>
                <GcInput
                  placeholder="rw_free_drink (huruf kecil, angka, underscore)"
                  value={form.rewardId}
                  onChange={e => {
                    setIdTouched(true);
                    setForm(p => ({ ...p, rewardId: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '') }));
                  }}
                />
                <p style={{ fontSize: 11.5, color: C.tx3, marginTop: 5 }}>
                  Akan menjadi document ID di Firestore. Contoh:{' '}
                  <code style={{ background: C.bg, padding: '1px 5px', borderRadius: 4, border: `1px solid ${C.border2}` }}>
                    rw_drink_gratis
                  </code>. Tidak bisa diubah setelah disimpan.
                </p>
              </div>
            </div>
          )}

          {/* Info Reward */}
          {section('Informasi Reward')}
          <div>
            <FL required>Nama Reward / Judul Voucher</FL>
            <GcInput placeholder="Free Drink Any Size" value={form.title} onChange={set('title')}/>
          </div>
          <div>
            <FL>Deskripsi</FL>
            <GcTextarea placeholder="Tukarkan poin kamu dengan minuman gratis pilihan..." value={form.description} onChange={set('description')}/>
          </div>

          {/* Poin & Kategori */}
          {section('Poin & Kategori')}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <FL required>Biaya Poin (pointsCost)</FL>
              <GcInput
                type="number"
                min="0"
                step="1"
                placeholder="500"
                value={form.pointsCost}
                onChange={set('pointsCost')}
              />
              <p style={{ fontSize: 11.5, color: C.tx3, marginTop: 4 }}>Isi 0 untuk reward gratis.</p>
            </div>
            <div>
              <FL required>Kategori</FL>
              <GcSelect value={form.category} onChange={set('category')}>
                <option value="Drink">🧋 Drink</option>
                <option value="Topping">🧁 Topping</option>
                <option value="Discount">🎟️ Discount</option>
              </GcSelect>
            </div>
          </div>

          {/* Points preview */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 14,
            padding: '12px 16px', borderRadius: 12,
            background: cat.bg, border: `1.5px solid ${cat.color}22`,
          }}>
            <div style={{ fontSize: 26 }}>{cat.emoji}</div>
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: cat.color, marginBottom: 2 }}>Preview Badge</p>
              <p style={{ fontSize: 13, color: C.tx2 }}>
                {form.title || '(nama reward)'}
                {' · '}
                <strong style={{ color: cat.color }}>
                  {form.pointsCost === '0' || form.pointsCost === '' ? 'Gratis' : `${Number(form.pointsCost).toLocaleString('id')} pts`}
                </strong>
              </p>
            </div>
            <div style={{ marginLeft: 'auto' }}>
              <CategoryBadge category={form.category}/>
            </div>
          </div>

          {/* isActive toggle */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 16px', borderRadius: 12, background: C.bg, border: `1.5px solid ${C.border}`,
          }}>
            <div>
              <p style={{ fontSize: 13.5, fontWeight: 600, color: C.tx1, marginBottom: 2 }}>isActive</p>
              <p style={{ fontSize: 12, color: C.tx3 }}>
                {form.isActive ? 'Reward tersedia untuk di-redeem member' : 'Reward disembunyikan dari member'}
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <StatusPill active={form.isActive}/>
              <button
                type="button"
                onClick={() => setForm(p => ({ ...p, isActive: !p.isActive }))}
                style={{
                  width: 42, height: 24, borderRadius: 99, border: 'none', cursor: 'pointer',
                  background: form.isActive ? C.blue : C.border, position: 'relative', transition: 'background .2s',
                }}
              >
                <span style={{
                  position: 'absolute', top: 3, borderRadius: '50%',
                  width: 18, height: 18, background: '#fff',
                  boxShadow: '0 1px 4px rgba(0,0,0,.2)',
                  left: form.isActive ? 21 : 3,
                  transition: 'left .2s cubic-bezier(.34,1.56,.64,1)', display: 'block',
                }}/>
              </button>
            </div>
          </div>

          {error && (
            <div style={{ padding: '11px 14px', background: C.redBg, border: '1px solid #FECDD3', borderRadius: 9, fontSize: 12.5, color: '#B42318' }}>
              {error}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div style={{
          padding: '16px 28px 24px', borderTop: `1px solid ${C.border2}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
        }}>
          <p style={{ fontSize: 11.5, color: C.tx3 }}>
            Kolom <span style={{ color: C.red }}>*</span> wajib diisi
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={onClose}
              style={{ height: 40, padding: '0 20px', borderRadius: 9, border: `1.5px solid ${C.border}`, background: C.white, color: C.tx2, fontFamily: font, fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}
            >
              Batal
            </button>
            <button
              onClick={handleSave}
              disabled={loading}
              style={{
                height: 40, padding: '0 22px', borderRadius: 9, border: 'none',
                background: loading ? '#9ca3af' : C.blue,
                color: '#fff', fontFamily: font, fontSize: 13.5, fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all .15s', display: 'inline-flex', alignItems: 'center', gap: 7,
              }}
            >
              {loading ? 'Menyimpan…' : isNew ? '+ Tambah Reward' : 'Simpan Perubahan'}
            </button>
          </div>
        </div>
      </div>
      <style>{`@keyframes gcFadeIn{from{opacity:0}to{opacity:1}}@keyframes gcRise{from{opacity:0;transform:translateY(18px) scale(.97)}to{opacity:1;transform:none}}`}</style>
    </div>
  );
}

// ── Reward Card ────────────────────────────────────────────────────────────────
function RewardCard({
  reward, onEdit, onDelete, onToggleActive,
}: {
  reward:        RewardWithId;
  onEdit:        () => void;
  onDelete:      () => void;
  onToggleActive:() => void;
}) {
  const [hoverEdit,   setHoverEdit]   = useState(false);
  const [hoverDel,    setHoverDel]    = useState(false);
  const [hoverToggle, setHoverToggle] = useState(false);
  const [hoverCard,   setHoverCard]   = useState(false);
  const cat = CAT_CFG[reward.category as Category] ?? CAT_CFG.Drink;

  return (
    <div
      onMouseOver={() => setHoverCard(true)}
      onMouseOut={() => setHoverCard(false)}
      style={{
        background: C.white, borderRadius: 18,
        border: `1px solid ${hoverCard ? C.blueMid : C.border}`,
        boxShadow: hoverCard
          ? '0 8px 24px rgba(67,97,238,.10), 0 2px 8px rgba(0,0,0,.06)'
          : C.shadow,
        padding: '20px', display: 'flex', flexDirection: 'column',
        transition: 'all .18s cubic-bezier(.34,1,.64,1)',
        transform: hoverCard ? 'translateY(-2px)' : 'none',
        position: 'relative', overflow: 'hidden',
      }}
    >
      {/* Top accent bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 3,
        background: reward.isActive
          ? `linear-gradient(90deg, ${cat.color}, ${C.blue})`
          : C.border2,
        borderRadius: '18px 18px 0 0',
      }}/>

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{
          width: 46, height: 46, borderRadius: 13,
          background: cat.bg, display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: 22, flexShrink: 0,
        }}>
          {cat.emoji}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5 }}>
          <StatusPill active={reward.isActive}/>
          <code style={{
            fontSize: 9.5, color: C.tx4, background: C.bg,
            padding: '1px 5px', borderRadius: 4, border: `1px solid ${C.border2}`,
          }}>
            {reward.id}
          </code>
        </div>
      </div>

      {/* Content */}
      <p style={{ fontSize: 14, fontWeight: 800, color: C.tx1, marginBottom: 5, lineHeight: 1.3, letterSpacing: '-.01em' }}>
        {reward.title}
      </p>
      <p style={{ fontSize: 12.5, color: C.tx2, lineHeight: 1.55, flex: 1, marginBottom: 14, minHeight: 36 }}>
        {reward.description || <span style={{ color: C.tx4, fontStyle: 'italic' }}>Tidak ada deskripsi.</span>}
      </p>

      {/* Points & category */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <p style={{ fontSize: 10, color: C.tx3, marginBottom: 2, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' }}>Biaya Poin</p>
          <p style={{ fontSize: 22, fontWeight: 800, color: C.blue, letterSpacing: '-.02em', lineHeight: 1 }}>
            {reward.pointsCost === 0
              ? <span style={{ color: C.green }}>Gratis</span>
              : `${reward.pointsCost.toLocaleString('id')}`
            }
            {reward.pointsCost !== 0 && (
              <span style={{ fontSize: 12, fontWeight: 600, color: C.tx3, marginLeft: 3 }}>pts</span>
            )}
          </p>
        </div>
        <CategoryBadge category={reward.category as Category}/>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 7, paddingTop: 14, borderTop: `1px solid ${C.border2}` }}>
        <button
          onClick={onEdit}
          onMouseOver={() => setHoverEdit(true)}
          onMouseOut={() => setHoverEdit(false)}
          style={{
            flex: 1, height: 34, borderRadius: 8, fontFamily: font,
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
            border: `1.5px solid ${hoverEdit ? C.blue : C.border}`,
            background: hoverEdit ? C.blueL : C.white,
            color: hoverEdit ? C.blue : C.tx2,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            transition: 'all .13s',
          }}
        >
          <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
          </svg>
          Edit
        </button>

        <button
          onClick={onToggleActive}
          onMouseOver={() => setHoverToggle(true)}
          onMouseOut={() => setHoverToggle(false)}
          style={{
            flex: 1, height: 34, borderRadius: 8, fontFamily: font,
            fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all .13s',
            border: `1.5px solid ${reward.isActive
              ? (hoverToggle ? '#DC2626' : '#FCA5A5')
              : (hoverToggle ? C.green   : '#86EFAC')
            }`,
            background: reward.isActive
              ? (hoverToggle ? C.redBg  : C.white)
              : (hoverToggle ? C.greenBg: C.white),
            color: reward.isActive
              ? (hoverToggle ? C.red    : '#EF4444')
              : (hoverToggle ? '#027A48': '#16A34A'),
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5,
          }}
        >
          {reward.isActive ? (
            <>
              <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
              Nonaktifkan
            </>
          ) : (
            <>
              <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path d="M20 6L9 17l-5-5"/>
              </svg>
              Aktifkan
            </>
          )}
        </button>

        <button
          onClick={onDelete}
          onMouseOver={() => setHoverDel(true)}
          onMouseOut={() => setHoverDel(false)}
          style={{
            width: 34, height: 34, borderRadius: 8, fontFamily: font,
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
            border: `1.5px solid ${hoverDel ? C.red : C.border}`,
            background: hoverDel ? C.redBg : C.white,
            color: hoverDel ? C.red : C.tx3,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, transition: 'all .13s',
          }}
        >
          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14H6L5 6"/>
            <path d="M9 6V4h6v2"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

// ── Add Card (placeholder) ─────────────────────────────────────────────────────
function AddCard({ onClick }: { onClick: () => void }) {
  const [h, setH] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseOver={() => setH(true)}
      onMouseOut={() => setH(false)}
      style={{
        border: `2px dashed ${h ? C.blue : C.border}`,
        borderRadius: 18,
        background: h ? C.blueL : 'transparent',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        minHeight: 220, cursor: 'pointer',
        transition: 'all .18s', gap: 10,
      }}
    >
      <div style={{
        width: 44, height: 44, borderRadius: 13,
        background: h ? C.blueMid : C.bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all .18s',
        transform: h ? 'scale(1.08)' : 'none',
      }}>
        <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke={h ? C.blue : C.tx3} strokeWidth={2}>
          <line x1="12" y1="5" x2="12" y2="19"/>
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </div>
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: 13.5, fontWeight: 700, color: h ? C.blue : C.tx3, marginBottom: 3 }}>Tambah Voucher</p>
        <p style={{ fontSize: 12, color: C.tx4 }}>Klik untuk menambahkan reward baru</p>
      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function RewardsClient({
  initialRewards,
  showAddTrigger,
}: {
  initialRewards: RewardWithId[];
  showAddTrigger?: boolean;
}) {
  const [rewards,      setRewards]      = useState<RewardWithId[]>(initialRewards);
  const [syncStatus,   setSyncStatus]   = useState<SyncStatus>('connecting');
  const [search,       setSearch]       = useState('');
  const [filter,       setFilter]       = useState<'all' | 'active' | 'inactive'>('all');
  const [catFilter,    setCatFilter]    = useState<'all' | Category>('all');
  const [editTarget,   setEditTarget]   = useState<RewardWithId | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RewardWithId | null>(null);
  const [showAdd,      setShowAdd]      = useState(false);
  const [toast,        setToast]        = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [searchFocus,  setSearchFocus]  = useState(false);
  const [togglingId,   setTogglingId]   = useState<string | null>(null);

  const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => setToast({ msg, type }), []);

  // ── Realtime onSnapshot ─────────────────────────────────────────────────────
  useEffect(() => {
    const q = query(collection(db, 'rewards_catalog'), orderBy('title'));
    const unsub = onSnapshot(
      q,
      snap => {
        setRewards(snap.docs.map(d => ({ id: d.id, ...d.data() } as RewardWithId)));
        setSyncStatus('live');
      },
      err => { console.error('[rewards_catalog onSnapshot]', err); setSyncStatus('error'); }
    );
    return () => unsub();
  }, []);

  // ── Toggle active via API ──────────────────────────────────────────────────
  const handleToggleActive = useCallback(async (reward: RewardWithId) => {
    setTogglingId(reward.id);
    try {
      const r = await fetch(`/api/rewards/${reward.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !reward.isActive }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message ?? 'Gagal update.');
      showToast(
        reward.isActive
          ? `"${reward.title}" dinonaktifkan.`
          : `"${reward.title}" diaktifkan.`
      );
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setTogglingId(null);
    }
  }, [showToast]);

  // ── Filter / search ────────────────────────────────────────────────────────
  const filtered = useMemo(() => rewards.filter(r => {
    const q  = search.toLowerCase();
    const ok = !q || r.title?.toLowerCase().includes(q) || r.id?.toLowerCase().includes(q) || r.description?.toLowerCase().includes(q);
    const f  = filter === 'all' || (filter === 'active' ? r.isActive : !r.isActive);
    const c  = catFilter === 'all' || r.category === catFilter;
    return ok && f && c;
  }), [rewards, search, filter, catFilter]);

  // Stats
  const total    = rewards.length;
  const active   = rewards.filter(r => r.isActive).length;
  const inactive = rewards.filter(r => !r.isActive).length;
  const drinkCnt = rewards.filter(r => r.category === 'Drink').length;

  // Header trigger mode (used in page.tsx header)
  if (showAddTrigger) {
    return (
      <>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <LiveBadge status={syncStatus}/>
          <button
            onClick={() => setShowAdd(true)}
            style={{
              height: 42, padding: '0 20px', borderRadius: 10, border: 'none',
              background: `linear-gradient(135deg, ${C.blue}, #3A0CA3)`,
              color: '#fff', fontFamily: font, fontSize: 13.5, fontWeight: 600,
              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8,
              boxShadow: '0 2px 12px rgba(67,97,238,.35)', transition: 'all .15s',
            }}
            onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(67,97,238,.45)'; }}
            onMouseOut={e  => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 2px 12px rgba(67,97,238,.35)'; }}
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15"/>
            </svg>
            Tambah Voucher
          </button>
        </div>
        {showAdd && (
          <RewardModal
            reward={null}
            onClose={() => setShowAdd(false)}
            onSaved={msg => { showToast(msg); setShowAdd(false); }}
          />
        )}
        {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)}/>}
      </>
    );
  }

  return (
    <>
      {/* ── Stats Row ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 22 }}>
        {[
          { label: 'Total Reward', value: total,    color: C.blue,   bg: C.blueL,   icon: 'gift'  },
          { label: 'Aktif',        value: active,   color: C.green,  bg: C.greenBg, icon: 'check' },
          { label: 'Nonaktif',     value: inactive, color: C.red,    bg: C.redBg,   icon: 'x'     },
          { label: 'Drink',        value: drinkCnt, color: '#2563EB',bg: '#DBEAFE',  icon: 'drink' },
        ].map(s => (
          <div key={s.label} style={{
            background: C.white, border: `1px solid ${C.border}`,
            borderRadius: 18, boxShadow: C.shadow,
            padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14,
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12, background: s.bg,
              flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {s.icon === 'gift' && (
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke={s.color} strokeWidth={2}>
                  <polyline points="20 12 20 22 4 22 4 12"/>
                  <rect x="2" y="7" width="20" height="5"/>
                  <line x1="12" y1="22" x2="12" y2="7"/>
                  <path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z"/>
                  <path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z"/>
                </svg>
              )}
              {s.icon === 'check' && (
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke={s.color} strokeWidth={2.5}>
                  <path d="M20 6L9 17l-5-5"/>
                </svg>
              )}
              {s.icon === 'x' && (
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke={s.color} strokeWidth={2.5}>
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              )}
              {s.icon === 'drink' && (
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke={s.color} strokeWidth={2}>
                  <path d="M8 2h8l1 6H7L8 2z"/>
                  <path d="M7 8c0 5 1 10 5 12S17 13 17 8"/>
                  <line x1="5" y1="2" x2="19" y2="2"/>
                </svg>
              )}
            </div>
            <div>
              <p style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: C.tx3, marginBottom: 4 }}>
                {s.label}
              </p>
              <p style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-.02em', color: s.color, lineHeight: 1 }}>
                {s.value}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Toolbar ───────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>

          {/* Search */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, height: 40, padding: '0 13px',
            minWidth: 220, background: C.white,
            border: `1.5px solid ${searchFocus ? C.blue : C.border}`,
            borderRadius: 10,
            boxShadow: searchFocus ? '0 0 0 3px rgba(67,97,238,.1)' : 'none',
            transition: 'all .14s',
          }}>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke={C.tx3} strokeWidth={2.2}>
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontFamily: font, fontSize: 13.5, color: C.tx1 }}
              placeholder="Cari reward, ID…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onFocus={() => setSearchFocus(true)}
              onBlur={() => setSearchFocus(false)}
            />
            {search && (
              <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.tx3, fontSize: 15, padding: 0 }}>✕</button>
            )}
          </div>

          {/* Status filter */}
          <div style={{ display: 'flex', background: C.bg, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: 3 }}>
            {(['all', 'active', 'inactive'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{
                padding: '5px 14px', borderRadius: 7, border: 'none',
                fontFamily: font, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                transition: 'all .13s',
                background: filter === f ? C.white : 'transparent',
                color:      filter === f ? C.tx1   : C.tx3,
                boxShadow:  filter === f ? C.shadow : 'none',
              }}>
                {f === 'all' ? 'Semua' : f === 'active' ? 'Aktif' : 'Nonaktif'}
              </button>
            ))}
          </div>

          {/* Category filter */}
          <div style={{ display: 'flex', background: C.bg, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: 3 }}>
            {(['all', 'Drink', 'Topping', 'Discount'] as const).map(c => {
              const cfg = c !== 'all' ? CAT_CFG[c] : null;
              return (
                <button key={c} onClick={() => setCatFilter(c)} style={{
                  padding: '5px 13px', borderRadius: 7, border: 'none',
                  fontFamily: font, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                  transition: 'all .13s',
                  background: catFilter === c ? C.white : 'transparent',
                  color:      catFilter === c ? (cfg?.color ?? C.tx1) : C.tx3,
                  boxShadow:  catFilter === c ? C.shadow : 'none',
                }}>
                  {cfg ? `${cfg.emoji} ${cfg.label}` : 'Semua'}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <LiveBadge status={syncStatus}/>
          <span style={{ fontSize: 12.5, color: C.tx3 }}>
            {filtered.length} / {rewards.length} reward
          </span>
          <button
            onClick={() => setShowAdd(true)}
            style={{
              height: 38, padding: '0 16px', borderRadius: 9, border: 'none',
              background: `linear-gradient(135deg, ${C.blue}, #3A0CA3)`,
              color: '#fff', fontFamily: font, fontSize: 12.5, fontWeight: 600,
              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
              boxShadow: '0 2px 10px rgba(67,97,238,.3)', transition: 'all .15s',
            }}
            onMouseOver={e => (e.currentTarget.style.boxShadow = '0 4px 16px rgba(67,97,238,.45)')}
            onMouseOut={e  => (e.currentTarget.style.boxShadow = '0 2px 10px rgba(67,97,238,.3)')}
          >
            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15"/>
            </svg>
            Tambah Voucher
          </button>
        </div>
      </div>

      {/* ── Grid ──────────────────────────────────────────────────────────── */}
      {rewards.length === 0 && syncStatus !== 'connecting' ? (
        <div style={{
          background: C.white, borderRadius: 20, border: `1px solid ${C.border}`,
          boxShadow: C.shadow, padding: '80px 24px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🎁</div>
          <p style={{ fontSize: 16, fontWeight: 800, color: C.tx1, marginBottom: 6 }}>Belum ada reward</p>
          <p style={{ fontSize: 13.5, color: C.tx3, marginBottom: 22 }}>
            Mulai tambahkan voucher pertama kamu.
          </p>
          <button
            onClick={() => setShowAdd(true)}
            style={{
              height: 42, padding: '0 24px', borderRadius: 10, border: 'none',
              background: `linear-gradient(135deg, ${C.blue}, #3A0CA3)`,
              color: '#fff', fontFamily: font, fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(67,97,238,.35)',
            }}
          >
            + Tambah Voucher Pertama
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{
          background: C.white, borderRadius: 20, border: `1px solid ${C.border}`,
          boxShadow: C.shadow, padding: '60px 24px', textAlign: 'center',
        }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: C.tx1, marginBottom: 6 }}>Tidak ada hasil</p>
          <p style={{ fontSize: 13, color: C.tx3 }}>
            {syncStatus === 'connecting' ? 'Memuat data…' : `Tidak ada reward untuk filter yang dipilih.`}
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {filtered.map(reward => (
            <RewardCard
              key={reward.id}
              reward={{ ...reward, isActive: togglingId === reward.id ? !reward.isActive : reward.isActive }}
              onEdit={() => setEditTarget(reward)}
              onDelete={() => setDeleteTarget(reward)}
              onToggleActive={() => handleToggleActive(reward)}
            />
          ))}
          <AddCard onClick={() => setShowAdd(true)}/>
        </div>
      )}

      {/* ── Footer count ──────────────────────────────────────────────────── */}
      {rewards.length > 0 && (
        <div style={{
          marginTop: 20, padding: '12px 18px', background: C.white,
          border: `1px solid ${C.border}`, borderRadius: 14,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          boxShadow: C.shadow,
        }}>
          <p style={{ fontSize: 12, color: C.tx3 }}>
            <strong style={{ color: C.tx2 }}>{active}</strong> aktif ·{' '}
            <strong style={{ color: C.tx2 }}>{inactive}</strong> nonaktif ·{' '}
            <strong style={{ color: C.tx2 }}>{drinkCnt}</strong> drink ·{' '}
            <strong style={{ color: C.tx2 }}>{rewards.filter(r => r.category === 'Topping').length}</strong> topping ·{' '}
            <strong style={{ color: C.tx2 }}>{rewards.filter(r => r.category === 'Discount').length}</strong> discount
          </p>
          <p style={{ fontSize: 12, color: C.tx3 }}>
            Rata-rata poin: <strong style={{ color: C.blue }}>
              {rewards.length ? Math.round(rewards.reduce((a, r) => a + r.pointsCost, 0) / rewards.length).toLocaleString('id') : 0} pts
            </strong>
          </p>
        </div>
      )}

      {/* ── Modals ────────────────────────────────────────────────────────── */}
      {editTarget   && (
        <RewardModal
          reward={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={msg => { showToast(msg); setEditTarget(null); }}
        />
      )}
      {showAdd && (
        <RewardModal
          reward={null}
          onClose={() => setShowAdd(false)}
          onSaved={msg => { showToast(msg); setShowAdd(false); }}
        />
      )}
      {deleteTarget && (
        <DeleteModal
          reward={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={msg => { showToast(msg); setDeleteTarget(null); }}
        />
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)}/>}
    </>
  );
}