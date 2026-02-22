import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseServer";
import { getServerSession } from "next-auth"; // atau auth lib yang kamu pakai
import { authOptions } from "@/lib/auth";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ uid: string }> }
) {
  try {
    // ── Auth guard: hanya admin ──
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "admin") {
      return NextResponse.json(
        { error: "Akses ditolak. Hanya admin yang dapat mengubah poin." },
        { status: 403 }
      );
    }

    const { currentPoints, lifetimePoints } = await req.json();
    const { uid } = await context.params;

    if (typeof currentPoints  !== "number" || currentPoints  < 0) {
      return NextResponse.json({ error: "Nilai poin tidak valid." }, { status: 400 });
    }
    if (typeof lifetimePoints !== "number" || lifetimePoints < 0) {
      return NextResponse.json({ error: "Nilai lifetime XP tidak valid." }, { status: 400 });
    }
    if (lifetimePoints < currentPoints) {
      return NextResponse.json(
        { error: "Lifetime XP tidak boleh lebih kecil dari poin aktif." },
        { status: 400 }
      );
    }

    await adminDb.collection("users").doc(uid).update({
      currentPoints,
      lifetimePoints,
      // Opsional: catat log audit
      pointsLastEditedBy: session.user.uid,
      pointsLastEditedAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
