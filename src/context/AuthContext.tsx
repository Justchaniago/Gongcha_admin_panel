"use client";

import React, { createContext, useContext, ReactNode, useEffect, useRef, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { usePathname, useRouter } from "next/navigation";
import { auth } from "@/lib/firebaseClient";
import { AdminUser } from "@/types/firestore";

interface AuthCtx {
  user: AdminUser | null;
  loading: boolean;
  logout: () => Promise<void>;
  can: (permission: string) => boolean;
}

// Nilai default
const Ctx = createContext<AuthCtx>({ user: null, loading: true, logout: async () => {}, can: () => false });

// Hook utama yang dipakai oleh semua komponen UI kamu
export function useAuth() { return useContext(Ctx); }

const font = "Inter, system-ui, sans-serif";
const SESSION_IDLE_TIMEOUT_MS = 60 * 60 * 1000;
const SESSION_REFRESH_INTERVAL_MS = 10 * 60 * 1000;
const SESSION_CHECK_INTERVAL_MS = 60 * 1000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthCtx['user']>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const lastActivityAtRef = useRef(Date.now());
  const lastRefreshAtRef = useRef(Date.now());
  const loggingOutRef = useRef(false);

  const normalizeRole = (rawRole: unknown): AdminUser["role"] => {
    const role = String(rawRole ?? "").toUpperCase();
    if (["SUPER_ADMIN", "MASTER"].includes(role)) return "SUPER_ADMIN";
    if (role === "ADMIN") return "ADMIN" as AdminUser["role"];
    if (role === "AUDITOR") return "AUDITOR" as AdminUser["role"];
    if (["STAFF", "MANAGER"].includes(role)) return "STAFF";
    return "STAFF";
  };

  const fetchSessionProfile = async () => {
    const res = await fetch("/api/auth/session", {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
    });

    const data = await res.json().catch(() => null);
    return {
      ok: res.ok,
      status: res.status,
      data,
    };
  };

  const tryAutoSetupProfile = async () => {
    const res = await fetch("/api/setup-user", {
      method: "POST",
      credentials: "include",
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error(`Setup user failed with HTTP ${res.status}`);
    }

    return res.json().catch(() => null);
  };

  const hydrateAdminUser = async (uid: string, fallbackEmail?: string | null, fallbackName?: string | null) => {
    try {
      const sessionResponse = await fetchSessionProfile();

      if (sessionResponse.status === 401) {
        return { sessionExpired: true } as const;
      }

      const sessionData = sessionResponse.data;
      if (sessionResponse.ok && sessionData?.authenticated && sessionData?.uid === uid) {
        const profile = sessionData.profile ?? null;
        if (profile) {
          return {
            uid,
            email: profile.email ?? sessionData.email ?? fallbackEmail ?? "",
            name: profile.name ?? sessionData.name ?? fallbackName ?? fallbackEmail?.split("@")[0] ?? "Admin",
            role: normalizeRole(profile.role),
            accessProfile: profile.accessProfile ?? undefined,
            permissions: Array.isArray(profile.permissions) ? profile.permissions : [],
            scope: profile.scope ?? undefined,
            isActive: profile.isActive !== false,
            assignedStoreId: profile.assignedStoreId ?? null,
          } as AdminUser;
        }
      }

      // No session profile — try auto-setup
      console.log("[AuthContext] No session profile, attempting auto-setup...", uid);
      try {
        await tryAutoSetupProfile();
        await new Promise((resolve) => setTimeout(resolve, 500));

        const retryResponse = await fetchSessionProfile();
        const retryData = retryResponse.data;
        if (retryResponse.ok && retryData?.authenticated && retryData?.uid === uid) {
          const profile = retryData.profile ?? null;
          if (profile) {
            return {
              uid,
              email: profile.email ?? fallbackEmail ?? "",
              name: profile.name ?? fallbackName ?? fallbackEmail?.split("@")[0] ?? "Admin",
              role: normalizeRole(profile.role),
              accessProfile: profile.accessProfile ?? undefined,
              permissions: Array.isArray(profile.permissions) ? profile.permissions : [],
              scope: profile.scope ?? undefined,
              isActive: profile.isActive !== false,
              assignedStoreId: profile.assignedStoreId ?? null,
            } as AdminUser;
          }
        }
      } catch (setupErr) {
        console.error("[AuthContext] Setup API error:", setupErr);
      }

      // Still no profile after auto-setup
      return { profileMissing: true } as const;
    } catch (error) {
      console.warn("[AuthContext] Failed to hydrate admin user:", error);
      return { profileMissing: true } as const;
    }
  };

  const buildOptimisticUser = (
    uid: string,
    email?: string | null,
    name?: string | null,
    ): AdminUser => ({
    uid,
    email: email ?? "",
    name: name ?? email?.split("@")[0] ?? "Admin",
    role: "STAFF",
    accessProfile: undefined,
    permissions: [],
    scope: undefined,
    assignedStoreId: null,
    isActive: true,
  });

  async function clearServerSession() {
    try {
      await fetch("/api/auth/session", {
        method: "DELETE",
        credentials: "include",
        cache: "no-store",
      });
    } catch (cookieErr) {
      console.warn("Failed to clear /api/auth/session cookie:", cookieErr);
    }

    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
      });
    } catch (legacyErr) {
      console.warn("Failed to call /api/auth/logout:", legacyErr);
    }
  }

  async function forceLogout(reason?: string) {
    if (loggingOutRef.current) return;
    loggingOutRef.current = true;

    try {
      if (reason) {
        console.warn("[AuthContext]", reason);
      }

      await clearServerSession();
      await signOut(auth);
    } catch (error) {
      console.error("Forced logout error:", error);
    } finally {
      setUser(null);
      loggingOutRef.current = false;
      router.replace("/login");
      router.refresh();
    }
  }

  function markActivity() {
    lastActivityAtRef.current = Date.now();
  }

  async function refreshSessionCookie() {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser || document.hidden) return;

    const now = Date.now();
    if (now - lastRefreshAtRef.current < SESSION_REFRESH_INTERVAL_MS) return;
    if (now - lastActivityAtRef.current >= SESSION_IDLE_TIMEOUT_MS) return;

    try {
      const idToken = await firebaseUser.getIdToken();
      const res = await fetch("/api/auth/session", {
        method: "PATCH",
        credentials: "include",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ idToken }),
      });

      if (!res.ok) {
        await forceLogout("Session refresh rejected. Redirecting to login.");
        return;
      }

      lastRefreshAtRef.current = now;
    } catch (error) {
      console.error("Session refresh error:", error);
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      loggingOutRef.current = false;

      if (!firebaseUser) {
        setUser(null);
        setLoading(false);
        return;
      }

      const optimisticUser = buildOptimisticUser(
        firebaseUser.uid,
        firebaseUser.email,
        firebaseUser.displayName,
      );

      // Jangan block UI dengan spinner panjang: tampilkan dulu user optimistic.
      setUser((prev) => prev ?? optimisticUser);
      setLoading(false);
      lastActivityAtRef.current = Date.now();
      lastRefreshAtRef.current = Date.now();

      // Hydrate profile admin di background.
      (async () => {
        try {
          const hydratedOrFallback = await hydrateAdminUser(
            firebaseUser.uid,
            firebaseUser.email,
            firebaseUser.displayName,
          );

          if ("sessionExpired" in hydratedOrFallback) {
            // On the login page the session cookie doesn't exist yet (still
            // being created by handleLogin). Skip forceLogout to avoid the
            // race where onAuthStateChanged fires before POST /api/auth/session
            // completes, causing an unnecessary redirect back to /login.
            if (pathname !== "/login") {
              await forceLogout("Session expired. Please login again.");
            }
            return;
          }

          if ("profileMissing" in hydratedOrFallback) {
            await forceLogout("Admin profile is missing. Please login again after admin access is configured.");
            return;
          }

          if (hydratedOrFallback?.isActive === false) {
            await signOut(auth);
            setUser(null);
            if (pathname !== "/login") {
              router.replace("/unauthorized");
            }
            return;
          }

          setUser(hydratedOrFallback ?? optimisticUser);
        } catch (error) {
          console.error("Gagal memverifikasi admin user:", error);
          // Keep optimistic user to prevent false unauthorized loop.
          setUser((prev) => prev ?? optimisticUser);
        }
      })();
    });

    return () => unsubscribe();
  }, [pathname, router]);

  useEffect(() => {
    if (loading || !user) return;

    const handleActivity = () => {
      if (document.hidden) return;
      markActivity();
      void refreshSessionCookie();
    };

    const handleVisibilityChange = () => {
      if (document.hidden) return;
      markActivity();
      void refreshSessionCookie();
    };

    const intervalId = window.setInterval(() => {
      if (document.hidden) return;

      const idleFor = Date.now() - lastActivityAtRef.current;
      if (idleFor >= SESSION_IDLE_TIMEOUT_MS) {
        void forceLogout("Idle timeout reached. Redirecting to login.");
        return;
      }

      if (Date.now() - lastRefreshAtRef.current >= SESSION_REFRESH_INTERVAL_MS) {
        void refreshSessionCookie();
      }
    }, SESSION_CHECK_INTERVAL_MS);

    const activityEvents: Array<keyof WindowEventMap> = [
      "pointerdown",
      "keydown",
      "touchstart",
      "focus",
    ];

    for (const eventName of activityEvents) {
      window.addEventListener(eventName, handleActivity, { passive: true });
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      for (const eventName of activityEvents) {
        window.removeEventListener(eventName, handleActivity);
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [loading, user]);

  async function handleLogout() {
    try {
      await clearServerSession();
      await signOut(auth);
      setUser(null);
      router.replace("/login");
      router.refresh();
    } catch (error) {
      console.error("Logout error:", error);
    }
  }

  function can(permission: string) {
    if (user?.role === "SUPER_ADMIN") return true;
    return Array.isArray(user?.permissions) && user.permissions.includes(permission);
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F4F6FB", fontFamily: font }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: "linear-gradient(135deg,#059669,#047857)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 24px rgba(5,150,105,.3)" }}>
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
    <Ctx.Provider value={{ user, loading: false, logout: handleLogout, can }}>
      {children}
    </Ctx.Provider>
  );
}
