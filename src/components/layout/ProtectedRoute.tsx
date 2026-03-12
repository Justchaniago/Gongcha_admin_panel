"use client";
import { useAuth } from "@/context/AuthContext";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isPublicPage = pathname === "/login" || pathname === "/unauthorized";
  const redirectingRef = useRef(false);

  useEffect(() => {
    if (loading || user || isPublicPage) {
      redirectingRef.current = false;
      return;
    }

    const timeout = window.setTimeout(() => {
      if (!redirectingRef.current) {
        redirectingRef.current = true;
        router.replace("/login");
      }
    }, 1200);

    return () => window.clearTimeout(timeout);
  }, [loading, user, isPublicPage, router]);

  if (loading) {
    return (
      <div className="gc-auth-loading">
        <div className="gc-auth-loading-card">
          <div className="gc-auth-spinner">
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeOpacity=".25"/>
              <path d="M21 12a9 9 0 00-9-9"/>
            </svg>
          </div>
          <p style={{ fontSize: 13, color: "var(--gc-tx3)", fontWeight: 700 }}>Memuat workspace…</p>
        </div>
      </div>
    );
  }

  // Hard fallback: jangan render route private jika user null.
  if (!user && !isPublicPage) {
    return (
      <div className="gc-auth-loading">
        <div className="gc-auth-loading-card">
          <div className="gc-auth-spinner">
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeOpacity=".25"/>
              <path d="M21 12a9 9 0 00-9-9"/>
            </svg>
          </div>
          <p style={{ fontSize: 13, color: "var(--gc-tx3)", fontWeight: 700 }}>Mengalihkan ke login…</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
