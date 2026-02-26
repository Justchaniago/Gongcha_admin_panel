"use server";
import { adminDb } from "@/lib/firebaseAdmin";

export async function createMenu(data: any) {
  try {
    const docRef = await adminDb.collection("products").add({
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    return { success: true, id: docRef.id };
  } catch (error: any) {
    throw new Error(error.message || "Gagal menambah produk");
  }
}

export async function updateMenu(id: string, data: any) {
  try {
    await adminDb.collection("products").doc(id).update({
      ...data,
      updatedAt: new Date().toISOString(),
    });
    return { success: true };
  } catch (error: any) {
    throw new Error(error.message || "Gagal mengupdate produk");
  }
}

export async function deleteMenu(id: string) {
  try {
    await adminDb.collection("products").doc(id).delete();
    return { success: true };
  } catch (error: any) {
    throw new Error(error.message || "Gagal menghapus produk");
  }
}
