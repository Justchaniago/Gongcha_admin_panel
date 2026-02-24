"use client";
import { useRouter } from "next/navigation";

const font = "'Plus Jakarta Sans', system-ui, sans-serif";

export default function UnauthorizedOverlay() {
  const router = useRouter();
  
  return (
    <div style={{ position: "relative", minHeight: "calc(100vh - 64px)", overflow: "hidden", background: "#F4F6FB" }}>
      {/* 1. Fake Dashboard Skeleton (Kerangka Tiruan yang Aman) */}
      <div style={{
        position: "absolute",
        inset: 0,
        zIndex: 1,
        pointerEvents: "none",
        userSelect: "none",
        overflow: "hidden",
      }}>
        <div style={{
          padding: "40px",
          filter: "blur(16px)",
          opacity: 0.7,
          minHeight: "100vh",
        }}>
          <div style={{ width: "25%", height: "32px", background: "#D1D5DB", borderRadius: "8px", marginBottom: "8px", animation: "pulse 1.5s infinite" }} />
          <div style={{ width: "40%", height: "16px", background: "#E5E7EB", borderRadius: "8px", marginBottom: "32px", animation: "pulse 1.5s infinite 0.2s" }} />
          <div style={{ display: "flex", gap: "20px", marginBottom: "32px" }}>
            <div style={{ flex: 1, height: "120px", background: "#E5E7EB", borderRadius: "16px", animation: "pulse 1.5s infinite 0.3s" }} />
            <div style={{ flex: 1, height: "120px", background: "#E5E7EB", borderRadius: "16px", animation: "pulse 1.5s infinite 0.5s" }} />
            <div style={{ flex: 1, height: "120px", background: "#E5E7EB", borderRadius: "16px", animation: "pulse 1.5s infinite 0.7s" }} />
            <div style={{ flex: 1, height: "120px", background: "#E5E7EB", borderRadius: "16px", animation: "pulse 1.5s infinite 0.9s" }} />
          </div>
          <div style={{ width: "100%", height: "400px", background: "#E5E7EB", borderRadius: "16px", animation: "pulse 1.5s infinite 1.1s" }} />
        </div>
        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 0.7; }
            50% { opacity: 1; }
          }
        `}</style>
      </div>
      {/* 2. Glassmorphism Overlay (Memblokir Interaksi) */}
      <div style={{
        position: "absolute", inset: 0,
        background: "rgba(244, 246, 251, 0.4)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24, zIndex: 50,
      }}>
        {/* 3. Modal Box Original */}
        <div style={{
          background: "#fff", borderRadius: 24, padding: "48px 40px", maxWidth: 440, width: "100%",
          boxShadow: "0 20px 60px rgba(16,24,40,.12)", textAlign: "center",
        }}>
          <div style={{
            width: 72, height: 72, borderRadius: 20, background: "#FEF2F2",
            display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px",
          }}>
            <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="#DC2626" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/>
            </svg>
          </div>
          <span style={{
            display: "inline-block", padding: "4px 12px", borderRadius: 99,
            background: "#FEF2F2", color: "#DC2626", fontSize: 11, fontWeight: 700,
            letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 16,
          }}>
            403 — Akses Ditolak
          </span>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: "#0F1117", marginBottom: 12, letterSpacing: "-.02em" }}>
            Tidak Ada Izin
          </h1>
          <p style={{ fontSize: 14, color: "#4A5065", lineHeight: 1.7, marginBottom: 32 }}>
            Akun Anda tidak memiliki izin untuk mengakses halaman ini.
            Hubungi administrator jika Anda merasa ini adalah kesalahan.
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <button
              onClick={() => router.back()}
              style={{
                height: 42, padding: "0 20px", borderRadius: 10,
                border: "1.5px solid #E2E8F0", background: "#fff",
                color: "#4A5065", fontFamily: font, fontSize: 13.5, fontWeight: 600,
                cursor: "pointer",
              }}
            >
              ← Kembali
            </button>
            <button
              onClick={() => router.push("/dashboard")}
              style={{
                height: 42, padding: "0 20px", borderRadius: 10, border: "none",
                background: "linear-gradient(135deg,#4361EE,#3A0CA3)",
                color: "#fff", fontFamily: font, fontSize: 13.5, fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Ke Dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
