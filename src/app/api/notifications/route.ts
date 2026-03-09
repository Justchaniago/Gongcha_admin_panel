import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseServer";
import { adminAuth } from "@/lib/firebaseAdmin";
import { cookies } from "next/headers";
import { v4 as uuidv4 } from "uuid";
import type { AdminNotificationLog, NotificationType } from "@/types/firestore";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

// Map admin-side NotificationType to the type values the customer app expects
function toCustomerType(t: NotificationType): 'gift' | 'points' | 'promo' | 'order' | 'system' {
  if (t === 'voucher_injected') return 'gift';
  if (t === 'tx_verified')      return 'points';
  if (t === 'tx_rejected')      return 'system';
  if (t === 'broadcast')        return 'promo';
  return 'system'; // targeted
}

// Helper: session validation (admin / master only)
async function validateSession() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;
  if (!sessionCookie) return { error: "Session not found.", status: 403, token: null };
  try {
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    const uid = decoded.uid as string;
    const adminProfileSnap = await adminDb.collection("admin_users").doc(uid).get();
    const adminProfile = adminProfileSnap.data();
    const role = adminProfile?.role ?? (decoded.role as string) ?? "";
    if (adminProfile?.isActive !== true || !["SUPER_ADMIN", "STAFF"].includes(role)) {
      return { error: "Access denied.", status: 403, token: null };
    }
    return { error: null, status: 200, token: { ...decoded, uid } };
  } catch {
    return { error: "Invalid session.", status: 401, token: null };
  }
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
  const validation = await validateSession();
  if (validation.error)
    return NextResponse.json({ message: validation.error }, { status: validation.status });

  try {
    const snap = await adminDb
      .collection("notifications_log")
      .orderBy("sentAt", "desc")
      .limit(100)
      .get();

    const logs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return NextResponse.json({ success: true, logs });
  } catch (err: any) {
    console.error("[GET /api/notifications]", err);
    return NextResponse.json({ message: err.message ?? "Internal server error" }, { status: 500 });
  }
}

// ── POST — send manual notification (broadcast or targeted) ───────────────
export async function POST(req: NextRequest) {
  const validation = await validateSession();
  if (validation.error)
    return NextResponse.json({ message: validation.error }, { status: validation.status });

  try {
    const body = await req.json();
    const { title, message: bodyText, targetType, targetUid, targetName } = body;

    if (!title || !bodyText || !targetType)
      return NextResponse.json({ message: "title, message, dan targetType wajib diisi." }, { status: 400 });
    if (!["all", "user"].includes(targetType))
      return NextResponse.json({ message: "targetType harus 'all' atau 'user'." }, { status: 400 });
    if (targetType === "user" && !targetUid)
      return NextResponse.json({ message: "targetUid wajib diisi untuk targetType 'user'." }, { status: 400 });

    const now      = new Date().toISOString();
    const sentBy   = validation.token!.uid as string;
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

    return NextResponse.json({ success: true, id: notifId, recipientCount });
  } catch (err: any) {
    console.error("[POST /api/notifications]", err);
    return NextResponse.json({ message: err.message ?? "Internal server error" }, { status: 500 });
  }
}
