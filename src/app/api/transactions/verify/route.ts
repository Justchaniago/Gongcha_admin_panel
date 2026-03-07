import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { cookies } from "next/headers";

interface VerifyRequest {
  transactionId: string;
  action: "approve" | "reject";
}

export async function POST(req: NextRequest) {
  try {
    // ── Pilar 1: Keamanan (Sesi & Role) ──
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session")?.value;
    if (!sessionCookie) {
      return NextResponse.json({ success: false, message: "Unauthorized: No session active" }, { status: 401 });
    }

    const decodedToken = await adminAuth.verifySessionCookie(sessionCookie, true);
    const uid = decodedToken.uid;

    const adminDoc = await adminDb.collection("admin_users").doc(uid).get();
    if (!adminDoc.exists || adminDoc.data()?.role !== "SUPER_ADMIN") {
      return NextResponse.json({ success: false, message: "Forbidden: Super Admin only" }, { status: 403 });
    }

    // ── Validasi Request ──
    const body: VerifyRequest = await req.json();
    const { transactionId, action } = body;

    if (!transactionId || (action !== "approve" && action !== "reject")) {
      return NextResponse.json({ success: false, message: "Bad Request: Invalid payload" }, { status: 400 });
    }

    const txRef = adminDb.collection("transactions").doc(transactionId);

    // ── Pilar 2: Integritas & Atomic (Transaction) ──
    const newStatus = action === "approve" ? "COMPLETED" : "FRAUD";
    
    await adminDb.runTransaction(async (transaction) => {
      const doc = await transaction.get(txRef);
      if (!doc.exists) {
        throw new Error("Transaksi tidak ditemukan.");
      }

      const txData = doc.data()!;
      // ✅ FIX: Accept legacy "pending" and canonical "NEEDS_REVIEW"
      const processableStatuses = ["NEEDS_REVIEW", "pending"];
      if (!processableStatuses.includes(txData.status)) {
        throw new Error(`Transaksi sudah diproses (Status saat ini: ${txData.status}).`);
      }

      // Pilar 2: Audit Trail
      transaction.update(txRef, {
        status: newStatus,
        verifiedBy: uid,
        verifiedAt: FieldValue.serverTimestamp(),
      });
    });

    return NextResponse.json({
      success: true,
      message: `Transaksi berhasil ditandai sebagai ${newStatus}`,
      status: newStatus
    }, { status: 200 });

  } catch (error: any) {
    console.error("[/api/transactions/verify] System Error:", error.message);
    const isConflict = error.message.includes("sudah diproses") || error.message.includes("tidak ditemukan");
    return NextResponse.json(
      { success: false, message: error.message || "Internal Server Error" },
      { status: isConflict ? 409 : 500 }
    );
  }
}
