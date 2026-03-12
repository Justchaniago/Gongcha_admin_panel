"use client";
import { useState, useEffect } from "react";
import { GcButton, GcFieldLabel, GcInput, GcModalShell, GcSelect } from "@/components/ui/gc";
const C = {
  white:    '#FFFFFF',
  border:   '#EAECF2',
  tx1:      '#0F1117',
  tx2:      '#4A5065',
  red:      '#C8102E',
  purple:   '#7C3AED',
  shadowLg: '0 20px 60px rgba(16,24,40,.18), 0 4px 12px rgba(16,24,40,.08)',
};
const font = "Inter, system-ui, sans-serif";

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
        setError('User UID not found. Please close and reopen form.');
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
    <GcModalShell
      onClose={onClose}
      title="Inject Voucher to User"
      eyebrow="Member Reward"
      description="Select an active/inactive voucher, set a code, then inject it directly to this member."
      maxWidth={460}
      footer={
        <>
          <GcButton variant="ghost" size="lg" onClick={onClose}>
            Batal
          </GcButton>
          <GcButton
            variant="blue"
            size="lg"
            onClick={handleInject}
            loading={loading}
            disabled={!uid || typeof uid !== 'string' || uid.trim() === ''}
            title={!uid ? 'UID user tidak ditemukan. Tidak bisa suntik voucher.' : undefined}
          >
            Suntik Voucher
          </GcButton>
        </>
      }
    >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <GcFieldLabel>Pilih Voucher</GcFieldLabel>
            <GcSelect
              value={rewardId}
              onChange={e => {
                setRewardId(e.target.value);
                const selected = rewards.find(r => r.id === e.target.value);
                if (selected) setTitle(selected.title);
              }}
            >
              <option value="">-- Pilih voucher --</option>
              {rewards.map(r => (
                <option key={r.id} value={r.id}>
                  {r.title} ({r.id}){!r.isActive ? ' [Nonaktif]' : ''}
                </option>
              ))}
            </GcSelect>
          </div>
          <div>
            <GcFieldLabel>Judul Voucher</GcFieldLabel>
            <GcInput placeholder="Judul voucher" value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          <div>
            <GcFieldLabel>Kode Voucher</GcFieldLabel>
            <GcInput placeholder="Kode unik voucher" value={code} onChange={e => setCode(e.target.value)} />
            <div style={{ fontSize: 11, color: C.tx2, marginTop: 2 }}>Otomatis terisi, bisa diganti manual jika perlu.</div>
          </div>
          <div>
            <GcFieldLabel>Tanggal Kadaluarsa</GcFieldLabel>
            <GcInput type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} />
          </div>
          {error && <div style={{ color: C.red, fontSize: 13, marginTop: 6 }}>{error}</div>}
        </div>
    </GcModalShell>
  );
}
