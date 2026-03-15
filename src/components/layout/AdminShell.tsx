"use client";

import React, { useState, useEffect, createContext, useContext } from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import { useAuth } from "@/context/AuthContext";
import { useIsMobile } from "@/hooks/useIsMobile";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, LayoutDashboard, Receipt, Users, Store,
  Star, Bell, Settings, LogOut, ChevronRight
} from "lucide-react";
import { auth } from "@/lib/firebaseClient";
import { signOut } from "firebase/auth";

// ─────────────────────────────────────────────────────────────────
// CONTEXT (Agar halaman mobile bisa membuka drawer dari tombol menu mereka sendiri)
// ─────────────────────────────────────────────────────────────────
interface MobileSidebarContextType {
  openDrawer: () => void;
}
export const MobileSidebarContext = createContext<MobileSidebarContextType>({
  openDrawer: () => {},
});
export const useMobileSidebar = () => useContext(MobileSidebarContext);

// ─────────────────────────────────────────────────────────────────
// CONSTANTS & DESIGN TOKENS
// ─────────────────────────────────────────────────────────────────
const NO_SIDEBAR_ROUTES = ["/login", "/register", "/forgot-password", "/unauthorized"];

const NAV = [
  { icon: LayoutDashboard, label: "Dashboard",  href: "/dashboard"     },
  { icon: Receipt,  label: "Transactions", href: "/transactions" },
  { icon: Users,    label: "Members",    href: "/admin-users"   },
  { icon: Store,    label: "Stores",     href: "/stores"        },
  { icon: Star,     label: "Points & Claims", href: "/claims"   },
  { icon: Bell,     label: "Notifications",  href: "/notifications" },
  { icon: Settings, label: "Settings",   href: "/settings"      },
];

const T = {
  surface:   "#FFFFFF",
  tx1:       "#111827",
  tx3:       "#6B7280",
  tx4:       "#9CA3AF",
  border:    "#F3F4F6",
  blue:      "#3B82F6",
  blueL:     "#EFF6FF",
  blueD:     "#1D4ED8",
  red:       "#DC2626",
};

// ─────────────────────────────────────────────────────────────────
// MOBILE DRAWER COMPONENT (Pindahan dari DashboardMobile)
// ─────────────────────────────────────────────────────────────────
const MobileDrawer = ({ open, onClose, userName, role, router }: any) => {
  const pathname = usePathname();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push("/login");
    } catch (e) {
      console.error("Logout error", e);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ position: "fixed", inset: 0, zIndex: 9998, background: "rgba(0,0,0,0.32)", backdropFilter: "blur(4px)" }}
            onClick={onClose}
          />
          
          {/* Drawer Panel */}
          <motion.div
            initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
            transition={{ type: "spring", stiffness: 360, damping: 36 }}
            style={{
              position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 9999,
              width: "75vw", maxWidth: 300,
              background: T.surface, display: "flex", flexDirection: "column",
              boxShadow: "4px 0 24px rgba(0,0,0,0.08)"
            }}
          >
            {/* Header Profil */}
            <div style={{ padding: "56px 20px 16px", borderBottom: `1px solid ${T.border}` }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 10, background: T.blue, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ color: "#fff", fontSize: 10, fontWeight: 900, letterSpacing: ".04em" }}>GC</span>
                  </div>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 800, color: T.tx1, lineHeight: 1 }}>Gong Cha</p>
                    <p style={{ fontSize: 10, color: T.tx4, marginTop: 2 }}>Admin Panel</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  style={{ width: 28, height: 28, borderRadius: "50%", background: T.border, border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                >
                  <X size={13} color={T.tx3} />
                </button>
              </div>
              
              {/* User row */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#F9FAFB", borderRadius: 12, padding: "10px 12px" }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: T.blueL, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ color: T.blueD, fontSize: 12, fontWeight: 800 }}>{(userName?.[0] || "A").toUpperCase()}</span>
                </div>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: T.tx1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{userName}</p>
                  <p style={{ fontSize: 9, color: T.tx4, textTransform: "uppercase", letterSpacing: ".1em", marginTop: 1 }}>
                    {role === "SUPER_ADMIN" ? "Super Admin" : "Staff"}
                  </p>
                </div>
              </div>
            </div>

            {/* Menu List */}
            <div style={{ flex: 1, padding: "12px 10px", overflowY: "auto" }}>
              {NAV.map(({ icon: Icon, label, href }) => {
                const active = pathname === href || pathname.startsWith(href + "/");
                return (
                  <button key={label}
                    onClick={() => { router.push(href); onClose(); }}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", gap: 10,
                      padding: "12px 14px", borderRadius: 10, marginBottom: 4, border: "none", cursor: "pointer",
                      background: active ? T.blueL : "transparent",
                      color: active ? T.blue : T.tx3,
                      transition: "all 0.2s ease"
                    }}
                  >
                    <Icon size={18} strokeWidth={active ? 2.5 : 2} />
                    <span style={{ fontSize: 13.5, fontWeight: active ? 700 : 500 }}>{label}</span>
                    {active && <ChevronRight size={14} style={{ marginLeft: "auto", color: T.blue }} />}
                  </button>
                );
              })}
            </div>

            {/* Logout Button */}
            <div style={{ padding: "12px 10px 32px", borderTop: `1px solid ${T.border}` }}>
              <button onClick={handleLogout} style={{
                width: "100%", display: "flex", alignItems: "center", gap: 10,
                padding: "12px 14px", borderRadius: 10, border: "none", cursor: "pointer",
                background: "transparent", color: T.red, transition: "all 0.2s ease"
              }}>
                <LogOut size={18} />
                <span style={{ fontSize: 13.5, fontWeight: 600 }}>Sign out</span>
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

// ─────────────────────────────────────────────────────────────────
// MAIN SHELL (Desktop & Mobile)
// ─────────────────────────────────────────────────────────────────
export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const isMobile = useIsMobile(); 
  
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const showSidebar = !NO_SIDEBAR_ROUTES.some(r => pathname.startsWith(r));

  if (!showSidebar) {
    return <>{children}</>;
  }

  // Hindari hydration mismatch (wajib untuk Next.js App Router saat memakai window.innerWidth)
  if (!mounted) {
    return null; 
  }

  // --- RENDER UNTUK MOBILE ---
  if (isMobile) {
    const userName = user?.name || user?.email?.split("@")[0] || "Admin";
    const role = user?.role || "STAFF";

    return (
      <MobileSidebarContext.Provider value={{ openDrawer: () => setDrawerOpen(true) }}>
        <div style={{ height: "100dvh", overflow: "hidden" }}>
          {/* Drawer Tersembunyi */}
          <MobileDrawer 
            open={drawerOpen} 
            onClose={() => setDrawerOpen(false)} 
            userName={userName} 
            role={role} 
            router={router} 
          />
          {/* Konten Halaman Mobile (Termasuk Top Bar dari halaman masing-masing) */}
          <main style={{ height: "100%", overflowY: "auto", overflowX: "hidden" }}>
            {children}
          </main>
        </div>
      </MobileSidebarContext.Provider>
    );
  }

  // --- RENDER UNTUK DESKTOP (Layout lama dijamin utuh 100%) ---
  return (
    <div className="gc-shell">
      <Sidebar />
      <main className="gc-shell-main">
        <div className="gc-shell-content">
          {children}
        </div>
      </main>
    </div>
  );
}