// src/app/api/rewards/route.ts
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseServer";
import { FieldValue } from "firebase-admin/firestore";
import { cookies } from "next/headers";
import { adminAuth } from "@/lib/firebaseAdmin";

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

// ── GET /api/rewards ───────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  // Validasi session
  const validation = await validateSession(req);
  if (validation.error) {
    return NextResponse.json({ message: validation.error }, { status: validation.status });
  }

  try {
    const snap = await adminDb.collection("rewards_catalog").get();
    const rewards = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return NextResponse.json({ rewards });
  } catch (err: any) {
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}

// ── POST /api/rewards ─────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  // Validasi session
  const validation = await validateSession(req);
  if (validation.error) {
    return NextResponse.json({ message: validation.error }, { status: validation.status });
  }

  try {
    const body = await req.json();
    const { rewardId, title, description, pointsCost, category, isActive, type } = body;

    // Validation
    if (!rewardId?.trim())  return NextResponse.json({ message: "rewardId wajib diisi." },  { status: 400 });
    if (!title?.trim())     return NextResponse.json({ message: "title wajib diisi." },      { status: 400 });
    if (!["Drink", "Topping", "Discount"].includes(category)) {
      return NextResponse.json({ message: "category tidak valid. Gunakan: Drink, Topping, atau Discount." }, { status: 400 });
    }

    const docId = rewardId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
    if (!docId) {
      return NextResponse.json({ message: "Reward ID tidak valid. Gunakan huruf kecil, angka, atau underscore." }, { status: 400 });
    }
    const docRef = adminDb.collection("rewards_catalog").doc(docId);

    // Check duplicate
    const existing = await docRef.get();
    if (existing.exists) {
      return NextResponse.json({ message: `Reward ID "${docId}" sudah digunakan.` }, { status: 409 });
    }

    const payload = {
      title:       title.trim(),
      description: (description ?? "").trim(),
      pointsCost:  typeof pointsCost === "number" ? pointsCost : 0,
      category,
      isActive:    isActive !== false,
      type:        type === "personal" ? "personal" : "catalog", // default ke catalog
      createdAt:   FieldValue.serverTimestamp(),
      updatedAt:   FieldValue.serverTimestamp(),
    };

    await docRef.set(payload);
    return NextResponse.json({ id: docId, ...payload }, { status: 201 });

  } catch (err: any) {
    console.error("[POST /api/rewards]", err);
    return NextResponse.json({ message: err.message ?? "Internal server error." }, { status: 500 });
  }
}
