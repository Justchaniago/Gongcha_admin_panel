import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Satpam baru kita hanya mengecek laci cookie ini
  const session = request.cookies.get('session');
  const { pathname } = request.nextUrl;

  // Rute publik (Login & file statis)
  if (pathname === '/login' || pathname.startsWith('/_next') || pathname.startsWith('/api') || pathname.startsWith('/assets')) {
    // Kalau sudah punya tiket session tapi mau ke halaman login, usir ke dashboard
    if (session && pathname === '/login') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return NextResponse.next();
  }

  // Jika tidak ada tiket session di rute private, tendang kembali ke login
  if (!session) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};