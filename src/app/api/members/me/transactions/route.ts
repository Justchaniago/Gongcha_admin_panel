import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";

/**
 * GET /api/members/me/transactions
 * Member views own transaction history
 * Auth: Firebase ID token (member)
 * Query params: ?status=pending|verified|rejected&limit=50&startAfter={docId}
 */
export async function GET(req: NextRequest) {
  try {
    // Verify Firebase Auth token
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Missing or invalid Authorization header" },
        { status: 401 }
      );
    }

    const token = authHeader.slice(7);
    let decoded;
    try {
      decoded = await adminAuth.verifyIdToken(token);
    } catch (err: any) {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401 }
      );
    }

    const memberId = decoded.uid;
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status"); // pending, verified, rejected (or null for all)
    const limit = Math.min(
      parseInt(searchParams.get("limit") ?? "50", 10),
      100
    );
    const startAfter = searchParams.get("startAfter");

    // Build query
    let q: FirebaseFirestore.Query = adminDb
      .collection("transactions")
      .where("memberId", "==", memberId);

    // Filter by status if provided
    if (status) {
      const statusValue = normalizeStatus(status);
      q = q.where("status", "==", statusValue);
    }

    // Order by creation date (newest first)
    q = q.orderBy("createdAt", "desc");

    // Pagination
    if (startAfter) {
      const afterDoc = await adminDb
        .collection("transactions")
        .doc(startAfter)
        .get();
      if (afterDoc.exists) {
        q = q.startAfter(afterDoc);
      }
    }

    // Fetch limit + 1 to detect hasMore
    q = q.limit(limit + 1);
    const snap = await q.get();

    const hasMore = snap.docs.length > limit;
    const docs = snap.docs.slice(0, limit);

    const transactions = docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        receiptNumber: data.receiptNumber,
        type: data.type, // "earn" or "redeem"
        status: data.status,
        pointsEarned: data.pointsEarned || 0,
        pointsDeducted: data.pointsDeducted || 0,
        amount: data.totalAmount || 0,
        voucherCode: data.voucherCode,
        voucherTitle: data.voucherTitle,
        createdAt: data.createdAt?.toDate?.()?.toISOString?.() ?? data.createdAt,
        verifiedAt: data.verifiedAt?.toDate?.()?.toISOString?.() ?? data.verifiedAt,
        verifiedBy: data.verifiedBy,
      };
    });

    return NextResponse.json(
      {
        transactions,
        hasMore,
        limit,
        count: transactions.length,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("[members/me/transactions] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Normalize status from query parameter
 */
function normalizeStatus(status: unknown): string {
  const s = String(status ?? "").toUpperCase();
  switch (s) {
    case "PENDING":
      return "PENDING";
    case "VERIFIED":
    case "APPROVED":
    case "COMPLETED":
      return "COMPLETED";
    case "REJECTED":
    case "CANCELLED":
      return "CANCELLED";
    default:
      return "PENDING";
  }
}
