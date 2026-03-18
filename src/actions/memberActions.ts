"use server";

import { revalidatePath } from "next/cache";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { getAdminSession } from "@/lib/adminSession";
import { writeActivityLog } from "@/lib/activityLog";

type UpdateMemberInput = {
  name?: string;
  phone?: string;
  dob?: string;
  points?: number;
  xp?: number;
  tier?: "BRONZE" | "SILVER" | "GOLD";
};

async function verifySuperAdmin() {
  const session = await getAdminSession({ allowedRoles: ["SUPER_ADMIN"] });
  return session.uid;
}

export async function updateMemberAction(uid: string, input: UpdateMemberInput) {
  const actorUid = await verifySuperAdmin();
  if (!uid) throw new Error("uid is required");
  const actor = await getAdminSession({ allowedRoles: ["SUPER_ADMIN"] });
  const beforeSnap = await adminDb.collection("users").doc(uid).get();
  const before = beforeSnap.data() ?? null;

  const update: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (typeof input.name === "string") update.name = input.name.trim();
  if (typeof input.phone === "string") update.phone = input.phone.trim();
  if (typeof input.dob === "string") update.dob = input.dob.trim();
  if (typeof input.tier === "string") update.tier = input.tier;

  if (input.points !== undefined) {
    const points = Number(input.points);
    if (!Number.isFinite(points) || points < 0) throw new Error("Invalid points value");
    update.points = Math.floor(points);
  }

  if (input.xp !== undefined) {
    const xp = Number(input.xp);
    if (!Number.isFinite(xp) || xp < 0) throw new Error("Invalid xp value");
    update.xp = Math.floor(xp);
  }

  await adminDb.collection("users").doc(uid).set(update, { merge: true });
  await writeActivityLog({
    actor,
    action: "MEMBER_UPDATED",
    targetType: "member",
    targetId: uid,
    targetLabel: String(before?.name ?? uid),
    summary: `Updated member profile ${uid}`,
    source: "action/updateMemberAction",
    metadata: { before, changes: update, requestedBy: actorUid },
  });

  revalidatePath("/admin-users");
  return { success: true };
}

export async function sendMemberNotificationAction(uid: string, title: string, body: string) {
  await verifySuperAdmin();
  const actor = await getAdminSession({ allowedRoles: ["SUPER_ADMIN"] });
  if (!uid) throw new Error("uid is required");
  if (!title.trim() || !body.trim()) throw new Error("title and body are required");

  const now = Date.now();
  await adminDb.collection("users").doc(uid).collection("notifications").add({
    title: title.trim(),
    body: body.trim(),
    isRead: false,
    createdAt: FieldValue.serverTimestamp(),
    expireAt: new Date(now + 7 * 24 * 60 * 60 * 1000),
    type: "system",
  });
  await writeActivityLog({
    actor,
    action: "NOTIFICATION_SENT",
    targetType: "notification",
    targetId: uid,
    targetLabel: title.trim(),
    summary: `Sent manual member notification to ${uid}`,
    source: "action/sendMemberNotificationAction",
    metadata: { title: title.trim(), body: body.trim(), uid },
  });

  revalidatePath("/notifications");
  return { success: true };
}
