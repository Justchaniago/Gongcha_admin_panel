// src/middleware.ts — Next.js auth middleware using next-auth/jwt getToken
import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req: NextRequest) {
  const session = req.cookies.get('session');
  const { pathname } = req.nextUrl;

  // Rute publik
  if (pathname === '/login' || pathname.startsWith('/_next') || pathname.startsWith('/api') || pathname.startsWith('/assets')) {
    if (session && pathname === '/login') {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
    return NextResponse.next();
  }

  // Jika tidak ada session di rute private, tendang ke login
  if (!session) {
    return NextResponse.redirect(new URL('/login', req.url));
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
