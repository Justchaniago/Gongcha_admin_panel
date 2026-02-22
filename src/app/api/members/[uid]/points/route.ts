import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { getToken } from "next-auth/jwt";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ uid: string }> }
) {
  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    console.log('TOKEN DEBUG', JSON.stringify(token));
    if (!token || !['admin', 'master'].includes(token.role)) {
      return NextResponse.json(
        { error: "Akses ditolak. Anda tidak memiliki izin." },
        { status: 403 }
      );
    }

    const { currentPoints, lifetimePoints } = await req.json();
    const { uid } = await context.params;
    if (!uid) return NextResponse.json({ error: 'Missing uid' }, { status: 400 });

    await adminDb.collection('users').doc(uid).update({
      currentPoints: Number(currentPoints),
      lifetimePoints: Number(lifetimePoints),
      pointsLastEditedBy: token.uid,
      pointsLastEditedAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to update points' }, { status: 500 });
  }
}