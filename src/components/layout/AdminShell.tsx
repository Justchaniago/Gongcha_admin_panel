"use client";

import { usePathname } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
// import { AuthProvider } from "@/components/AuthProvider";

// Pages that should NOT show the sidebar
const NO_SIDEBAR_ROUTES = ["/login", "/register", "/forgot-password"];

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showSidebar = !NO_SIDEBAR_ROUTES.some(r => pathname.startsWith(r));

  if (!showSidebar) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen" style={{ background: "#F1F5FF" }}>
      <Sidebar />
      <main
        className="flex-1 min-h-screen overflow-y-auto"
        style={{ marginLeft: "72px" }}
      >
        {children}
      </main>
    </div>
  );
}