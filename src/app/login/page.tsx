"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebaseClient";
import { useAuth } from "@/context/AuthContext";
import { GcButton, GcPanel } from "@/components/ui/gc";

const font = "Inter, system-ui, sans-serif";

export default function LoginPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [showAccessHelp, setShowAccessHelp] = useState(false);
  const [accessHelpVisible, setAccessHelpVisible] = useState(false);
  const [showPw,   setShowPw]   = useState(false);
  const [focusE,   setFocusE]   = useState(false);
  const [focusP,   setFocusP]   = useState(false);
  const [success,  setSuccess]  = useState(false);
  const sessionSyncRef = useRef(false);
  const accessHelpHideTimerRef = useRef<number | null>(null);
  const accessHelpUnmountTimerRef = useRef<number | null>(null);

  function clearAccessHelpTimers() {
    if (accessHelpHideTimerRef.current) {
      window.clearTimeout(accessHelpHideTimerRef.current);
      accessHelpHideTimerRef.current = null;
    }
    if (accessHelpUnmountTimerRef.current) {
      window.clearTimeout(accessHelpUnmountTimerRef.current);
      accessHelpUnmountTimerRef.current = null;
    }
  }

  function dismissAccessHelp() {
    clearAccessHelpTimers();
    setAccessHelpVisible(false);
    accessHelpUnmountTimerRef.current = window.setTimeout(() => {
      setShowAccessHelp(false);
      accessHelpUnmountTimerRef.current = null;
    }, 180);
  }

  function revealAccessHelp() {
    clearAccessHelpTimers();
    setShowAccessHelp(true);
    requestAnimationFrame(() => setAccessHelpVisible(true));
    accessHelpHideTimerRef.current = window.setTimeout(() => {
      dismissAccessHelp();
    }, 4800);
  }

  // Mencegah user yang sudah punya sesi mengakses halaman login
  useEffect(() => {
    if (authLoading || !user || sessionSyncRef.current || window.location.pathname === "/dashboard") return;

    sessionSyncRef.current = true;

    (async () => {
      try {
        const sessionStatus = await fetch("/api/auth/session", { cache: "no-store" });
        if (sessionStatus.ok) {
          router.replace("/dashboard");
          return;
        }

        const firebaseUser = auth.currentUser;
        if (!firebaseUser) {
          sessionSyncRef.current = false;
          return;
        }

        const idToken = await firebaseUser.getIdToken(true);
        const createSession = await fetch("/api/auth/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken }),
        });

        if (createSession.ok) {
          router.replace("/dashboard");
          return;
        }

        sessionSyncRef.current = false;
      } catch {
        sessionSyncRef.current = false;
      }
    })();
  }, [user, authLoading, router]);

  useEffect(() => {
    return () => {
      clearAccessHelpTimers();
    };
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("Email and password are required.");
      dismissAccessHelp();
      return;
    }
    setLoading(true);
    setError("");
    dismissAccessHelp();

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const idToken = await userCredential.user.getIdToken();

      const response = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });

      if (!response.ok) throw new Error("Failed to create session on server.");

      setSuccess(true);
      dismissAccessHelp();
      router.replace("/dashboard");

    } catch (err: any) {
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
          setError("Incorrect email or password.");
          revealAccessHelp();
      } else {
          setError(`Login failed: ${err.message ?? "Try again."}`);
          dismissAccessHelp();
      }
      setLoading(false);
    }
  }

  if (authLoading) {
    return (
      <div style={{ minHeight: "100vh", background: "#F4F6FB", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: "#059669", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 8px 24px rgba(5,150,105,.22)` }}>
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2} style={{ animation: "spin 1s linear infinite" }}>
              <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeOpacity=".25"/><path d="M21 12a9 9 0 00-9-9"/>
            </svg>
          </div>
          <p style={{ fontSize: 13, color: "#4A5065", fontFamily: font, fontWeight: 500 }}>Checking session…</p>
        </div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  return (
    <div style={{ 
      minHeight: "100vh", 
      display: "flex", 
      alignItems: "center",
      justifyContent: "center",
      fontFamily: font, 
      WebkitFontSmoothing: "antialiased", 
      position: "relative", 
      overflow: "hidden",
      // Gambar background diletakkan full screen di sini
      backgroundImage: "url('/assets/images/background.webp')",
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat"
    }}>
      
      {/* ── Optional: Overlay tipis agar background tidak terlalu mencolok ── */}
      <div style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0, 0, 0, 0.15)", zIndex: 0 }}/>

      {/* ── CARD LOGIN (THE PERFECT GLASSMORPHISM) ── */}
      <GcPanel style={{ 
        position: "relative",
        zIndex: 10,
        width: "100%", 
        maxWidth: "420px", 
        margin: "24px",
        // Efek "Kaca Putih" (Frosted Glass)
        background: "rgba(255, 255, 255, 0.65)", 
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        border: "1px solid rgba(255, 255, 255, 0.8)", 
        borderRadius: "32px", 
        padding: "48px 40px", 
        boxShadow: "0 24px 48px rgba(0, 0, 0, 0.1), inset 0 1px 1px rgba(255, 255, 255, 1)" 
      }}>
        
        {/* Logo & Header */}
        <div style={{ textAlign: "center", marginBottom: "36px" }}>
          <div style={{ display: "inline-flex", padding: "8px", borderRadius: "18px", background: "rgba(255,255,255,0.8)", boxShadow: "0 4px 12px rgba(0,0,0,0.05)", marginBottom: "20px" }}>
            <img src="/assets/images/logo1.webp" alt="Gong Cha Logo" style={{ width: 48, height: 48, borderRadius: "12px", objectFit: "cover" }} />
          </div>
          <h1 style={{ fontSize: "26px", fontWeight: 800, color: "#0F1117", letterSpacing: "-.03em", margin: 0, marginBottom: "8px" }}>
            {success ? "Login successful! ✓" : "Welcome"}
          </h1>
          <p style={{ fontSize: "14px", color: "#4A5065", margin: 0, fontWeight: 500 }}>
            {success ? "Redirecting to dashboard…" : "Sign in to Gong Cha Admin Dashboard"}
          </p>
        </div>

        {!success && (
          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            
            {/* Input Email */}
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#4A5065", marginBottom: "8px" }}>Email</label>
              <div style={{ position: "relative" }}>
                <div style={{ position: "absolute", left: "16px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke={focusE ? "#3B82F6" : "#9299B0"} strokeWidth={2}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                </div>
                <input 
                  type="email" 
                  value={email} 
                  onChange={e => {
                    setEmail(e.target.value);
                    if (showAccessHelp || accessHelpVisible) dismissAccessHelp();
                  }} 
                  placeholder="kasir@gongcha.id" 
                  onFocus={() => setFocusE(true)} 
                  onBlur={() => setFocusE(false)} 
                  style={{ 
                    width: "100%", height: "50px", borderRadius: "14px", outline: "none", boxSizing: "border-box", 
                    border: `1.5px solid ${focusE ? "#3B82F6" : "rgba(255,255,255,0.7)"}`, 
                    background: focusE ? "#ffffff" : "rgba(255, 255, 255, 0.5)", 
                    boxShadow: focusE ? `0 0 0 4px rgba(59,130,246,.1)` : "inset 0 2px 4px rgba(0,0,0,0.02)", 
                    padding: "0 16px 0 46px", fontFamily: font, fontSize: "14px", color: "#0F1117", transition: "all .2s ease",
                    fontWeight: 500
                  }} 
                />
              </div>
            </div>

            {/* Input Password */}
            <div className={`login-password-field${showAccessHelp ? " has-help" : ""}`}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#4A5065", marginBottom: "8px" }}>Password</label>
              <div style={{ position: "relative" }}>
                <div style={{ position: "absolute", left: "16px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke={focusP ? "#3B82F6" : "#9299B0"} strokeWidth={2}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                </div>
                <input 
                  type={showPw ? "text" : "password"} 
                  value={password} 
                  onChange={e => {
                    setPassword(e.target.value);
                    if (showAccessHelp || accessHelpVisible) dismissAccessHelp();
                  }} 
                  placeholder="••••••••" 
                  onFocus={() => setFocusP(true)} 
                  onBlur={() => setFocusP(false)} 
                  style={{ 
                    width: "100%", height: "50px", borderRadius: "14px", outline: "none", boxSizing: "border-box", 
                    border: `1.5px solid ${focusP ? "#3B82F6" : "rgba(255,255,255,0.7)"}`, 
                    background: focusP ? "#ffffff" : "rgba(255, 255, 255, 0.5)", 
                    boxShadow: focusP ? `0 0 0 4px rgba(59,130,246,.1)` : "inset 0 2px 4px rgba(0,0,0,0.02)", 
                    padding: "0 46px 0 46px", fontFamily: font, fontSize: "14px", color: "#0F1117", transition: "all .2s ease",
                    fontWeight: 500
                  }} 
                />
                <button type="button" onClick={() => setShowPw(!showPw)} style={{ position: "absolute", right: "16px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#9299B0", padding: "4px" }}>
                  {showPw ? <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22"/></svg> : <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}
                </button>
              </div>

              {showAccessHelp && (
                <div
                  className={`login-help-bubble${accessHelpVisible ? " visible" : ""}`}
                >
                  <div className="login-help-bubble-inner">
                    <div style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontSize: "28px", lineHeight: 1, color: "rgba(5,150,105,.38)", marginTop: "-2px", flexShrink: 0 }}>
                      "
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                      <p style={{ margin: 0, fontSize: "11px", color: "#667085", lineHeight: 1.2, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", fontFamily: '"SF Pro Text", Inter, system-ui, sans-serif' }}>
                        Lupa akses login?
                      </p>
                      <p style={{ margin: 0, fontSize: "12.5px", color: "#344054", lineHeight: 1.55, fontWeight: 500, letterSpacing: "-.01em", fontFamily: '"SF Pro Text", Inter, system-ui, sans-serif' }}>
                        Hubungi administrator untuk reset email atau kata sandi akun staff/admin.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Error Message */}
            {error && (
              <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", padding: "14px 16px", background: "rgba(255, 255, 255, 0.8)", border: "1px solid rgba(200,16,46,.3)", borderRadius: "12px", fontSize: "13px", color: "#C8102E", lineHeight: 1.5, fontWeight: 600 }}>
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} style={{ flexShrink: 0, marginTop: "1px" }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>{error}
              </div>
            )}

            {/* Submit Button */}
            <GcButton type="submit" variant="primary" size="lg" loading={loading} style={{ width: "100%", height: "52px", borderRadius: "14px", marginTop: "8px", boxShadow: loading ? "none" : "0 8px 20px rgba(5,150,105,.25)" }}>
              Sign In
            </GcButton>

            {/* Help Note */}
          </form>
        )}

        {/* Success State */}
        {success && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px", padding: "24px 0" }}>
            <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: "#12B76A", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 24px rgba(18,183,106,.3)" }}>
              <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="#fff" strokeWidth={3}><path d="M20 6L9 17l-5-5"/></svg>
            </div>
            <p style={{ fontSize: "15px", color: "#4A5065", textAlign: "center", fontWeight: 700 }}>Authentication successful!</p>
          </div>
        )}
      </GcPanel>

      {/* ── Footer ── */}
      <div style={{ position: "absolute", bottom: "32px", textAlign: "center", zIndex: 10, width: "100%" }}>
        <p style={{ fontSize: "13px", color: "rgba(255, 255, 255, 0.8)", fontWeight: 500, textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}>
          © 2026 Gong Cha Indonesia. All rights reserved.
        </p>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } } 
        input::placeholder { color: #9299B0; }
        .login-password-field {
          position: relative;
          transition: padding-bottom .22s ease;
        }
        .login-password-field.has-help {
          padding-bottom: 96px;
        }
        .login-help-bubble {
          position: absolute;
          right: 0;
          top: calc(100% + 10px);
          width: min(100%, 260px);
          padding: 12px 14px 12px 16px;
          border-radius: 16px;
          background: rgba(255,255,255,.92);
          border: 1px solid rgba(15,23,42,.08);
          box-shadow: 0 16px 34px rgba(15,17,23,.10), 0 2px 6px rgba(15,17,23,.04);
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
          z-index: 5;
          opacity: 0;
          pointer-events: none;
          transform: translateY(-8px) scale(.98);
          transition: opacity .18s ease, transform .24s cubic-bezier(.22,1,.36,1);
        }
        .login-help-bubble.visible {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
        .login-help-bubble::before {
          content: "";
          position: absolute;
          top: -7px;
          right: 22px;
          width: 14px;
          height: 14px;
          background: rgba(255,255,255,.92);
          border-left: 1px solid rgba(15,23,42,.08);
          border-top: 1px solid rgba(15,23,42,.08);
          transform: rotate(45deg);
        }
        .login-help-bubble-inner {
          position: relative;
          z-index: 1;
          display: flex;
          gap: 10px;
          align-items: flex-start;
        }
        @media (min-width: 980px) {
          .login-password-field.has-help {
            padding-bottom: 0;
          }
          .login-help-bubble {
            left: calc(100% + 14px);
            right: auto;
            top: 50%;
            width: 260px;
            transform: translate(-8px, -50%) scale(.98);
          }
          .login-help-bubble.visible {
            transform: translate(0, -50%) scale(1);
          }
          .login-help-bubble::before {
            top: 50%;
            left: -7px;
            right: auto;
            border-left: 1px solid rgba(15,23,42,.08);
            border-top: 1px solid rgba(15,23,42,.08);
            transform: translateY(-50%) rotate(-45deg);
          }
        }
        /* Animasi masuk perlahan untuk kartu */
        div[style*="backdrop-filter"] { animation: cardFadeIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        @keyframes cardFadeIn { from { opacity: 0; transform: translateY(20px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
      `}</style>
    </div>
  );
}
