// src/app/api/rewards/route.ts
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseServer";
import { FieldValue } from "firebase-admin/firestore";
import { cookies } from "next/headers";
import { adminAuth } from "@/lib/firebaseAdmin";

async function validateSession() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;
  if (!sessionCookie) {
    return { error: "Session not found. Please login again.", status: 403 };
  }
  try {
    const decodedClaims = await adminAuth.verifySessionCookie(sessionCookie, true);
    const profileSnap = await adminDb.collection("admin_users").doc(decodedClaims.uid).get();
    const profile = profileSnap.data();
    if (profile?.isActive !== true || profile?.role !== "SUPER_ADMIN") {
      return { error: "Access denied. SUPER_ADMIN required.", status: 403 };
    }
    return { token: decodedClaims, userRole: profile.role, error: null };
  } catch {
    return { error: "Invalid session.", status: 401 };
  }
}

function parseRewardBody(body: any) {
  const title = String(body.title ?? "").trim();
  const description = String(body.description ?? "").trim();
  const pointsRequired = Number(body.pointsRequired ?? body.pointsCost ?? 0);
  const imageUrl = String(body.imageUrl ?? body.imageURL ?? "").trim();
  const category = body.category;
  const isActive = body.isActive !== false;

  if (!title) throw new Error("title wajib diisi.");
  if (!Number.isFinite(pointsRequired) || pointsRequired < 0) {
    throw new Error("pointsRequired harus angka positif.");
  }

  return {
    title,
    description,
    pointsRequired,
    imageUrl,
    isActive,
    ...(category ? { category } : {}),
  };
}

// ── GET /api/rewards ───────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  // Validasi session
  const validation = await validateSession();
  if (validation.error) {
    return NextResponse.json({ message: validation.error }, { status: validation.status });
  }

  try {
    const snap = await adminDb.collection("rewards").get();
    const rewards = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return NextResponse.json({ rewards });
  } catch (err: any) {
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}

// ── POST /api/rewards ─────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  // Validasi session
  const validation = await validateSession();
  if (validation.error) {
    return NextResponse.json({ message: validation.error }, { status: validation.status });
  }

  try {
    const body = await req.json();
    const { rewardId } = body;

    // Validation
    if (!rewardId?.trim())  return NextResponse.json({ message: "rewardId wajib diisi." },  { status: 400 });

    const docId = rewardId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
    if (!docId) {
      return NextResponse.json({ message: "Reward ID invalid. Use lowercase letters, numbers, or underscore." }, { status: 400 });
    }
    const docRef = adminDb.collection("rewards").doc(docId);

    // Check duplicate
    const existing = await docRef.get();
    if (existing.exists) {
      return NextResponse.json({ message: `Reward ID "${docId}" sudah digunakan.` }, { status: 409 });
    }

    const parsed = parseRewardBody(body);

    const payload = {
      ...parsed,
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
