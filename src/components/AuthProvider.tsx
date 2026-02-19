"use client";
// src/components/AuthProvider.tsx
// Wraps dashboard layout — redirects to /login if not authenticated

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { useRouter, usePathname } from "next/navigation";
import { auth } from "@/lib/firebaseClient";

interface AuthCtx {
  user:    User | null;
  loading: boolean;
  logout:  () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({ user: null, loading: true, logout: async () => {} });
export function useAdminAuth() { return useContext(Ctx); }

const font = "'Plus Jakarta Sans', system-ui, sans-serif";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,    setUser]    = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router   = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
      if (!u && pathname?.startsWith("/dashboard")) {
        router.replace("/login");
      }
    });
    return () => unsub();
  }, [router, pathname]);

  async function logout() {
    await signOut(auth);
    router.replace("/login");
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F4F6FB", fontFamily: font }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: "linear-gradient(135deg,#4361EE,#3A0CA3)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 24px rgba(67,97,238,.3)" }}>
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2} style={{ animation: "spin 1s linear infinite" }}>
              <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeOpacity=".25"/>
              <path d="M21 12a9 9 0 00-9-9"/>
            </svg>
          </div>
          <p style={{ fontSize: 13, color: "#9299B0", fontWeight: 500 }}>Memuat sesi…</p>
        </div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  if (!user) return null;

  return (
    <Ctx.Provider value={{ user, loading, logout }}>
      {children}
    </Ctx.Provider>
  );
}
