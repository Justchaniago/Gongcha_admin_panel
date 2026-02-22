// src/middleware.ts — Next.js auth middleware using next-auth/jwt getToken
import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // getToken handles NextAuth's JWE-encrypted session cookie correctly
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });

  // ── Not authenticated → redirect to login ─────────────────────────────────
  if (!token) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const role = token.role as string | undefined;

  // ── Role helpers ──────────────────────────────────────────────────────────
  const isAdmin = role === "admin" || role === "master";
  const isStaff = ["admin", "master", "cashier", "store_manager"].includes(role ?? "");

  // ── Route guards ──────────────────────────────────────────────────────────

  // Settings & Accounts — admin/master only
  if (pathname.startsWith("/settings") || pathname.startsWith("/accounts")) {
    if (!isAdmin) {
      return NextResponse.redirect(new URL("/unauthorized", req.url));
    }
  }

  // Stores & Rewards — admin/master only
  if (pathname.startsWith("/stores") || pathname.startsWith("/rewards")) {
    if (!isAdmin) {
      return NextResponse.redirect(new URL("/unauthorized", req.url));
    }
  }

  // Transactions — admin/master/cashier/store_manager
  if (pathname.startsWith("/transactions")) {
    if (!isStaff) {
      return NextResponse.redirect(new URL("/unauthorized", req.url));
    }
  }

  // Users & Staff — admin/master/cashier/store_manager
  if (pathname.startsWith("/users-staff")) {
    if (!isStaff) {
      return NextResponse.redirect(new URL("/unauthorized", req.url));
    }
  }

  return NextResponse.next();
}

// Apply middleware to all admin routes
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/transactions/:path*",
    "/users-staff/:path*",
    "/stores/:path*",
    "/rewards/:path*",
    "/settings/:path*",
    "/accounts/:path*",
  ],
};
