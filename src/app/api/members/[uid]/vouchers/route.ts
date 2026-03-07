import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseServer";
import * as admin from "firebase-admin";
import { cookies } from "next/headers";
import { adminAuth } from "@/lib/firebaseAdmin";
import { UserVoucher, VoucherType, AdminNotificationLog, UserNotification } from "@/types/firestore";
import { v4 as uuidv4 } from "uuid";

// Helper validasi session admin/master
async function validateSession() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;
  if (!sessionCookie) {
    return { error: "Session not found. Please login again.", status: 403 };
  }
  const decodedClaims = await adminAuth.verifySessionCookie(sessionCookie, true);
  const userRole = decodedClaims.role as string;
  
  // Kita tambahkan SUPER_ADMIN juga agar tidak tertolak oleh logic lama
  if (!["admin", "master", "SUPER_ADMIN"].includes(userRole)) {
    return { error: "Access denied. You do not have permission.", status: 403 };
  }
  return { token: decodedClaims, userRole, error: null };
}

// POST /api/members/[uid]/vouchers — Suntik voucher ke user
export async function POST(req: NextRequest, { params }: { params: Promise<{ uid: string }> }) {
  const awaitedParams = await params;
  const { uid } = awaitedParams;
  
  if (!uid) {
    return NextResponse.json({ message: "UID diperlukan." }, { status: 400 });
  }

  const validation = await validateSession();
  if (validation.error) {
    return NextResponse.json({ message: validation.error }, { status: validation.status });
  }

  try {
    const body = await req.json();
    const { rewardId, title, code, expiresAt } = body;
    
    if (!rewardId || !title || !code || !expiresAt) {
      return NextResponse.json({ message: "Semua field wajib diisi." }, { status: 400 });
    }
    
    // FIX: Bypass TypeScript dengan 'as UserVoucher' dan penuhi field yang wajib
    // Memakai admin.firestore.Timestamp agar tidak perlu import baru
    const voucher = {
      id: uuidv4(),
      userId: uid,
      voucherMasterId: rewardId,
      title,
      code,
      status: 'ACTIVE',
      claimedAt: admin.firestore.Timestamp.now() as any,
      
      // -- Legacy Fields --
      rewardId,
      isUsed: false,
      expiresAt,
      type: "personal" as VoucherType,
    } as UserVoucher;
    
    const userRef = adminDb.collection("users").doc(uid);
    await userRef.update({ vouchers: admin.firestore.FieldValue.arrayUnion(voucher) });

    // ── Auto-notification: voucher injected ──────────────────────────────────
    const now         = new Date().toISOString();
    const notifId     = uuidv4();
    const adminUid    = validation.token!.uid as string;

    // Fetch user display name for log
    let targetName = uid;
    try {
      const userSnap = await userRef.get();
      targetName = userSnap.data()?.name ?? userSnap.data()?.email ?? uid;
    } catch { /* ignore */ }

    const userNotif: UserNotification = {
      id:        notifId,
      type:      "voucher_injected",
      title:     "🎁 Voucher Baru Untukmu!",
      body:      `Voucher "${title}" (${code}) telah ditambahkan ke akun kamu. Berlaku hingga ${new Date(expiresAt).toLocaleDateString("id-ID")}.`,
      isRead:    false,
      createdAt: now,
      data:      { voucherId: voucher.id, code, expiresAt },
    };

    const adminLog: AdminNotificationLog = {
      type:           "voucher_injected",
      title:          "🎁 Voucher Baru Untukmu!",
      body:           userNotif.body,
      targetType:     "user",
      targetUid:      uid,
      targetName,
      sentAt:         now,
      sentBy:         adminUid,
      recipientCount: 1,
    };

    // Write both in parallel
    await Promise.all([
      adminDb.collection("notifications").doc(notifId).set({
        userId:    uid,
        type:      "gift",
        title:     userNotif.title,
        body:      userNotif.body,
        isRead:    false,
        createdAt: now,
        data:      userNotif.data,
      }),
      adminDb.collection("notifications_log").doc(notifId).set(adminLog),
    ]);

    return NextResponse.json({ success: true, voucher });
  } catch (err: any) {
    console.error("[POST /api/members/[uid]/vouchers]", err);
    return NextResponse.json({ message: err.message ?? "Internal server error." }, { status: 500 });
  }
}