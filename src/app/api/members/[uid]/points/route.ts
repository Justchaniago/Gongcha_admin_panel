import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { getToken } from "next-auth/jwt";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ uid: string }> }
) {
  try {
    // Lebih robust: coba baca token dari cookie header atau dari authorization header
    let token = await getToken({ 
      req, 
      secret: process.env.NEXTAUTH_SECRET,
      secureCookie: process.env.NODE_ENV === "production"
    });
    
    // Debug: log semua cookie yang masuk
    console.log('=== DEBUG PATCH /api/members/[uid]/points ===');
    console.log('Cookies:', req.headers.get('cookie'));
    console.log('Token:', token);
    
    if (!token) {
      // Coba alternatif: baca dari header Authorization
      const authHeader = req.headers.get('authorization');
      if (authHeader) {
        console.log('Authorization header:', authHeader);
      }
      
      return NextResponse.json(
        { error: "Session tidak ditemukan. Silakan login ulang.", code: "SESSION_NULL" },
        { status: 403 }
      );
    }

    // Cek role admin atau master
    const userRole = token.role as string;
    console.log('User role:', userRole);
    
    if (!['admin', 'master'].includes(userRole)) {
      return NextResponse.json(
        { error: "Akses ditolak. Anda tidak memiliki izin admin.", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    const { currentPoints, lifetimePoints } = await req.json();
    const { uid } = await context.params;
    if (!uid) return NextResponse.json({ error: 'Missing uid' }, { status: 400 });

    // Validasi points
    if (typeof currentPoints !== 'number' || typeof lifetimePoints !== 'number') {
      return NextResponse.json({ error: 'Invalid points format' }, { status: 400 });
    }

    if (lifetimePoints < currentPoints) {
      return NextResponse.json({ error: 'Lifetime points tidak boleh kurang dari current points' }, { status: 400 });
    }

    await adminDb.collection('users').doc(uid).update({
      currentPoints: Number(currentPoints),
      lifetimePoints: Number(lifetimePoints),
      pointsLastEditedBy: token.uid,
      pointsLastEditedAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('Error updating points:', e);
    return NextResponse.json({ error: e.message || 'Failed to update points' }, { status: 500 });
  }
}
