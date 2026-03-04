import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseServer";
import { adminAuth } from "@/lib/firebaseAdmin";
import { cookies } from "next/headers";
import { v4 as uuidv4 } from "uuid";
import type { AdminNotificationLog, NotificationType, UserNotification } from "@/types/firestore";

// Helper: session validation (admin / master only)
async function validateSession() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;
  if (!sessionCookie) return { error: "Session not found.", status: 403, token: null };
  try {
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    const uid = decoded.uid as string;

    // Role is stored in Firestore, not JWT claims — always do Firestore lookup
    let role = (decoded.role as string) ?? "";
    if (!role) {
      const userDoc  = await adminDb.collection("users").doc(uid).get();
      const staffDoc = await adminDb.collection("staff").doc(uid).get();
      const profile  = userDoc.exists ? userDoc.data() : staffDoc.exists ? staffDoc.data() : null;
      role = profile?.role ?? "";
    }

    if (!["admin", "master"].includes(role))
      return { error: "Access denied.", status: 403, token: null };
    return { error: null, status: 200, token: { ...decoded, uid } };
  } catch {
    return { error: "Invalid session.", status: 401, token: null };
  }
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

    const userNotif: UserNotification = {
      id:        notifId,
      type,
      title,
      body:      bodyText,
      isRead:    false,
      createdAt: now,
    };

    let recipientCount = 0;

    if (targetType === "all") {
      // Load all member UIDs
      const usersSnap = await adminDb.collection("users").get();
      recipientCount = usersSnap.size;

      // Batch write (Firestore max 500/batch)
      const chunks: FirebaseFirestore.QueryDocumentSnapshot[][] = [];
      for (let i = 0; i < usersSnap.docs.length; i += 400) {
        chunks.push(usersSnap.docs.slice(i, i + 400));
      }
      for (const chunk of chunks) {
        const batch = adminDb.batch();
        for (const userDoc of chunk) {
          const ref = adminDb
            .collection("users")
            .doc(userDoc.id)
            .collection("notifications")
            .doc(notifId);
          batch.set(ref, userNotif);
        }
        await batch.commit();
      }
    } else {
      // Targeted: single user
      recipientCount = 1;
      await adminDb
        .collection("users")
        .doc(targetUid)
        .collection("notifications")
        .doc(notifId)
        .set(userNotif);
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
