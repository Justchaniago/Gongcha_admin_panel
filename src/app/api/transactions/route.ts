// src/app/api/transactions/route.ts
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseServer";
import { cookies } from "next/headers";
import { adminAuth } from "@/lib/firebaseAdmin";
import * as admin from "firebase-admin";
import { v4 as uuidv4 } from "uuid";
import type { AdminNotificationLog, UserNotification } from "@/types/firestore";

// ── Notification helper ───────────────────────────────────────────────────────
// action "verified" = COMPLETED, "rejected" = FRAUD (legacy param, canonical storage)
async function createTxNotification(
  memberId: string,
  action: "verified" | "rejected",
  txData: FirebaseFirestore.DocumentData,
  adminUid: string,
) {
  try {
    const notifId = uuidv4();
    const now     = new Date().toISOString();
    const txId    = (txData.posTransactionId ?? txData.transactionId ?? "") as string;
    const amount  = (txData.amount ?? 0) as number;

    const title = action === "verified"
      ? "Transaksi Diverifikasi ✅"
      : "Transaksi Ditolak ❌";
    const body = action === "verified"
      ? `Transaksi Rp ${amount.toLocaleString("id-ID")} telah diverifikasi. Poin akan segera dikreditkan.`
      : `Transaksi Rp ${amount.toLocaleString("id-ID")} ditolak. Hubungi staff untuk informasi lebih lanjut.`;

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
      adminDb.collection("notifications").doc(notifId).set({
        userId:    memberId,
        type:      action === "verified" ? "points" : "system",
        title,
        body,
        isRead:    false,
        createdAt: now,
        data:      { txId, amount },
      }),
      adminDb.collection("notifications_log").doc(notifId).set(adminLog),
    ]);
  } catch (err) {
    console.error("[createTxNotification]", err);
    // Non-fatal — jangan biarkan notif failure menghentikan main action
  }
}

// ── Auth helper ───────────────────────────────────────────────────────────────
async function validateSession(req: NextRequest) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;
  if (!sessionCookie) return { error: "Session not found.", status: 401, token: null };

  try {
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    const uid = decoded.uid as string;

    const adminDoc = await adminDb.collection("admin_users").doc(uid).get();
    if (!adminDoc.exists) {
      return { error: "Access denied. Admin profile not found.", status: 403, token: null };
    }
    const role: string = adminDoc.data()?.role ?? "";
    if (!["SUPER_ADMIN", "STAFF"].includes(role)) {
      return { error: "Access denied. Role not permitted.", status: 403, token: null };
    }
    return { error: null, status: 200, token: { ...decoded, uid, role } };
  } catch {
    return { error: "Invalid or expired session.", status: 401, token: null };
  }
}

// ── Points disbursement helper ────────────────────────────────────────────────
async function disbursePoints(
  memberId: string,
  points: number,
  txData: FirebaseFirestore.DocumentData,
  txId: string,
  adminUid: string,
) {
  if (!memberId || points <= 0) return;
  try {
    const userRef = adminDb.collection("users").doc(memberId);
    await adminDb.runTransaction(async (t) => {
      const userSnap = await t.get(userRef);
      if (!userSnap.exists) return;

      const current  = (userSnap.data()?.currentPoints  as number) ?? 0;
      const lifetime = (userSnap.data()?.lifetimePoints as number) ?? 0;

      t.update(userRef, {
        currentPoints:  current  + points,
        lifetimePoints: lifetime + points,
        updatedAt:      new Date().toISOString(),
      });
    });
  } catch (err) {
    console.error("[disbursePoints]", err);
  }
}

// Status values yang dapat diproses (legacy + canonical)
const PROCESSABLE_STATUSES = ["NEEDS_REVIEW", "pending"];

