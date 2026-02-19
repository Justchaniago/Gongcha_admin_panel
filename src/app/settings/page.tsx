"use client";
import { useState } from "react";

function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button onClick={onChange}
      className="w-11 h-6 rounded-full transition-all relative flex-shrink-0"
      style={{ background: on ? "#4361EE" : "#E2E8F0" }}>
      <span className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all"
            style={{ left: on ? "22px" : "2px" }} />
    </button>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-border shadow-card overflow-hidden">
      <div className="px-6 py-4" style={{ borderBottom: "1px solid #F1F5F9" }}>
        <h2 className="font-display font-bold text-tx1">{title}</h2>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="mb-5 last:mb-0">
      <label className="block text-xs font-semibold text-tx2 mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-tx3 mt-1">{hint}</p>}
    </div>
  );
}

export default function SettingsPage() {
  const [notifs, setNotifs] = useState({ email: true, push: true, weekly: false });

  return (
    <div className="p-8 max-w-[1400px]">
      <div className="mb-8">
        <h1 className="font-display text-2xl font-bold text-tx1">Global Settings</h1>
        <p className="text-sm text-tx2 mt-1">Konfigurasi sistem poin, tier member, dan preferensi notifikasi.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Point Config */}
        <Card title="💎 Konfigurasi Poin">
          <Field label="Poin per Rp 1.000" hint="Setiap Rp 1.000 transaksi = X poin">
            <input type="number" defaultValue={10} className="w-full border border-border rounded-xl px-4 py-2.5 text-sm text-tx1 bg-s2 outline-none focus:border-blue1 transition-colors" />
          </Field>
          <Field label="Minimum Transaksi (Rp)" hint="Transaksi di bawah ini tidak mendapat poin">
            <input type="number" defaultValue={25000} className="w-full border border-border rounded-xl px-4 py-2.5 text-sm text-tx1 bg-s2 outline-none focus:border-blue1 transition-colors" />
          </Field>
          <Field label="Masa Berlaku Poin">
            <select className="w-full border border-border rounded-xl px-4 py-2.5 text-sm text-tx1 bg-s2 outline-none focus:border-blue1 transition-colors">
              <option>1 Tahun</option>
              <option>6 Bulan</option>
              <option>Tidak Kedaluwarsa</option>
            </select>
          </Field>
          <button className="w-full py-2.5 rounded-xl text-white text-sm font-semibold shadow-card-blue hover:opacity-90 transition-all" style={{ background: "linear-gradient(135deg,#4361EE,#3A0CA3)" }}>
            Simpan Konfigurasi Poin
          </button>
        </Card>

        {/* Tier Config */}
        <Card title="🏅 Konfigurasi Tier Member">
          {[
            { tier: "Platinum", req: "50.000 pts lifetime", bonus: "3x multiplier", color: "#6D28D9", bg: "#EDE9FE", border: "#C4B5FD" },
            { tier: "Gold",     req: "10.000 pts lifetime", bonus: "2x multiplier", color: "#D97706", bg: "#FEF3C7", border: "#FDE68A" },
            { tier: "Silver",   req: "0 pts (default)",     bonus: "1x multiplier", color: "#64748B", bg: "#F1F5F9", border: "#E2E8F0" },
          ].map(t => (
            <div key={t.tier} className="rounded-xl p-4 mb-3 last:mb-0 border" style={{ background: t.bg, borderColor: t.border }}>
              <div className="flex items-center justify-between mb-2">
                <p className="font-display font-bold" style={{ color: t.color }}>{t.tier}</p>
                <button className="text-xs px-3 py-1 border border-border rounded-lg bg-white text-tx2 hover:text-blue1 hover:border-blue1 transition-all">Edit</button>
              </div>
              <p className="text-xs text-tx2">Syarat: <span className="font-semibold text-tx1">{t.req}</span></p>
              <p className="text-xs text-tx2">Bonus: <span className="font-semibold text-tx1">{t.bonus}</span></p>
            </div>
          ))}
        </Card>

        {/* Notifications */}
        <Card title="🔔 Notifikasi Admin">
          {[
            { key: "email" as const, label: "Email saat ada transaksi pending", sub: "ferry@gongcha.id" },
            { key: "push"  as const, label: "Push alert outlet non-aktif", sub: "Browser notification" },
            { key: "weekly" as const, label: "Laporan mingguan otomatis", sub: "Setiap Senin 08:00 WIB" },
          ].map(n => (
            <div key={n.key} className="flex items-center justify-between py-4" style={{ borderBottom: "1px solid #F1F5F9" }}>
              <div>
                <p className="text-sm font-medium text-tx1">{n.label}</p>
                <p className="text-xs text-tx3">{n.sub}</p>
              </div>
              <Toggle on={notifs[n.key]} onChange={() => setNotifs(prev => ({ ...prev, [n.key]: !prev[n.key] }))} />
            </div>
          ))}
        </Card>

        {/* Danger Zone */}
        <Card title="⚠️ Danger Zone">
          <div className="rounded-xl border border-red-200 overflow-hidden" style={{ background: "#FFF5F5" }}>
            {[
              { title: "Reset Semua Poin Member", desc: "Mengatur ulang currentPoints semua user ke 0. Tidak dapat dibatalkan." },
              { title: "Hapus Riwayat Transaksi", desc: "Menghapus semua dokumen di subcollection transactions. Permanen." },
            ].map((d, i) => (
              <div key={d.title} className="p-4" style={{ borderTop: i > 0 ? "1px solid #FEE2E2" : "none" }}>
                <p className="text-sm font-semibold text-red-700">{d.title}</p>
                <p className="text-xs text-red-500 mt-0.5 mb-3">{d.desc}</p>
                <button className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-red-300 text-red-600 hover:bg-red-100 transition-all">
                  {d.title.split(" ").slice(0, 2).join(" ")}
                </button>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
