// src/app/api/transactions/route.ts
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseServer";
import { getToken } from "next-auth/jwt";
import * as admin from "firebase-admin";

// ── Auth helper ───────────────────────────────────────────────────────────────
async function validateSession(req: NextRequest) {
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
    secureCookie: process.env.NODE_ENV === "production",
  });

  if (!token) {
    return { error: "Session tidak ditemukan. Silakan login ulang.", status: 403, token: null };
  }

  return { token, userRole: token.role as string, error: null, status: 200 };
}

// ── Points disbursement helper ────────────────────────────────────────────────
async function disbursePoints(
  memberId: string,
  points: number,
  txData: FirebaseFirestore.DocumentData,
  txId: string,
  verifiedBy: string
) {
  if (!memberId || points <= 0) return;

  const memberRef = adminDb.collection("users").doc(memberId);

  await adminDb.runTransaction(async (t) => {
    const memberSnap = await t.get(memberRef);
    if (!memberSnap.exists) return;

    const memberData = memberSnap.data()!;
    const newCurrentPoints  = (memberData.currentPoints  ?? 0) + points;
    const newLifetimePoints = (memberData.lifetimePoints ?? 0) + points;

    // Auto-upgrade tier
    let tier = "Silver";
    if (newLifetimePoints >= 50000) tier = "Platinum";
    else if (newLifetimePoints >= 10000) tier = "Gold";

    const xpEntry = {
      id:            `${txId}_${Date.now()}`,
      date:          new Date().toISOString(),
      amount:        points,
      type:          "earn",
      status:        "verified",
      context:       `Transaksi ${txData.transactionId ?? txId}`,
      location:      txData.storeLocation ?? "",
      transactionId: txData.transactionId ?? txId,
    };

    t.update(memberRef, {
      currentPoints:  newCurrentPoints,
      lifetimePoints: newLifetimePoints,
      tier,
      xpHistory: admin.firestore.FieldValue.arrayUnion(xpEntry),
      pointsLastUpdatedAt: new Date().toISOString(),
      pointsLastUpdatedBy: verifiedBy,
    });
  });
}

// ── GET — list all transactions ───────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const validation = await validateSession(req);
  if (validation.error) {
    return NextResponse.json({ message: validation.error }, { status: validation.status });
  }

  try {
    // collectionGroup + orderBy requires a composite index that may not exist yet.
    // Fetch without orderBy and sort in-memory instead.
    const snap = await adminDb
      .collectionGroup("transactions")
      .limit(500)
      .get();

    const txs = snap.docs
      .map((d) => {
        const data = d.data();
        return {
          docId:           d.id,
          docPath:         d.ref.path,
          transactionId:   data.transactionId   ?? "",
          memberName:      data.memberName       ?? "-",
          memberId:        data.memberId         ?? "",
          staffId:         data.staffId          ?? "",
          storeLocation:   data.storeLocation    ?? "-",
          amount:          data.amount           ?? 0,
          potentialPoints: data.potentialPoints  ?? 0,
          status:          data.status           ?? "pending",
          createdAt:       data.createdAt?.toDate?.()?.toISOString() ?? data.createdAt ?? null,
          verifiedAt:      data.verifiedAt?.toDate?.()?.toISOString() ?? data.verifiedAt ?? null,
          verifiedBy:      data.verifiedBy       ?? null,
        };
      })
      // Sort newest-first in memory (avoids needing a Firestore collection-group index)
      .sort((a, b) => {
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return tb - ta;
      })
      .slice(0, 200);

    return NextResponse.json(txs);
  } catch (e: any) {
    console.error("[GET /api/transactions]", e);
    return NextResponse.json({ message: e.message }, { status: 500 });
  }
}

// ── PATCH — verify or reject a single transaction ─────────────────────────────
export async function PATCH(req: NextRequest) {
  const validation = await validateSession(req);
  if (validation.error) {
    return NextResponse.json({ message: validation.error }, { status: validation.status });
  }

  try {
    const { docPath, action } = await req.json();

    if (!docPath || !action) {
      return NextResponse.json({ message: "docPath dan action wajib diisi." }, { status: 400 });
    }
    if (!["verify", "reject"].includes(action)) {
      return NextResponse.json({ message: "action harus 'verify' atau 'reject'." }, { status: 400 });
    }

    const txRef  = adminDb.doc(docPath);
    const txSnap = await txRef.get();

    if (!txSnap.exists) {
      return NextResponse.json({ message: "Transaksi tidak ditemukan." }, { status: 404 });
    }

    const txData = txSnap.data()!;

    if (txData.status !== "pending") {
      return NextResponse.json(
        { message: `Transaksi sudah berstatus "${txData.status}". Tidak bisa diubah lagi.` },
        { status: 409 }
      );
    }

    const now        = new Date().toISOString();
    const verifiedBy = validation.token!.uid as string;

    if (action === "verify") {
      // 1. Update transaction status
      await txRef.update({ status: "verified", verifiedAt: now, verifiedBy });

      // 2. Disburse points to member
      await disbursePoints(
        txData.memberId,
        txData.potentialPoints ?? 0,
        txData,
        txSnap.id,
        verifiedBy
      );

      return NextResponse.json({
        success: true,
        action:  "verified",
        points:  txData.potentialPoints ?? 0,
      });
    } else {
      // Reject — just update status, no points
      await txRef.update({ status: "rejected", verifiedAt: now, verifiedBy });
      return NextResponse.json({ success: true, action: "rejected" });
    }
  } catch (e: any) {
    console.error("[PATCH /api/transactions]", e);
    return NextResponse.json({ message: e.message ?? "Internal server error" }, { status: 500 });
  }
}

// ── POST — bulk verify / reject multiple transactions ─────────────────────────
export async function POST(req: NextRequest) {
  const validation = await validateSession(req);
  if (validation.error) {
    return NextResponse.json({ message: validation.error }, { status: validation.status });
  }

  try {
    const { docPaths, action } = await req.json();

    if (!Array.isArray(docPaths) || docPaths.length === 0) {
      return NextResponse.json({ message: "docPaths harus berupa array yang tidak kosong." }, { status: 400 });
    }

    const actionType = action ?? "verify";
    if (!["verify", "reject"].includes(actionType)) {
      return NextResponse.json({ message: "action harus 'verify' atau 'reject'." }, { status: 400 });
    }

    const now        = new Date().toISOString();
    const verifiedBy = validation.token!.uid as string;
    let   successCount = 0;
    let   skipCount    = 0;
    const errors: string[] = [];

    for (const docPath of docPaths) {
      try {
        const txRef  = adminDb.doc(docPath);
        const txSnap = await txRef.get();

        if (!txSnap.exists || txSnap.data()!.status !== "pending") {
          skipCount++;
          continue;
        }

        const txData = txSnap.data()!;

        if (actionType === "verify") {
          await txRef.update({ status: "verified", verifiedAt: now, verifiedBy });
          await disbursePoints(
            txData.memberId,
            txData.potentialPoints ?? 0,
            txData,
            txSnap.id,
            verifiedBy
          );
        } else {
          await txRef.update({ status: "rejected", verifiedAt: now, verifiedBy });
        }

        successCount++;
      } catch (e: any) {
        errors.push(`${docPath}: ${e.message}`);
      }
    }

    return NextResponse.json({
      success:      true,
      successCount,
      skipCount,
      errorCount:   errors.length,
      errors:       errors.slice(0, 5),
    });
  } catch (e: any) {
    console.error("[POST /api/transactions]", e);
    return NextResponse.json({ message: e.message ?? "Internal server error" }, { status: 500 });
  }
}
