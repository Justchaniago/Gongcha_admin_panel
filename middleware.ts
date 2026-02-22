// middleware.ts (taruh di root project, sejajar dengan app/)
import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const role = req.nextauth.token?.role as string | undefined;

    // Halaman members hanya untuk staff roles
    if (pathname.startsWith("/dashboard/members")) {
      const allowed = ["admin", "cashier", "store_manager"];
      if (!role || !allowed.includes(role)) {
        return NextResponse.redirect(new URL("/unauthorized", req.url));
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      // Hanya lanjut ke middleware function jika sudah ada token (sudah login)
      authorized: ({ token }) => !!token,
    },
  }
);

// Terapkan middleware ke semua route di bawah /dashboard
export const config = {
  matcher: ["/dashboard/:path*"],
};