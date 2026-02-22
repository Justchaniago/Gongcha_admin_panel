import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { decode } from "next-auth/jwt";
import { cookies } from "next/headers";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ uid: string }> }
) {
  try {
    // Baca cookie session langsung dari next/headers dan decode JWT secara manual.
    // Pendekatan ini paling kompatibel dengan Next.js 16 karena tidak bergantung
    // pada internal getServerSession atau getToken.
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("next-auth.session-token")?.value;

    if (!sessionToken) {
      return NextResponse.json(
        { error: "Session tidak ditemukan. Silakan login ulang.", code: "SESSION_NULL" },
        { status: 403 }
      );
    }

    const token = await decode({
      token: sessionToken,
      secret: process.env.NEXTAUTH_SECRET!,
    });

    if (!token) {
      return NextResponse.json(
        { error: "Session tidak ditemukan. Silakan login ulang.", code: "SESSION_NULL" },
        { status: 403 }
      );
    }

    // Cek role admin atau master
    const userRole = token.role as string;

    if (!["admin", "master"].includes(userRole)) {
      return NextResponse.json(
        { error: "Akses ditolak. Anda tidak memiliki izin admin.", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    const { uid } = await context.params;
    if (!uid) return NextResponse.json({ error: "Missing uid" }, { status: 400 });

    const { currentPoints, lifetimePoints } = await req.json();

    // Validasi points
    if (typeof currentPoints !== "number" || typeof lifetimePoints !== "number") {
      return NextResponse.json({ error: "Invalid points format" }, { status: 400 });
    }

    if (lifetimePoints < currentPoints) {
      return NextResponse.json(
        { error: "Lifetime points tidak boleh kurang dari current points" },
        { status: 400 }
      );
    }

    await adminDb.collection("users").doc(uid).update({
      currentPoints:        Number(currentPoints),
      lifetimePoints:       Number(lifetimePoints),
      pointsLastEditedBy:   token.uid as string,
      pointsLastEditedAt:   new Date().toISOString(),
    });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error("Error updating points:", e);
    return NextResponse.json({ error: e.message || "Failed to update points" }, { status: 500 });
  }
}
