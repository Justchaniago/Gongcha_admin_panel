"use client";
import { useRouter } from "next/navigation";
import { GcButton, GcPanel } from "@/components/ui/gc";

const font = "Inter, system-ui, sans-serif";

export default function UnauthorizedPage() {
  const router = useRouter();
  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "linear-gradient(135deg,#F4F6FB 0%,#EEF2FF 100%)", fontFamily: font, padding: 24,
    }}>
      <GcPanel style={{ borderRadius: 24, padding: "48px 40px", maxWidth: 440, width: "100%", textAlign: "center" }}>
        {/* Icon */}
        <div style={{
          width: 72, height: 72, borderRadius: 20, background: "#FEF2F2",
          display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px",
        }}>
          <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="#DC2626" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/>
          </svg>
        </div>

        {/* Badge */}
        <span style={{
          display: "inline-block", padding: "4px 12px", borderRadius: 99,
          background: "#FEF2F2", color: "#DC2626", fontSize: 11, fontWeight: 700,
          letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 16,
        }}>
          403 — Akses Ditolak
        </span>

        <h1 style={{ fontSize: 26, fontWeight: 800, color: "#0F1117", marginBottom: 12, letterSpacing: "-.02em" }}>
          No Permission
        </h1>
        <p style={{ fontSize: 14, color: "#4A5065", lineHeight: 1.7, marginBottom: 32 }}>
          You do not have permission to access this page. Please contact the administrator if you believe this is an error.
        </p>

        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <GcButton variant="ghost" size="lg" onClick={() => router.back()}>
            ← Kembali
          </GcButton>
          <GcButton variant="blue" size="lg" onClick={() => router.push("/dashboard")}>
            Ke Dashboard
          </GcButton>
        </div>
      </GcPanel>
    </div>
  );
}
