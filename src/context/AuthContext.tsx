"use client";

import React, { createContext, useContext, ReactNode, useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { usePathname, useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebaseClient";
import { AdminUser, adminUserConverter } from "@/types/firestore";

interface AuthCtx {
  user: AdminUser | null;
  loading: boolean;
  logout: () => Promise<void>;
}

// Nilai default
const Ctx = createContext<AuthCtx>({ user: null, loading: true, logout: async () => {} });

// Hook utama yang dipakai oleh semua komponen UI kamu
export function useAuth() { return useContext(Ctx); }

const font = "'Plus Jakarta Sans', system-ui, sans-serif";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthCtx['user']>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const adminRef = doc(db, "admin_users", firebaseUser.uid).withConverter(adminUserConverter);
          const adminSnap = await getDoc(adminRef);

          if (adminSnap.exists() && adminSnap.data().isActive === true) {
            setUser(adminSnap.data());
          } else {
            await signOut(auth);
            setUser(null);
            if (pathname !== "/login") {
              router.push("/unauthorized");
            }
          }
        } catch (error) {
          console.error("Gagal memverifikasi admin user:", error);
          await signOut(auth);
          setUser(null);
          if (pathname !== "/login") {
            router.push("/unauthorized");
          }
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [pathname, router]);

  async function handleLogout() {
    try {
      await signOut(auth);
      setUser(null);
      router.push("/login");
    } catch (error) {
      console.error("Logout error:", error);
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F4F6FB", fontFamily: font }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: "linear-gradient(135deg,#4361EE,#3A0CA3)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 24px rgba(67,97,238,.3)" }}>
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2} style={{ animation: "spin 1s linear infinite" }}>
              <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeOpacity=".25"/><path d="M21 12a9 9 0 00-9-9"/>
            </svg>
          </div>
          <p style={{ fontSize: 13, color: "#9299B0", fontWeight: 500 }}>Memuat sesi…</p>
        </div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  return (
    <Ctx.Provider value={{ user, loading: false, logout: handleLogout }}>
      {children}
    </Ctx.Provider>
  );
}