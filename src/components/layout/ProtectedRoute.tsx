"use client";
import { useAuth } from "@/context/AuthContext";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isPublicPage = pathname === "/login" || pathname === "/unauthorized";
  const redirectingRef = useRef(false);

  useEffect(() => {
    if (loading || user || isPublicPage) {
      redirectingRef.current = false;
      return;
    }

    const timeout = window.setTimeout(() => {
      if (!redirectingRef.current) {
        redirectingRef.current = true;
        router.replace("/login");
      }
    }, 1200);

    return () => window.clearTimeout(timeout);
  }, [loading, user, isPublicPage, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-blue-600"></div>
      </div>
    );
  }

  // Hard fallback: jangan render route private jika user null.
  if (!user && !isPublicPage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-10 w-10 border-t-4 border-blue-600"></div>
      </div>
    );
  }

  return <>{children}</>;
}