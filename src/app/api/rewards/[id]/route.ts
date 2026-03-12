// src/app/api/rewards/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseServer";
import { FieldValue } from "firebase-admin/firestore";
import { cookies } from "next/headers";
import { adminAuth } from "@/lib/firebaseAdmin";


// Next.js 14+ App Router: params is a Promise
type RouteContext = { params: Promise<{ id: string }> };

async function validateSession(requireSuperAdmin = true) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;
  if (!sessionCookie) {
    return { error: "Session not found. Please login again.", status: 403 };
  }
  try {
    const decodedClaims = await adminAuth.verifySessionCookie(sessionCookie, true);
    const profileSnap = await adminDb.collection("admin_users").doc(decodedClaims.uid).get();
    const profile = profileSnap.data();
    if (profile?.isActive !== true) {
      return { error: "Access denied. Account inactive.", status: 403 };
    }
    if (requireSuperAdmin && profile?.role !== "SUPER_ADMIN") {
      return { error: "Access denied. SUPER_ADMIN required.", status: 403 };
    }
    return { token: decodedClaims, userRole: profile.role, error: null };
  } catch {
    return { error: "Invalid session.", status: 401 };
  }
}

function guardId(id: unknown): string | null {
  if (typeof id !== 'string' || !id.trim()) return null;
  return id.trim();
}

// ── GET /api/rewards/:id ───────────────────────────────────────────────────────
export async function GET(req: NextRequest, ctx: RouteContext) {
  // Validasi session
  const validation = await validateSession(false);
  if (validation.error) {
    return NextResponse.json({ message: validation.error }, { status: validation.status });
  }

  const { id } = await ctx.params;
  const safeId = guardId(id);
  if (!safeId) return NextResponse.json({ message: 'Reward ID tidak valid.' }, { status: 400 });
  try {
    const doc = await adminDb.collection("rewards").doc(safeId).get();
    if (!doc.exists) {
      return NextResponse.json({ message: `Reward "${safeId}" tidak ditemukan.` }, { status: 404 });
    }
    return NextResponse.json({ id: doc.id, ...doc.data() });
  } catch (err: any) {
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}

// ── PATCH /api/rewards/:id ────────────────────────────────────────────────────
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  // Validasi session
  const validation = await validateSession(true);
  if (validation.error) {
    return NextResponse.json({ message: validation.error }, { status: validation.status });
  }

  const { id } = await ctx.params;
  const safeId = guardId(id);
  if (!safeId) return NextResponse.json({ message: 'Reward ID tidak valid.' }, { status: 400 });
  try {
    const body = await req.json();
    const docRef = adminDb.collection("rewards").doc(safeId);

    const existing = await docRef.get();
    if (!existing.exists) {
      return NextResponse.json({ message: `Reward "${safeId}" tidak ditemukan.` }, { status: 404 });
    }

    // Validation that are present in — only validate fields body
    if ("category" in body && body.category && !["Drink", "Topping", "Discount"].includes(body.category)) {
      return NextResponse.json({ message: "category invalid. Use: Drink, Topping, or Discount." }, { status: 400 });
    }

    const pointsPayload = body.pointsRequired ?? body.pointsCost;
    if (pointsPayload !== undefined && (typeof pointsPayload !== "number" || pointsPayload < 0)) {
      return NextResponse.json({ message: "pointsRequired harus angka positif." }, { status: 400 });
    }

    // Build safe update payload (whitelist fields)
    const allowed = ["title", "description", "category", "isActive"] as const;
    const update: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in body) {
        update[key] = key === "title" || key === "description"
          ? (body[key] as string).trim?.() ?? body[key]
          : body[key];
      }
    }

    if (pointsPayload !== undefined) update.pointsRequired = Number(pointsPayload);
    if (body.imageUrl !== undefined || body.imageURL !== undefined) {
      update.imageUrl = String(body.imageUrl ?? body.imageURL ?? "").trim();
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ message: "No fields to update." }, { status: 400 });
    }

    update.updatedAt = FieldValue.serverTimestamp();

    await docRef.update(update);
    const updated = await docRef.get();
    return NextResponse.json({ id: updated.id, ...updated.data() });

  } catch (err: any) {
    console.error("[PATCH /api/rewards/:id]", err);
    return NextResponse.json({ message: err.message ?? "Internal server error." }, { status: 500 });
  }
}

// ── DELETE /api/rewards/:id ───────────────────────────────────────────────────
export async function DELETE(req: NextRequest, ctx: RouteContext) {
  // Validasi session
  const validation = await validateSession(true);
  if (validation.error) {
    return NextResponse.json({ message: validation.error }, { status: validation.status });
  }

  const { id } = await ctx.params;
  const safeId = guardId(id);
  if (!safeId) return NextResponse.json({ message: 'Reward ID tidak valid.' }, { status: 400 });
  try {
    const docRef = adminDb.collection("rewards").doc(safeId);

    const existing = await docRef.get();
    if (!existing.exists) {
      return NextResponse.json({ message: `Reward "${safeId}" tidak ditemukan.` }, { status: 404 });
    }

    await docRef.delete();
    return NextResponse.json({ success: true, id: safeId });

  } catch (err: any) {
    console.error("[DELETE /api/rewards/:id]", err);
    return NextResponse.json({ message: err.message ?? "Internal server error." }, { status: 500 });
  }
}
