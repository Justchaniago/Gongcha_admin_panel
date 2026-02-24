"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebaseClient"; // Memanggil instance Firebase Client

const font = "'Plus Jakarta Sans', system-ui, sans-serif";

const C = {
  bg:      "#0D0F14",
  card:    "#13161E",
  border:  "#1E2330",
  border2: "#252A38",
  tx1:     "#F0F2F8",
  tx2:     "#8B91A8",
  tx3:     "#4A5068",
  blue:    "#4361EE",
  blueL:   "#EEF2FF",
  blueD:   "#2B45D4",
  green:   "#12B76A",
  red:     "#F04438",
  redDim:  "rgba(240,68,56,.12)",
  glow:    "rgba(67,97,238,.18)",
} as const;

export default function LoginPage() {
  const router = useRouter();

  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [showPw,   setShowPw]   = useState(false);
  const [focusE,   setFocusE]   = useState(false);
  const [focusP,   setFocusP]   = useState(false);
  const [success,  setSuccess]  = useState(false);

  // Jika user sudah memiliki cookie, middleware otomatis melempar mereka, 
  // jadi kita tidak butuh useEffect useSession lagi.

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) { setError("Email dan password wajib diisi."); return; }
    setLoading(true); setError("");

    try {
      // 1. Eksekusi Login Firebase
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      
      // 2. Ambil token ID asli
      const idToken = await userCredential.user.getIdToken();

      // 3. Kirim Token ke Server untuk dijadikan Session Cookie 14 hari
      const response = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });

      if (!response.ok) {
        throw new Error("Gagal mencetak sesi di server.");
      }

      setSuccess(true);
      setTimeout(() => {
        // Redirect paksa dengan window.location agar middleware mendeteksi cookie
        window.location.href = "/dashboard";
      }, 800);

    } catch (err: any) {
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
          setError("Email atau password salah.");
      } else {
          setError(`Login gagal: ${err.message ?? "Coba lagi."}`);
      }
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: C.bg,
      display: "flex",
      fontFamily: font,
      WebkitFontSmoothing: "antialiased",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* ── Background decoration ── */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0 }}>
        <div style={{ position: "absolute", top: -180, left: -180, width: 520, height: 520, borderRadius: "50%", background: `radial-gradient(circle, rgba(67,97,238,.13) 0%, transparent 70%)` }}/>
        <div style={{ position: "absolute", bottom: -200, right: -200, width: 600, height: 600, borderRadius: "50%", background: `radial-gradient(circle, rgba(67,97,238,.08) 0%, transparent 70%)` }}/>
        <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, opacity: .035 }}>
          <defs>
            <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse">
              <path d="M 48 0 L 0 0 0 48" fill="none" stroke="white" strokeWidth="1"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)"/>
        </svg>
      </div>

      {/* ── Left panel — branding ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "48px 64px", position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 11, background: `linear-gradient(135deg,${C.blue},${C.blueD})`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 20px ${C.glow}` }}>
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.2}>
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
          </div>
          <span style={{ fontSize: 16, fontWeight: 800, color: C.tx1, letterSpacing: "-.01em" }}>Gong Cha</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: C.tx3, background: C.border, padding: "3px 8px", borderRadius: 6, letterSpacing: ".06em", textTransform: "uppercase" }}>Admin</span>
        </div>

        <div>
          <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".16em", textTransform: "uppercase", color: C.blue, marginBottom: 18 }}>
            Management Dashboard
          </p>
          <h1 style={{ fontSize: 48, fontWeight: 800, letterSpacing: "-.04em", color: C.tx1, lineHeight: 1.08, margin: 0, marginBottom: 20 }}>
            Kelola bisnis<br/>
            <span style={{ background: `linear-gradient(135deg, ${C.blue}, #7C6FFF)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              lebih efisien.
            </span>
          </h1>
          <p style={{ fontSize: 15, color: C.tx2, lineHeight: 1.65, maxWidth: 380, margin: 0 }}>
            Platform terpadu untuk manajemen member, transaksi, poin loyalitas, dan performa seluruh outlet Gong Cha.
          </p>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 36 }}>
            {[
              { icon: "👥", label: "Member & Tier" },
              { icon: "📊", label: "Analytics" },
              { icon: "🏪", label: "Multi-Outlet" },
              { icon: "⚡", label: "Realtime Sync" },
            ].map(f => (
              <div key={f.label} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 10, border: `1px solid ${C.border2}`, background: C.card, fontSize: 12.5, fontWeight: 600, color: C.tx2 }}>
                <span>{f.icon}</span> {f.label}
              </div>
            ))}
          </div>
        </div>

        <p style={{ fontSize: 12, color: C.tx3 }}>© 2025 Gong Cha Indonesia. All rights reserved.</p>
      </div>

      {/* ── Right panel — login form ── */}
      <div style={{ width: 460, display: "flex", alignItems: "center", justifyContent: "center", padding: "48px 40px", position: "relative", zIndex: 1 }}>
        <div style={{ width: "100%", maxWidth: 380 }}>
          <div style={{
            background: C.card,
            border: `1px solid ${C.border2}`,
            borderRadius: 24,
            padding: "40px 36px",
            boxShadow: "0 32px 80px rgba(0,0,0,.5), 0 0 0 1px rgba(255,255,255,.04)",
          }}>
            <div style={{ marginBottom: 32 }}>
              <h2 style={{ fontSize: 24, fontWeight: 800, color: C.tx1, letterSpacing: "-.025em", margin: 0, marginBottom: 8 }}>
                {success ? "Berhasil masuk! ✓" : "Masuk ke Dashboard"}
              </h2>
              <p style={{ fontSize: 13.5, color: C.tx2, margin: 0 }}>
                {success ? "Mengalihkan ke dashboard…" : "Gunakan akun admin atau staff kamu"}
              </p>
            </div>

            {!success && (
              <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: C.tx2, marginBottom: 8 }}>
                    Email
                  </label>
                  <div style={{ position: "relative" }}>
                    <div style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
                      <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke={focusE ? C.blue : C.tx3} strokeWidth={2}>
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
                      </svg>
                    </div>
                    <input
                      type="email" value={email} onChange={e => setEmail(e.target.value)}
                      placeholder="kasir@gongcha.id" autoComplete="email"
                      onFocus={() => setFocusE(true)} onBlur={() => setFocusE(false)}
                      style={{
                        width: "100%", height: 46, borderRadius: 11, outline: "none", boxSizing: "border-box",
                        border: `1.5px solid ${focusE ? C.blue : C.border2}`,
                        background: "rgba(255,255,255,.04)",
                        boxShadow: focusE ? `0 0 0 3px rgba(67,97,238,.15)` : "none",
                        padding: "0 14px 0 42px",
                        fontFamily: font, fontSize: 14, color: C.tx1,
                        transition: "all .15s",
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: C.tx2, marginBottom: 8 }}>
                    Password
                  </label>
                  <div style={{ position: "relative" }}>
                    <div style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
                      <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke={focusP ? C.blue : C.tx3} strokeWidth={2}>
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
                      </svg>
                    </div>
                    <input
                      type={showPw ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••" autoComplete="current-password"
                      onFocus={() => setFocusP(true)} onBlur={() => setFocusP(false)}
                      style={{
                        width: "100%", height: 46, borderRadius: 11, outline: "none", boxSizing: "border-box",
                        border: `1.5px solid ${focusP ? C.blue : C.border2}`,
                        background: "rgba(255,255,255,.04)",
                        boxShadow: focusP ? `0 0 0 3px rgba(67,97,238,.15)` : "none",
                        padding: "0 44px 0 42px",
                        fontFamily: font, fontSize: 14, color: C.tx1,
                        transition: "all .15s",
                      }}
                    />
                    <button type="button" onClick={() => setShowPw(p => !p)} style={{ position: "absolute", right: 13, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: C.tx3, display: "flex", padding: 4, transition: "color .13s" }}
                      onMouseOver={e => (e.currentTarget.style.color = C.tx2)}
                      onMouseOut={e  => (e.currentTarget.style.color = C.tx3)}>
                      {showPw
                        ? <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22"/></svg>
                        : <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      }
                    </button>
                  </div>
                </div>

                {error && (
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 14px", background: C.redDim, border: `1px solid rgba(240,68,56,.25)`, borderRadius: 10, fontSize: 13, color: "#FF8A80", lineHeight: 1.5 }}>
                    <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    {error}
                  </div>
                )}

                <button
                  type="submit" disabled={loading}
                  style={{
                    height: 48, borderRadius: 12, border: "none", marginTop: 4,
                    background: loading ? "rgba(67,97,238,.6)" : `linear-gradient(135deg, ${C.blue} 0%, ${C.blueD} 100%)`,
                    color: "#fff", fontFamily: font, fontSize: 14.5, fontWeight: 700,
                    cursor: loading ? "not-allowed" : "pointer",
                    boxShadow: loading ? "none" : `0 4px 20px rgba(67,97,238,.35)`,
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    transition: "all .15s",
                    letterSpacing: "-.01em",
                  }}
                >
                  {loading ? (
                    <><svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} style={{ animation: "spin 1s linear infinite" }}><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeOpacity=".3"/><path d="M21 12a9 9 0 00-9-9"/></svg>Masuk…</>
                  ) : (
                    <><svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3"/></svg>Masuk ke Dashboard</>
                  )}
                </button>
              </form>
            )}

            {success && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "24px 0" }}>
                <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(18,183,106,.15)", border: "2px solid rgba(18,183,106,.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="#12B76A" strokeWidth={2.5}><path d="M20 6L9 17l-5-5"/></svg>
                </div>
                <p style={{ fontSize: 14, color: C.tx2, textAlign: "center" }}>Login berhasil! Mengalihkan…</p>
              </div>
            )}
          </div>

          <div style={{ marginTop: 20, padding: "14px 18px", borderRadius: 12, border: `1px solid ${C.border}`, background: "rgba(255,255,255,.02)" }}>
            <p style={{ fontSize: 11.5, color: C.tx3, margin: 0, lineHeight: 1.6 }}>
              🔐 Akses tersedia untuk <strong style={{ color: C.tx2 }}>Admin</strong> dan <strong style={{ color: C.tx2 }}>Staff</strong> yang terdaftar. Hubungi superadmin jika tidak bisa masuk.
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input::placeholder { color: ${C.tx3}; }
        input:-webkit-autofill {
          -webkit-box-shadow: 0 0 0 100px ${C.card} inset !important;
          -webkit-text-fill-color: ${C.tx1} !important;
        }
      `}</style>
    </div>
  );
}