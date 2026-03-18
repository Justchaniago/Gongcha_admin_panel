"use server";

import { adminDb, adminAuth } from "@/lib/firebaseAdmin";
import { revalidatePath } from "next/cache";
import { getAdminSession } from "@/lib/adminSession";
import { writeActivityLog } from "@/lib/activityLog";

async function getAuthSession() {
  return getAdminSession({ allowedRoles: ["SUPER_ADMIN", "STAFF"] });
}

// ├── CREATE ACCOUNT (MEMBER OR STAFF) ──
export async function createAccountAction(payload: any, type: "member" | "staff") {
  const actor = await getAuthSession();
  const { email, password, name, role, assignedStoreId, phoneNumber, tier } = payload;

  try {
    // 1. Create in Firebase Auth
    const authUser = await adminAuth.createUser({
      email: email.toLowerCase().trim(),
      password: password,
      displayName: name,
    });

    // 2. Prepare Data
    const baseData = {
      name, email: email.toLowerCase().trim(),
      createdAt: new Date().toISOString(),
      isActive: true,
    };

    if (type === "staff") {
      const staffData = {
        ...baseData,
        uid: authUser.uid,
        role: role === "SUPER_ADMIN" ? "SUPER_ADMIN" : "STAFF",
        assignedStoreId: role === "SUPER_ADMIN" ? null : (assignedStoreId ?? null),
      };
      await adminDb.collection("admin_users").doc(authUser.uid).set(staffData);
      await writeActivityLog({
        actor,
        action: "STAFF_CREATED",
        targetType: "staff",
        targetId: authUser.uid,
        targetLabel: staffData.name,
        summary: `Created staff account for ${staffData.name}`,
        source: "action/createAccountAction",
        metadata: { email: staffData.email, role: staffData.role, assignedStoreId: staffData.assignedStoreId },
      });
    } else {
      const userData = {
        ...baseData,
        phone: phoneNumber || "",
        tier: (tier || "SILVER").toUpperCase(),
        role: "member",
        points: 0,
        xp: 0,
        activeVouchers: [],
        fcmTokens: [],
      };
      await adminDb.collection("users").doc(authUser.uid).set(userData);
      await writeActivityLog({
        actor,
        action: "MEMBER_CREATED",
        targetType: "member",
        targetId: authUser.uid,
        targetLabel: userData.name,
        summary: `Created member account for ${userData.name}`,
        source: "action/createAccountAction",
        metadata: { email: userData.email, tier: userData.tier, phone: userData.phone },
      });
    }

    return { success: true, uid: authUser.uid };
  } catch (error: any) {
    if (error.code === "auth/email-already-exists") throw new Error("Email sudah terdaftar.");
    throw new Error(error.message || "Failed to create account.");
  }
}

// ── UPDATE ACCOUNT ──
export async function updateAccountAction(uid: string, data: any, collection: "users" | "staff" | "admin_users") {
  const actor = await getAuthSession();
  const cleanData = { ...data, updatedAt: new Date().toISOString() };
  const targetRef = adminDb.collection(collection).doc(uid);
  const beforeSnap = await targetRef.get();
  const before = beforeSnap.data() ?? null;
  
  // Jika ada password, update di Auth (opsional)
  if (data.password) {
    await adminAuth.updateUser(uid, { password: data.password });
    delete cleanData.password;
  }

  await targetRef.update(cleanData);
  await writeActivityLog({
    actor,
    action: collection === "users" ? "MEMBER_UPDATED" : "STAFF_UPDATED",
    targetType: collection === "users" ? "member" : "staff",
    targetId: uid,
    targetLabel: String(before?.name ?? cleanData.name ?? uid),
    summary: `Updated ${collection === "users" ? "member" : "staff"} account ${uid}`,
    source: "action/updateAccountAction",
    metadata: { before, changes: cleanData },
  });
  return { success: true };
}

// ── DELETE ACCOUNT ──
export async function deleteAccountAction(uid: string, collection: "users" | "staff" | "admin_users") {
  const actor = await getAuthSession();
  const targetRef = adminDb.collection(collection).doc(uid);
  const beforeSnap = await targetRef.get();
  const before = beforeSnap.data() ?? null;
  try {
    await adminAuth.deleteUser(uid);
  } catch (e) {
    console.warn("User auth no longer exists, just delete doc.");
  }
  await targetRef.delete();
  await writeActivityLog({
    actor,
    action: collection === "users" ? "MEMBER_DELETED" : "STAFF_DELETED",
    targetType: collection === "users" ? "member" : "staff",
    targetId: uid,
    targetLabel: String(before?.name ?? uid),
    summary: `Deleted ${collection === "users" ? "member" : "staff"} account ${uid}`,
    source: "action/deleteAccountAction",
    metadata: { before },
  });
  return { success: true };
}

// ── UPDATE POINTS ──
export async function updatePointsAction(uid: string, points: number, lifetime: number) {
  const actor = await getAuthSession();
  const targetRef = adminDb.collection("users").doc(uid);
  const beforeSnap = await targetRef.get();
  const before = beforeSnap.data() ?? null;
  await targetRef.update({
    points,
    xp: lifetime,
    // legacy mirror for old UI that still reads these fields
    currentPoints: points,
    lifetimePoints: lifetime,
    updatedAt: new Date().toISOString(),
  });
  await writeActivityLog({
    actor,
    action: "POINTS_UPDATED",
    targetType: "member",
    targetId: uid,
    targetLabel: String(before?.name ?? uid),
    summary: `Updated points for member ${uid}`,
    source: "action/updatePointsAction",
    metadata: {
      before: {
        points: before?.points ?? before?.currentPoints ?? 0,
        xp: before?.xp ?? before?.lifetimePoints ?? 0,
      },
      after: { points, xp: lifetime },
    },
  });
  return { success: true };
}
