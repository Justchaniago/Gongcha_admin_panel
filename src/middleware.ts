import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const session = request.cookies.get('session');
  const { pathname } = request.nextUrl;

  // 1. Pengecualian (File statis & aset)
  const isAsset = 
    pathname.startsWith('/_next') || 
    pathname.startsWith('/assets') || 
    pathname.startsWith('/favicon.ico');

  if (isAsset) {
    return NextResponse.next();
  }

  // 2. Rute Publik
  const isLoginPage = pathname === '/login';
  
  // 🔥 PERBAIKAN DI SINI: Kita izinkan semua rute yang berawalan /api/auth
  // agar API /api/auth/session (pembuat cookie) tidak diblokir!
  const isPublicApi = pathname.startsWith('/api/auth'); 

  if (isLoginPage || isPublicApi) {
    if (session && isLoginPage) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return NextResponse.next();
  }

  // 3. Proteksi Rute Private
  if (!session) {
    if (pathname.startsWith('/api')) {
      return NextResponse.json({ error: 'Session Expired' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|assets).*)'],
};