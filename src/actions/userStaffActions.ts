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

    // Pilar Keamanan: selalu baca dari admin_users, role harus SUPER_ADMIN
    const adminDoc = await adminDb.collection("admin_users").doc(decodedClaims.uid).get();
    const role = adminDoc.exists ? adminDoc.data()?.role : null;

    if (role !== "SUPER_ADMIN") throw new Error("Forbidden: Hanya SUPER_ADMIN yang dapat melakukan aksi ini.");

    return { uid: decodedClaims.uid, role };
  } catch (error) {
    throw new Error("Unauthorized: Invalid session.");
  }
}

// ├── CREATE ACCOUNT (MEMBER OR STAFF) ──
export async function createAccountAction(payload: any, type: "member" | "staff") {
  await getAuthSession();
  const { email, password, name, role, storeLocations, accessAllStores, phoneNumber, tier } = payload;

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
        role: role || "cashier",
        storeLocations: storeLocations || [],
        accessAllStores: !!accessAllStores,
      };
      // Skema baru: semua admin/staff disimpan di admin_users
      await adminDb.collection("admin_users").doc(authUser.uid).set(staffData);
    } else {
      const userData = {
        ...baseData,
        phoneNumber: phoneNumber || "",
        tier: tier || "Silver",
        role: "member",
        currentPoints: 0,
        lifetimePoints: 0,
        vouchers: [],
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
export async function updateAccountAction(uid: string, data: any, collection: "users" | "admin_users") {
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
export async function deleteAccountAction(uid: string, collection: "users" | "admin_users") {
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
    currentPoints: points,
    lifetimePoints: lifetime,
    updatedAt: new Date().toISOString(),
  });
  return { success: true };
}
