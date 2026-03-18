import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseServer";
import { v4 as uuidv4 } from "uuid";
import type { AdminNotificationLog, NotificationType } from "@/types/firestore";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAdminSession, isAdminAuthError } from "@/lib/adminSession";
import { writeActivityLog } from "@/lib/activityLog";

// Map admin-side NotificationType to the type values the customer app expects
function toCustomerType(t: NotificationType): 'gift' | 'points' | 'promo' | 'order' | 'system' {
  if (t === 'voucher_injected') return 'gift';
  if (t === 'tx_verified')      return 'points';
  if (t === 'tx_rejected')      return 'system';
  if (t === 'broadcast')        return 'promo';
  return 'system'; // targeted
}

async function writeNotificationToUser(
  uid: string,
  payload: { title: string; body: string; customerType: ReturnType<typeof toCustomerType> }
) {
  const now = Timestamp.now();
  const expireAt = Timestamp.fromMillis(now.toMillis() + 7 * 24 * 60 * 60 * 1000);
  const ref = adminDb.collection("users").doc(uid).collection("notifications").doc();

  await ref.set({
    title: payload.title,
    body: payload.body,
    isRead: false,
    createdAt: now,
    expireAt,
    type: payload.customerType,
  });
}

// ── GET — fetch notification log (most recent 100) ─────────────────────────
export async function GET(req: NextRequest) {
  try {
    await getAdminSession({ allowedRoles: ["SUPER_ADMIN", "STAFF"] });
    const snap = await adminDb
      .collection("notifications_log")
      .orderBy("sentAt", "desc")
      .limit(100)
      .get();

    const logs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return NextResponse.json({ success: true, logs });
  } catch (err: any) {
    console.error("[GET /api/notifications]", err);
    if (isAdminAuthError(err)) {
      return NextResponse.json({ message: err.message }, { status: err.status });
    }
    return NextResponse.json({ message: err.message ?? "Internal server error" }, { status: 500 });
  }
}

// ── POST — send manual notification (broadcast or targeted) ───────────────
export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession({ allowedRoles: ["SUPER_ADMIN", "STAFF"] });
    const body = await req.json();
    const { title, message: bodyText, targetType, targetUid, targetName } = body;

    if (!title || !bodyText || !targetType)
      return NextResponse.json({ message: "title, message, dan targetType wajib diisi." }, { status: 400 });
    if (!["all", "user"].includes(targetType))
      return NextResponse.json({ message: "targetType harus 'all' atau 'user'." }, { status: 400 });
    if (targetType === "user" && !targetUid)
      return NextResponse.json({ message: "targetUid wajib diisi untuk targetType 'user'." }, { status: 400 });

    const now      = new Date().toISOString();
    const sentBy   = session.uid;
    const notifId  = uuidv4();
    const type: NotificationType = targetType === "all" ? "broadcast" : "targeted";
    const customerType = toCustomerType(type);

    let recipientCount = 0;

    if (targetType === "all") {
      // Load all member UIDs
      const usersSnap = await adminDb.collection("users").get();
      recipientCount = usersSnap.size;

      await Promise.all(
        usersSnap.docs.map((userDoc) =>
          writeNotificationToUser(userDoc.id, {
            title,
            body: bodyText,
            customerType,
          })
        )
      );

      await adminDb.collection("global_promos").doc(notifId).set({
        title,
        description: bodyText,
        imageUrl: "",
        isActive: true,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    } else {
      // Targeted: write to user sub-collection
      recipientCount = 1;
      await writeNotificationToUser(targetUid, {
        title,
        body: bodyText,
        customerType,
      });
    }

    // Write admin log
    const log: AdminNotificationLog = {
      type,
      title,
      body:       bodyText,
      targetType,
      ...(targetUid  ? { targetUid }  : {}),
      ...(targetName ? { targetName } : {}),
      sentAt:     now,
      sentBy,
      recipientCount,
    };
    await adminDb.collection("notifications_log").doc(notifId).set(log);
    await writeActivityLog({
      actor: session,
      action: "NOTIFICATION_SENT",
      targetType: "notification",
      targetId: notifId,
      targetLabel: title,
      summary: `Sent ${targetType === "all" ? "broadcast" : "targeted"} notification`,
      source: "api/notifications:POST",
      metadata: { title, body: bodyText, targetType, targetUid, targetName, recipientCount },
    });

    return NextResponse.json({ success: true, id: notifId, recipientCount });
  } catch (err: any) {
    console.error("[POST /api/notifications]", err);
    if (isAdminAuthError(err)) {
      return NextResponse.json({ message: err.message }, { status: err.status });
    }
    return NextResponse.json({ message: err.message ?? "Internal server error" }, { status: 500 });
  }
}

