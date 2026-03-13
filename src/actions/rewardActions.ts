"use server";

import { adminDb } from "@/lib/firebaseAdmin";
import { Reward, rewardConverter } from "@/types/firestore";
// 🔥 FIX: Import FieldValue untuk Delta Sync
import { FieldValue } from "firebase-admin/firestore";

type RewardMutationInput = {
  title?: string;
  description?: string;
  pointsCost?: number | string;
  imageUrl?: string;
  isAvailable?: boolean;
  category?: string;
  expiryDays?: number | string;
};

function generateRewardId(title: string): string {
  return title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s_-]/g, "")
    .replace(/[\s-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function doc(id: string) {
  return adminDb.collection("rewards_catalog").doc(id);
}

// ============================================================================
// CREATE REWARD
// ============================================================================
export async function createReward(data: RewardMutationInput) {
  try {
    const title = String(data.title ?? "").trim();
    if (!title) throw new Error("Reward title is required");

    const rewardId = generateRewardId(title);
    const ref = doc(rewardId).withConverter(rewardConverter as any);
    
    const existing = await ref.get();
    if (existing.exists) throw new Error(`Reward ID "${rewardId}" is already in use`);

    const payload = {
      title,
      description: String(data.description ?? "").trim(),
      pointsCost: Number(data.pointsCost),
      imageUrl: String(data.imageUrl ?? "").trim(),
      isAvailable: typeof data.isAvailable === "boolean" ? data.isAvailable : true,
      category: String(data.category ?? "Beverage").trim(),
      expiryDays: Number(data.expiryDays || 30),
      // 🔥 DELTA SYNC: Wajib ada Timestamp
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    };

    await ref.set(payload as any);
    return { success: true, id: rewardId };
  } catch (error: any) {
    throw new Error(error.message || "Failed to add reward");
  }
}

// ============================================================================
// UPDATE REWARD
// ============================================================================
export async function updateReward(id: string, data: RewardMutationInput) {
  try {
    const ref = doc(id).withConverter(rewardConverter as any);
    const snap = await ref.get();
    if (!snap.exists) throw new Error(`Reward "${id}" not found`);

    const updates: any = { ...data };
    if (updates.pointsCost) updates.pointsCost = Number(updates.pointsCost);
    if (updates.expiryDays) updates.expiryDays = Number(updates.expiryDays);
    
    // 🔥 DELTA SYNC: Update waktu setiap ada perubahan
    updates.updatedAt = FieldValue.serverTimestamp();

    await ref.update(updates);
    return { success: true };
  } catch (error: any) {
    throw new Error(error.message || "Failed to update reward");
  }
}

// ============================================================================
// DELETE REWARD (SOFT DELETE)
// ============================================================================
export async function deleteReward(id: string) {
  try {
    // 🔥 DELTA SYNC: HARAM .delete(). Pakai Soft Delete agar HP Customer sadar.
    await adminDb.collection("rewards_catalog").doc(id).update({
      isAvailable: false,
      updatedAt: FieldValue.serverTimestamp()
    });
    return { success: true };
  } catch (error: any) {
    throw new Error(error.message || "Failed to delete reward");
  }
}