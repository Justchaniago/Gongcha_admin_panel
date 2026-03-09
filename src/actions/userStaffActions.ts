"use server";

import { adminDb, adminAuth } from "@/lib/firebaseAdmin";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

// Helper internal: Verifikasi Session & Role
async function getAuthSession() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;
  if (!sessionCookie) throw new Error("Unauthorized: Session not found.");

  try {
    const decodedClaims = await adminAuth.verifySessionCookie(sessionCookie, true);
    
    const adminSnap = await adminDb.collection("admin_users").doc(decodedClaims.uid).get();
    const adminData = adminSnap.data();
    const role = adminData?.role;
    if (!adminData || adminData.isActive !== true || !["SUPER_ADMIN", "STAFF"].includes(role)) {
      throw new Error("Forbidden: You do not have permission.");
    }
    
    return { uid: decodedClaims.uid, role };
  } catch (error) {
    throw new Error("Unauthorized: Invalid session.");
  }
}

// ├── CREATE ACCOUNT (MEMBER OR STAFF) ──
export async function createAccountAction(payload: any, type: "member" | "staff") {
  await getAuthSession();
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
    }

    return { success: true, uid: authUser.uid };
  } catch (error: any) {
    if (error.code === "auth/email-already-exists") throw new Error("Email sudah terdaftar.");
    throw new Error(error.message || "Failed to create account.");
  }
}

// ── UPDATE ACCOUNT ──
export async function updateAccountAction(uid: string, data: any, collection: "users" | "staff" | "admin_users") {
  await getAuthSession();
  const cleanData = { ...data, updatedAt: new Date().toISOString() };
  
  // Jika ada password, update di Auth (opsional)
  if (data.password) {
    await adminAuth.updateUser(uid, { password: data.password });
    delete cleanData.password;
  }

  await adminDb.collection(collection).doc(uid).update(cleanData);
  return { success: true };
}

// ── DELETE ACCOUNT ──
export async function deleteAccountAction(uid: string, collection: "users" | "staff" | "admin_users") {
  await getAuthSession();
  try {
    await adminAuth.deleteUser(uid);
  } catch (e) {
    console.warn("User auth no longer exists, just delete doc.");
  }
  await adminDb.collection(collection).doc(uid).delete();
  return { success: true };
}

// ── UPDATE POINTS ──
export async function updatePointsAction(uid: string, points: number, lifetime: number) {
  await getAuthSession();
  await adminDb.collection("users").doc(uid).update({
    points,
    xp: lifetime,
    // legacy mirror for old UI that still reads these fields
    currentPoints: points,
    lifetimePoints: lifetime,
    updatedAt: new Date().toISOString(),
  });
  return { success: true };
}
