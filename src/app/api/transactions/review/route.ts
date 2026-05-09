import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { Timestamp, FieldValue } from "firebase-admin/firestore";
import { getAdminSession, isAdminAuthError } from "@/lib/adminSession";
import { authorize, isRbacForbiddenError } from "@/lib/rbac";
import { writeActivityLog } from "@/lib/activityLog";
import { createTxNotification } from "@/lib/transactionNotifications";

export async function POST(req: NextRequest) {
  try {
    const auth = await getAdminSession({ allowedRoles: ["SUPER_ADMIN", "ADMIN"] });

    const { docPath, action } = await req.json();

    if (!docPath || !["approve", "confirm_reject"].includes(action)) {
      return NextResponse.json(
        { success: false, message: "docPath and action (approve|confirm_reject) required" },
        { status: 400 }
      );
    }

    const txRef  = adminDb.doc(docPath);
    const txSnap = await txRef.get();

    if (!txSnap.exists) {
      return NextResponse.json({ success: false, message: "Transaction not found" }, { status: 404 });
    }

    const txData  = txSnap.data()!;
    const status  = String(txData.status ?? "").toUpperCase();

    if (status !== "CANCELLED") {
      return NextResponse.json(
        { success: false, message: `Transaction status is "${txData.status}", not CANCELLED` },
        { status: 409 }
      );
    }

    if (txData.manualReviewDone) {
      return NextResponse.json(
        { success: false, message: "Transaction already reviewed — no further changes allowed" },
        { status: 409 }
      );
    }

    authorize(auth, {
      permission: "transaction.verify",
      resource: { storeId: String(txData.storeId ?? txData.storeLocation ?? "") },
    });

    const now           = Timestamp.now();
    const receiptNumber = String(txData.receiptNumber ?? txData.posTransactionId ?? txData.transactionId ?? txSnap.id);
    const uid           = String(txData.uid ?? txData.userId ?? txData.memberId ?? "").trim();
    const points        = Number(txData.pointsEarned ?? txData.potentialPoints ?? 0);

    if (action === "approve") {
      await adminDb.runTransaction(async (t) => {
        const fresh = await t.get(txRef);
        if (!fresh.exists || String(fresh.data()!.status ?? "").toUpperCase() !== "CANCELLED" || fresh.data()!.manualReviewDone) {
          throw new Error("Transaction not eligible for review");
        }

        t.update(txRef, {
          status: "COMPLETED",
          verifiedAt: now,
          verifiedBy: auth.uid,
          manualReviewDone: true,
          manualReviewedAt: now,
          manualReviewedBy: auth.uid,
          manualReviewAction: "approved",
        });

        // pendingPoints were already voided on original rejection — credit earned points directly
        if (uid && points > 0) {
          t.update(adminDb.collection("users").doc(uid), {
            points: FieldValue.increment(points),
            updatedAt: now,
          });
        }
      });

      await createTxNotification(uid || null, "verified", txData, auth.uid);
      await writeActivityLog({
        actor: auth,
        action: "TRANSACTION_APPROVED",
        targetType: "transaction",
        targetId: txSnap.id,
        targetLabel: receiptNumber,
        summary: `Manual review: approved transaction ${receiptNumber}`,
        source: "api/transactions/review:POST",
        metadata: { docPath, reviewAction: "approve", pointsEarned: points, uid },
      });

      return NextResponse.json({ success: true, action: "approved", points });
    } else {
      // confirm_reject — keep CANCELLED, just mark reviewed so no further changes
      await txRef.update({
        manualReviewDone: true,
        manualReviewedAt: now,
        manualReviewedBy: auth.uid,
        manualReviewAction: "rejected",
      });

      await writeActivityLog({
        actor: auth,
        action: "TRANSACTION_REJECTED",
        targetType: "transaction",
        targetId: txSnap.id,
        targetLabel: receiptNumber,
        summary: `Manual review: confirmed rejection for transaction ${receiptNumber}`,
        source: "api/transactions/review:POST",
        metadata: { docPath, reviewAction: "confirm_reject", uid },
      });

      return NextResponse.json({ success: true, action: "confirmed_reject" });
    }
  } catch (error: any) {
    console.error("[/api/transactions/review]", error);
    if (isAdminAuthError(error)) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.status });
    }
    if (isRbacForbiddenError(error)) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { success: false, message: error.message ?? "Server error" },
      { status: 500 }
    );
  }
}
