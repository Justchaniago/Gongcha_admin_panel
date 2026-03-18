// src/app/api/transactions/route.ts
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseServer";
import * as admin from "firebase-admin";
import { v4 as uuidv4 } from "uuid";
import type { AdminNotificationLog, UserNotification } from "@/types/firestore";
import { getAdminSession, isAdminAuthError } from "@/lib/adminSession";
import { writeActivityLog } from "@/lib/activityLog";

type TransactionStatus = "PENDING" | "COMPLETED" | "CANCELLED" | "REFUNDED";

function isFirestoreNotFoundError(err: any): boolean {
  const msg = String(err?.message ?? "");
  return err?.code === 5 || msg.includes("5 NOT_FOUND") || msg.includes("NOT_FOUND");
}

function normalizeStatus(status: unknown): TransactionStatus {
  switch (String(status ?? "").toUpperCase()) {
    case "COMPLETED":
    case "VERIFIED":
      return "COMPLETED";
    case "CANCELLED":
    case "REJECTED":
      return "CANCELLED";
    case "REFUNDED":
      return "REFUNDED";
    case "PENDING":
    default:
      return "PENDING";
  }
}

function getReceiptNumber(txData: FirebaseFirestore.DocumentData, fallback = ""): string {
  return String(txData.receiptNumber ?? txData.posTransactionId ?? txData.transactionId ?? fallback);
}

function getTotalAmount(txData: FirebaseFirestore.DocumentData): number {
  return Number(txData.totalAmount ?? txData.amount ?? 0);
}

function getUserId(txData: FirebaseFirestore.DocumentData): string {
  return String(txData.userId ?? txData.memberId ?? "");
}

function getStoreName(txData: FirebaseFirestore.DocumentData): string {
  return String(txData.storeName ?? txData.storeLocation ?? txData.storeId ?? "-");
}

function toIsoString(value: any): string | null {
  return value?.toDate?.()?.toISOString?.() ?? value ?? null;
}

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
    const txId    = getReceiptNumber(txData);
    const amount  = `Rp ${getTotalAmount(txData).toLocaleString("id-ID")}`;

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
      data:      { txId, amount: getTotalAmount(txData) },
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
      // Write to flat 'notifications' collection — customer app reads from here
      adminDb.collection("notifications").doc(notifId).set({
        userId:    memberId,
        type:      action === "verified" ? "points" : "system", // customer app types
        title,
        body,
        isRead:    false,
        createdAt: now,
        data:      userNotif.data,
      }),
      adminDb.collection("notifications_log").doc(notifId).set(adminLog),
    ]);
  } catch (err) {
    console.error("[createTxNotification]", err);
    // Non-fatal — don't let notif failure break the main action
  }
}

