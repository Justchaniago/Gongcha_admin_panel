"use client";
import { useAuth } from "@/context/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";

const PUBLIC_ROUTES = ["/login"];

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, isStaff } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isPublicRoute = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );

  useEffect(() => {
    if (isPublicRoute) return;

    if (!loading) {
      // 1. Jika belum login atau profil database tidak ditemukan
      if (!user || !profile) {
        if (pathname !== "/login") {
          router.replace("/login");
        }
        return;
      }

      // 2. Jika akun terdeteksi sebagai STAFF, aktifkan URL Blocker
      if (isStaff) {
        const allowedPaths = ["/dashboard", "/transactions", "/unauthorized"];
        const isAllowed = allowedPaths.some(
          (path) => pathname === path || pathname.startsWith(path + '/')
        );
        
        if (!isAllowed) {
          router.replace("/unauthorized");
        }
      }
    }
  }, [loading, user, profile, router, pathname, isStaff]);

  if (isPublicRoute) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-blue-600"></div>
      </div>
    );
  }

  // Mencegah flash konten sebelum redirect selesai
  if (!user || !profile) return null;

  return <>{children}</>;
}