// ── GET — list all transactions ───────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const validation = await validateSession(req);
  if (validation.error) {
    return NextResponse.json({ message: validation.error }, { status: validation.status });
  }

  try {
    const snap = await adminDb
      .collectionGroup("transactions")
      .limit(500)
      .get();

    const txs = snap.docs.map((d) => {
      const data    = d.data();
      // Normalise status ke canonical schema
      let status    = (data.status ?? "NEEDS_REVIEW") as string;
      if (status === "verified") status = "COMPLETED";
      if (status === "rejected") status = "FRAUD";
      if (status === "pending")  status = "NEEDS_REVIEW";

      return {
        docId:           d.id,
        docPath:         d.ref.path,
        transactionId:   data.posTransactionId ?? data.transactionId ?? "",
        memberName:      data.memberName       ?? "-",
        memberId:        data.memberId         ?? "",
        staffId:         data.staffId          ?? "",
        storeId:         data.storeId          ?? data.storeLocation ?? "",
        amount:          data.amount           ?? 0,
        potentialPoints: data.potentialPoints  ?? 0,
        status,
        type:            data.type             ?? "earn",
        createdAt:       data.createdAt?.toDate?.()?.toISOString?.() ?? null,
        verifiedAt:      data.verifiedAt       ?? null,
        verifiedBy:      data.verifiedBy       ?? null,
      };
    });

    // Sort in-memory (descending createdAt)
    txs.sort((a, b) => {
      if (!a.createdAt && !b.createdAt) return 0;
      if (!a.createdAt) return 1;
      if (!b.createdAt) return -1;
      return b.createdAt.localeCompare(a.createdAt);
    });

    return NextResponse.json({ transactions: txs });
  } catch (e: any) {
    console.error("[GET /api/transactions]", e);
    return NextResponse.json({ message: e.message ?? "Internal server error" }, { status: 500 });
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

    // ✅ Terima status lama (transitional) DAN canonical baru
    if (!PROCESSABLE_STATUSES.includes(txData.status)) {
      return NextResponse.json({
        message: `Transaksi sudah diproses (Status: ${txData.status}).`,
      }, { status: 409 });
    }

    const now        = new Date().toISOString();
    const verifiedBy = validation.token!.uid as string;

    if (action === "verify") {
      // ✅ Canonical: "COMPLETED" (bukan "verified")
      await txRef.update({ status: "COMPLETED", verifiedAt: now, verifiedBy });
      await disbursePoints(
        txData.memberId,
        txData.potentialPoints ?? 0,
        txData,
        txData.posTransactionId ?? txData.transactionId ?? txSnap.id,
        verifiedBy,
      );
      await createTxNotification(txData.memberId, "verified", txData, verifiedBy);
    } else {
      // ✅ Canonical: "FRAUD" (bukan "rejected")
      await txRef.update({ status: "FRAUD", verifiedAt: now, verifiedBy });
      await createTxNotification(txData.memberId, "rejected", txData, verifiedBy);
    }

    return NextResponse.json({
      success: true,
      message: `Transaksi berhasil ${action === "verify" ? "diverifikasi (COMPLETED)" : "ditolak (FRAUD)"}`,
    });
  } catch (err: any) {
    console.error("[PATCH /api/transactions]", err);
    return NextResponse.json({ message: err.message ?? "Internal server error." }, { status: 500 });
  }
}

// ── POST — bulk verify / reject multiple transactions ─────────────────────────
export async function POST(req: NextRequest) {
  const validation = await validateSession(req);
  if (validation.error) {
    return NextResponse.json({ message: validation.error }, { status: validation.status });
  }

  try {
    const { docPaths, actionType } = await req.json();

    if (!Array.isArray(docPaths) || docPaths.length === 0) {
      return NextResponse.json({ message: "docPaths harus berupa array." }, { status: 400 });
    }
    if (!["verify", "reject"].includes(actionType)) {
      return NextResponse.json({ message: "actionType harus 'verify' atau 'reject'." }, { status: 400 });
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

        if (!txSnap.exists || !PROCESSABLE_STATUSES.includes(txSnap.data()!.status)) {
          skipCount++;
          continue;
        }

        const txData = txSnap.data()!;

        if (actionType === "verify") {
          // ✅ Canonical: "COMPLETED"
          await txRef.update({ status: "COMPLETED", verifiedAt: now, verifiedBy });
          await disbursePoints(
            txData.memberId,
            txData.potentialPoints ?? 0,
            txData,
            txData.posTransactionId ?? txData.transactionId ?? txSnap.id,
            verifiedBy,
          );
          await createTxNotification(txData.memberId, "verified", txData, verifiedBy);
        } else {
          // ✅ Canonical: "FRAUD"
          await txRef.update({ status: "FRAUD", verifiedAt: now, verifiedBy });
          await createTxNotification(txData.memberId, "rejected", txData, verifiedBy);
        }

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
      errors:     errors.slice(0, 5),
    });
  } catch (e: any) {
    console.error("[POST /api/transactions]", e);
    return NextResponse.json({ message: e.message ?? "Internal server error" }, { status: 500 });
  }
}

// ── DELETE — bulk/single delete transactions ──────────────────────────────────
export async function DELETE(req: NextRequest) {
  const validation = await validateSession(req);
  if (validation.error) {
    return NextResponse.json({ message: validation.error }, { status: validation.status });
  }
  // Only SUPER_ADMIN can delete
  if (validation.token?.role !== "SUPER_ADMIN") {
    return NextResponse.json({ message: "Forbidden: Super Admin only." }, { status: 403 });
  }

  try {
    const { docPaths } = await req.json();
    if (!Array.isArray(docPaths) || docPaths.length === 0) {
      return NextResponse.json({ message: "docPaths wajib berupa array." }, { status: 400 });
    }

    let   successCount = 0;
    let   skipCount    = 0;
    const errors: string[] = [];

    for (const docPath of docPaths) {
      try {
        const txRef  = adminDb.doc(docPath);
        const txSnap = await txRef.get();
        if (!txSnap.exists) { skipCount++; continue; }
        await txRef.delete();
        successCount++;
      } catch (e: any) {
        errors.push(`${docPath}: ${e.message}`);
      }
    }

    return NextResponse.json({ success: true, successCount, skipCount, errorCount: errors.length, errors: errors.slice(0, 5) });
  } catch (e: any) {
    console.error("[DELETE /api/transactions]", e);
    return NextResponse.json({ message: e.message ?? "Internal server error" }, { status: 500 });
  }
}
