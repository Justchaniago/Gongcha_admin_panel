import { v4 as uuidv4 } from "uuid";
import { adminDb } from "@/lib/firebaseAdmin";
import type { AdminNotificationLog, UserNotification } from "@/types/firestore";

function getReceiptNumber(txData: FirebaseFirestore.DocumentData, fallback = ""): string {
  return String(txData.receiptNumber ?? txData.posTransactionId ?? txData.transactionId ?? fallback);
}

function getTotalAmount(txData: FirebaseFirestore.DocumentData): number {
  return Number(txData.totalAmount ?? txData.amount ?? 0);
}

export async function createTxNotification(
  memberId: string | null | undefined,
  action: "verified" | "rejected",
  txData: FirebaseFirestore.DocumentData,
  adminUid: string,
) {
  if (!memberId) return;

  try {
    const notifId = uuidv4();
    const now = new Date().toISOString();
    const txId = getReceiptNumber(txData);
    const amount = `Rp ${getTotalAmount(txData).toLocaleString("id-ID")}`;

    const title = action === "verified"
      ? "✅ Transaksi Kamu Diverifikasi!"
      : "❌ Transaksi Ditolak";
    const body = action === "verified"
      ? `Transaksi ${txId} (${amount}) telah diverifikasi. Poin pending kamu sudah dirilis.`
      : `Transaksi ${txId} (${amount}) ditolak. Poin pending dari transaksi ini dibatalkan.`;

    const userNotif: UserNotification = {
      id: notifId,
      type: action === "verified" ? "tx_verified" : "tx_rejected",
      title,
      body,
      isRead: false,
      createdAt: now,
      data: { txId, amount: getTotalAmount(txData) },
    };

    const adminLog: AdminNotificationLog = {
      type: action === "verified" ? "tx_verified" : "tx_rejected",
      title,
      body,
      targetType: "user",
      targetUid: memberId,
      sentAt: now,
      sentBy: adminUid,
      recipientCount: 1,
    };

    await Promise.all([
      // Write to subcollection — member app subscribes to users/{uid}/notifications
      adminDb.collection("users").doc(memberId).collection("notifications").doc(notifId).set({
        type: action === "verified" ? "tx_verified" : "tx_rejected",
        title,
        body,
        isRead: false,
        createdAt: now,
        data: userNotif.data,
      }),
      adminDb.collection("notifications_log").doc(notifId).set(adminLog),
    ]);
  } catch (err) {
    console.error("[createTxNotification]", err);
  }
}
