"use client";
// src/components/SetupUserButton.tsx

import { useState } from "react";
import { reload, getIdToken } from "firebase/auth";
import { auth } from "@/lib/firebaseClient"; // Gunakan auth dari lib kita
import { useAuth } from "@/context/AuthContext"; // Gunakan hook baru kita

export default function SetupUserButton() {
  // PERBAIKAN: Destructuring user (role ada di dalam user)
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSetup = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/setup-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Setup failed");
      }

      setResult(data.message || "Setup berhasil! Memperbarui hak akses...");
      
      // Force Firebase token refresh untuk mendapatkan custom claims (role) baru
      if (auth.currentUser) {
        await reload(auth.currentUser);
        await getIdToken(auth.currentUser, true); // Force refresh token
      }
      
      // Reload halaman agar Middleware membaca cookie baru
      setTimeout(() => {
        window.location.reload();
      }, 1500);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  // PERBAIKAN: Gunakan 'user' sebagai pengganti 'session'
  if (authLoading || !user) return null;

  // Hanya tampilkan jika user belum punya role (untuk jaga-jaga)
  // atau jika Anda ingin tombol ini tetap ada sebagai sekoci penyelamat
  return (
    <div style={{ 
      padding: "16px", 
      background: "#FEF3F2", 
      border: "1px solid #FECACA",
      borderRadius: "12px",
      marginBottom: "16px",
      fontFamily: "'Plus Jakarta Sans', sans-serif"
    }}>
      <h3 style={{ margin: "0 0 8px 0", color: "#991B1B", fontSize: "16px", fontWeight: 700 }}>
        ⚠️ Hak Akses Belum Terkonfigurasi
      </h3>
      <p style={{ margin: "0 0 12px 0", color: "#7F1D1D", fontSize: "13.5px", lineHeight: 1.5 }}>
        Anda berhasil login, namun sistem belum mendeteksi peran (role) Anda sebagai staf atau admin. 
        Klik tombol di bawah untuk mendaftarkan akun Anda secara otomatis.
      </p>
      
      <button
        onClick={handleSetup}
        disabled={loading}
        style={{
          padding: "10px 20px",
          background: loading ? "#9CA3AF" : "#C8102E",
          color: "white",
          border: "none",
          borderRadius: "8px",
          cursor: loading ? "not-allowed" : "pointer",
          fontSize: "13.5px",
          fontWeight: "600",
          transition: "all .2s"
        }}
      >
        {loading ? "Sedang Memproses..." : "Konfigurasi Akses Admin"}
      </button>

      {result && (
        <p style={{ margin: "12px 0 0 0", color: "#059669", fontSize: "13px", fontWeight: 600 }}>
          ✅ {result} Segera memuat ulang...
        </p>
      )}
      
      {error && (
        <p style={{ margin: "12px 0 0 0", color: "#DC2626", fontSize: "13px", fontWeight: 600 }}>
          ❌ Error: {error}
        </p>
      )}
    </div>
  );
}