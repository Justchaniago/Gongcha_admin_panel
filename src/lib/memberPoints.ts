import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "@/lib/firebaseAdmin";

const SETTINGS_DOC = "settings/global";

const DEFAULT_REWARD_SETTINGS = {
  tiers: {
    silver: { minPoints: 0, label: "Silver" },
    gold: { minPoints: 10000, label: "Gold" },
    platinum: { minPoints: 50000, label: "Platinum" },
  },
};

type MemberResolution = {
  ref: FirebaseFirestore.DocumentReference<FirebaseFirestore.DocumentData>;
  uid: string;
  via: "docId" | "uidField" | "email" | "phoneNumber" | "phone";
};

export class MemberPointsError extends Error {
  code: string;
  details?: Record<string, unknown>;

  constructor(message: string, code = "MEMBER_POINTS_ERROR", details?: Record<string, unknown>) {
    super(message);
    this.name = "MemberPointsError";
    this.code = code;
    this.details = details;
  }
}

function asCleanString(value: unknown): string | null {
  const normalized = String(value ?? "").trim();
  if (!normalized) return null;
  if (["null", "undefined", "-", "guest", "anonymous"].includes(normalized.toLowerCase())) return null;
  return normalized;
}

function uniqueStrings(values: Array<unknown>) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = asCleanString(value);
    if (!normalized) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

function collectMemberCandidates(txData: FirebaseFirestore.DocumentData) {
  return uniqueStrings([
    txData.userId,
    txData.memberId,
    txData.uid,
    txData.memberUid,
    txData.userUid,
    txData.customerUid,
  ]);
}

function collectEmailCandidates(txData: FirebaseFirestore.DocumentData) {
  return uniqueStrings([
    txData.email,
    txData.userEmail,
    txData.memberEmail,
    txData.customerEmail,
  ]).map((value) => value.toLowerCase());
}

function collectPhoneCandidates(txData: FirebaseFirestore.DocumentData) {
  return uniqueStrings([
    txData.phone,
    txData.phoneNumber,
    txData.memberPhone,
    txData.customerPhone,
  ]);
}

async function resolveMemberDocument(txData: FirebaseFirestore.DocumentData): Promise<MemberResolution | null> {
  const idCandidates = collectMemberCandidates(txData);
  for (const candidate of idCandidates) {
    const ref = adminDb.collection("users").doc(candidate);
    const snap = await ref.get();
    if (snap.exists) {
      return { ref, uid: snap.id, via: "docId" };
    }
  }

  for (const candidate of idCandidates) {
    const snap = await adminDb.collection("users").where("uid", "==", candidate).limit(1).get();
    if (!snap.empty) {
      return { ref: snap.docs[0].ref, uid: snap.docs[0].id, via: "uidField" };
    }
  }

  for (const email of collectEmailCandidates(txData)) {
    const snap = await adminDb.collection("users").where("email", "==", email).limit(1).get();
    if (!snap.empty) {
      return { ref: snap.docs[0].ref, uid: snap.docs[0].id, via: "email" };
    }
  }

  for (const phone of collectPhoneCandidates(txData)) {
    const byPhoneNumber = await adminDb.collection("users").where("phoneNumber", "==", phone).limit(1).get();
    if (!byPhoneNumber.empty) {
      return { ref: byPhoneNumber.docs[0].ref, uid: byPhoneNumber.docs[0].id, via: "phoneNumber" };
    }

    const byPhone = await adminDb.collection("users").where("phone", "==", phone).limit(1).get();
    if (!byPhone.empty) {
      return { ref: byPhone.docs[0].ref, uid: byPhone.docs[0].id, via: "phone" };
    }
  }

  return null;
}

async function loadTierRules() {
  const snap = await adminDb.doc(SETTINGS_DOC).get();
  const settings = snap.exists ? { ...DEFAULT_REWARD_SETTINGS, ...snap.data() } : DEFAULT_REWARD_SETTINGS;
  const tiers = settings.tiers ?? DEFAULT_REWARD_SETTINGS.tiers;

  return [
    { minPoints: Number(tiers.silver?.minPoints ?? 0), label: String(tiers.silver?.label ?? "Silver") },
    { minPoints: Number(tiers.gold?.minPoints ?? 10000), label: String(tiers.gold?.label ?? "Gold") },
    { minPoints: Number(tiers.platinum?.minPoints ?? 50000), label: String(tiers.platinum?.label ?? "Platinum") },
  ].sort((a, b) => a.minPoints - b.minPoints);
}

function deriveTier(totalTierXp: number, tierRules: Array<{ minPoints: number; label: string }>) {
  let resolvedTier = tierRules[0]?.label ?? "Silver";
  for (const rule of tierRules) {
    if (totalTierXp >= rule.minPoints) {
      resolvedTier = rule.label;
    }
  }
  return resolvedTier;
}

function getPointsToAdd(txData: FirebaseFirestore.DocumentData) {
  return Number(txData.potentialPoints ?? txData.pointsEarned ?? 0);
}

