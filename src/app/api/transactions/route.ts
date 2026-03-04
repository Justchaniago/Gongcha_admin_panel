// src/app/api/transactions/route.ts
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseServer";
import { cookies } from "next/headers";
import { adminAuth } from "@/lib/firebaseAdmin";
import * as admin from "firebase-admin";
import { v4 as uuidv4 } from "uuid";
import type { AdminNotificationLog, UserNotification } from "@/types/firestore";

// ── Notification helper ───────────────────────────────────────────────────────
async function createTxNotification(
  memberId: string,
  action: "verified" | "rejected",
  txData: FirebaseFirestore.DocumentData,
  adminUid: string,
) {
  if (!memberId) return;
  try {
    const notifId = uuidv4();
    const now     = new Date().toISOString();
    const txId    = txData.posTransactionId ?? txData.transactionId ?? "";
    const amount  = `Rp ${(txData.amount ?? 0).toLocaleString("id-ID")}`;

    const title = action === "verified"
      ? "✅ Transaksi Kamu Diverifikasi!"
      : "❌ Transaksi Ditolak";
    const body  = action === "verified"
      ? `Transaksi ${txId} (${amount}) telah diverifikasi. Poin kamu sudah bertambah!`
      : `Transaksi ${txId} (${amount}) ditolak. Hubungi kasir jika ada pertanyaan.`;

    const userNotif: UserNotification = {
      id:        notifId,
      type:      action === "verified" ? "tx_verified" : "tx_rejected",
      title,
      body,
      isRead:    false,
      createdAt: now,
      data:      { txId, amount: txData.amount ?? 0 },
    };
    const adminLog: AdminNotificationLog = {
      type:           action === "verified" ? "tx_verified" : "tx_rejected",
      title,
      body,
      targetType:     "user",
      targetUid:      memberId,
      sentAt:         now,
      sentBy:         adminUid,
      recipientCount: 1,
    };
    await Promise.all([
      adminDb.collection("users").doc(memberId).collection("notifications").doc(notifId).set(userNotif),
      adminDb.collection("notifications_log").doc(notifId).set(adminLog),
    ]);
  } catch (err) {
    console.error("[createTxNotification]", err);
    // Non-fatal — don't let notif failure break the main action
  }
}

// ── Auth helper ───────────────────────────────────────────────────────────────
async function validateSession(req: NextRequest) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;
  if (!sessionCookie) {
    return { error: "Session not found. Please login again.", status: 403, token: null };
  }
  const decodedClaims = await adminAuth.verifySessionCookie(sessionCookie, true);
  const userRole = decodedClaims.role as string;
  return { token: decodedClaims, userRole, error: null, status: 200 };
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
      context:       `Transaction ${txData.posTransactionId ?? txData.transactionId ?? txId}`,
      location:      txData.storeLocation ?? "",
      transactionId: txData.posTransactionId ?? txData.transactionId ?? txId,
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
        const type = data.type ?? "earn"; // Default to earn if not specified
        return {
          docId:           d.id,
          docPath:         d.ref.path,
          transactionId:   data.posTransactionId ?? data.transactionId ?? "",
          memberName:      data.memberName       ?? "-",
          memberId:        data.memberId         ?? "",
          staffId:         data.staffId          ?? "",
          storeLocation:   data.storeLocation    ?? "-",
          amount:          data.amount           ?? 0,
          potentialPoints: data.potentialPoints  ?? 0,
          type:            type,
          status:          data.status           ?? "pending",
          createdAt:       data.createdAt?.toDate?.()?.toISOString() ?? data.createdAt ?? null,
          verifiedAt:      data.verifiedAt?.toDate?.()?.toISOString() ?? data.verifiedAt ?? null,
          verifiedBy:      data.verifiedBy       ?? null,
        };
      })
      // Filter: only show "earn" (purchase) transactions, exclude "redeem"
      .filter((tx) => tx.type === "earn")
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
      return NextResponse.json({ message: "Transaction not found." }, { status: 404 });
    }

    const txData = txSnap.data()!;

    if (txData.status !== "pending") {
      return NextResponse.json(
        { message: `Transaction already has status "${txData.status}". Cannot be changed.` },
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
        txData.posTransactionId ?? txData.transactionId ?? txSnap.id,
        verifiedBy
      );

      // 3. Auto-notification to member
      await createTxNotification(txData.memberId, "verified", txData, verifiedBy);

      return NextResponse.json({
        success: true,
        action:  "verified",
        points:  txData.potentialPoints ?? 0,
      });
    } else {
      // Reject — just update status, no points
      await txRef.update({ status: "rejected", verifiedAt: now, verifiedBy });

      // Auto-notification to member
      await createTxNotification(txData.memberId, "rejected", txData, verifiedBy);

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
      return NextResponse.json({ message: "docPaths must be a non-empty array." }, { status: 400 });
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
            txData.posTransactionId ?? txData.transactionId ?? txSnap.id,
            verifiedBy
          );
          await createTxNotification(txData.memberId, "verified", txData, verifiedBy);
        } else {
          await txRef.update({ status: "rejected", verifiedAt: now, verifiedBy });
          await createTxNotification(txData.memberId, "rejected", txData, verifiedBy);
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

// ── DELETE — bulk/single delete transactions (admin only) ────────────────────
export async function DELETE(req: NextRequest) {
  const validation = await validateSession(req);
  if (validation.error) {
    return NextResponse.json({ message: validation.error }, { status: validation.status });
  }

  if (validation.userRole !== "admin") {
    return NextResponse.json(
      { message: "Only admin is allowed to delete transactions." },
      { status: 403 }
    );
  }

  try {
    const { docPaths } = await req.json();
    if (!Array.isArray(docPaths) || docPaths.length === 0) {
      return NextResponse.json(
        { message: "docPaths must be a non-empty array." },
        { status: 400 }
      );
    }

    let successCount = 0;
    let skipCount = 0;
    const errors: string[] = [];

    for (const docPath of docPaths) {
      try {
        if (typeof docPath !== "string" || !docPath.trim()) {
          skipCount++;
          continue;
        }

        const txRef = adminDb.doc(docPath);
        const txSnap = await txRef.get();

        if (!txSnap.exists) {
          skipCount++;
          continue;
        }

        await txRef.delete();
        successCount++;
      } catch (e: any) {
        errors.push(`${docPath}: ${e.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      successCount,
      skipCount,
      errorCount: errors.length,
      errors: errors.slice(0, 5),
    });
  } catch (e: any) {
    console.error("[DELETE /api/transactions]", e);
    return NextResponse.json({ message: e.message ?? "Internal server error" }, { status: 500 });
  }
}
