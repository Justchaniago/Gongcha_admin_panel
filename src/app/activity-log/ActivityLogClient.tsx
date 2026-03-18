"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useIsMobile } from "@/hooks/useIsMobile";
import ActivityLogDesktop from "./ActivityLogDesktop";
import ActivityLogMobile from "./ActivityLogMobile";
import type { AccessState } from "./activityLogShared";

// ── Keylog constants — HANYA ada di client bundle, tidak pernah dikirim ke server ──
// Untuk mengubah keylog: update nilai di sini dan redeploy.
const KEYLOG_READ   = "adminlog_auth";
const KEYLOG_MANAGE = "Chaniago123";

// ── Design tokens untuk gate UI ───────────────────────────────────────────────
const T = {
  bg: "#F4F5F7", surface: "#FFFFFF", navy: "#1C2333",
  blue: "#3B82F6", blueL: "#EFF6FF",
  red: "#DC2626", redL: "#FEF2F2",
  tx1: "#111827", tx2: "#374151", tx3: "#6B7280", tx4: "#9CA3AF",
  border2: "#E5E7EB",
} as const;

// ── Keylog gate screen ────────────────────────────────────────────────────────
function KeylogGate({ onUnlock }: { onUnlock: (access: AccessState) => void }) {
  const router = useRouter();
  const [keylog, setKeylog]     = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(true);
  const [checking, setChecking] = useState(false);
  // Whitelist status dari server (UID check)
  const [inRead, setInRead]     = useState(false);
  const [inManage, setInManage] = useState(false);
  const [notWhitelisted, setNotWhitelisted] = useState(false);

  useEffect(() => {
    // Verifikasi whitelist dari server setiap kali halaman dibuka.
    (async () => {
      try {
        const res = await fetch("/api/activity-logs/access", { cache: "no-store" });
        const data = await res.json();

        if (!data.authenticated || (!data.inReadWhitelist && !data.inManageWhitelist)) {
          setNotWhitelisted(true);
          setLoading(false);
          return;
        }

        const nextInRead = Boolean(data.inReadWhitelist);
        const nextInManage = Boolean(data.inManageWhitelist);
        setInRead(nextInRead);
        setInManage(nextInManage);
      } catch {
        setNotWhitelisted(true);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function handleSubmit() {
    if (!keylog.trim()) { setError("Keylog wajib diisi."); return; }
    setChecking(true);
    setError("");

    // Validasi keylog murni client-side — tidak dikirim ke mana pun
    let access: AccessState | null = null;

    if (inManage && keylog === KEYLOG_MANAGE) {
      access = { authenticated: true, canRead: true, canManage: true, level: "manage" };
    } else if (inRead && keylog === KEYLOG_READ) {
      access = { authenticated: true, canRead: true, canManage: false, level: "read" };
    }

    setTimeout(() => {
      setChecking(false);
      if (access) {
        onUnlock(access);
      } else {
        setError("Keylog salah. Periksa kembali dan coba lagi.");
        setKeylog("");
      }
    }, 400); // sedikit delay biar tidak instant brute-force
  }

  // ── Loading ──
  if (loading) {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: T.bg }}>
        <p style={{ fontSize: 12, color: T.tx4 }}>Memverifikasi akses…</p>
      </div>
    );
  }

  // ── UID tidak ada di whitelist sama sekali ──
  if (notWhitelisted) {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: T.bg, padding: 24 }}>
        <div style={{ textAlign: "center", maxWidth: 320 }}>
          <p style={{ fontSize: 36, margin: "0 0 12px" }}>🔒</p>
          <p style={{ fontSize: 15, fontWeight: 800, color: T.tx1, margin: "0 0 8px" }}>Akses Dibatasi</p>
          <p style={{ fontSize: 13, color: T.tx4, margin: 0, lineHeight: 1.6 }}>
            Akun kamu tidak terdaftar dalam whitelist Activity Log.
          </p>
        </div>
      </div>
    );
  }

  // ── Keylog gate form ──
  return (
    <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: T.bg, padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 360, background: T.surface, borderRadius: 20, padding: 32, boxShadow: "0 8px 32px rgba(0,0,0,.08)" }}>
        {/* Icon */}
        <div style={{ width: 52, height: 52, borderRadius: 14, background: T.navy, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
          <span style={{ fontSize: 24 }}>🔑</span>
        </div>

        <p style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 900, color: T.tx1 }}>Activity Log</p>
        <p style={{ margin: "0 0 24px", fontSize: 13, color: T.tx3, lineHeight: 1.5 }}>
          Input keylog to access.
        </p>

        {/* Input */}
        <div style={{ marginBottom: 12 }}>
          <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, color: T.tx3, letterSpacing: ".08em", textTransform: "uppercase" }}>
            Keylog
          </p>
          <input
            type="password"
            value={keylog}
            onChange={(e) => { setKeylog(e.target.value); setError(""); }}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            autoFocus
            style={{
              width: "100%", padding: "13px 14px", borderRadius: 12,
              border: `1.5px solid ${error ? T.red : T.border2}`,
              background: error ? T.redL : T.bg,
              fontSize: 14, outline: "none", boxSizing: "border-box",
              color: T.tx1, letterSpacing: ".08em",
            }}
          />
          {error && (
            <p style={{ margin: "6px 0 0", fontSize: 12, color: T.red, fontWeight: 600 }}>
              {error}
            </p>
          )}
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={checking || !keylog.trim()}
          style={{
            width: "100%", padding: "13px 0", borderRadius: 12, border: "none",
            background: keylog.trim() ? T.navy : T.border2,
            color: keylog.trim() ? "#fff" : T.tx4,
            fontSize: 14, fontWeight: 800,
            cursor: keylog.trim() && !checking ? "pointer" : "default",
            opacity: checking ? .7 : 1, transition: "all .15s",
          }}>
          {checking ? "Memverifikasi…" : "Masuk ke Log"}
        </button>

        <button
          onClick={() => router.push("/settings")}
          style={{
            width: "100%",
            marginTop: 10,
            padding: "12px 0",
            borderRadius: 12,
            border: `1px solid ${T.border2}`,
            background: T.surface,
            color: T.tx2,
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Back to Settings
        </button>
      </div>
    </div>
  );
}

// ── Bridge: gate → desktop/mobile ────────────────────────────────────────────
export default function ActivityLogClient() {
  const [mounted, setMounted]   = useState(false);
  const [access, setAccess]     = useState<AccessState | null>(null);
  const isMobile = useIsMobile();

  useEffect(() => { setMounted(true); }, []);

  function handleLock() {
    setAccess(null);
  }

  if (!mounted) return null;

  // Belum unlock → tampilkan gate
  if (!access) {
    return <KeylogGate onUnlock={setAccess} />;
  }

  // Sudah unlock → render halaman log dengan access yang sudah diverifikasi
  if (isMobile) return <ActivityLogMobile access={access} onLock={handleLock} />;
  return <ActivityLogDesktop access={access} onLock={handleLock} />;
}
