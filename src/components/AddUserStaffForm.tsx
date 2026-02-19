"use client";
import { useState } from "react";
import { addUser, addStaff, deleteUser, deleteStaff } from "@/lib/userStaffActions";

export default function AddUserStaffForm() {
  const [type, setType] = useState<"user"|"staff">("user");
  const [uid, setUid] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string|null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!uid || !email || !role) {
      setMsg("Semua field wajib diisi.");
      return;
    }
    setLoading(true);
    try {
      if (type === "user") {
        await addUser(uid, { email, role });
      } else {
        await addStaff(uid, { email, role });
      }
      setMsg(`✅ Berhasil menambah ${type}.`);
      setUid(""); setEmail(""); setRole("");
    } catch (err: any) {
      setMsg("❌ Gagal menyimpan: " + (err.message || err.toString()));
    }
    setLoading(false);
  }

  async function handleDelete() {
    setMsg(null);
    if (!uid) {
      setMsg("Masukkan UID yang ingin dihapus.");
      return;
    }
    setLoading(true);
    try {
      if (type === "user") {
        await deleteUser(uid);
      } else {
        await deleteStaff(uid);
      }
      setMsg(`✅ Berhasil menghapus ${type}.`);
      setUid(""); setEmail(""); setRole("");
    } catch (err: any) {
      setMsg("❌ Gagal menghapus: " + (err.message || err.toString()));
    }
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 340, margin: "32px auto", padding: 24, border: "1px solid #E2E8F0", borderRadius: 14, background: "#fff", boxShadow: "0 2px 8px rgba(67,97,238,.06)" }}>
      <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 18 }}>Tambah User/Staff</h3>
      <div style={{ marginBottom: 14 }}>
        <label style={{ fontWeight: 600, fontSize: 13, marginRight: 10 }}>
          <input type="radio" checked={type==="user"} onChange={()=>setType("user")}/> User
        </label>
        <label style={{ fontWeight: 600, fontSize: 13 }}>
          <input type="radio" checked={type==="staff"} onChange={()=>setType("staff")}/> Staff
        </label>
      </div>
      <div style={{ marginBottom: 12 }}>
        <input value={uid} onChange={e=>setUid(e.target.value)} placeholder="UID" style={{ width: "100%", padding: 8, borderRadius: 7, border: "1px solid #E2E8F0", fontSize: 14 }}/>
      </div>
      <div style={{ marginBottom: 12 }}>
        <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" style={{ width: "100%", padding: 8, borderRadius: 7, border: "1px solid #E2E8F0", fontSize: 14 }}/>
      </div>
      <div style={{ marginBottom: 16 }}>
        <input value={role} onChange={e=>setRole(e.target.value)} placeholder="Role (admin/cashier)" style={{ width: "100%", padding: 8, borderRadius: 7, border: "1px solid #E2E8F0", fontSize: 14 }}/>
      </div>
      <button type="submit" disabled={loading} style={{ width: "100%", padding: 10, borderRadius: 8, background: loading ? "#c7d2fe" : "#4361EE", color: "#fff", fontWeight: 700, fontSize: 15, border: "none", cursor: loading ? "not-allowed" : "pointer", marginBottom: 8 }}>
        {loading ? "Menyimpan..." : `Tambah ${type}`}
      </button>
      <button type="button" onClick={handleDelete} disabled={loading} style={{ width: "100%", padding: 10, borderRadius: 8, background: loading ? "#fee2e2" : "#C8102E", color: "#fff", fontWeight: 700, fontSize: 15, border: "none", cursor: loading ? "not-allowed" : "pointer" }}>
        {loading ? "Menghapus..." : `Hapus ${type}`}
      </button>
      {msg && <div style={{ marginTop: 14, color: msg.startsWith("✅") ? "#12B76A" : "#C8102E", fontSize: 13 }}>{msg}</div>}
    </form>
  );
}
