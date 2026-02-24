"use client";
// src/components/PermissionSettingsPanel.tsx
// Check user registration status via API

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";

const font = "'Plus Jakarta Sans',system-ui,sans-serif";
const C = {
  bg:"#F4F6FB", white:"#FFFFFF", border:"#EAECF2", border2:"#F0F2F7",
  tx1:"#0F1117", tx2:"#4A5065", tx3:"#9299B0",
  blue:"#4361EE", blueL:"#EEF2FF", blueD:"#3A0CA3",
  green:"#059669", red:"#DC2626", amber:"#F59E0B",
  greenBg:"#D1FAE5",
  shadow:"0 1px 3px rgba(16,24,40,.06)",
} as const;

export default function PermissionSettingsPanel() {
  const { user, loading: authLoading, logout } = useAuth();
  const role = user?.role;
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{type: "success" | "error"; message: string} | null>(null);
  const [isRegistered, setIsRegistered] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);

  // Check registration status via API
  useEffect(() => {
    const checkRegistration = async () => {
      if (!user?.email) {
        setChecking(false);
        return;
      }

      try {
        const res = await fetch("/api/setup-user", { method: "GET" });
        const data = await res.json();
        
        console.log("📊 Registration check:", data);
        setIsRegistered(data.exists || false);
      } catch (err) {
        console.error("❌ Error checking registration:", err);
        setIsRegistered(false);
      } finally {
        setChecking(false);
      }
    };

    checkRegistration();
  }, [user]);

  const handleSetup = async () => {
    setLoading(true);
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

      setResult({
        type: "success",
        message: data.message || "Akses admin berhasil diaktifkan!"
      });
      
      // Reload page after 2 seconds
      setTimeout(() => {
        window.location.reload();
      }, 2000);
      
    } catch (err) {
      setResult({
        type: "error",
        message: err instanceof Error ? err.message : "Terjadi kesalahan"
      });
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;
  
  // Loading state
  if (checking) {
    return (
      <div style={{ 
        background: C.white, 
        borderRadius: 18, 
        border: `1px solid ${C.border}`, 
        boxShadow: C.shadow, 
        overflow: "hidden",
        marginBottom: 16,
        padding: 24
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ 
            width: 20, 
            height: 20, 
            borderRadius: "50%", 
            border: `2px solid ${C.blue}`, 
            borderTopColor: "transparent", 
            animation: "spin .7s linear infinite" 
          }}/>
          <span style={{ fontFamily: font, fontSize: 14, color: C.tx2 }}>
            Mengecek status akses database...
          </span>
        </div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  // User is registered - Show green panel
  if (isRegistered) {
    return (
      <div style={{ 
        background: C.white, 
        borderRadius: 18, 
        border: `1px solid ${C.border}`, 
        boxShadow: C.shadow, 
        overflow: "hidden",
        marginBottom: 16
      }}>
        {/* Header - Green */}
        <div style={{ 
          padding: "16px 24px", 
          borderBottom: `1px solid ${C.border2}`,
          background: "linear-gradient(135deg, #ECFDF3 0%, #F0FDF4 100%)"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ 
              width: 32, 
              height: 32, 
              borderRadius: 8, 
              background: C.green,
              display: "flex", 
              alignItems: "center", 
              justifyContent: "center",
              color: "white",
              fontSize: 16
            }}>
              ✓
            </div>
            <div>
              <h2 style={{ 
                fontFamily: font, 
                fontSize: 15, 
                fontWeight: 800, 
                color: C.green, 
                margin: 0 
              }}>
                Akses Database Aktif
              </h2>
              <p style={{ 
                fontFamily: font, 
                fontSize: 12, 
                color: C.tx2, 
                margin: "4px 0 0 0" 
              }}>
                Akun Anda sudah terdaftar dan memiliki akses penuh
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: 24 }}>
          <div style={{ 
            padding: 16, 
            borderRadius: 12, 
            background: C.bg,
            border: `1px solid ${C.border}`,
          }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <div style={{ 
                width: 40, 
                height: 40, 
                borderRadius: 10, 
                background: C.greenBg,
                display: "flex", 
                alignItems: "center", 
                justifyContent: "center",
                flexShrink: 0
              }}>
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke={C.green} strokeWidth={2}>
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </div>
              <div>
                <h3 style={{ 
                  fontFamily: font, 
                  fontSize: 14, 
                  fontWeight: 700, 
                  color: C.tx1, 
                  margin: "0 0 6px 0" 
                }}>
                  Status: Terautentikasi
                </h3>
                <p style={{ 
                  fontFamily: font, 
                  fontSize: 13, 
                  color: C.tx2, 
                  margin: 0,
                  lineHeight: 1.5
                }}>
                  Akun <strong>{user.email}</strong> sudah terdaftar di database 
                  dan memiliki akses admin penuh ke semua fitur.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // User not registered - Show red panel with setup button
  return (
    <div style={{ 
      background: C.white, 
      borderRadius: 18, 
      border: `1px solid ${C.border}`, 
      boxShadow: C.shadow, 
      overflow: "hidden",
      marginBottom: 16
    }}>
      {/* Header - Red */}
      <div style={{ 
        padding: "16px 24px", 
        borderBottom: `1px solid ${C.border2}`,
        background: "linear-gradient(135deg, #FEF3F2 0%, #FFF5F5 100%)"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ 
            width: 32, 
            height: 32, 
            borderRadius: 8, 
            background: C.red,
            display: "flex", 
            alignItems: "center", 
            justifyContent: "center",
            color: "white",
            fontSize: 16
          }}>
            ⚠️
          </div>
          <div>
            <h2 style={{ 
              fontFamily: font, 
              fontSize: 15, 
              fontWeight: 800, 
              color: C.red, 
              margin: 0 
            }}>
              Konfigurasi Akses Database
            </h2>
            <p style={{ 
              fontFamily: font, 
              fontSize: 12, 
              color: C.tx2, 
              margin: "4px 0 0 0" 
            }}>
              Setup permission untuk akses Firestore
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: 24 }}>
        <div style={{ 
          padding: 16, 
          borderRadius: 12, 
          background: C.bg,
          border: `1px solid ${C.border}`,
          marginBottom: 20
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <div style={{ 
              width: 40, 
              height: 40, 
              borderRadius: 10, 
              background: C.blueL,
              display: "flex", 
              alignItems: "center", 
              justifyContent: "center",
              flexShrink: 0
            }}>
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke={C.blue} strokeWidth={2}>
                <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
              </svg>
            </div>
            <div>
              <h3 style={{ 
                fontFamily: font, 
                fontSize: 14, 
                fontWeight: 700, 
                color: C.tx1, 
                margin: "0 0 6px 0" 
              }}>
                Status Akses Firestore
              </h3>
              <p style={{ 
                fontFamily: font, 
                fontSize: 13, 
                color: C.tx2, 
                margin: 0,
                lineHeight: 1.5
              }}>
                Anda sudah login sebagai <strong>{user.email}</strong>, tapi belum terdaftar 
                di database staff. Klik tombol di bawah untuk mengaktifkan akses admin penuh.
              </p>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button
            onClick={handleSetup}
            disabled={loading}
            style={{
              height: 44,
              padding: "0 24px",
              borderRadius: 10,
              border: "none",
              background: loading 
                ? "#9CA3AF" 
                : `linear-gradient(135deg, ${C.blue} 0%, ${C.blueD} 100%)`,
              color: "white",
              fontFamily: font,
              fontSize: 14,
              fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer",
              transition: "all .2s",
              display: "flex",
              alignItems: "center",
              gap: 8,
              boxShadow: loading ? "none" : "0 4px 16px rgba(67,97,238,.35)"
            }}
          >
            {loading ? (
              <>
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} style={{ animation: "spin 1s linear infinite" }}>
                  <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeOpacity=".3"/>
                  <path d="M21 12a9 9 0 00-9-9"/>
                </svg>
                Mengaktifkan akses...
              </>
            ) : (
              <>
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                Aktifkan Akses Admin
              </>
            )}
          </button>

          {result && (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 16px",
              borderRadius: 8,
              background: result.type === "success" ? "#ECFDF3" : "#FEF3F2",
              border: `1px solid ${result.type === "success" ? "#A7F3D0" : "#FECACA"}`,
            }}>
              <span style={{ fontSize: 16 }}>
                {result.type === "success" ? "✅" : "❌"}
              </span>
              <span style={{ 
                fontFamily: font, 
                fontSize: 13, 
                fontWeight: 600,
                color: result.type === "success" ? C.green : C.red
              }}>
                {result.message}
              </span>
            </div>
          )}
        </div>

        <p style={{ 
          fontFamily: font, 
          fontSize: 11, 
          color: C.tx3, 
          margin: "16px 0 0 0" 
        }}>
          💡 <strong>Catatan:</strong> Setelah mengklik tombol, halaman akan reload otomatis untuk menerapkan permission baru.
        </p>
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
