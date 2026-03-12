import { useState } from "react";
import { Reward } from "@/types/firestore";
import { GcButton, GcFieldLabel, GcInput, GcModalShell, GcSelect } from "@/components/ui/gc";
const C = {
  white:    '#FFFFFF',
  border:   '#EAECF2',
  tx1:      '#0F1117',
  tx2:      '#4A5065',
  red:      '#C8102E',
  purple:   '#6D28D9',
  shadowLg: '0 20px 60px rgba(16,24,40,.18), 0 4px 12px rgba(16,24,40,.08)',
};
const font = "Inter, system-ui, sans-serif";

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
        setError('All fields are required.'); setLoading(false); return;
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
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message ?? 'Failed to inject voucher.');
      onSuccess('Voucher successfully injected to user!');
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  }

  return (
    <GcModalShell
      onClose={onClose}
      title="Inject Voucher to User"
      eyebrow="Voucher Injection"
      description="Specify the target user and reward to inject manually."
      maxWidth={460}
      footer={
        <>
          <GcButton variant="ghost" size="lg" onClick={onClose}>
            Cancel
          </GcButton>
          <GcButton variant="blue" size="lg" onClick={handleInject} loading={loading}>
            Inject Voucher
          </GcButton>
        </>
      }
    >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <GcFieldLabel required>UID User</GcFieldLabel>
            <GcInput placeholder="Enter user UID" value={uid} onChange={e => setUid(e.target.value)} />
          </div>
          <div>
            <GcFieldLabel required>Select Voucher (Reward)</GcFieldLabel>
            <GcSelect value={rewardId} onChange={e => setRewardId(e.target.value)}>
              <option value="">Select reward...</option>
              {rewards.map(r => (
                <option key={r.id} value={r.id}>{r.title}</option>
              ))}
            </GcSelect>
          </div>
          <div>
            <GcFieldLabel required>Voucher Code</GcFieldLabel>
            <GcInput placeholder="Unique voucher code" value={code} onChange={e => setCode(e.target.value)} />
          </div>
          <div>
            <GcFieldLabel required>Expiration Date</GcFieldLabel>
            <GcInput type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} />
          </div>
          {error && <div style={{ color: C.red, fontSize: 13, marginTop: 6 }}>{error}</div>}
        </div>
    </GcModalShell>
  );
}
