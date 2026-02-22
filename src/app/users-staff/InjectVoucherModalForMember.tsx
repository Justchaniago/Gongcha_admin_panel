"use client";
import { useState, useEffect } from "react";
import { GcInput, FL } from "./MembersClient";
const C = {
  white:    '#FFFFFF',
  border:   '#EAECF2',
  tx1:      '#0F1117',
  tx2:      '#4A5065',
  red:      '#C8102E',
  purple:   '#7C3AED',
  shadowLg: '0 20px 60px rgba(16,24,40,.18), 0 4px 12px rgba(16,24,40,.08)',
};
const font = "'Plus Jakarta Sans', system-ui, sans-serif";

export default function InjectVoucherModalForMember({ uid, onClose, onSuccess }: {
  uid?: string;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}) {
  const [rewardId, setRewardId] = useState('');
  const [title, setTitle] = useState('');
  const [rewards, setRewards] = useState<{ id: string; title: string; isActive: boolean; type: string }[]>([]);
  // Fetch semua rewards (voucher) dari API secara realtime saat modal dibuka
  useEffect(() => {
    let ignore = false;
    async function fetchRewards() {
      try {
        const res = await fetch('/api/rewards');
        const data = await res.json();
        if (!ignore && data.rewards) {
          setRewards(data.rewards); // tanpa filter isActive
        }
      } catch {}
    }
    fetchRewards();
    return () => { ignore = true; };
  }, []);
  // Generate kode voucher random format GC-XXXX
  function generateVoucherCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let rand = '';
    for (let i = 0; i < 4; i++) rand += chars[Math.floor(Math.random() * chars.length)];
    return `GC-${rand}`;
  }

  const [code, setCode] = useState(generateVoucherCode());

  // Set kode voucher baru setiap kali reward diganti
  useEffect(() => {
    setCode(generateVoucherCode());
  }, [rewardId]);
  const [expiresAt, setExpiresAt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleInject() {
    setLoading(true); setError('');
    try {
      if (!uid || typeof uid !== 'string' || uid.trim() === '') {
        setError('UID user tidak ditemukan. Silakan tutup dan buka ulang form.');
        setLoading(false);
        // Debug log
        // eslint-disable-next-line no-console
        console.error('InjectVoucherModalForMember: UID kosong!', { uid });
        return;
      }
      if (!rewardId || !title || !code || !expiresAt) {
        setError('Semua field wajib diisi.'); setLoading(false); return;
      }
      // Debug log
      // eslint-disable-next-line no-console
      const url = `/api/members/${uid}/vouchers`;
      console.log('InjectVoucherModalForMember: Suntik voucher ke UID', uid, 'URL:', url);
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rewardId, title, code, expiresAt }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message ?? 'Gagal suntik voucher.');
      onSuccess('Voucher berhasil disuntikkan ke user!');
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  }

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(10,12,20,.52)', backdropFilter: 'blur(8px)' }}>
      <div style={{ background: C.white, borderRadius: 22, width: '100%', maxWidth: 420, boxShadow: C.shadowLg, padding: '32px 28px', fontFamily: font }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: C.tx1, marginBottom: 18 }}>Suntik Voucher ke User</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <FL required>Pilih Voucher</FL>
            <select
              value={rewardId}
              onChange={e => {
                setRewardId(e.target.value);
                const selected = rewards.find(r => r.id === e.target.value);
                if (selected) setTitle(selected.title);
              }}
              style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: `1.5px solid ${C.border}`, fontFamily: font, fontSize: 15 }}
            >
              <option value="">-- Pilih voucher --</option>
              {rewards.map(r => (
                <option key={r.id} value={r.id}>
                  {r.title} ({r.id}){!r.isActive ? ' [Nonaktif]' : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <FL required>Judul Voucher</FL>
            <GcInput placeholder="Judul voucher" value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          <div>
            <FL required>Kode Voucher</FL>
            <GcInput placeholder="Kode unik voucher" value={code} onChange={e => setCode(e.target.value)} />
            <div style={{ fontSize: 11, color: C.tx2, marginTop: 2 }}>Otomatis terisi, bisa diganti manual jika perlu.</div>
          </div>
          <div>
            <FL required>Tanggal Kadaluarsa</FL>
            <GcInput type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} />
          </div>
          {error && <div style={{ color: C.red, fontSize: 13, marginTop: 6 }}>{error}</div>}
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ height: 40, padding: '0 20px', borderRadius: 9, border: `1.5px solid ${C.border}`, background: C.white, color: C.tx2, fontFamily: font, fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>Batal</button>
          <button onClick={handleInject} disabled={loading || !uid || typeof uid !== 'string' || uid.trim() === ''} style={{ height: 40, padding: '0 22px', borderRadius: 9, border: 'none', background: loading || !uid || typeof uid !== 'string' || uid.trim() === '' ? '#9ca3af' : C.purple, color: '#fff', fontFamily: font, fontSize: 13.5, fontWeight: 600, cursor: loading || !uid || typeof uid !== 'string' || uid.trim() === '' ? 'not-allowed' : 'pointer', transition: 'all .15s' }} title={!uid ? 'UID user tidak ditemukan. Tidak bisa suntik voucher.' : undefined}>{loading ? 'Menyuntik…' : 'Suntik Voucher'}</button>
        </div>
      </div>
    </div>
  );
}