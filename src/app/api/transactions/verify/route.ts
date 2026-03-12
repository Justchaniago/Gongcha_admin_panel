import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebaseAdmin";
import { Timestamp } from "firebase-admin/firestore";
import { cookies } from "next/headers";

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

function isFirestoreNotFoundError(err: any): boolean {
  const msg = String(err?.message ?? "");
  return err?.code === 5 || msg.includes("5 NOT_FOUND") || msg.includes("NOT_FOUND");
}

async function validateSession() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;
  if (!sessionCookie) {
    return { error: "Session not found. Please login again.", status: 401, token: null as any };
  }

  try {
    const token = await adminAuth.verifySessionCookie(sessionCookie, true);
    return { error: null, status: 200, token };
  } catch {
    return { error: "Invalid session.", status: 401, token: null as any };
  }
}

export async function POST(req: NextRequest): Promise<NextResponse<VerifyResponse>> {
  try {
    // ── Auth check ──
    const auth = await validateSession();
    if (auth.error) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

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
    let txQuery;
    try {
      txQuery = await adminDb
        .collectionGroup("transactions")
        .where("receiptNumber", "==", receiptNumber)
        .limit(1)
        .get();
    } catch (err: any) {
      if (!isFirestoreNotFoundError(err)) throw err;
      txQuery = await adminDb
        .collection("transactions")
        .where("receiptNumber", "==", receiptNumber)
        .limit(1)
        .get();
    }

    // Backward compatibility for older records
    if (txQuery.empty) {
      try {
        txQuery = await adminDb
          .collectionGroup("transactions")
          .where("posTransactionId", "==", receiptNumber)
          .limit(1)
          .get();
      } catch (err: any) {
        if (!isFirestoreNotFoundError(err)) throw err;
        txQuery = await adminDb
          .collection("transactions")
          .where("posTransactionId", "==", receiptNumber)
          .limit(1)
          .get();
      }
    }

    if (txQuery.empty) {
      try {
        txQuery = await adminDb
          .collectionGroup("transactions")
          .where("transactionId", "==", receiptNumber)
          .limit(1)
          .get();
      } catch (err: any) {
        if (!isFirestoreNotFoundError(err)) throw err;
        txQuery = await adminDb
          .collection("transactions")
          .where("transactionId", "==", receiptNumber)
          .limit(1)
          .get();
      }
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

    // Update transaction status
    const updateData: any = {
      status: newStatus,
      verifiedAt: Timestamp.now(),
      verifiedBy: auth.token.uid,
    };

    if (reason) {
      updateData.reason = reason;
      updateData.needsManualReview = true; // Rejected transactions need manual verification
    }

    await txSnapshot.ref.update(updateData);

    // ── Release points if verified ──
    const userId = txData.userId ?? txData.memberId;
    if (newStatus === "COMPLETED" && userId && txData.potentialPoints) {
      try {
        const userRef = adminDb.collection("users").doc(userId);
        const userSnap = await userRef.get();
        
        if (userSnap.exists) {
          const userData = userSnap.data();
          const currentPoints = userData?.currentPoints || 0;
          const lifetimePoints = userData?.lifetimePoints || 0;
          const pointsToAdd = txData.potentialPoints;

          await userRef.update({
            currentPoints: currentPoints + pointsToAdd,
            lifetimePoints: lifetimePoints + pointsToAdd,
            updatedAt: Timestamp.now(),
          });

          console.log(`[verify] Released ${pointsToAdd} points to user ${userId}`);
        }
      } catch (pointError) {
        console.error("[verify] Error releasing points:", pointError);
        // Don't fail the verification if points update fails
      }
    }

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
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Server error" },
      { status: 500 }
    );
  }
}
