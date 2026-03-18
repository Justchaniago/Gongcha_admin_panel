import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { getAdminSession, isAdminAuthError } from "@/lib/adminSession";
import { writeActivityLog } from "@/lib/activityLog";

function parseRewardBody(body: any) {
  const title = String(body.title ?? "").trim();
  const description = String(body.description ?? "").trim();
  const pointsrequired = Number(body.pointsrequired ?? 0);
  const imageUrl = String(body.imageUrl ?? "").trim();
  const isActive = body.isActive !== false;
  const isRedeemable = body.isRedeemable !== false;

  if (!title) throw new Error("title wajib diisi.");

  return {
    title,
    description,
    pointsrequired,
    imageUrl,
    isActive,
    isRedeemable,
  };
}

export async function GET(_req: NextRequest) {
  try {
    await getAdminSession({ allowedRoles: ["SUPER_ADMIN", "STAFF"] });
    const snap = await adminDb.collection("rewards_catalog").get();
    const rewards = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return NextResponse.json({ rewards });
  } catch (error: any) {
    if (isAdminAuthError(error)) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: error.message ?? "Internal server error." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await getAdminSession({ allowedRoles: ["SUPER_ADMIN"] });
    const body = await req.json();
    const rewardId = String(body.rewardId ?? "").trim();

    if (!rewardId) {
      return NextResponse.json({ message: "rewardId wajib diisi." }, { status: 400 });
    }

    const docId = rewardId.toLowerCase().replace(/[^a-z0-9_-]/g, "");
    if (!docId) {
      return NextResponse.json({ message: "rewardId tidak valid." }, { status: 400 });
    }

    const docRef = adminDb.collection("rewards_catalog").doc(docId);
    const existing = await docRef.get();
    if (existing.exists) {
      return NextResponse.json({ message: "ID sudah digunakan" }, { status: 409 });
    }

    const parsed = parseRewardBody(body);
    const payload = {
      ...parsed,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    await docRef.set(payload);
    await writeActivityLog({
      actor,
      action: "REWARD_CREATED",
      targetType: "reward",
      targetId: docId,
      targetLabel: parsed.title,
      summary: `Created reward ${parsed.title}`,
      source: "api/rewards:POST",
      metadata: {
        title: parsed.title,
        pointsrequired: parsed.pointsrequired,
        isActive: parsed.isActive,
        isRedeemable: parsed.isRedeemable,
      },
    });

    return NextResponse.json({ id: docId, ...payload }, { status: 201 });
  } catch (error: any) {
    if (isAdminAuthError(error)) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: error.message ?? "Internal server error." }, { status: 500 });
  }
}
