import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { getAdminSession, isAdminAuthError } from "@/lib/adminSession";
import { writeActivityLog } from "@/lib/activityLog";

function guardId(id: unknown): string | null {
  if (typeof id !== "string" || !id.trim()) return null;
  return id.trim();
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<unknown> },
) {
  try {
    await getAdminSession({ allowedRoles: ["SUPER_ADMIN", "STAFF"] });
    const params = await context.params as { id?: string };
    const safeId = guardId(params.id);

    if (!safeId) {
      return NextResponse.json({ message: "Reward ID tidak valid." }, { status: 400 });
    }

    const doc = await adminDb.collection("rewards_catalog").doc(safeId).get();
    if (!doc.exists) {
      return NextResponse.json({ message: `Reward "${safeId}" tidak ditemukan.` }, { status: 404 });
    }

    return NextResponse.json({ id: doc.id, ...doc.data() });
  } catch (error: any) {
    if (isAdminAuthError(error)) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: error.message ?? "Internal server error." }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<unknown> },
) {
  try {
    const actor = await getAdminSession({ allowedRoles: ["SUPER_ADMIN"] });
    const params = await context.params as { id?: string };
    const safeId = guardId(params.id);

    if (!safeId) {
      return NextResponse.json({ message: "Reward ID tidak valid." }, { status: 400 });
    }

    const body = await req.json();
    const docRef = adminDb.collection("rewards_catalog").doc(safeId);
    const existing = await docRef.get();

    if (!existing.exists) {
      return NextResponse.json({ message: `Reward "${safeId}" tidak ditemukan.` }, { status: 404 });
    }

    const allowed = ["title", "description", "isActive", "isRedeemable"] as const;
    const update: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in body) {
        update[key] = body[key];
      }
    }

    if (body.pointsrequired !== undefined) update.pointsrequired = Number(body.pointsrequired);
    if (body.imageUrl !== undefined) update.imageUrl = String(body.imageUrl).trim();

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ message: "No fields to update." }, { status: 400 });
    }

    update.updatedAt = FieldValue.serverTimestamp();

    await docRef.update(update);
    await writeActivityLog({
      actor,
      action: "REWARD_UPDATED",
      targetType: "reward",
      targetId: safeId,
      targetLabel: String(existing.data()?.title ?? safeId),
      summary: `Updated reward ${safeId}`,
      source: "api/rewards/[id]:PATCH",
      metadata: {
        before: existing.data(),
        changes: update,
      },
    });

    const updated = await docRef.get();
    return NextResponse.json({ id: updated.id, ...updated.data() });
  } catch (error: any) {
    if (isAdminAuthError(error)) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: error.message ?? "Internal server error." }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<unknown> },
) {
  try {
    const actor = await getAdminSession({ allowedRoles: ["SUPER_ADMIN"] });
    const params = await context.params as { id?: string };
    const safeId = guardId(params.id);

    if (!safeId) {
      return NextResponse.json({ message: "Reward ID tidak valid." }, { status: 400 });
    }

    const docRef = adminDb.collection("rewards_catalog").doc(safeId);
    const existing = await docRef.get();
    if (!existing.exists) {
      return NextResponse.json({ message: `Reward "${safeId}" tidak ditemukan.` }, { status: 404 });
    }

    const before = existing.data() ?? null;
    await docRef.delete();
    await writeActivityLog({
      actor,
      action: "REWARD_DELETED",
      targetType: "reward",
      targetId: safeId,
      targetLabel: String(before?.title ?? safeId),
      summary: `Deleted reward ${safeId}`,
      source: "api/rewards/[id]:DELETE",
      metadata: { before },
    });

    return NextResponse.json({ success: true, id: safeId });
  } catch (error: any) {
    if (isAdminAuthError(error)) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: error.message ?? "Internal server error." }, { status: 500 });
  }
}
