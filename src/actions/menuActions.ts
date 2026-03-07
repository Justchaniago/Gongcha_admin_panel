"use server";
import { adminDb, adminAuth } from "@/lib/firebaseAdmin";
import { cookies } from "next/headers";
import { FieldValue } from "firebase-admin/firestore";

// ── Session Helper ────────────────────────────────────────────────────────────
async function getAuthSession(): Promise<{ uid: string; role: string }> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;
  if (!sessionCookie) throw new Error("Unauthorized: Sesi tidak ditemukan.");

  const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
  const doc = await adminDb.collection("admin_users").doc(decoded.uid).get();
  const role: string = doc.data()?.role ?? "";
  if (!role) throw new Error("Forbidden: Profil admin tidak ditemukan.");
  return { uid: decoded.uid, role };
}

// Field sensitif yang tidak boleh diubah oleh STAFF
const SENSITIVE_FIELDS = [
  "name", "category", "description", "image",
  "mediumPrice", "largePrice", "hotPrice", "price",
  "availableHot", "availableLarge",
];

// ── Create ────────────────────────────────────────────────────────────────────
export async function createMenu(data: any) {
  const { role } = await getAuthSession();
  if (role !== "SUPER_ADMIN")
    throw new Error("Akses Ditolak: Hanya SUPER_ADMIN yang dapat menambah menu.");

  try {
    const docRef = await adminDb.collection("products").add({
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    return { success: true, id: docRef.id };
  } catch (error: any) {
    throw new Error(error.message || "Failed to add product");
  }
}

// ── Update ────────────────────────────────────────────────────────────────────
export async function updateMenu(id: string, data: any) {
  const { uid, role } = await getAuthSession();

  if (role !== "SUPER_ADMIN") {
    // STAFF: hanya boleh mengirim field isAvailable
    const sentFields = Object.keys(data);
    const hasSensitive = sentFields.some(f => SENSITIVE_FIELDS.includes(f));
    if (hasSensitive) {
      throw new Error(
        "Akses Ditolak: Staf hanya diizinkan mengubah ketersediaan item."
      );
    }
    const illegalFields = sentFields.filter(f => f !== "isAvailable");
    if (illegalFields.length > 0) {
      throw new Error(
        `Akses Ditolak: Field '${illegalFields.join(", ")}' tidak dapat diubah oleh Staf.`
      );
    }
  }

  try {
    const isStatusOnlyUpdate =
      Object.keys(data).length === 1 && "isAvailable" in data;

    const updatePayload: Record<string, unknown> = {
      ...data,
      updatedAt: new Date().toISOString(),
    };

    // Bonus: audit trail untuk toggle status
    if (isStatusOnlyUpdate) {
      updatePayload.lastToggledBy  = uid;
      updatePayload.lastToggledAt  = FieldValue.serverTimestamp();
    }

    await adminDb.collection("products").doc(id).update(updatePayload);
    return { success: true };
  } catch (error: any) {
    throw new Error(error.message || "Failed to update product");
  }
}

// ── Delete ────────────────────────────────────────────────────────────────────
export async function deleteMenu(id: string) {
  const { role } = await getAuthSession();
  if (role !== "SUPER_ADMIN")
    throw new Error("Akses Ditolak: Hanya SUPER_ADMIN yang dapat menghapus menu.");

  try {
    await adminDb.collection("products").doc(id).delete();
    return { success: true };
  } catch (error: any) {
    throw new Error(error.message || "Failed to delete product");
  }
}
