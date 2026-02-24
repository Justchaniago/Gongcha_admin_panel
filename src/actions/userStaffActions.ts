"use server";

import { adminDb, adminAuth } from "@/lib/firebaseAdmin";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

// Helper internal: Verifikasi Session & Role
async function getAuthSession() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;
  if (!sessionCookie) throw new Error("Unauthorized: Sesi tidak ditemukan.");

  try {
    const decodedClaims = await adminAuth.verifySessionCookie(sessionCookie, true);
    
    // Ambil role dari Firestore (cek di users dulu, lalu staff)
    let userDoc = await adminDb.collection("users").doc(decodedClaims.uid).get();
    let role = userDoc.exists ? userDoc.data()?.role : null;
    
    if (!role) {
      const staffDoc = await adminDb.collection("staff").doc(decodedClaims.uid).get();
      role = staffDoc.exists ? staffDoc.data()?.role : null;
    }

    const allowedRoles = ["admin", "master", "manager", "store_manager"];
    if (!allowedRoles.includes(role)) throw new Error("Forbidden: Anda tidak memiliki izin.");
    
    return { uid: decodedClaims.uid, role };
  } catch (error) {
    throw new Error("Unauthorized: Sesi tidak valid.");
  }
}

// ── CREATE ACCOUNT (MEMBER ATAU STAFF) ──
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
        storeLocation: accessAllStores ? "" : (storeLocations?.[0] || ""),
        storeLocations: storeLocations || [],
        accessAllStores: !!accessAllStores,
      };
      await adminDb.collection("staff").doc(authUser.uid).set(staffData);
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
    throw new Error(error.message || "Gagal membuat akun.");
  }
}

// ── UPDATE ACCOUNT ──
export async function updateAccountAction(uid: string, data: any, collection: "users" | "staff") {
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
export async function deleteAccountAction(uid: string, collection: "users" | "staff") {
  await getAuthSession();
  try {
    await adminAuth.deleteUser(uid);
  } catch (e) {
    console.warn("User auth sudah tidak ada, hapus doc saja.");
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
