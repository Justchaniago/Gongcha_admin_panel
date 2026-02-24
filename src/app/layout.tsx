import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
// import NextAuthProvider from "@/components/NextAuthProvider"; // 🔥 SUDAH DIHAPUS (CLEANUP)
import { AuthProvider } from "@/context/AuthContext";
import ProtectedRoute from "@/components/layout/ProtectedRoute";
import UserProfileHeader from "@/components/layout/UserProfileHeader";
import AdminShell from "@/components/layout/AdminShell";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-jakarta",
  display: "swap",
});

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
    <html lang="id" className={jakarta.variable}>
      <body>
        {/* NextAuthProvider sudah dihapus, langsung gunakan AuthProvider Firebase kita */}
        <AuthProvider>
          <UserProfileHeader />
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