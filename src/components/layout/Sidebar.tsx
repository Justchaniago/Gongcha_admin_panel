"use client";
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import LogoutButton from "@/components/LogoutButton";
import { useAdminAuth } from "@/components/AuthProvider";

const navItems = [
  { href: "/dashboard", label: "Dashboard", badge: false },
  { href: "/stores",    label: "Outlets",   badge: false },
  { href: "/transactions", label: "Transaksi", badge: false },
  { href: "/users-staff",  label: "Member",    badge: false },
  { href: "/rewards",  label: "Rewards",   badge: false },
  { href: "/settings", label: "Settings",  badge: false },
];

const icons: Record<string, React.ReactNode> = {
  "/dashboard":  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>,
  "/stores":     <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  "/transactions": <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/><path d="M9 12h6M9 16h4"/></svg>,
  "/users-staff":  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>,
  "/rewards":    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5" rx="1"/><path d="M12 22V7"/></svg>,
  "/settings":   <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>,
};


export default function Sidebar() {
  const pathname = usePathname();
  const { user } = useAdminAuth();

  return (
    <aside className="fixed top-0 left-0 h-screen w-[72px] flex flex-col items-center py-6 z-50 bg-white" style={{ borderRight: "1px solid #E2E8F0" }}>
      <div className="mb-8 w-14 h-14 rounded-2xl flex items-center justify-center bg-white shadow-lg border border-gray-200 overflow-hidden transition-all duration-200">
        <img src="/assets/images/logo1.webp" alt="Logo" className="w-12 h-12 object-contain" />
      </div>
      <nav className="flex flex-col items-center gap-1 flex-1">
        {navItems.map((item, idx) => {
          const active = pathname.startsWith(item.href);
          const isLast = idx === navItems.length - 1;
          return (
            <React.Fragment key={item.href}>
              <Link href={item.href} title={item.label}
                className="relative w-11 h-11 flex items-center justify-center rounded-xl transition-all group"
                style={{ background: active ? "#EEF2FF" : "transparent", color: active ? "#4361EE" : "#94A3B8" }}>
                {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r-full bg-blue1" style={{ background: "#4361EE" }} />}
                {icons[item.href]}
                {item.badge && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500 border-2 border-white" />}
                <span className="absolute left-14 bg-tx1 text-white text-xs px-2.5 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-lg" style={{ background: "#0F172A" }}>{item.label}</span>
              </Link>
              {isLast && <LogoutButton />}
            </React.Fragment>
          );
        })}
      </nav>
    </aside>
  );
}
