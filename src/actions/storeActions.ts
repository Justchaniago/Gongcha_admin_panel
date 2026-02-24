"use server";

import { adminDb, adminAuth } from "@/lib/firebaseAdmin";
import { cookies } from "next/headers";

// Helper untuk verifikasi admin dari session cookie
async function verifyAdmin() {
  const sessionCookie = cookies().get("session")?.value;
  if (!sessionCookie) throw new Error("Unauthorized: No session cookie");

  try {
    const decodedClaims = await adminAuth.verifySessionCookie(sessionCookie, true);
    const uid = decodedClaims.uid;
    
    // Cek role di Firestore (hanya admin/master yang boleh mengedit store)
    const userDoc = await adminDb.collection("users").doc(uid).get();
    const role = userDoc.exists ? userDoc.data()?.role : null;
    
    if (role !== "admin" && role !== "master") {
      throw new Error("Forbidden: Insufficient privileges");
    }
    return uid;
  } catch (error) {
    throw new Error("Unauthorized: Invalid session");
  }
}

// CREATE STORE
export async function createStore(data: any) {
  await verifyAdmin();
  const { storeId, name, address, latitude, longitude, openHours, statusOverride, isActive } = data;

  if (!name?.trim()) throw new Error("Nama outlet wajib diisi.");
  if (!storeId?.trim()) throw new Error("Store ID wajib diisi.");

  const idRegex = /^[a-z0-9_-]+$/;
  if (!idRegex.test(storeId.trim())) {
    throw new Error("Store ID hanya boleh mengandung huruf kecil, angka, underscore (_) dan dash (-).");
  }

  const existing = await adminDb.collection("stores").doc(storeId.trim()).get();
  if (existing.exists) throw new Error(`Store ID "${storeId}" sudah digunakan.`);

  const storeData = {
    name: name.trim(),
    address: address?.trim() ?? "",
    latitude: latitude != null && latitude !== "" ? Number(latitude) : null,
    longitude: longitude != null && longitude !== "" ? Number(longitude) : null,
    openHours: openHours?.trim() ?? "",
    statusOverride: statusOverride ?? "open",
    isActive: isActive ?? true,
    createdAt: new Date().toISOString(),
  };

  await adminDb.collection("stores").doc(storeId.trim()).set(storeData);
  return { success: true, id: storeId.trim() };
}

// UPDATE STORE
export async function updateStore(id: string, data: any) {
  await verifyAdmin();
  const { name, address, latitude, longitude, openHours, statusOverride, isActive } = data;

  if (!name?.trim()) throw new Error("Nama outlet wajib diisi.");

  const ref = adminDb.collection("stores").doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw new Error(`Store "${id}" tidak ditemukan.`);

  const updates: any = {
    name: name.trim(),
    address: address?.trim() ?? "",
    openHours: openHours?.trim() ?? "",
    statusOverride: statusOverride ?? "open",
    isActive: isActive ?? true,
    updatedAt: new Date().toISOString(),
  };

  if (latitude != null && latitude !== "") updates.latitude = Number(latitude);
  if (longitude != null && longitude !== "") updates.longitude = Number(longitude);

  await ref.update(updates);
  return { success: true, id };
}

// DELETE STORE
export async function deleteStore(id: string) {
  await verifyAdmin();
  const ref = adminDb.collection("stores").doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw new Error(`Store "${id}" tidak ditemukan.`);

  await ref.delete();
  return { success: true };
}
