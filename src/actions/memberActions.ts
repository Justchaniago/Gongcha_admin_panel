"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";

type UpdateMemberInput = {
  name?: string;
  phone?: string;
  dob?: string;
  points?: number;
  xp?: number;
  tier?: "BRONZE" | "SILVER" | "GOLD";
};

async function verifySuperAdmin() {
  const cookieStore = await cookies();
  const session = cookieStore.get("session")?.value;
  if (!session) throw new Error("Unauthorized");

  const decoded = await adminAuth.verifySessionCookie(session, true);
  const adminSnap = await adminDb.collection("admin_users").doc(decoded.uid).get();
  const admin = adminSnap.data();
  if (!admin || admin.isActive !== true || admin.role !== "SUPER_ADMIN") {
    throw new Error("Forbidden");
  }

  return decoded.uid;
}

export async function updateMemberAction(uid: string, input: UpdateMemberInput) {
  await verifySuperAdmin();
  if (!uid) throw new Error("uid is required");

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

  revalidatePath("/admin-users");
  return { success: true };
}

export async function sendMemberNotificationAction(uid: string, title: string, body: string) {
  await verifySuperAdmin();
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

  revalidatePath("/notifications");
  return { success: true };
}
