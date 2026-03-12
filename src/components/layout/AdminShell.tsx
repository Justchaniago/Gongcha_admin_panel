"use client";

import { usePathname } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
// import { AuthProvider } from "@/components/AuthProvider";

// Pages that should NOT show the sidebar
const NO_SIDEBAR_ROUTES = ["/login", "/register", "/forgot-password", "/unauthorized"];

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showSidebar = !NO_SIDEBAR_ROUTES.some(r => pathname.startsWith(r));

  if (!showSidebar) {
    return <>{children}</>;
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
