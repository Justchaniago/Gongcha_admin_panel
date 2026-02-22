import { useState } from "react";
import { Reward } from "@/types/firestore";
import { GcInput, GcSelect, FL } from "./RewardsClient";
const C = {
  white:    '#FFFFFF',
  border:   '#EAECF2',
  tx1:      '#0F1117',
  tx2:      '#4A5065',
  red:      '#C8102E',
  purple:   '#6D28D9',
  shadowLg: '0 20px 60px rgba(16,24,40,.18), 0 4px 12px rgba(16,24,40,.08)',
};
const font = "'Plus Jakarta Sans', system-ui, sans-serif";

export default function InjectVoucherModal({ rewards, onClose, onSuccess }: {
  rewards: (Reward & { id: string })[];
  onClose: () => void;
  onSuccess: (msg: string) => void;
}) {
  const [uid, setUid] = useState('');
  const [rewardId, setRewardId] = useState('');
  const [code, setCode] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleInject() {
    setLoading(true); setError('');
    try {
      const reward = rewards.find(r => r.id === rewardId);
      if (!uid || !rewardId || !code || !expiresAt) {
        setError('Semua field wajib diisi.'); setLoading(false); return;
      }
      const res = await fetch(`/api/members/${uid}/vouchers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rewardId: rewardId,
          title: reward?.title || '',
          code,
          expiresAt,
        }),
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
            <FL required>UID User</FL>
            <GcInput placeholder="Masukkan UID user" value={uid} onChange={e => setUid(e.target.value)} />
          </div>
          <div>
            <FL required>Pilih Voucher (Reward)</FL>
            <GcSelect value={rewardId} onChange={e => setRewardId(e.target.value)}>
              <option value="">Pilih reward…</option>
              {rewards.map(r => (
                <option key={r.id} value={r.id}>{r.title}</option>
              ))}
            </GcSelect>
          </div>
          <div>
            <FL required>Kode Voucher</FL>
            <GcInput placeholder="Kode unik voucher" value={code} onChange={e => setCode(e.target.value)} />
          </div>
          <div>
            <FL required>Tanggal Kadaluarsa</FL>
            <GcInput type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} />
          </div>
          {error && <div style={{ color: C.red, fontSize: 13, marginTop: 6 }}>{error}</div>}
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ height: 40, padding: '0 20px', borderRadius: 9, border: `1.5px solid ${C.border}`, background: C.white, color: C.tx2, fontFamily: font, fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>Batal</button>
          <button onClick={handleInject} disabled={loading} style={{ height: 40, padding: '0 22px', borderRadius: 9, border: 'none', background: loading ? '#9ca3af' : C.purple, color: '#fff', fontFamily: font, fontSize: 13.5, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', transition: 'all .15s' }}>{loading ? 'Menyuntik…' : 'Suntik Voucher'}</button>
        </div>
      </div>
    </div>
  );
}