import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import * as admin from "firebase-admin";
import { UserVoucher, AdminNotificationLog } from "@/types/firestore";
import { v4 as uuidv4 } from "uuid";
import { getAdminSession, isAdminAuthError } from "@/lib/adminSession";
import { authorize, isRbacForbiddenError } from "@/lib/rbac";
import { writeActivityLog } from "@/lib/activityLog";

// POST /api/members/[uid]/vouchers — Suntik voucher ke user
export async function POST(req: NextRequest, { params }: { params: Promise<{ uid: string }> }) {
  const awaitedParams = await params;
  const { uid } = awaitedParams;
  if (!uid) {
    return NextResponse.json({ message: "UID diperlukan." }, { status: 400 });
  }

  try {
    const session = await getAdminSession({ allowedRoles: ["SUPER_ADMIN", "ADMIN", "STAFF"] });
    authorize(session, { permission: "voucher.issue" });
    const body = await req.json();
    const { rewardId } = body;
    if (!rewardId) {
      return NextResponse.json({ message: "rewardId wajib diisi." }, { status: 400 });
    }

    // 🔥 AMBIL DATA DARI rewards_catalog
    const rewardSnap = await adminDb.collection("rewards_catalog").doc(rewardId).get();
    if (!rewardSnap.exists) throw new Error("Voucher tidak ditemukan di katalog.");
    const rewardData = rewardSnap.data()!;

    // Buat objek voucher baru untuk disuntikkan ke field 'vouchers' milik user
    const expiresAt = new Date(Date.now() + (rewardData.expiryDays || 30) * 24 * 60 * 60 * 1000).toISOString();
    const code = `GC-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    const voucher: UserVoucher = {
      id: uuidv4(),
      rewardId: rewardSnap.id,
      title: rewardData.title,
      code,
      expiry: admin.firestore.Timestamp.fromDate(new Date(expiresAt)) as any,
      isUsed: false,
      expiresAt,
      type: "personal",
    };

    const userRef = adminDb.collection("users").doc(uid);
    await userRef.update({ vouchers: admin.firestore.FieldValue.arrayUnion(voucher) });

    // ── Auto-notification: voucher injected ──────────────────────────────────
    const now         = new Date().toISOString();
    const notifId     = uuidv4();
    const adminUid    = session.uid;

    // Fetch user display name for log
    let targetName = uid;
    try {
      const userSnap = await userRef.get();
      targetName = userSnap.data()?.name ?? userSnap.data()?.email ?? uid;
    } catch { /* ignore */ }

    const notificationTitle = "🎁 Voucher Baru Untukmu!";
    const notificationBody = `Voucher \"${rewardData.title}\" (${code}) telah ditambahkan ke akun kamu. Berlaku hingga ${new Date(expiresAt).toLocaleDateString("id-ID")}.`;

    const adminLog: AdminNotificationLog = {
      type:           "voucher_injected",
      title:          notificationTitle,
      body:           notificationBody,
      targetType:     "user",
      targetUid:      uid,
      targetName,
      sentAt:         now,
      sentBy:         adminUid,
      recipientCount: 1,
    };

    // Write both in parallel
    await Promise.all([
      adminDb.collection("users").doc(uid).collection("notifications").doc(notifId).set({
        title:     notificationTitle,
        body:      notificationBody,
        isRead:    false,
        createdAt: admin.firestore.Timestamp.now(),
        expireAt: admin.firestore.Timestamp.fromMillis(Date.now() + 7 * 24 * 60 * 60 * 1000),
        type: "gift",
        data: { voucherId: voucher.id, code, expiresAt },
      }),
      adminDb.collection("notifications_log").doc(notifId).set(adminLog),
    ]);
    await writeActivityLog({
      actor: session,
      action: "VOUCHER_INJECTED",
      targetType: "member",
      targetId: uid,
      targetLabel: targetName,
      summary: `Injected voucher ${rewardData.title} to ${targetName}`,
      source: "api/members/[uid]/vouchers:POST",
      metadata: {
        rewardId,
        rewardTitle: rewardData.title,
        voucherCode: code,
        voucherId: voucher.id,
        expiresAt,
      },
    });

    return NextResponse.json({ success: true, voucher });
  } catch (err: any) {
    console.error("[POST /api/members/[uid]/vouchers]", err);
    if (isAdminAuthError(err)) {
      return NextResponse.json({ message: err.message }, { status: err.status });
    }
    if (isRbacForbiddenError(err)) {
      return NextResponse.json({ message: err.message, code: err.code }, { status: err.status });
    }
    return NextResponse.json({ message: err.message ?? "Internal server error." }, { status: 500 });
  }
}

// DELETE /api/members/[uid]/vouchers — Hapus voucher dari user by voucherId
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ uid: string }> }) {
  const { uid } = await params;
  if (!uid) return NextResponse.json({ message: "UID diperlukan." }, { status: 400 });

  try {
    const session = await getAdminSession({ allowedRoles: ["SUPER_ADMIN", "ADMIN", "STAFF"] });
    authorize(session, { permission: "voucher.cancel" });

    const body = await req.json();
    const { voucherId, voucherCode } = body;
    if (!voucherId && !voucherCode) return NextResponse.json({ message: "voucherId atau voucherCode wajib diisi." }, { status: 400 });

    const userRef = adminDb.collection("users").doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) return NextResponse.json({ message: "User tidak ditemukan." }, { status: 404 });

    const vouchers: UserVoucher[] = userSnap.data()?.vouchers ?? [];
    const target = vouchers.find((v) =>
      (voucherId && v.id === voucherId) || (voucherCode && v.code === voucherCode)
    );
    if (!target) return NextResponse.json({ message: "Voucher tidak ditemukan pada user ini." }, { status: 404 });

    await userRef.update({ vouchers: admin.firestore.FieldValue.arrayRemove(target) });

    const targetName = userSnap.data()?.name ?? userSnap.data()?.email ?? uid;
    await writeActivityLog({
      actor: session,
      action: "VOUCHER_CANCELLED",
      targetType: "member",
      targetId: uid,
      targetLabel: targetName,
      summary: `Removed voucher "${target.title}" (${target.code}) from ${targetName}`,
      source: "api/members/[uid]/vouchers:DELETE",
      metadata: { voucherId, voucherCode: target.code, voucherTitle: target.title },
    });

    return NextResponse.json({ success: true, removed: target });
  } catch (err: any) {
    console.error("[DELETE /api/members/[uid]/vouchers]", err);
    if (isAdminAuthError(err)) return NextResponse.json({ message: err.message }, { status: err.status });
    if (isRbacForbiddenError(err)) return NextResponse.json({ message: err.message, code: err.code }, { status: err.status });
    return NextResponse.json({ message: err.message ?? "Internal server error." }, { status: 500 });
  }
}
