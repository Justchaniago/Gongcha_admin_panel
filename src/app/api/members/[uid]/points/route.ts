import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { getAdminSession, isAdminAuthError } from "@/lib/adminSession";
import { writeActivityLog } from "@/lib/activityLog";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ uid: string }> }
) {
  try {
    const session = await getAdminSession({ allowedRoles: ["SUPER_ADMIN"] });

    const { uid } = await context.params;
    if (!uid) return NextResponse.json({ error: "Missing uid" }, { status: 400 });

    const { currentPoints, pendingPoints, lifetimePoints } = await req.json();

    // Validasi points
    if (typeof currentPoints !== "number" || typeof pendingPoints !== "number" || typeof lifetimePoints !== "number") {
      return NextResponse.json({ error: "Invalid points format" }, { status: 400 });
    }

    if (pendingPoints < 0) {
      return NextResponse.json({ error: "Pending points cannot be negative" }, { status: 400 });
    }

    if (lifetimePoints < currentPoints) {
      return NextResponse.json(
        { error: "Lifetime points cannot be less than current points" },
        { status: 400 }
      );
    }

    const targetRef = adminDb.collection("users").doc(uid);
    const beforeSnap = await targetRef.get();
    const before = beforeSnap.data() ?? null;

    await adminDb.collection("users").doc(uid).update({
      currentPoints:        Number(currentPoints),
      pendingPoints:        Number(pendingPoints),
      lifetimePoints:       Number(lifetimePoints),
      points:               Number(currentPoints),
      xp:                   Number(lifetimePoints),
      pointsLastEditedBy:   session.uid,
      pointsLastEditedAt:   new Date().toISOString(),
    });
    await writeActivityLog({
      actor: session,
      action: "POINTS_UPDATED",
      targetType: "member",
      targetId: uid,
      targetLabel: String(before?.name ?? uid),
      summary: `Updated member points via API for ${uid}`,
      source: "api/members/[uid]/points:PATCH",
      metadata: {
        before: {
          currentPoints: before?.currentPoints ?? before?.points ?? 0,
          pendingPoints: before?.pendingPoints ?? 0,
          lifetimePoints: before?.lifetimePoints ?? before?.xp ?? 0,
        },
        after: { currentPoints: Number(currentPoints), pendingPoints: Number(pendingPoints), lifetimePoints: Number(lifetimePoints) },
      },
    });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    if (isAdminAuthError(e)) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
    }
    console.error("Error updating points:", e);
    return NextResponse.json({ error: e.message || "Failed to update points" }, { status: 500 });
  }
}
