"use client";
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import LogoutButton from "@/components/LogoutButton";
import { useAuth } from "@/context/AuthContext";

const navItems = [
  { href: "/dashboard",     label: "Dashboard",  badge: false },
  { href: "/stores",        label: "Outlets",    badge: false },
  { href: "/transactions",  label: "Transaksi",  badge: false },
  { href: "/menus",         label: "Menu",       badge: false },
  { href: "/assets",        label: "Assets",     badge: false, superAdminOnly: true },
  { href: "/admin-users",   label: "Member",     badge: false, superAdminOnly: true },
  { href: "/rewards",       label: "Rewards",    badge: false },
  { href: "/notifications", label: "Notifikasi", badge: false, superAdminOnly: true },
  { href: "/settings",      label: "Settings",   badge: false, superAdminOnly: true },
];

const icons: Record<string, React.ReactNode> = {
  "/dashboard":     <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>,
  "/stores":        <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  "/transactions":  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/><path d="M9 12h6M9 16h4"/></svg>,
  "/menus":         <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v4"/><path d="M8 6h8"/><path d="M7.5 7.5h9l-1 8.5a3.5 3.5 0 01-3.5 3h0a3.5 3.5 0 01-3.5-3L7.5 7.5z"/><path d="M9.5 4.5L12 6l2.5-1.5"/><circle cx="10" cy="14.5" r=".6" fill="currentColor" stroke="none"/><circle cx="12" cy="15.5" r=".6" fill="currentColor" stroke="none"/><circle cx="13.9" cy="14.5" r=".6" fill="currentColor" stroke="none"/></svg>,
  "/assets":        <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.4"/><path d="M21 16l-5.25-5.25a1.5 1.5 0 00-2.12 0L8 16"/><path d="M13 16l-2-2-4 4"/></svg>,
  "/admin-users":   <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>,
  "/rewards":       <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5" rx="1"/><path d="M12 22V7"/></svg>,
  "/notifications": <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>,
  "/settings":      <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>,
};

export default function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const profileName = user?.name || user?.email?.split("@")[0] || "Admin";
  const isSuperAdmin = user?.role === "SUPER_ADMIN";
  const visibleNavItems = navItems.filter((item) => !item.superAdminOnly || isSuperAdmin);
  const [isOpen, setIsOpen] = React.useState(false);
  const closeTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const openSidebar = React.useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setIsOpen(true);
  }, []);

  const closeSidebar = React.useCallback((delay = 140) => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
    }
    closeTimerRef.current = setTimeout(() => {
      setIsOpen(false);
      closeTimerRef.current = null;
    }, delay);
  }, []);

  React.useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  return (
    <aside
      className={`gc-sidebar${isOpen ? " gc-sidebar--open" : ""}`}
      onMouseEnter={openSidebar}
      onMouseLeave={() => closeSidebar()}
      onFocusCapture={openSidebar}
      onBlurCapture={(e) => {
        const next = e.relatedTarget as Node | null;
        if (!next || !e.currentTarget.contains(next)) {
          closeSidebar(0);
        }
      }}
    >
      {/*
        Layer 2: .gc-sidebar-inner
        Selalu lebar penuh (220px via CSS), tidak ikut animasi.
        Ini yang mencegah teks wrap saat sidebar menyempit.
      */}
      <div className="gc-sidebar-inner">

        <div className="gc-sidebar-brand">
          <div className="gc-sidebar-brand-inner">
            <div className="gc-sidebar-logo">
              <img src="/assets/images/logo1.webp" alt="Gong Cha" />
            </div>
            {/*
              Layer 3: .gc-sidebar-label
              Hanya opacity + translateX yang berubah — zero reflow, zero wrap.
            */}
            <div className="gc-sidebar-brand-copy gc-sidebar-label">
              <p className="gc-sidebar-brand-title">Gong Cha Admin</p>
              <p className="gc-sidebar-brand-subtitle">Control Surface</p>
            </div>
          </div>
        </div>

        <nav className="gc-sidebar-nav">
          {visibleNavItems.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                className={`gc-sidebar-link${active ? " active" : ""}`}
              >
                <span className="gc-sidebar-link-inner">
                  <span className="gc-sidebar-icon">
                    {icons[item.href]}
                  </span>
                  <span className="gc-sidebar-label">{item.label}</span>
                </span>
                {item.badge && (
                  <span
                    className="absolute top-3 right-3 w-2 h-2 rounded-full"
                    style={{ background: "var(--gc-red)" }}
                  />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="gc-sidebar-footer">
          <div className="gc-sidebar-role">
            <div className="gc-sidebar-role-inner">
              <div className="gc-sidebar-icon gc-sidebar-role-icon">
                <svg width="19" height="19" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="8" r="3.5"/>
                  <path d="M5 20c0-3.9 3.1-7 7-7s7 3.1 7 7"/>
                </svg>
              </div>
              <div className="gc-sidebar-role-copy gc-sidebar-label">
                <p className="gc-sidebar-role-name">{profileName}</p>
              </div>
            </div>
          </div>
          <LogoutButton />
        </div>

      </div>
    </aside>
  );
}
