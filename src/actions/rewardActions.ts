"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";

type RewardPayload = {
  id?: string;
  title: string;
  description?: string;
  pointsRequired: number;
  imageUrl?: string;
  isActive?: boolean;
  category?: "Drink" | "Topping" | "Discount";
};

async function verifySuperAdmin() {
  const cookieStore = await cookies();
  const session = cookieStore.get("session")?.value;
  if (!session) throw new Error("Unauthorized");

  const decoded = await adminAuth.verifySessionCookie(session, true);
  const adminSnap = await adminDb.collection("admin_users").doc(decoded.uid).get();
  const admin = adminSnap.data();
  if (!admin || admin.isActive !== true || admin.role !== "SUPER_ADMIN") {
    throw new Error("Forbidden");
  }
}

function normalizeReward(payload: RewardPayload) {
  const title = payload.title.trim();
  const pointsRequired = Math.floor(Number(payload.pointsRequired));
  if (!title) throw new Error("title is required");
  if (!Number.isFinite(pointsRequired) || pointsRequired < 0) {
    throw new Error("pointsRequired must be a non-negative number");
  }

  return {
    title,
    description: String(payload.description ?? "").trim(),
    pointsRequired,
    imageUrl: String(payload.imageUrl ?? "").trim(),
    isActive: payload.isActive !== false,
    ...(payload.category ? { category: payload.category } : {}),
  };
}

function toId(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s_-]/g, "")
    .replace(/[\s-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export async function upsertRewardAction(payload: RewardPayload) {
  await verifySuperAdmin();
  const normalized = normalizeReward(payload);
  const id = toId(payload.id?.trim() || normalized.title);
  if (!id) throw new Error("Invalid reward id");

  await adminDb.collection("rewards").doc(id).set(
    {
      ...normalized,
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  revalidatePath("/rewards");
  return { success: true, id };
}

export async function blastGlobalPromoAction(input: { title: string; description: string; imageUrl?: string }) {
  await verifySuperAdmin();
  const title = input.title.trim();
  const description = input.description.trim();
  if (!title || !description) throw new Error("title and description are required");

  const id = `${new Date().toISOString().slice(0, 10)}_${toId(title)}`;

  await adminDb.collection("global_promos").doc(id).set({
    title,
    description,
    imageUrl: String(input.imageUrl ?? "").trim(),
    isActive: true,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  revalidatePath("/notifications");
  return { success: true, id };
}
