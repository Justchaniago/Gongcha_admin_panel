"use server";

import { cookies } from "next/headers";
import { GeoPoint } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { Store, storeConverter } from "@/types/firestore";

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
  const cookieStore = await cookies();
  const session = cookieStore.get("session")?.value;

  if (!session) {
    throw new Error("Unauthorized: No session found");
  }

  try {
    const decodedClaims = await adminAuth.verifySessionCookie(session, true);
    const uid = decodedClaims.uid;

    const adminProfile = await adminDb.collection("admin_users").doc(uid).get();
    if (!adminProfile.exists) {
      throw new Error("Forbidden: Admin profile not found");
    }

    const profile = adminProfile.data();
    if (profile?.isActive !== true) {
      throw new Error("Forbidden: Account is inactive");
    }

    if (profile?.role !== "SUPER_ADMIN") {
      throw new Error("Forbidden: Insufficient permissions");
    }

    return uid;
  } catch (error) {
    console.error("verifyAdmin Error:", error);
    throw new Error("Unauthorized: Invalid session");
  }
}

// CREATE STORE
export async function createStore(data: StoreMutationInput) {
  await verifyAdmin();
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
  await setDoc(storesRef as any, converted as FirebaseFirestore.DocumentData);

  return { success: true, id: storeId };
}

// UPDATE STORE
export async function updateStore(id: string, data: StoreMutationInput) {
  await verifyAdmin();
  const ref = doc("stores", id).withConverter(storeConverter as any);
  const snap = await ref.get();
  if (!snap.exists) throw new Error(`Store "${id}" tidak ditemukan.`);

  const updates: Partial<Omit<Store, "id">> = {};

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

  if (typeof data.isForceClosed === "boolean") updates.isForceClosed = data.isForceClosed;
  if (typeof data.isActive === "boolean") updates.isActive = data.isActive;

  if (Object.keys(updates).length === 0) {
    throw new Error("No valid fields to update.");
  }

  const converted = storeConverter.toFirestore(updates as any);
  await setDoc(ref as any, converted as FirebaseFirestore.DocumentData, { merge: true });
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
