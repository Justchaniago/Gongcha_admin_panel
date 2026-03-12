import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseServer";
import { FieldValue } from "firebase-admin/firestore";
import { cookies } from "next/headers";
import { adminAuth } from "@/lib/firebaseAdmin";

type RouteContext = { params: Promise<{ id: string }> };

async function validateSession(requireSuperAdmin = true) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;
  if (!sessionCookie) return { error: "Session not found.", status: 403 };
  try {
    const decodedClaims = await adminAuth.verifySessionCookie(sessionCookie, true);
    const profileSnap = await adminDb.collection("admin_users").doc(decodedClaims.uid).get();
    const profile = profileSnap.data();
    if (profile?.isActive !== true) return { error: "Access denied. Account inactive.", status: 403 };
    if (requireSuperAdmin && profile?.role !== "SUPER_ADMIN") return { error: "Access denied. SUPER_ADMIN required.", status: 403 };
    return { token: decodedClaims, userRole: profile.role, error: null };
  } catch {
    return { error: "Invalid session.", status: 401 };
  }
}

function guardId(id: unknown): string | null {
  if (typeof id !== 'string' || !id.trim()) return null;
  return id.trim();
}

export async function GET(req: NextRequest, ctx: RouteContext) {
  const validation = await validateSession(false);
  if (validation.error) return NextResponse.json({ message: validation.error }, { status: validation.status });

  const { id } = await ctx.params;
  const safeId = guardId(id);
  if (!safeId) return NextResponse.json({ message: 'Reward ID tidak valid.' }, { status: 400 });
  try {
    // 🔥 MENGARAH KE rewards_catalog
    const doc = await adminDb.collection("rewards_catalog").doc(safeId).get();
    if (!doc.exists) return NextResponse.json({ message: `Reward "${safeId}" tidak ditemukan.` }, { status: 404 });
    return NextResponse.json({ id: doc.id, ...doc.data() });
  } catch (err: any) {
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const validation = await validateSession(true);
  if (validation.error) return NextResponse.json({ message: validation.error }, { status: validation.status });

  const { id } = await ctx.params;
  const safeId = guardId(id);
  if (!safeId) return NextResponse.json({ message: 'Reward ID tidak valid.' }, { status: 400 });
  try {
    const body = await req.json();
    // 🔥 MENGARAH KE rewards_catalog
    const docRef = adminDb.collection("rewards_catalog").doc(safeId);

    const existing = await docRef.get();
    if (!existing.exists) return NextResponse.json({ message: `Reward "${safeId}" tidak ditemukan.` }, { status: 404 });

    const pointsPayload = body.pointsrequired;
    if (pointsPayload !== undefined && (typeof pointsPayload !== "number" || pointsPayload < 0)) {
      return NextResponse.json({ message: "pointsrequired harus angka positif." }, { status: 400 });
    }

    const allowed = ["title", "description", "isActive"] as const;
    const update: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in body) {
        update[key] = key === "title" || key === "description" ? (body[key] as string).trim?.() ?? body[key] : body[key];
      }
    }

    if (pointsPayload !== undefined) update.pointsrequired = Number(pointsPayload);
    if (body.imageUrl !== undefined) update.imageUrl = String(body.imageUrl).trim();

    if (Object.keys(update).length === 0) return NextResponse.json({ message: "No fields to update." }, { status: 400 });

    update.updatedAt = FieldValue.serverTimestamp();

    await docRef.update(update);
    const updated = await docRef.get();
    return NextResponse.json({ id: updated.id, ...updated.data() });
  } catch (err: any) {
    return NextResponse.json({ message: err.message ?? "Internal server error." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: RouteContext) {
  const validation = await validateSession(true);
  if (validation.error) return NextResponse.json({ message: validation.error }, { status: validation.status });

  const { id } = await ctx.params;
  const safeId = guardId(id);
  if (!safeId) return NextResponse.json({ message: 'Reward ID tidak valid.' }, { status: 400 });
  try {
    // 🔥 MENGARAH KE rewards_catalog
    const docRef = adminDb.collection("rewards_catalog").doc(safeId);

    const existing = await docRef.get();
    if (!existing.exists) return NextResponse.json({ message: `Reward "${safeId}" tidak ditemukan.` }, { status: 404 });

    await docRef.delete();
    return NextResponse.json({ success: true, id: safeId });
  } catch (err: any) {
    return NextResponse.json({ message: err.message ?? "Internal server error." }, { status: 500 });
  }
}