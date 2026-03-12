import type { Metadata } from "next";
import "./globals.css";
import "../../styles/design-system.css";
// import NextAuthProvider from "@/components/NextAuthProvider"; // 🔥 ALREADY REMOVED (CLEANUP)
import { AuthProvider } from "@/context/AuthContext";
import ProtectedRoute from "@/components/layout/ProtectedRoute";
import AdminShell from "@/components/layout/AdminShell";

export const metadata: Metadata = {
  title: "Gong Cha Admin",
  description: "Gong Cha Loyalty & Store Management System",
  // ✨ INI DIA KUNCI UNTUK MENGGANTI LOGO TAB BROWSER ✨
  icons: {
    icon: "/assets/images/logo1.webp",
    shortcut: "/assets/images/logo1.webp",
    apple: "/assets/images/logo1.webp",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>
        {/* NextAuthProvider sudah dihapus, langsung gunakan AuthProvider Firebase kita */}
        <AuthProvider>
          <ProtectedRoute>
            <AdminShell>
              {children}
            </AdminShell>
          </ProtectedRoute>
        </AuthProvider>
      </body>
    </html>
  );
}
