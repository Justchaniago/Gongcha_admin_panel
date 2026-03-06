import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { cookies } from 'next/headers';
import { UserStaff } from '@/types/firestore';

export async function POST(request: Request) {
  try {
    const { idToken } = await request.json();

    if (!idToken) {
      return NextResponse.json({ error: 'Missing ID token' }, { status: 401 });
    }

    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const uid = decodedToken.uid;

    // Arahkan pemeriksaan ke koleksi admin_users
    const adminDoc = await adminDb.collection("admin_users").doc(uid).get();

    if (!adminDoc.exists) {
      return NextResponse.json({ error: 'Akses Ditolak. Anda bukan Super Admin atau Staff.' }, { status: 403 });
    }

    const userData = adminDoc.data() as UserStaff;
    if (!userData?.isActive) {
      return NextResponse.json({ error: 'Akun telah dinonaktifkan.' }, { status: 403 });
    }

    const expiresIn = 60 * 60 * 24 * 5 * 1000; // Sesi 5 hari
    const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn });

    cookies().set('session', sessionCookie, {
      maxAge: expiresIn,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    });

    return NextResponse.json({ success: true, user: userData });
  } catch (error) {
    console.error('Session creation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}