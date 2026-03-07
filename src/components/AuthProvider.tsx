"use client";
import { createContext, useContext, ReactNode, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebaseClient";
import { useRouter } from "next/navigation";

interface AuthCtx {
  user: { name?: string | null; email?: string | null; role?: string; uid?: string } | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({ user: null, loading: true, logout: async () => {} });
export function useAdminAuth() { return useContext(Ctx); }

const font = "'Plus Jakarta Sans', system-ui, sans-serif";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthCtx['user']>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // 1. Membaca session langsung dari Firebase (Cepat & Sinkron)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        let role = "STAFF"; // Default — akan di-override dari admin_users
        let name = firebaseUser.displayName || "User";
        
        try {
          // ✅ FIX GAP #2: Canonical — hanya baca admin_users (hapus legacy users/staff)
          const adminDoc = await getDoc(doc(db, "admin_users", firebaseUser.uid));
          if (adminDoc.exists()) {
            role = adminDoc.data()?.role ?? "STAFF";
            name = adminDoc.data()?.name || name;
          } else {
            // User tidak terdaftar sebagai admin → tolak sesi
            setUser(null);
            setLoading(false);
            return;
          }
        } catch (error) {
          console.error("Gagal mengambil role dari admin_users:", error);
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

  // 2. Fungsi Logout Firebase (Anti Bentrok)
  async function handleLogout() {
    try {
      await auth.signOut(); // Logout client
      await fetch('/api/auth/logout', { method: 'POST' }); // Hapus cookie server
      router.replace("/login");
    } catch (error) {
      console.error("Logout error:", error);
    }
  }

  // 3. UI Loading (100% desain asli milikmu, tidak disentuh)
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

  // Middleware sudah handle redirect untuk rute private, aman
  if (!user) return null;

  return (
    <Ctx.Provider value={{ user, loading: false, logout: handleLogout }}>
      {children}
    </Ctx.Provider>
  );
}