export async function applyTransactionReward(params: {
  txRef: FirebaseFirestore.DocumentReference<FirebaseFirestore.DocumentData>;
  txData: FirebaseFirestore.DocumentData;
  txId: string;
  verifiedBy: string;
  verifiedAt: string | FirebaseFirestore.Timestamp;
  nextStatus: "COMPLETED" | "CANCELLED";
  failureReason?: string;
}) {
  const { txRef, txData, txId, verifiedBy, verifiedAt, nextStatus, failureReason } = params;

  if (nextStatus !== "COMPLETED") {
    await txRef.update({
      status: nextStatus,
      verifiedAt,
      verifiedBy,
      ...(failureReason ? { reason: failureReason, needsManualReview: true } : {}),
    });
    return {
      memberUid: null,
      memberResolution: null,
      pointsAdded: 0,
      tier: null,
    };
  }

  const pointsToAdd = getPointsToAdd(txData);
  const memberResolution = await resolveMemberDocument(txData);
  const memberCandidates = collectMemberCandidates(txData);
  let resolvedTier: string | null = null;

  if (!memberResolution && pointsToAdd > 0) {
    throw new MemberPointsError(
      "Transaction could not be verified because the related member could not be resolved to users/{uid}.",
      "MEMBER_NOT_RESOLVED",
      {
        txId,
        receiptNumber: txData.receiptNumber ?? txData.posTransactionId ?? txData.transactionId ?? txId,
        candidates: memberCandidates,
      },
    );
  }

  const tierRules = await loadTierRules();

  await adminDb.runTransaction(async (transaction) => {
    const freshTxSnap = await transaction.get(txRef);
    if (!freshTxSnap.exists) {
      throw new MemberPointsError("Transaction document no longer exists.", "TRANSACTION_NOT_FOUND", { txId, path: txRef.path });
    }

    const freshTxData = freshTxSnap.data() ?? {};
    const currentStatus = String(freshTxData.status ?? "").toUpperCase();
    if (currentStatus && currentStatus !== "PENDING") {
      throw new MemberPointsError(
        `Transaction already has status "${freshTxData.status}".`,
        "TRANSACTION_ALREADY_PROCESSED",
        { txId, path: txRef.path, status: freshTxData.status },
      );
    }

    transaction.update(txRef, {
      status: nextStatus,
      verifiedAt,
      verifiedBy,
      ...(failureReason ? { reason: failureReason, needsManualReview: true } : {}),
    });

    if (!memberResolution || pointsToAdd <= 0) {
      return;
    }

    const memberSnap = await transaction.get(memberResolution.ref);
    if (!memberSnap.exists) {
      throw new MemberPointsError(
        "Resolved member document no longer exists.",
        "MEMBER_NOT_FOUND",
        { txId, memberUid: memberResolution.uid, via: memberResolution.via },
      );
    }

    const memberData = memberSnap.data() ?? {};
    const currentPoints = Number(memberData.currentPoints ?? memberData.points ?? 0);
    const lifetimePoints = Number(memberData.lifetimePoints ?? memberData.xp ?? 0);
    const tierXp = Number(memberData.tierXp ?? memberData.lifetimePoints ?? memberData.xp ?? 0);

    const nextCurrentPoints = currentPoints + pointsToAdd;
    const nextLifetimePoints = lifetimePoints + pointsToAdd;
    const nextTierXp = tierXp + pointsToAdd;
    const nextTier = deriveTier(nextTierXp, tierRules);
    resolvedTier = nextTier;

    const xpEntry = {
      id: `${txId}_${Date.now()}`,
      date: new Date().toISOString(),
      amount: pointsToAdd,
      type: "earn",
      status: "verified",
      context: `Transaction ${txData.receiptNumber ?? txData.posTransactionId ?? txData.transactionId ?? txId}`,
      location: txData.storeName ?? txData.storeLocation ?? txData.storeId ?? "-",
      transactionId: txData.receiptNumber ?? txData.posTransactionId ?? txData.transactionId ?? txId,
    };

    transaction.set(
      memberResolution.ref,
      {
        currentPoints: nextCurrentPoints,
        lifetimePoints: nextLifetimePoints,
        tierXp: nextTierXp,
        tier: nextTier,
        // Legacy mirrors kept in sync for older parts of the app/admin.
        points: nextCurrentPoints,
        xp: nextLifetimePoints,
        xpHistory: FieldValue.arrayUnion(xpEntry),
        pointsLastUpdatedAt: new Date().toISOString(),
        pointsLastUpdatedBy: verifiedBy,
        updatedAt: new Date().toISOString(),
        lastRewardTransactionId: txId,
      },
      { merge: true },
    );
  });

  return {
    memberUid: memberResolution?.uid ?? null,
    memberResolution: memberResolution?.via ?? null,
    pointsAdded: pointsToAdd,
    tier: resolvedTier,
  };
}

export function getTransactionMemberReference(txData: FirebaseFirestore.DocumentData) {
  return {
    idCandidates: collectMemberCandidates(txData),
    emailCandidates: collectEmailCandidates(txData),
    phoneCandidates: collectPhoneCandidates(txData),
  };
}
