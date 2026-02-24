"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { createAccountAction } from "@/actions/userStaffActions";

export default function AddUserStaffForm() {
  // Ambil user dari context. Role sekarang ada di dalam user: user.role
  const { user: currentUser } = useAuth();
  
  const [type, setType] = useState<"user" | "staff">("user");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [roleInput, setRoleInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; isError: boolean } | null>(null);

  // Pengecekan permission dari currentUser?.role
  const currentUserRole = currentUser?.role;
  const hasPermission = currentUserRole === "admin" || currentUserRole === "master" || currentUserRole === "manager";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    
    if (!hasPermission || !currentUser) {
      setMsg({ text: "❌ Akses ditolak: Hanya Admin/Manager.", isError: true });
      return;
    }
    if (!email || !password || !roleInput) {
      setMsg({ text: "Email, Password, dan Role wajib diisi.", isError: true });
      return;
    }
    if (password.length < 8) {
      setMsg({ text: "Password minimal 8 karakter.", isError: true });
      return;
    }

    setLoading(true);
    try {
      // Gunakan Server Action yang kita buat di Fase 2.2
      // Kita map 'user' ke 'member' agar sesuai dengan payload action
      const payload = {
        email,
        password,
        name: email.split('@')[0], // Nama default dari email
        role: roleInput,
      };

      await createAccountAction(payload, type === "user" ? "member" : "staff");

      setMsg({ text: `✅ Berhasil membuat akun ${type}.`, isError: false });
      setEmail(""); setPassword(""); setRoleInput("");
    } catch (err: any) {
      setMsg({ text: "❌ Error: " + err.message, isError: true });
    }
    setLoading(false);
  }

  return (
    <form 
      onSubmit={handleSubmit} 
      className="w-full max-w-md mx-auto my-8 p-6 border border-slate-200 rounded-2xl bg-white shadow-sm"
    >
      <h3 className="text-xl font-bold mb-5 text-slate-800">Manajemen Akses Sistem</h3>
      
      {!hasPermission && (
        <div className="mb-5 p-4 bg-red-50 text-red-600 text-sm rounded-xl border border-red-200 flex items-start gap-3">
          <span className="text-lg">🔒</span>
          <p>Login sebagai: <b className="capitalize">{currentUserRole || "Guest"}</b>. Pembuatan akun dikunci.</p>
        </div>
      )}

      <div className="flex gap-6 mb-5">
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 cursor-pointer">
          <input 
            type="radio" checked={type==="user"} onChange={()=>setType("user")}
            className="accent-blue-600 w-4 h-4" disabled={!hasPermission}
          /> User Data
        </label>
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 cursor-pointer">
          <input 
            type="radio" checked={type==="staff"} onChange={()=>setType("staff")}
            className="accent-blue-600 w-4 h-4" disabled={!hasPermission}
          /> Staff Data
        </label>
      </div>

      <div className="mb-4">
        <input 
          value={email} onChange={e=>setEmail(e.target.value)}
          placeholder="Alamat Email Akun Baru" type="email" disabled={!hasPermission}
          className="w-full p-3.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-50 disabled:cursor-not-allowed"
        />
      </div>

      <div className="mb-4">
        <input 
          value={password} onChange={e=>setPassword(e.target.value)}
          placeholder="Password Sementara" type="password" disabled={!hasPermission}
          className="w-full p-3.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-50 disabled:cursor-not-allowed"
        />
      </div>

      <div className="mb-6">
        <input 
          value={roleInput} onChange={e=>setRoleInput(e.target.value)}
          placeholder="Role (contoh: cashier, staff)" disabled={!hasPermission}
          className="w-full p-3.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-50 disabled:cursor-not-allowed"
        />
      </div>

      <button 
        type="submit" disabled={loading || !hasPermission}
        className="w-full py-3.5 rounded-xl bg-blue-600 text-white font-bold text-sm mb-3 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? "Memproses Pembuatan Akun..." : `Buat Akun ${type} Baru`}
      </button>

      {msg && (
        <div className={`mt-5 text-sm p-4 rounded-xl ${!msg.isError ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"} border`}>
          {msg.text}
        </div>
      )}
    </form>
  );
}