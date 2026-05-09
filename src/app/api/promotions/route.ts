import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { getAdminSession, isAdminAuthError } from "@/lib/adminSession";
import { authorize, isRbacForbiddenError } from "@/lib/rbac";
import { writeActivityLog } from "@/lib/activityLog";

function parseBody(body: any) {
  const title = String(body.title ?? "").trim();
  const type = body.type === "modal_ad" ? "modal_ad" : "carousel";
  const imageUrl = String(body.imageUrl ?? "").trim();
  const storagePath = String(body.storagePath ?? "").trim();
  const order = typeof body.order === "number" ? body.order : 0;
  const isActive = body.isActive !== false;

  if (!title) throw new Error("title wajib diisi.");
  if (!imageUrl) throw new Error("imageUrl wajib diisi.");

  return { title, type, imageUrl, storagePath, order, isActive };
}

export async function GET(_req: NextRequest) {
  try {
    const session = await getAdminSession({ allowedRoles: ["SUPER_ADMIN", "ADMIN", "STAFF", "AUDITOR"] });
    authorize(session, { permission: "promo.read" });
    const snap = await adminDb.collection("promotions").orderBy("order", "asc").get();
    const promotions = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return NextResponse.json({ promotions });
  } catch (error: any) {
    if (isAdminAuthError(error)) return NextResponse.json({ message: error.message }, { status: error.status });
    if (isRbacForbiddenError(error)) return NextResponse.json({ message: error.message, code: error.code }, { status: error.status });
    return NextResponse.json({ message: error.message ?? "Internal server error." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await getAdminSession({ allowedRoles: ["SUPER_ADMIN", "ADMIN"] });
    authorize(actor, { permission: "promo.create" });
    const body = await req.json();
    const parsed = parseBody(body);

    const payload = {
      ...parsed,
      startDate: body.startDate ?? null,
      endDate: body.endDate ?? null,
      createdBy: actor.uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    const docRef = await adminDb.collection("promotions").add(payload);
    await writeActivityLog({
      actor,
      action: "PROMO_CREATED",
      targetType: "promotion",
      targetId: docRef.id,
      targetLabel: parsed.title,
      summary: `Created ${parsed.type} promotion "${parsed.title}"`,
      source: "api/promotions:POST",
      metadata: { type: parsed.type, isActive: parsed.isActive },
    });

    return NextResponse.json({ id: docRef.id, ...payload }, { status: 201 });
  } catch (error: any) {
    if (isAdminAuthError(error)) return NextResponse.json({ message: error.message }, { status: error.status });
    if (isRbacForbiddenError(error)) return NextResponse.json({ message: error.message, code: error.code }, { status: error.status });
    return NextResponse.json({ message: error.message ?? "Internal server error." }, { status: 500 });
  }
}
