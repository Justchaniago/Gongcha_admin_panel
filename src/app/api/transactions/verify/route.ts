import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { Timestamp } from "firebase-admin/firestore";
import { getAdminSession, isAdminAuthError } from "@/lib/adminSession";
import { writeActivityLog } from "@/lib/activityLog";
import { applyTransactionReward, getTransactionMemberReference, MemberPointsError } from "@/lib/memberPoints";

interface VerifyRequest {
  receiptNumber?: string;    // Transaction number from POS (must match)
  transactionId?: string;    // Legacy alias
  posAmount: number;         // Total amount from POS (must match)
  posDate: string;           // Date from POS in YYYY-MM-DD format (must match)
}

interface VerifyResponse {
  success: boolean;
  status?: "COMPLETED" | "CANCELLED";
  reason?: string;
  message: string;
}
const TRANSACTIONS_COLLECTION = "transactions";

function warnOnInvalidTransactionShape(
  txData: FirebaseFirestore.DocumentData,
  ref: { id: string; path: string }
) {
  const uid = String(txData.uid ?? "").trim();
  const hasValidPointsEarned = Number.isFinite(Number(txData.pointsEarned));

  if (!uid || !hasValidPointsEarned) {
    console.warn("[transactions/verify] legacy or malformed transaction document", {
      id: ref.id,
      path: ref.path,
      uid: txData.uid ?? null,
      userId: txData.userId ?? null,
      memberId: txData.memberId ?? null,
      pointsEarned: txData.pointsEarned ?? null,
      potentialPoints: txData.potentialPoints ?? null,
    });
  }
}

export async function POST(req: NextRequest): Promise<NextResponse<VerifyResponse>> {
  try {
    const auth = await getAdminSession({ allowedRoles: ["SUPER_ADMIN", "STAFF"] });

    // ── Parse request ──
    const body: VerifyRequest = await req.json();
    const receiptNumber = body.receiptNumber ?? body.transactionId ?? "";
    const { posAmount, posDate } = body;

    if (!receiptNumber || posAmount === undefined || !posDate) {
      return NextResponse.json(
        { success: false, message: "Missing required fields: receiptNumber, posAmount, and posDate are all required for POS verification" },
        { status: 400 }
      );
    }

    // ── Fetch transaction by receipt number, then fall back to legacy keys ──
    let txQuery = await adminDb
      .collection(TRANSACTIONS_COLLECTION)
      .where("receiptNumber", "==", receiptNumber)
      .limit(1)
      .get();

    // Backward compatibility for older records
    if (txQuery.empty) {
      txQuery = await adminDb
        .collection(TRANSACTIONS_COLLECTION)
        .where("posTransactionId", "==", receiptNumber)
        .limit(1)
        .get();
    }

    if (txQuery.empty) {
      txQuery = await adminDb
        .collection(TRANSACTIONS_COLLECTION)
        .where("transactionId", "==", receiptNumber)
        .limit(1)
        .get();
    }

    if (txQuery.empty) {
      return NextResponse.json(
        {
          success: false,
          status: "CANCELLED",
          reason: "Transaction not found in database",
          message: "Transaction not found",
        },
        { status: 404 }
      );
    }

    const txSnapshot = txQuery.docs[0];

    const txData = txSnapshot.data();
    if (!txData) {
      return NextResponse.json(
        {
          success: false,
          status: "CANCELLED",
          reason: "Transaction data is empty",
          message: "Transaction data invalid",
        },
        { status: 404 }
      );
    }

    warnOnInvalidTransactionShape(txData, txSnapshot.ref);

    // ── POS Verification: Match transaction number, date, and total ──
    const errors: string[] = [];

    const currentStatus = String(txData.status ?? "").toUpperCase();
    if (currentStatus && currentStatus !== "PENDING") {
      return NextResponse.json(
        {
          success: false,
          message: `Transaction already has status "${txData.status}".`,
        },
        { status: 409 }
      );
    }

    // 1. Transaction number is already matched by query (posTransactionId field)

    // 2. Check date (REQUIRED - must match)
    const txDate = txData.createdAt?.toDate?.()?.toISOString?.().split("T")[0];
    if (txDate !== posDate) {
      errors.push(`Date mismatch: DB=${txDate}, POS=${posDate}`);
    }

    // 3. Check amount (REQUIRED - must match exactly)
    const dbAmount = Number(txData.totalAmount ?? txData.amount ?? 0);
    if (Math.abs(dbAmount - posAmount) > 0.01) {
      errors.push(`Amount mismatch: DB=${dbAmount}, POS=${posAmount}`);
    }

    // ── Update status ──
    const newStatus = errors.length === 0 ? "COMPLETED" : "CANCELLED";
    const reason = errors.length > 0 ? errors.join(" | ") : undefined;

    const rewardResult = await applyTransactionReward({
      txRef: txSnapshot.ref,
      txData,
      txId: String(txData.receiptNumber ?? txData.posTransactionId ?? txData.transactionId ?? txSnapshot.id),
      verifiedBy: auth.uid,
      verifiedAt: Timestamp.now(),
      nextStatus: newStatus,
      failureReason: reason,
    });

    await writeActivityLog({
      actor: auth,
      action: newStatus === "COMPLETED" ? "TRANSACTION_APPROVED" : "TRANSACTION_REJECTED",
      targetType: "transaction",
      targetId: String(txSnapshot.id),
      targetLabel: String(txData.receiptNumber ?? receiptNumber),
      summary: `${newStatus === "COMPLETED" ? "Approved" : "Rejected"} transaction ${receiptNumber}`,
      source: "api/transactions/verify:POST",
      metadata: {
        receiptNumber,
        posAmount,
        posDate,
        previousStatus: currentStatus || "PENDING",
        nextStatus: newStatus,
        reason,
        userId: rewardResult.memberUid ?? txData.userId ?? txData.memberId ?? null,
        resolvedMemberUid: rewardResult.memberUid,
        memberResolution: rewardResult.memberResolution,
        memberReference: getTransactionMemberReference(txData),
        potentialPoints: txData.potentialPoints ?? 0,
      },
    });

    return NextResponse.json(
      {
        success: true,
        status: newStatus,
        reason,
        message: newStatus === "COMPLETED"
          ? "Transaction verified and points have been released to customer" 
          : "Transaction rejected - requires manual verification to ensure no system errors",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[/api/transactions/verify] Error:", error);
    if (error instanceof MemberPointsError) {
      return NextResponse.json(
        { success: false, message: error.message, reason: error.code },
        { status: 409 }
      );
    }
    if (isAdminAuthError(error)) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Server error" },
      { status: 500 }
    );
  }
}
