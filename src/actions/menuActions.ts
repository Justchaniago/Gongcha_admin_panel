"use server";
import { adminDb } from "@/lib/firebaseAdmin";
import { Product, productConverter } from "@/types/firestore";

type ProductMutationInput = {
  name?: string;
  category?: string;
  basePrice?: number | string;
  imageUrl?: string;
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

  if (!name) throw new Error("Product name is required");
  if (!category) throw new Error("Product category is required");
  if (!Number.isFinite(basePrice)) throw new Error("basePrice must be a valid number");

  const imageUrl = ensureProductImagePath(String(data.imageUrl ?? "").trim(), productId);

  return {
    name,
    category,
    basePrice,
    imageUrl,
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
    const rawName = String(data.name ?? "").trim();
    const productId = generateProductId(rawName);
    if (!productId) throw new Error("Failed to generate product ID from name");

    const ref = doc(productId).withConverter(productConverter as any);
    const existing = await ref.get();
    if (existing.exists) {
      throw new Error(`Product ID "${productId}" is already in use`);
    }

    const normalized = normalizeProductInput(data, productId);
    const converted = productConverter.toFirestore(normalized as any);
    await setDoc(ref as any, converted as FirebaseFirestore.DocumentData);
    return { success: true, id: productId };
  } catch (error: any) {
    throw new Error(error.message || "Failed to add product");
  }
}

export async function updateMenu(id: string, data: ProductMutationInput) {
  try {
    const ref = doc(id).withConverter(productConverter as any);
    const snap = await ref.get();
    if (!snap.exists) throw new Error(`Product "${id}" not found`);

    const normalized = normalizeProductInput(
      {
        ...((snap.data() as Product) ?? {}),
        ...data,
      },
      id
    );

    const converted = productConverter.toFirestore(normalized as any);
    await setDoc(ref as any, converted as FirebaseFirestore.DocumentData, { merge: true });
    return { success: true };
  } catch (error: any) {
    throw new Error(error.message || "Failed to update product");
  }
}

export async function deleteMenu(id: string) {
  try {
    await adminDb.collection("products").doc(id).delete();
    return { success: true };
  } catch (error: any) {
    throw new Error(error.message || "Failed to delete product");
  }
}
