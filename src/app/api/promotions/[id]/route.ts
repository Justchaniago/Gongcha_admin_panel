import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { getAdminSession, isAdminAuthError } from "@/lib/adminSession";
import { authorize, isRbacForbiddenError } from "@/lib/rbac";
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
    const session = await getAdminSession({ allowedRoles: ["SUPER_ADMIN", "ADMIN", "STAFF", "AUDITOR"] });
    authorize(session, { permission: "promo.read" });
    const params = await context.params as { id?: string };
    const safeId = guardId(params.id);
    if (!safeId) return NextResponse.json({ message: "Promotion ID tidak valid." }, { status: 400 });

    const doc = await adminDb.collection("promotions").doc(safeId).get();
    if (!doc.exists) return NextResponse.json({ message: "Promotion tidak ditemukan." }, { status: 404 });

    return NextResponse.json({ id: doc.id, ...doc.data() });
  } catch (error: any) {
    if (isAdminAuthError(error)) return NextResponse.json({ message: error.message }, { status: error.status });
    if (isRbacForbiddenError(error)) return NextResponse.json({ message: error.message, code: error.code }, { status: error.status });
    return NextResponse.json({ message: error.message ?? "Internal server error." }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<unknown> },
) {
  try {
    const actor = await getAdminSession({ allowedRoles: ["SUPER_ADMIN", "ADMIN"] });
    authorize(actor, { permission: "promo.update" });
    const params = await context.params as { id?: string };
    const safeId = guardId(params.id);
    if (!safeId) return NextResponse.json({ message: "Promotion ID tidak valid." }, { status: 400 });

    const docRef = adminDb.collection("promotions").doc(safeId);
    const existing = await docRef.get();
    if (!existing.exists) return NextResponse.json({ message: "Promotion tidak ditemukan." }, { status: 404 });

    const body = await req.json();
    const update: Record<string, unknown> = {};

    const allowed = ["title", "imageUrl", "storagePath", "order", "isActive", "startDate", "endDate"] as const;
    for (const key of allowed) {
      if (key in body) update[key] = body[key];
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ message: "No fields to update." }, { status: 400 });
    }

    update.updatedAt = FieldValue.serverTimestamp();
    await docRef.update(update);

    await writeActivityLog({
      actor,
      action: "PROMO_UPDATED",
      targetType: "promotion",
      targetId: safeId,
      targetLabel: String(existing.data()?.title ?? safeId),
      summary: `Updated promotion ${safeId}`,
      source: "api/promotions/[id]:PATCH",
      metadata: { before: existing.data(), changes: update },
    });

    const updated = await docRef.get();
    return NextResponse.json({ id: updated.id, ...updated.data() });
  } catch (error: any) {
    if (isAdminAuthError(error)) return NextResponse.json({ message: error.message }, { status: error.status });
    if (isRbacForbiddenError(error)) return NextResponse.json({ message: error.message, code: error.code }, { status: error.status });
    return NextResponse.json({ message: error.message ?? "Internal server error." }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<unknown> },
) {
  try {
    const actor = await getAdminSession({ allowedRoles: ["SUPER_ADMIN", "ADMIN"] });
    authorize(actor, { permission: "promo.delete" });
    const params = await context.params as { id?: string };
    const safeId = guardId(params.id);
    if (!safeId) return NextResponse.json({ message: "Promotion ID tidak valid." }, { status: 400 });

    const docRef = adminDb.collection("promotions").doc(safeId);
    const existing = await docRef.get();
    if (!existing.exists) return NextResponse.json({ message: "Promotion tidak ditemukan." }, { status: 404 });

    const before = existing.data() ?? null;
    await docRef.delete();

    await writeActivityLog({
      actor,
      action: "PROMO_DELETED",
      targetType: "promotion",
      targetId: safeId,
      targetLabel: String(before?.title ?? safeId),
      summary: `Deleted promotion "${before?.title ?? safeId}"`,
      source: "api/promotions/[id]:DELETE",
      metadata: { before },
    });

    return NextResponse.json({ success: true, id: safeId, storagePath: before?.storagePath ?? null });
  } catch (error: any) {
    if (isAdminAuthError(error)) return NextResponse.json({ message: error.message }, { status: error.status });
    if (isRbacForbiddenError(error)) return NextResponse.json({ message: error.message, code: error.code }, { status: error.status });
    return NextResponse.json({ message: error.message ?? "Internal server error." }, { status: 500 });
  }
}