// ── Auth helper ───────────────────────────────────────────────────────────────
async function validateSession(req: NextRequest) {
  try {
    const session = await getAdminSession({ allowedRoles: ["SUPER_ADMIN", "STAFF"] });
    return { token: session.claims, userRole: session.role, error: null, status: 200 };
  } catch (error) {
    if (isAdminAuthError(error)) {
      return { token: null, userRole: null, error: error.message, status: error.status };
    }
    throw error;
  }
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
      context:       `Transaction ${getReceiptNumber(txData, txId)}`,
      location:      getStoreName(txData),
      transactionId: getReceiptNumber(txData, txId),
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
    // Prefer collectionGroup, but fall back to root collection when collectionGroup
    // is unavailable in certain environments/configurations.
    let snap: FirebaseFirestore.QuerySnapshot<FirebaseFirestore.DocumentData>;
    try {
      snap = await adminDb
        .collectionGroup("transactions")
        .limit(500)
        .get();
    } catch (err: any) {
      if (!isFirestoreNotFoundError(err)) throw err;
      console.warn("[GET /api/transactions] collectionGroup unavailable, fallback to root collection", err?.message ?? err);
      try {
        snap = await adminDb
          .collection("transactions")
          .limit(500)
          .get();
      } catch (fallbackErr: any) {
        if (!isFirestoreNotFoundError(fallbackErr)) throw fallbackErr;
        console.warn("[GET /api/transactions] root transactions collection not found, returning empty list");
        return NextResponse.json([]);
      }
    }

    const txs = snap.docs
      .map((d) => {
        const data = d.data();
        const type = data.type ?? "earn"; // Default to earn if not specified
        const receiptNumber = getReceiptNumber(data, d.id);
        const storeId = String(data.storeId ?? data.storeLocation ?? "");
        const storeName = getStoreName(data);
        const totalAmount = getTotalAmount(data);
        const userId = getUserId(data) || null;
        const status = normalizeStatus(data.status);
        return {
          docId: d.id,
          docPath: d.ref.path,
          receiptNumber,
          transactionId: receiptNumber,
          memberName: data.memberName ?? "-",
          userId,
          memberId: getUserId(data),
          staffId: String(data.staffId ?? ""),
          storeId,
          storeName,
          storeLocation: storeName,
          totalAmount,
          amount: totalAmount,
          potentialPoints: Number(data.potentialPoints ?? 0),
          type,
          status,
          createdAt: toIsoString(data.createdAt),
          verifiedAt: toIsoString(data.verifiedAt),
          verifiedBy: data.verifiedBy ?? null,
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
    if (isAdminAuthError(e)) {
      return NextResponse.json({ message: e.message }, { status: e.status });
    }
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

    if (normalizeStatus(txData.status) !== "PENDING") {
      return NextResponse.json(
        { message: `Transaction already has status "${txData.status}". Cannot be changed.` },
        { status: 409 }
      );
    }

    const now        = new Date().toISOString();
    const verifiedBy = validation.token!.uid as string;

    if (action === "verify") {
      // 1. Update transaction status
      await txRef.update({ status: "COMPLETED", verifiedAt: now, verifiedBy });

      // 2. Disburse points to member
      await disbursePoints(
        getUserId(txData),
        txData.potentialPoints ?? 0,
        txData,
        getReceiptNumber(txData, txSnap.id),
        verifiedBy
      );

      // 3. Auto-notification to member
      await createTxNotification(getUserId(txData), "verified", txData, verifiedBy);
      await writeActivityLog({
        actor: validation.token ? {
          uid: validation.token.uid,
          email: validation.token.email ?? null,
          role: validation.userRole,
          assignedStoreId: null,
          profile: { name: validation.token.name ?? validation.token.email ?? validation.token.uid },
          claims: validation.token,
        } : null,
        action: "TRANSACTION_APPROVED",
        targetType: "transaction",
        targetId: txSnap.id,
        targetLabel: getReceiptNumber(txData, txSnap.id),
        summary: `Approved transaction ${getReceiptNumber(txData, txSnap.id)}`,
        source: "api/transactions:PATCH",
        metadata: { docPath, statusBefore: txData.status, statusAfter: "COMPLETED", potentialPoints: txData.potentialPoints ?? 0 },
      });

      return NextResponse.json({
        success: true,
        action:  "verified",
        points:  txData.potentialPoints ?? 0,
      });
    } else {
      // Reject — just update status, no points
      await txRef.update({ status: "CANCELLED", verifiedAt: now, verifiedBy });

      // Auto-notification to member
      await createTxNotification(getUserId(txData), "rejected", txData, verifiedBy);
      await writeActivityLog({
        actor: validation.token ? {
          uid: validation.token.uid,
          email: validation.token.email ?? null,
          role: validation.userRole,
          assignedStoreId: null,
          profile: { name: validation.token.name ?? validation.token.email ?? validation.token.uid },
          claims: validation.token,
        } : null,
        action: "TRANSACTION_REJECTED",
        targetType: "transaction",
        targetId: txSnap.id,
        targetLabel: getReceiptNumber(txData, txSnap.id),
        summary: `Rejected transaction ${getReceiptNumber(txData, txSnap.id)}`,
        source: "api/transactions:PATCH",
        metadata: { docPath, statusBefore: txData.status, statusAfter: "CANCELLED" },
      });

      return NextResponse.json({ success: true, action: "rejected" });
    }
  } catch (e: any) {
    console.error("[PATCH /api/transactions]", e);
    if (isAdminAuthError(e)) {
      return NextResponse.json({ message: e.message }, { status: e.status });
    }
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

        if (!txSnap.exists || normalizeStatus(txSnap.data()!.status) !== "PENDING") {
          skipCount++;
          continue;
        }

        const txData = txSnap.data()!;

        if (actionType === "verify") {
          await txRef.update({ status: "COMPLETED", verifiedAt: now, verifiedBy });
          await disbursePoints(
            getUserId(txData),
            txData.potentialPoints ?? 0,
            txData,
            getReceiptNumber(txData, txSnap.id),
            verifiedBy
          );
          await createTxNotification(getUserId(txData), "verified", txData, verifiedBy);
          await writeActivityLog({
            actor: validation.token ? {
              uid: validation.token.uid,
              email: validation.token.email ?? null,
              role: validation.userRole,
              assignedStoreId: null,
              profile: { name: validation.token.name ?? validation.token.email ?? validation.token.uid },
              claims: validation.token,
            } : null,
            action: "TRANSACTION_APPROVED",
            targetType: "transaction",
            targetId: txSnap.id,
            targetLabel: getReceiptNumber(txData, txSnap.id),
            summary: `Approved transaction ${getReceiptNumber(txData, txSnap.id)}`,
            source: "api/transactions:POST",
            metadata: { docPath, statusBefore: txData.status, statusAfter: "COMPLETED", potentialPoints: txData.potentialPoints ?? 0 },
          });
        } else {
          await txRef.update({ status: "CANCELLED", verifiedAt: now, verifiedBy });
          await createTxNotification(getUserId(txData), "rejected", txData, verifiedBy);
          await writeActivityLog({
            actor: validation.token ? {
              uid: validation.token.uid,
              email: validation.token.email ?? null,
              role: validation.userRole,
              assignedStoreId: null,
              profile: { name: validation.token.name ?? validation.token.email ?? validation.token.uid },
              claims: validation.token,
            } : null,
            action: "TRANSACTION_REJECTED",
            targetType: "transaction",
            targetId: txSnap.id,
            targetLabel: getReceiptNumber(txData, txSnap.id),
            summary: `Rejected transaction ${getReceiptNumber(txData, txSnap.id)}`,
            source: "api/transactions:POST",
            metadata: { docPath, statusBefore: txData.status, statusAfter: "CANCELLED" },
          });
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
    if (isAdminAuthError(e)) {
      return NextResponse.json({ message: e.message }, { status: e.status });
    }
    return NextResponse.json({ message: e.message ?? "Internal server error" }, { status: 500 });
  }
}

// ── DELETE — bulk/single delete transactions (admin only) ────────────────────
export async function DELETE(req: NextRequest) {
  const validation = await validateSession(req);
  if (validation.error) {
    return NextResponse.json({ message: validation.error }, { status: validation.status });
  }

  if (validation.userRole !== "SUPER_ADMIN") {
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
        await writeActivityLog({
          actor: validation.token ? {
            uid: validation.token.uid,
            email: validation.token.email ?? null,
            role: validation.userRole,
            assignedStoreId: null,
            profile: { name: validation.token.name ?? validation.token.email ?? validation.token.uid },
            claims: validation.token,
          } : null,
          action: "TRANSACTION_DELETED",
          targetType: "transaction",
          targetId: txSnap.id,
          targetLabel: getReceiptNumber(txSnap.data()!, txSnap.id),
          summary: `Deleted transaction ${getReceiptNumber(txSnap.data()!, txSnap.id)}`,
          source: "api/transactions:DELETE",
          metadata: { docPath, before: txSnap.data() },
        });
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
    if (isAdminAuthError(e)) {
      return NextResponse.json({ message: e.message }, { status: e.status });
    }
    return NextResponse.json({ message: e.message ?? "Internal server error" }, { status: 500 });
  }
}
