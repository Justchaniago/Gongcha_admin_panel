"use client";

import React, { createContext, useContext, ReactNode, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebaseClient";

// Struktur data user disamakan dengan kebutuhan UI milikmu
interface AuthCtx {
  user: { name?: string | null; email?: string | null; role?: string; uid?: string } | null;
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

  // 1. Sinkronisasi Data Firebase
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        let role = "staff"; // Default
        let name = firebaseUser.displayName || "User";
        
        try {
          // Cari role di Firestore
          const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
          if (userDoc.exists()) {
            role = userDoc.data().role || "staff";
            name = userDoc.data().name || name;
          } else {
             const staffDoc = await getDoc(doc(db, "staff", firebaseUser.uid));
             if (staffDoc.exists()) {
                 role = staffDoc.data().role || "staff";
                 name = staffDoc.data().name || name;
             }
          }
        } catch (error) {
          console.error("Gagal mengambil role Firestore:", error);
        }

        setUser({
          name: name,
          email: firebaseUser.email,
          role: role,
          uid: firebaseUser.uid,
        });
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 2. Fungsi Logout yang Bersih
  async function handleLogout() {
    try {
      await auth.signOut(); // Hapus sesi client
      await fetch('/api/auth/logout', { method: 'POST' }); // Hapus cookie server
      window.location.href = "/login"; // Force reload ke login
    } catch (error) {
      console.error("Logout error:", error);
    }
  }

  // 3. Layar Loading Original Milikmu (Tidak Diubah)
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

  // KITA HAPUS "if (!user) return null;" DI SINI AGAR APLIKASI BISA MERENDER HALAMAN LOGIN!

  return (
    <Ctx.Provider value={{ user, loading: false, logout: handleLogout }}>
      {children}
    </Ctx.Provider>
  );
}