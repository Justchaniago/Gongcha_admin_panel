"use client";

import React, { useState, useEffect, createContext, useContext } from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import { useAuth } from "@/context/AuthContext";
import { useIsMobile } from "@/hooks/useIsMobile";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, LayoutDashboard, Receipt, Users, Store,
  Bell, Settings, LogOut, ChevronRight, Coffee, FolderOpen, Ticket
} from "lucide-react";
import { auth } from "@/lib/firebaseClient";
import { signOut } from "firebase/auth";

interface MobileSidebarContextType {
  openDrawer: () => void;
}
export const MobileSidebarContext = createContext<MobileSidebarContextType>({
  openDrawer: () => {},
});
export const useMobileSidebar = () => useContext(MobileSidebarContext);

const NO_SIDEBAR_ROUTES = ["/login", "/register", "/forgot-password", "/unauthorized"];

const NAV = [
  { href: "/dashboard",     label: "Dashboard",  superAdminOnly: false, icon: LayoutDashboard },
  { href: "/stores",        label: "Outlets",    superAdminOnly: false, icon: Store },
  { href: "/transactions",  label: "Transaksi",  superAdminOnly: false, icon: Receipt },
  { href: "/menus",         label: "Menu",       superAdminOnly: false, icon: Coffee },
  { href: "/assets",        label: "Assets",     superAdminOnly: true,  icon: FolderOpen },
  { href: "/admin-users",   label: "Member",     superAdminOnly: true,  icon: Users },
  { href: "/rewards",       label: "Rewards",    superAdminOnly: false, icon: Ticket },
  { href: "/notifications", label: "Notifikasi", superAdminOnly: true,  icon: Bell },
  { href: "/settings",      label: "Settings",   superAdminOnly: true,  icon: Settings },
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

const MobileDrawer = ({ open, onClose, userName, role, router, logout }: any) => {
  const pathname = usePathname();
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const dateStr = now.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const timeStr = now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  // handleLogout removed, using logout from AuthContext

  const isSuperAdmin = role === "SUPER_ADMIN";
  const visibleNavItems = NAV.filter((item) => !item.superAdminOnly || isSuperAdmin);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ position: "fixed", inset: 0, zIndex: 9998, background: "rgba(0,0,0,0.32)", backdropFilter: "blur(4px)" }}
            onClick={onClose}
          />
          
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
            {/* Header */}
            <div style={{ padding: "56px 20px 16px", borderBottom: `1px solid ${T.border}` }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
                {/* Logo + Title */}
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <img
                    src="/assets/images/logo1.webp"
                    alt="Gong Cha"
                    style={{ height: 48, width: "auto", objectFit: "contain", flexShrink: 0 }}
                  />
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 800, color: T.tx1, lineHeight: 1.3, letterSpacing: "-.01em" }}>
                      Gong Cha<br />Mobile Admin
                    </p>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 5 }}>
                      <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#10B981", display: "block", flexShrink: 0 }} />
                      <p style={{ fontSize: 9.5, color: T.tx4, fontVariantNumeric: "tabular-nums" }}>
                        {dateStr}
                      </p>
                    </div>
                    <p style={{ fontSize: 12, fontWeight: 700, color: T.tx1, fontVariantNumeric: "tabular-nums", marginTop: 1, letterSpacing: ".02em" }}>
                      {timeStr}
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  style={{ width: 28, height: 28, borderRadius: "50%", background: T.border, border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, marginTop: 2 }}
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
              {visibleNavItems.map(({ icon: Icon, label, href }) => {
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

            {/* Logout */}
            <div style={{ padding: "12px 10px 32px", borderTop: `1px solid ${T.border}` }}>
              <button onClick={logout} style={{
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

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const isMobile = useIsMobile(); 
  
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const showSidebar = !NO_SIDEBAR_ROUTES.some(r => pathname.startsWith(r));

  if (!showSidebar) return <>{children}</>;
  if (!mounted) return null; 

  if (isMobile) {
    const userName = user?.name || user?.email?.split("@")[0] || "Admin";
    const role = user?.role || "STAFF";

    return (
      <MobileSidebarContext.Provider value={{ openDrawer: () => setDrawerOpen(true) }}>
        <div style={{ height: "100dvh", overflow: "hidden" }}>
          <MobileDrawer 
            open={drawerOpen} 
            onClose={() => setDrawerOpen(false)} 
            userName={userName} 
            role={role} 
            router={router} 
            logout={logout}
          />
          <main style={{ height: "100%", overflowY: "auto", overflowX: "hidden" }}>
            {children}
          </main>
        </div>
      </MobileSidebarContext.Provider>
    );
  }

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