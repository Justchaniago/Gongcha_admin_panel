"use client";
// src/components/SetupUserButton.tsx
// Button untuk setup user yang sudah login sebagai admin
// Hanya muncul jika user belum terdaftar di staff collection

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { getAuth, reload } from "firebase/auth";
import { app } from "../lib/firebaseClient";

export default function SetupUserButton() {
  const { user, role, loading: authLoading, logout } = useAuth();
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

      setResult(data.message || "Setup complete! Refreshing token...");
      
      // Force Firebase token refresh to get new custom claims
      const auth = getAuth(app);
      if (auth.currentUser) {
        await reload(auth.currentUser);
        // Force token refresh
        await auth.currentUser.getIdToken(true);
      }
      
      // Reload page after token refresh
      setTimeout(() => {
        window.location.reload();
      }, 1500);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div style={{ 
      padding: "16px", 
      background: "#FEF3F2", 
      border: "1px solid #FECACA",
      borderRadius: "8px",
      marginBottom: "16px"
    }}>
      <h3 style={{ margin: "0 0 8px 0", color: "#991B1B", fontSize: "16px" }}>
        ⚠️ Permission Error
      </h3>
      <p style={{ margin: "0 0 12px 0", color: "#7F1D1D", fontSize: "14px" }}>
        Anda sudah login tapi belum terdaftar sebagai staff/admin. 
        Klik tombol di bawah untuk setup akses admin.
      </p>
      
      <button
        onClick={handleSetup}
        disabled={loading}
        style={{
          padding: "8px 16px",
          background: loading ? "#9CA3AF" : "#C8102E",
          color: "white",
          border: "none",
          borderRadius: "6px",
          cursor: loading ? "not-allowed" : "pointer",
          fontSize: "14px",
          fontWeight: "500"
        }}
      >
        {loading ? "Setting up..." : "Setup Admin Access"}
      </button>

      {result && (
        <p style={{ margin: "12px 0 0 0", color: "#059669", fontSize: "14px" }}>
          ✅ {result} Reloading...
        </p>
      )}
      
      {error && (
        <p style={{ margin: "12px 0 0 0", color: "#DC2626", fontSize: "14px" }}>
          ❌ Error: {error}
        </p>
      )}
    </div>
  );
}
