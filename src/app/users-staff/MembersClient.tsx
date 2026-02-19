"use client";

import { useState, useMemo } from "react";
import { User, Staff, UserTier, UserRole, StaffRole } from "@/types/firestore";

type UserWithUid = User & { uid: string };
type StaffWithUid = Staff & { uid: string };

const TIER: Record<string, { bg: string; color: string }> = {
  Platinum: { bg: "#EDE9FE", color: "#6D28D9" },
  Gold:     { bg: "#FEF3C7", color: "#D97706" },
  Silver:   { bg: "#F1F5F9", color: "#64748B" },
};

const ROLE_STAFF: Record<string, { bg: string; color: string; label: string }> = {
  cashier:       { bg: "#EEF2FF", color: "#4361EE", label: "Kasir" },
  store_manager: { bg: "#D1FAE5", color: "#059669", label: "Manajer" },
  admin:         { bg: "#FEE2E2", color: "#DC2626", label: "Admin" },
};

// ─── Modal: Detail Member ────────────────────────────────────────────────────
function MemberDetailModal({ user, onClose, onEdit }: {
  user: UserWithUid;
  onClose: () => void;
  onEdit: () => void;
}) {
  const tier = TIER[user.tier] ?? TIER.Silver;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(15,23,42,0.4)", backdropFilter: "blur(4px)" }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: "1px solid #F1F5F9" }}>
          <h2 className="font-display font-bold text-tx1 text-lg">Detail Member</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-s2 transition-colors text-tx3">✕</button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Avatar & name */}
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-xl font-bold flex-shrink-0"
              style={{ background: "linear-gradient(135deg,#4361EE,#7C3AED)" }}>
              {user.name?.[0] ?? "?"}
            </div>
            <div>
              <p className="font-display font-bold text-tx1 text-lg">{user.name}</p>
              <p className="text-xs text-tx3">{user.email}</p>
              <p className="text-xs text-tx3">{user.phoneNumber}</p>
            </div>
            <span className="ml-auto text-[11px] font-semibold px-3 py-1.5 rounded-full"
              style={{ background: tier.bg, color: tier.color }}>{user.tier}</span>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Poin Aktif", value: (user.currentPoints ?? 0).toLocaleString("id"), color: "#4361EE" },
              { label: "Lifetime XP", value: (user.lifetimePoints ?? 0).toLocaleString("id"), color: "#7C3AED" },
              { label: "Voucher", value: (user.vouchers?.length ?? 0).toString(), color: "#059669" },
            ].map(s => (
              <div key={s.label} className="rounded-xl p-3 text-center" style={{ background: "#F8FAFF" }}>
                <p className="font-display font-bold text-lg" style={{ color: s.color }}>{s.value}</p>
                <p className="text-[10px] text-tx3 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Info */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs py-2" style={{ borderBottom: "1px solid #F1F5F9" }}>
              <span className="text-tx3">UID</span>
              <code className="text-blue1 bg-blueLight px-2 py-0.5 rounded">{user.uid}</code>
            </div>
            <div className="flex justify-between text-xs py-2" style={{ borderBottom: "1px solid #F1F5F9" }}>
              <span className="text-tx3">Role</span>
              <span className="text-tx1 font-medium">{user.role}</span>
            </div>
            <div className="flex justify-between text-xs py-2" style={{ borderBottom: "1px solid #F1F5F9" }}>
              <span className="text-tx3">Bergabung</span>
              <span className="text-tx1">{user.joinedDate ? new Date(user.joinedDate).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "-"}</span>
            </div>
          </div>

          {/* XP History */}
          {user.xpHistory?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-tx2 mb-2">Riwayat XP (5 terbaru)</p>
              <div className="space-y-2">
                {[...user.xpHistory].reverse().slice(0, 5).map((x) => (
                  <div key={x.id} className="flex items-center justify-between rounded-xl px-3 py-2" style={{ background: "#F8FAFF" }}>
                    <div>
                      <p className="text-xs font-medium text-tx1">{x.context}</p>
                      <p className="text-[10px] text-tx3">{x.location} · {new Date(x.date).toLocaleDateString("id-ID")}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold" style={{ color: x.type === "earn" ? "#059669" : "#DC2626" }}>
                        {x.type === "earn" ? "+" : "-"}{x.amount.toLocaleString("id")} pts
                      </p>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{
                        background: x.status === "verified" ? "#D1FAE5" : x.status === "pending" ? "#FEF3C7" : "#FEE2E2",
                        color: x.status === "verified" ? "#059669" : x.status === "pending" ? "#D97706" : "#DC2626"
                      }}>{x.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Vouchers */}
          {user.vouchers?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-tx2 mb-2">Voucher Aktif</p>
              <div className="space-y-2">
                {user.vouchers.filter(v => !v.isUsed).map((v) => (
                  <div key={v.id} className="flex items-center justify-between rounded-xl px-3 py-2 border" style={{ borderColor: "#E2E8F0" }}>
                    <div>
                      <p className="text-xs font-medium text-tx1">{v.title}</p>
                      <code className="text-[10px] text-blue1">{v.code}</code>
                    </div>
                    <p className="text-[10px] text-tx3">Exp: {new Date(v.expiresAt).toLocaleDateString("id-ID")}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 flex gap-2 justify-end" style={{ borderTop: "1px solid #F1F5F9" }}>
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-tx2 border border-border hover:bg-s2 transition-colors">Tutup</button>
          <button onClick={onEdit} className="px-4 py-2 rounded-xl text-sm text-white font-semibold transition-all"
            style={{ background: "linear-gradient(135deg,#4361EE,#3A0CA3)" }}>Edit Member</button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal: Edit Member ──────────────────────────────────────────────────────
function EditMemberModal({ user, onClose, onSaved }: {
  user: UserWithUid;
  onClose: () => void;
  onSaved: (updated: Partial<UserWithUid>) => void;
}) {
  const [form, setForm] = useState({
    name: user.name ?? "",
    tier: user.tier ?? "Silver",
    currentPoints: user.currentPoints ?? 0,
    lifetimePoints: user.lifetimePoints ?? 0,
    role: user.role ?? "member",
    phoneNumber: user.phoneNumber ?? "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/members/${user.uid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Gagal menyimpan");
      onSaved(form);
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(15,23,42,0.4)", backdropFilter: "blur(4px)" }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: "1px solid #F1F5F9" }}>
          <h2 className="font-display font-bold text-tx1 text-lg">Edit Member</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-s2 transition-colors text-tx3">✕</button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {[
            { label: "Nama", key: "name", type: "text" },
            { label: "No. HP", key: "phoneNumber", type: "text" },
            { label: "Poin Aktif", key: "currentPoints", type: "number" },
            { label: "Lifetime Points", key: "lifetimePoints", type: "number" },
          ].map(f => (
            <div key={f.key}>
              <label className="text-xs font-medium text-tx2 block mb-1">{f.label}</label>
              <input
                type={f.type}
                value={form[f.key as keyof typeof form]}
                onChange={e => setForm(p => ({ ...p, [f.key]: f.type === "number" ? Number(e.target.value) : e.target.value }))}
                className="w-full border border-border rounded-xl px-3 py-2 text-sm text-tx1 outline-none focus:border-blue1 transition-colors"
              />
            </div>
          ))}

          <div>
            <label className="text-xs font-medium text-tx2 block mb-1">Tier</label>
            <select value={form.tier} onChange={e => setForm(p => ({ ...p, tier: e.target.value as UserTier }))}
              className="w-full border border-border rounded-xl px-3 py-2 text-sm text-tx1 outline-none focus:border-blue1 transition-colors">
              {["Silver", "Gold", "Platinum"].map(t => <option key={t}>{t}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-tx2 block mb-1">Role</label>
            <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value as UserRole }))}
              className="w-full border border-border rounded-xl px-3 py-2 text-sm text-tx1 outline-none focus:border-blue1 transition-colors">
              {["member", "admin", "trial", "master"].map(r => <option key={r}>{r}</option>)}
            </select>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <div className="px-6 py-4 flex gap-2 justify-end" style={{ borderTop: "1px solid #F1F5F9" }}>
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-tx2 border border-border hover:bg-s2 transition-colors">Batal</button>
          <button onClick={handleSave} disabled={loading}
            className="px-4 py-2 rounded-xl text-sm text-white font-semibold transition-all disabled:opacity-50"
            style={{ background: "linear-gradient(135deg,#4361EE,#3A0CA3)" }}>
            {loading ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal: Edit Staff ───────────────────────────────────────────────────────
function EditStaffModal({ staff, storeIds, onClose, onSaved }: {
  staff: StaffWithUid;
  storeIds: string[];
  onClose: () => void;
  onSaved: (updated: Partial<StaffWithUid>) => void;
}) {
  const [form, setForm] = useState({
    name: staff.name ?? "",
    role: staff.role ?? "cashier",
    storeLocation: staff.storeLocation ?? "",
    isActive: staff.isActive ?? true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/staff/${staff.uid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Gagal menyimpan");
      onSaved(form);
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(15,23,42,0.4)", backdropFilter: "blur(4px)" }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: "1px solid #F1F5F9" }}>
          <h2 className="font-display font-bold text-tx1 text-lg">Edit Staff</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-s2 transition-colors text-tx3">✕</button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-tx2 block mb-1">Nama</label>
            <input type="text" value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              className="w-full border border-border rounded-xl px-3 py-2 text-sm text-tx1 outline-none focus:border-blue1 transition-colors" />
          </div>

          <div>
            <label className="text-xs font-medium text-tx2 block mb-1">Role</label>
            <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value as StaffRole }))}
              className="w-full border border-border rounded-xl px-3 py-2 text-sm text-tx1 outline-none focus:border-blue1 transition-colors">
              <option value="cashier">Kasir</option>
              <option value="store_manager">Manajer</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-tx2 block mb-1">Outlet</label>
            <select value={form.storeLocation} onChange={e => setForm(p => ({ ...p, storeLocation: e.target.value }))}
              className="w-full border border-border rounded-xl px-3 py-2 text-sm text-tx1 outline-none focus:border-blue1 transition-colors">
              {storeIds.map(id => <option key={id} value={id}>{id}</option>)}
            </select>
          </div>

          <div className="flex items-center justify-between rounded-xl px-4 py-3" style={{ background: "#F8FAFF" }}>
            <span className="text-sm text-tx1">Status Aktif</span>
            <button onClick={() => setForm(p => ({ ...p, isActive: !p.isActive }))}
              className="relative w-10 h-6 rounded-full transition-colors"
              style={{ background: form.isActive ? "#4361EE" : "#CBD5E1" }}>
              <span className="absolute top-1 transition-all rounded-full w-4 h-4 bg-white shadow"
                style={{ left: form.isActive ? "20px" : "4px" }} />
            </button>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <div className="px-6 py-4 flex gap-2 justify-end" style={{ borderTop: "1px solid #F1F5F9" }}>
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-tx2 border border-border hover:bg-s2 transition-colors">Batal</button>
          <button onClick={handleSave} disabled={loading}
            className="px-4 py-2 rounded-xl text-sm text-white font-semibold transition-all disabled:opacity-50"
            style={{ background: "linear-gradient(135deg,#4361EE,#3A0CA3)" }}>
            {loading ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Client Component ───────────────────────────────────────────────────
export default function MembersClient({
  initialUsers = [],
  initialStaff = [],
  storeIds,
}: {
  initialUsers?: UserWithUid[];
  initialStaff?: StaffWithUid[];
  storeIds: string[];
}) {
  const [users, setUsers] = useState<UserWithUid[]>(initialUsers || []);
  const [staff, setStaff] = useState<StaffWithUid[]>(initialStaff || []);
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState<string>("All");

  // Modal states
  const [detailUser, setDetailUser] = useState<UserWithUid | null>(null);
  const [editUser, setEditUser] = useState<UserWithUid | null>(null);
  const [editStaff, setEditStaff] = useState<StaffWithUid | null>(null);

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchSearch = search === "" ||
        u.name?.toLowerCase().includes(search.toLowerCase()) ||
        u.email?.toLowerCase().includes(search.toLowerCase()) ||
        u.phoneNumber?.includes(search);
      const matchTier = tierFilter === "All" || u.tier === tierFilter;
      return matchSearch && matchTier;
    });
  }, [users, search, tierFilter]);

  function handleUserSaved(uid: string, updated: Partial<UserWithUid>) {
    setUsers(prev => prev.map(u => u.uid === uid ? { ...u, ...updated } : u));
  }

  function handleStaffSaved(uid: string, updated: Partial<StaffWithUid>) {
    setStaff(prev => prev.map(s => s.uid === uid ? { ...s, ...updated } : s));
  }

  return (
    <div className="p-8 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-2xl font-bold text-tx1">User & Staff Management</h1>
          <p className="text-sm text-tx2 mt-1">Kelola member, tier, poin, dan akses staff.</p>
        </div>
        <button className="px-4 py-2.5 rounded-xl text-white text-sm font-semibold shadow-card-blue"
          style={{ background: "linear-gradient(135deg,#4361EE,#3A0CA3)" }}>
          + Tambah Staff
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Member", value: users.length, color: "#4361EE", bg: "#EEF2FF" },
          { label: "Platinum", value: users.filter(u => u.tier === "Platinum").length, color: "#6D28D9", bg: "#EDE9FE" },
          { label: "Gold", value: users.filter(u => u.tier === "Gold").length, color: "#D97706", bg: "#FEF3C7" },
          { label: "Total Staff", value: staff.length, color: "#059669", bg: "#D1FAE5" },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-2xl border border-border shadow-card p-5">
            <p className="text-xs text-tx2 mb-2">{c.label}</p>
            <p className="font-display text-3xl font-bold" style={{ color: c.color }}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Members Table */}
      <div className="bg-white rounded-2xl border border-border shadow-card overflow-hidden mb-4">
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid #F1F5F9" }}>
          <h2 className="font-display font-bold text-tx1">Daftar Member ({filteredUsers.length}/{users.length})</h2>
          <div className="flex items-center gap-2">
            {/* Tier filter */}
            <div className="flex gap-1">
              {["All", "Platinum", "Gold", "Silver"].map(t => (
                <button key={t} onClick={() => setTierFilter(t)}
                  className="text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-all"
                  style={tierFilter === t
                    ? { background: "#4361EE", color: "white" }
                    : { background: "#F1F5F9", color: "#64748B" }}>
                  {t}
                </button>
              ))}
            </div>
            {/* Search */}
            <div className="flex items-center gap-2 bg-s2 border border-border rounded-xl px-3 py-2 w-48">
              <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="#94A3B8" strokeWidth={2}>
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input
                className="flex-1 text-xs outline-none text-tx2 bg-transparent"
                placeholder="Cari member..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              {search && (
                <button onClick={() => setSearch("")} className="text-tx3 hover:text-tx1 text-xs">✕</button>
              )}
            </div>
          </div>
        </div>

        {filteredUsers.length === 0 ? (
          <div className="py-16 text-center text-tx3 text-sm">
            {search || tierFilter !== "All" ? "Tidak ada member yang cocok." : "Belum ada member terdaftar."}
          </div>
        ) : (
          <table className="w-full">
            <thead style={{ background: "#F8FAFF" }}>
              <tr>
                {["Member", "Email", "Tier", "Poin", "Lifetime", "Role", "Aksi"].map(h => (
                  <th key={h} className="text-left text-[11px] font-semibold text-tx3 uppercase tracking-wide px-6 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => {
                const tier = TIER[u.tier] ?? TIER.Silver;
                return (
                  <tr key={u.uid} className="hover:bg-s2 transition-colors cursor-pointer"
                    style={{ borderTop: "1px solid #F1F5F9" }}
                    onClick={() => setDetailUser(u)}>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                          style={{ background: "linear-gradient(135deg,#4361EE,#7C3AED)" }}>
                          {u.name?.[0] ?? "?"}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-tx1">{u.name}</p>
                          <code className="text-[10px] text-tx3">{u.uid.slice(0, 12)}...</code>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-3 text-xs text-tx2">{u.email}</td>
                    <td className="px-6 py-3">
                      <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
                        style={{ background: tier.bg, color: tier.color }}>{u.tier}</span>
                    </td>
                    <td className="px-6 py-3 font-display font-bold text-blue1">{(u.currentPoints ?? 0).toLocaleString("id")}</td>
                    <td className="px-6 py-3 text-xs text-tx2">{(u.lifetimePoints ?? 0).toLocaleString("id")}</td>
                    <td className="px-6 py-3 text-xs text-tx2">{u.role}</td>
                    <td className="px-6 py-3" onClick={e => e.stopPropagation()}>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setDetailUser(u)}
                          className="text-xs px-3 py-1.5 border border-border rounded-lg text-tx2 hover:border-blue1 hover:text-blue1 transition-all">
                          Detail
                        </button>
                        <button
                          onClick={() => setEditUser(u)}
                          className="text-xs px-3 py-1.5 border border-border rounded-lg text-tx2 hover:border-blue1 hover:text-blue1 transition-all">
                          Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Staff Table */}
      <div className="bg-white rounded-2xl border border-border shadow-card overflow-hidden">
        <div className="px-6 py-4" style={{ borderBottom: "1px solid #F1F5F9" }}>
          <h2 className="font-display font-bold text-tx1">Staff & Kasir ({staff.length})</h2>
        </div>

        {staff.length === 0 ? (
          <div className="py-16 text-center text-tx3 text-sm">Belum ada staff terdaftar. Jalankan seeder staff.</div>
        ) : (
          <table className="w-full">
            <thead style={{ background: "#F8FAFF" }}>
              <tr>
                {["Staff", "Email", "Role", "Outlet", "Status", "Aksi"].map(h => (
                  <th key={h} className="text-left text-[11px] font-semibold text-tx3 uppercase tracking-wide px-6 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => {
                const r = ROLE_STAFF[s.role] ?? ROLE_STAFF.cashier;
                return (
                  <tr key={s.uid} className="hover:bg-s2 transition-colors" style={{ borderTop: "1px solid #F1F5F9" }}>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-s2 border border-border flex items-center justify-center text-tx2 text-xs font-bold flex-shrink-0">
                          {s.name?.[0] ?? "?"}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-tx1">{s.name}</p>
                          <code className="text-[10px] text-tx3">{s.uid.slice(0, 12)}...</code>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-3 text-xs text-tx2">{s.email}</td>
                    <td className="px-6 py-3">
                      <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
                        style={{ background: r.bg, color: r.color }}>{r.label}</span>
                    </td>
                    <td className="px-6 py-3">
                      <code className="text-[11px] bg-blueLight text-blue1 px-2 py-0.5 rounded">{s.storeLocation}</code>
                    </td>
                    <td className="px-6 py-3">
                      <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
                        style={{ background: s.isActive ? "#D1FAE5" : "#F1F5F9", color: s.isActive ? "#059669" : "#94A3B8" }}>
                        {s.isActive ? "Aktif" : "Nonaktif"}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <button
                        onClick={() => setEditStaff(s)}
                        className="text-xs px-3 py-1.5 border border-border rounded-lg text-tx2 hover:border-blue1 hover:text-blue1 transition-all">
                        Edit
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modals */}
      {detailUser && !editUser && (
        <MemberDetailModal
          user={detailUser}
          onClose={() => setDetailUser(null)}
          onEdit={() => { setEditUser(detailUser); setDetailUser(null); }}
        />
      )}
      {editUser && (
        <EditMemberModal
          user={editUser}
          onClose={() => setEditUser(null)}
          onSaved={(updated) => handleUserSaved(editUser.uid, updated)}
        />
      )}
      {editStaff && (
        <EditStaffModal
          staff={editStaff}
          storeIds={storeIds}
          onClose={() => setEditStaff(null)}
          onSaved={(updated) => handleStaffSaved(editStaff.uid, updated)}
        />
      )}
    </div>
  );
}