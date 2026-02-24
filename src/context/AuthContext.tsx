"use client";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { getAuth, onAuthStateChanged, signOut as firebaseSignOut, User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { signOut as nextAuthSignOut } from "next-auth/react";
import { app, db } from "@/lib/firebaseClient";

type AuthContextType = {
  user: User | null;
  role: "admin" | "manager" | "staff" | "cashier" | null;
  loading: boolean;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({ user: null, role: null, loading: true, logout: async () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<"admin" | "manager" | "staff" | "cashier" | null>(null);
  const [loading, setLoading] = useState(true);

  // Sinkron logout NextAuth & Firebase Auth
  const logout = async () => {
    const auth = getAuth(app);
    try {
      await firebaseSignOut(auth);
    } catch (e) {
      // ignore
    }
    await nextAuthSignOut({ callbackUrl: "/login" });
  };

  useEffect(() => {
    const auth = getAuth(app);
    // Listener ini dibungkus dengan cleanup untuk mencegah infinite loop / memory leak
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          const userDocRef = doc(db, "users", firebaseUser.uid);
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            setRole(userDocSnap.data().role);
          } else {
            setRole(null);
          }
        } catch (error) {
          console.error("Gagal mengambil role user:", error);
          setRole(null);
        }
      } else {
        setRole(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  return (
    <AuthContext.Provider value={{ user, role, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}