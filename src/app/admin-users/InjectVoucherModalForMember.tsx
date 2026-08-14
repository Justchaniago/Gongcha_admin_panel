"use client";

import React, { useState, useEffect } from "react";
import { GcModalShell, GcButton, GcSelect, GcFieldLabel, GcInput } from "@/components/ui/gc";
import { Reward } from "@/types/firestore";
import { FastApiAdminGateway } from "@/lib/api/FastApiAdminGateway";

interface InjectVoucherModalProps {
  uid: string;
  memberName?: string;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

export default function InjectVoucherModalForMember({ uid, memberName: nameProp = "Member", onClose, onSuccess }: InjectVoucherModalProps) {
  const [availableRewards, setAvailableRewards] = useState<Reward[]>([]);
  const [memberName] = useState(nameProp);
  const [selectedRewardId, setSelectedRewardId] = useState("");
  const [voucherTitle, setVoucherTitle] = useState("");
  const [voucherCode, setVoucherCode] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(true);
  const [error, setError] = useState("");

  // Helper untuk generate kode
  const generateCode = () => `GC-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

  useEffect(() => {
    async function initData() {
      try {
        setFetchingData(true);
        const fetched = await FastApiAdminGateway.getRewards();
        const list = fetched
          .filter((r: any) => (r.isActive ?? r.is_active) !== false)
          .map((r: any) => ({
            id: r.id || r.code,
            title: r.title,
            description: r.description || "",
            pointsrequired: r.pointsrequired ?? r.points_required ?? 0,
            isActive: true,
            imageUrl: r.imageUrl || r.image_url || "",
          } as any));

        setAvailableRewards(list);
        
        if (list.length > 0) {
          const first = list[0];
          setSelectedRewardId(first.id);
          setVoucherTitle(first.title);
          setVoucherCode(generateCode());
          const d = new Date();
          d.setDate(d.getDate() + 30);
          setExpiresAt(d.toISOString().split('T')[0]);
        }
      } catch (err: any) {
        console.error("Error init data:", err);
        setError("Gagal memuat data rewards.");
      } finally {
        setFetchingData(false);
      }
    }
    initData();
  }, [uid]);

  const handleInject = async () => {
    if (!selectedRewardId || !voucherTitle || !voucherCode || !expiresAt) {
      setError("Semua kolom wajib diisi.");
      return;
    }
    
    setLoading(true);
    setError("");
    
    try {
      const res = await fetch(`/api/members/${uid}/vouchers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          rewardId: selectedRewardId,
          title: voucherTitle,
          code: voucherCode,
          expiresAt
        }),
      });

      if (!res.ok) throw new Error("Gagal menyuntikkan voucher.");

      onSuccess(`Voucher berhasil disuntikkan ke ${memberName}.`);
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <GcModalShell
      onClose={onClose}
      title="Suntik Voucher Member"
      eyebrow="Direct Injection"
      description={<>Berikan voucher khusus kepada <strong>{memberName}</strong> secara manual.</>}
      maxWidth={480}
      footer={
        <>
          <GcButton variant="ghost" onClick={onClose}>Batal</GcButton>
          <GcButton 
            variant="blue" 
            onClick={handleInject} 
            loading={loading} 
            disabled={fetchingData || availableRewards.length === 0}
          >
            Suntik Voucher
          </GcButton>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {fetchingData ? (
          <p style={{ fontSize: 13, color: "#9299B0" }}>Menyiapkan data...</p>
        ) : availableRewards.length === 0 ? (
          <div style={{ padding: 12, background: "#FEF3F2", borderRadius: 8, border: "1px solid #FEE2E2" }}>
            <p style={{ fontSize: 12.5, color: "#B42318" }}>
              {error || "Tidak ada voucher aktif di katalog Rewards."}
            </p>
          </div>
        ) : (
          <>
            <div>
              <GcFieldLabel required>Pilih Tipe Voucher</GcFieldLabel>
              <GcSelect value={selectedRewardId} onChange={(e) => {
                const sel = availableRewards.find(r => r.id === e.target.value);
                setSelectedRewardId(e.target.value);
                if (sel) {
                  setVoucherTitle(sel.title);
                  setVoucherCode(generateCode());
                }
              }}>
                {availableRewards.map((r) => (
                  <option key={r.id} value={r.id}>{r.title}</option>
                ))}
              </GcSelect>
            </div>

            <div>
              <GcFieldLabel required>Judul Voucher (Akan Muncul di App User)</GcFieldLabel>
              <GcInput value={voucherTitle} onChange={e => setVoucherTitle(e.target.value)} />
            </div>

            <div>
              <GcFieldLabel required>Kode Voucher</GcFieldLabel>
              <GcInput value={voucherCode} onChange={e => setVoucherCode(e.target.value)} />
            </div>

            <div>
              <GcFieldLabel required>Tanggal Kadaluarsa</GcFieldLabel>
              <GcInput type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} />
            </div>
          </>
        )}

        {error && !fetchingData && availableRewards.length > 0 && (
          <p style={{ fontSize: 12, color: "#B42318" }}>{error}</p>
        )}
      </div>
    </GcModalShell>
  );
}