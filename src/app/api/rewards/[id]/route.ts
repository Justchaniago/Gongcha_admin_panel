// src/app/api/rewards/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseServer";
import { FieldValue } from "firebase-admin/firestore";
import { cookies } from "next/headers";
import { adminAuth } from "@/lib/firebaseAdmin";


// Next.js 14+ App Router: params is a Promise
type RouteContext = { params: Promise<{ id: string }> };

// Helper untuk validasi session
async function validateSession(req: NextRequest) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;
  if (!sessionCookie) {
    return { error: "Session tidak ditemukan. Silakan login ulang.", status: 403 };
  }
  const decodedClaims = await adminAuth.verifySessionCookie(sessionCookie, true);
  const userRole = decodedClaims.role as string;
  if (!['admin', 'master'].includes(userRole)) {
    return { error: "Akses ditolak. Anda tidak memiliki izin.", status: 403 };
  }
  return { token: decodedClaims, userRole, error: null };
}

function guardId(id: unknown): string | null {
  if (typeof id !== 'string' || !id.trim()) return null;
  return id.trim();
}

// ── GET /api/rewards/:id ───────────────────────────────────────────────────────
export async function GET(req: NextRequest, ctx: RouteContext) {
  // Validasi session
  const validation = await validateSession(req);
  if (validation.error) {
    return NextResponse.json({ message: validation.error }, { status: validation.status });
  }

  const { id } = await ctx.params;
  const safeId = guardId(id);
  if (!safeId) return NextResponse.json({ message: 'Reward ID tidak valid.' }, { status: 400 });
  try {
    const doc = await adminDb.collection("rewards_catalog").doc(safeId).get();
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
  const validation = await validateSession(req);
  if (validation.error) {
    return NextResponse.json({ message: validation.error }, { status: validation.status });
  }

  const { id } = await ctx.params;
  const safeId = guardId(id);
  if (!safeId) return NextResponse.json({ message: 'Reward ID tidak valid.' }, { status: 400 });
  try {
    const body = await req.json();
    const docRef = adminDb.collection("rewards_catalog").doc(safeId);

    const existing = await docRef.get();
    if (!existing.exists) {
      return NextResponse.json({ message: `Reward "${safeId}" tidak ditemukan.` }, { status: 404 });
    }

    // Validation that are present in — only validate fields body
    if ("category" in body && !["Drink", "Topping", "Discount"].includes(body.category)) {
      return NextResponse.json({ message: "category tidak valid. Gunakan: Drink, Topping, atau Discount." }, { status: 400 });
    }
    if ("pointsCost" in body && (typeof body.pointsCost !== "number" || body.pointsCost < 0)) {
      return NextResponse.json({ message: "pointsCost harus angka positif." }, { status: 400 });
    }

    // Build safe update payload (whitelist fields)
    const allowed = ["title", "description", "pointsCost", "category", "isActive", "type"] as const;
    const update: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in body) {
        if (key === "type") {
          update[key] = body[key] === "personal" ? "personal" : "catalog";
        } else {
          update[key] = key === "title" || key === "description"
            ? (body[key] as string).trim?.() ?? body[key]
            : body[key];
        }
      }
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ message: "Tidak ada field yang diupdate." }, { status: 400 });
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
  const validation = await validateSession(req);
  if (validation.error) {
    return NextResponse.json({ message: validation.error }, { status: validation.status });
  }

  const { id } = await ctx.params;
  const safeId = guardId(id);
  if (!safeId) return NextResponse.json({ message: 'Reward ID tidak valid.' }, { status: 400 });
  try {
    const docRef = adminDb.collection("rewards_catalog").doc(safeId);

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
