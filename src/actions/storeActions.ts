"use server";

// 🔥 FIX 1: Import FieldValue untuk inject Timestamp dari Server
import { GeoPoint, FieldValue } from "firebase-admin/firestore"; 
import { adminDb } from "@/lib/firebaseAdmin";
import { Store, storeConverter } from "@/types/firestore";
import { getAdminSession } from "@/lib/adminSession";
import { writeActivityLog } from "@/lib/activityLog";

type StoreMutationInput = {
  name?: string;
  address?: string;
  location?: { latitude: number; longitude: number } | null;
  operationalHours?: { open: string; close: string };
  isForceClosed?: boolean;
  isActive?: boolean;
  // backward-compatible inputs from existing UI
  latitude?: number | string | null;
  longitude?: number | string | null;
  openHours?: string;
};

function generateStoreId(name: string): string {
  const slug = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s_-]/g, "")
    .replace(/[\s-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (!slug) return "";
  return `store_${slug}`;
}

function isValidTime(value: string): boolean {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);
}

function parseCoordinate(value: number | string | null | undefined, label: "latitude" | "longitude"): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid ${label}.`);
  }

  if (label === "latitude" && (parsed < -90 || parsed > 90)) {
    throw new Error("Latitude must be between -90 and 90.");
  }

  if (label === "longitude" && (parsed < -180 || parsed > 180)) {
    throw new Error("Longitude must be between -180 and 180.");
  }

  return parsed;
}

function parseOperationalHours(input: StoreMutationInput): Store["operationalHours"] {
  if (input.operationalHours) {
    const { open, close } = input.operationalHours;
    if (!isValidTime(open) || !isValidTime(close)) {
      throw new Error("operationalHours must use HH:mm format.");
    }
    return { open, close };
  }

  if (input.openHours) {
    const raw = input.openHours.trim();
    const parts = raw.split("-").map((p) => p.trim());
    if (parts.length === 2 && isValidTime(parts[0]) && isValidTime(parts[1])) {
      return { open: parts[0], close: parts[1] };
    }
    throw new Error("openHours must be in 'HH:mm - HH:mm' format.");
  }

  throw new Error("operationalHours is required.");
}

function parseLocation(input: StoreMutationInput): FirebaseFirestore.GeoPoint {
  if (input.location) {
    const lat = parseCoordinate(input.location.latitude, "latitude");
    const lng = parseCoordinate(input.location.longitude, "longitude");
    return new GeoPoint(lat, lng);
  }

  if (input.latitude != null && input.longitude != null && input.latitude !== "" && input.longitude !== "") {
    const lat = parseCoordinate(input.latitude, "latitude");
    const lng = parseCoordinate(input.longitude, "longitude");
    return new GeoPoint(lat, lng);
  }

  throw new Error("location is required (GeoPoint). Provide latitude and longitude.");
}

function doc(collectionName: string, id: string) {
  return adminDb.collection(collectionName).doc(id);
}

async function setDoc(
  ref: FirebaseFirestore.DocumentReference,
  data: FirebaseFirestore.DocumentData,
  options?: FirebaseFirestore.SetOptions
) {
  if (options) {
    await ref.set(data, options);
    return;
  }
  await ref.set(data);
}

async function verifyAdmin() {
  const session = await getAdminSession({ allowedRoles: ["SUPER_ADMIN"] });
  return session.uid;
}

// ============================================================================
// CREATE STORE
// ============================================================================
export async function createStore(data: StoreMutationInput) {
  const actor = await getAdminSession({ allowedRoles: ["SUPER_ADMIN"] });
  const name = data.name?.trim();
  if (!name) throw new Error("Nama outlet wajib diisi.");

  const storeId = generateStoreId(name);
  if (!storeId) {
    throw new Error("Failed to generate Store ID from store name.");
  }

  const storesRef = doc("stores", storeId).withConverter(storeConverter as any);
  const existing = await storesRef.get();
  if (existing.exists) throw new Error(`Store ID "${storeId}" is already in use.`);

  const storeData: Omit<Store, "id"> = {
    name,
    address: data.address?.trim() ?? "",
    location: parseLocation(data) as any,
    operationalHours: parseOperationalHours(data),
    isForceClosed: typeof data.isForceClosed === "boolean" ? data.isForceClosed : false,
    isActive: typeof data.isActive === "boolean" ? data.isActive : true,
  };

  const converted = storeConverter.toFirestore(storeData as any);

  // 🔥 FIX 2: Suntikkan Timestamp dan isAvailable (untuk Customer App) 
  const payload = {
    ...converted,
    isAvailable: typeof data.isActive === "boolean" ? data.isActive : true,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  };

  await setDoc(storesRef as any, payload as FirebaseFirestore.DocumentData);
  await writeActivityLog({
    actor,
    action: "STORE_CREATED",
    targetType: "store",
    targetId: storeId,
    targetLabel: name,
    summary: `Created store ${name}`,
    source: "action/createStore",
    metadata: { address: storeData.address, isActive: storeData.isActive, operationalHours: storeData.operationalHours },
  });

  return { success: true, id: storeId };
}

// ============================================================================
// UPDATE STORE
// ============================================================================
export async function updateStore(id: string, data: StoreMutationInput) {
  const actor = await getAdminSession({ allowedRoles: ["SUPER_ADMIN"] });
  const ref = doc("stores", id).withConverter(storeConverter as any);
  const snap = await ref.get();
  if (!snap.exists) throw new Error(`Store "${id}" tidak ditemukan.`);
  const before = snap.data() ?? null;

  const updates: any = {};

  if (typeof data.name === "string") updates.name = data.name.trim();
  if (typeof data.address === "string") updates.address = data.address.trim();

  if (
    data.location ||
    (data.latitude != null && data.longitude != null && data.latitude !== "" && data.longitude !== "")
  ) {
    updates.location = parseLocation(data) as any;
  }

  if (data.operationalHours || data.openHours) {
    updates.operationalHours = parseOperationalHours(data);
  }

  if (typeof data.isForceClosed === "boolean") {
    updates.isForceClosed = data.isForceClosed;
    // Map isForceClosed jadi statusOverride "closed" agar UI map HP langsung paham
    updates.statusOverride = data.isForceClosed ? 'closed' : 'open'; 
  }
  
  if (typeof data.isActive === "boolean") {
    updates.isActive = data.isActive;
    updates.isAvailable = data.isActive; // Samakan dengan rules filter Customer App
  }

  if (Object.keys(updates).length === 0) {
    throw new Error("No valid fields to update.");
  }

  const converted = storeConverter.toFirestore(updates as any);
  
  // 🔥 FIX 3: Suntikkan `updatedAt` setiap kali tombol Save dipencet
  const payload = {
    ...converted,
    updatedAt: FieldValue.serverTimestamp()
  };

  await setDoc(ref as any, payload as FirebaseFirestore.DocumentData, { merge: true });
  await writeActivityLog({
    actor,
    action: "STORE_UPDATED",
    targetType: "store",
    targetId: id,
    targetLabel: String(before?.name ?? updates.name ?? id),
    summary: `Updated store ${id}`,
    source: "action/updateStore",
    metadata: { before, changes: updates },
  });
  return { success: true, id };
}

// ============================================================================
// DELETE STORE (SOFT DELETE)
// ============================================================================
export async function deleteStore(id: string) {
  const actor = await getAdminSession({ allowedRoles: ["SUPER_ADMIN"] });
  const ref = adminDb.collection("stores").doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw new Error(`Store "${id}" tidak ditemukan.`);
  const before = snap.data() ?? null;

  // 🔥 FIX 4: HARAM pakai .delete() karena HP user tak akan sadar.
  // Gunakan metode Soft Delete.
  await ref.update({
    isActive: false,
    isAvailable: false,     // Menghilangkan dari Map Customer App
    isForceClosed: true,    // Tutup paksa
    statusOverride: 'closed',
    updatedAt: FieldValue.serverTimestamp() // Trigger ke HP user
  });
  await writeActivityLog({
    actor,
    action: "STORE_DELETED",
    targetType: "store",
    targetId: id,
    targetLabel: String(before?.name ?? id),
    summary: `Soft deleted store ${id}`,
    source: "action/deleteStore",
    metadata: { before },
  });
  
  return { success: true };
}
