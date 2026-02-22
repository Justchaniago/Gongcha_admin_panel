// src/app/api/rewards/route.ts
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseServer";
import { FieldValue } from "firebase-admin/firestore";

// ── GET /api/rewards ───────────────────────────────────────────────────────────
export async function GET() {
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
  try {
    const body = await req.json();
    const { rewardId, title, description, pointsCost, category, isActive } = body;

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