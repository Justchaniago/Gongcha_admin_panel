"use server";
import { adminDb } from "@/lib/firebaseAdmin";
import { Product, productConverter } from "@/types/firestore";
// 🔥 FIX: Import FieldValue dari firebase-admin
import { FieldValue } from "firebase-admin/firestore";
import { getAdminSession } from "@/lib/adminSession";
import { writeActivityLog } from "@/lib/activityLog";

type ProductMutationInput = {
  name?: string;
  category?: string;
  basePrice?: number | string;
  imageUrl?: string;
  description?: string;
  isAvailable?: boolean;
  isHotAvailable?: boolean;
  isLargeAvailable?: boolean;
};

function generateProductId(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s_-]/g, "")
    .replace(/[\s-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function ensureProductImagePath(url: string, productId: string): string {
  if (!url) return url;
  if (url.includes("products%2F") || url.includes("/products/")) return url;
  return `products/${productId}.jpg`;
}

function normalizeProductInput(data: ProductMutationInput, productId: string): Omit<Product, "id"> {
  const name = String(data.name ?? "").trim();
  const category = String(data.category ?? "").trim();
  const basePrice = Number(data.basePrice);
  const description = typeof data.description === "string" ? data.description.trim() : "";

  if (!name) throw new Error("Product name is required");
  if (!category) throw new Error("Product category is required");
  if (!Number.isFinite(basePrice)) throw new Error("basePrice must be a valid number");

  const imageUrl = ensureProductImagePath(String(data.imageUrl ?? "").trim(), productId);

  return {
    name,
    category,
    basePrice,
    imageUrl,
    description,
    isAvailable: Boolean(data.isAvailable ?? true),
    isHotAvailable: Boolean(data.isHotAvailable ?? false),
    isLargeAvailable: Boolean(data.isLargeAvailable ?? true),
  };
}

function doc(id: string) {
  return adminDb.collection("products").doc(id);
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

export async function createMenu(data: ProductMutationInput) {
  try {
    const actor = await getAdminSession({ allowedRoles: ["SUPER_ADMIN"] });
    const rawName = String(data.name ?? "").trim();
    const productId = generateProductId(rawName);
    if (!productId) throw new Error("Failed to generate product ID from name");

    const ref = doc(productId).withConverter(productConverter as any);
    const existing = await ref.get();
    if (existing.exists) {
      throw new Error(`Product ID "${productId}" is already in use`);
    }

    const normalized = normalizeProductInput(data, productId);
    
    // 🔥 DELTA SYNC: Sisipkan createdAt dan updatedAt
    const payload = {
      ...normalized,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    };

    const converted = productConverter.toFirestore(payload as any);
    await setDoc(ref as any, converted as FirebaseFirestore.DocumentData);
    await writeActivityLog({
      actor,
      action: "MENU_CREATED",
      targetType: "menu",
      targetId: productId,
      targetLabel: normalized.name,
      summary: `Created menu ${normalized.name}`,
      source: "action/createMenu",
      metadata: normalized,
    });
    return { success: true, id: productId };
  } catch (error: any) {
    throw new Error(error.message || "Failed to add product");
  }
}

export async function updateMenu(id: string, data: ProductMutationInput) {
  try {
    const actor = await getAdminSession({ allowedRoles: ["SUPER_ADMIN"] });
    const ref = doc(id).withConverter(productConverter as any);
    const snap = await ref.get();
    if (!snap.exists) throw new Error(`Product "${id}" not found`);
    const before = snap.data() as Product;

    const normalized = normalizeProductInput(
      {
        ...((snap.data() as Product) ?? {}),
        ...data,
      },
      id
    );

    // 🔥 DELTA SYNC: Sisipkan updatedAt setiap kali ada perubahan
    const payload = {
      ...normalized,
      updatedAt: FieldValue.serverTimestamp()
    };

    const converted = productConverter.toFirestore(payload as any);
    await setDoc(ref as any, converted as FirebaseFirestore.DocumentData, { merge: true });
    await writeActivityLog({
      actor,
      action: "MENU_UPDATED",
      targetType: "menu",
      targetId: id,
      targetLabel: normalized.name,
      summary: `Updated menu ${normalized.name}`,
      source: "action/updateMenu",
      metadata: { before, after: normalized },
    });
    return { success: true };
  } catch (error: any) {
    throw new Error(error.message || "Failed to update product");
  }
}

export async function deleteMenu(id: string) {
  try {
    const actor = await getAdminSession({ allowedRoles: ["SUPER_ADMIN"] });
    const ref = adminDb.collection("products").doc(id);
    const snap = await ref.get();
    const before = snap.data() ?? null;
    // 🔥 DELTA SYNC ARCHITECTURE: SOFT DELETE!
    // HARAM menggunakan .delete(). Kita ubah isAvailable jadi false, lalu beri Timestamp.
    await ref.update({
      isAvailable: false,
      updatedAt: FieldValue.serverTimestamp()
    });
    await writeActivityLog({
      actor,
      action: "MENU_DELETED",
      targetType: "menu",
      targetId: id,
      targetLabel: String(before?.name ?? id),
      summary: `Soft deleted menu ${id}`,
      source: "action/deleteMenu",
      metadata: { before },
    });
    return { success: true };
  } catch (error: any) {
    throw new Error(error.message || "Failed to delete product");
  }
}
