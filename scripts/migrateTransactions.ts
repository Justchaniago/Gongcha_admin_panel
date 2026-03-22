import { adminDb, FieldValue } from "../src/lib/firebaseAdmin";

const IS_DRY_RUN = false;
const ROOT_COLLECTION = "transactions";
const STORE_COLLECTION = "stores";
const SUBCOLLECTION_NAME = "transactions";
const MAX_BATCH_OPERATIONS = 500;

type Stats = {
  auditedSubcollectionDocs: number;
  auditedRootDocs: number;
  copiedToRoot: number;
  deletedLegacyDocs: number;
  normalizedRootDocs: number;
  skippedRootConflicts: number;
  skippedNoChanges: number;
  committedBatches: number;
};

type Normalization = {
  uid?: string;
  pointsEarned?: number;
  removeUserId?: boolean;
  removeMemberId?: boolean;
  removePotentialPoints?: boolean;
};

class BatchManager {
  private batch = adminDb.batch();
  private operationCount = 0;

  constructor(private readonly stats: Stats) {}

  async set(
    ref: FirebaseFirestore.DocumentReference<FirebaseFirestore.DocumentData>,
    data: FirebaseFirestore.DocumentData
  ) {
    if (IS_DRY_RUN) return;
    await this.flushIfNeeded(1);
    this.batch.set(ref, data);
    this.operationCount += 1;
  }

  async update(
    ref: FirebaseFirestore.DocumentReference<FirebaseFirestore.DocumentData>,
    data: FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData>
  ) {
    if (IS_DRY_RUN) return;
    await this.flushIfNeeded(1);
    this.batch.update(ref, data);
    this.operationCount += 1;
  }

  async delete(ref: FirebaseFirestore.DocumentReference<FirebaseFirestore.DocumentData>) {
    if (IS_DRY_RUN) return;
    await this.flushIfNeeded(1);
    this.batch.delete(ref);
    this.operationCount += 1;
  }

  async flush() {
    if (IS_DRY_RUN || this.operationCount === 0) return;
    await this.batch.commit();
    this.stats.committedBatches += 1;
    this.batch = adminDb.batch();
    this.operationCount = 0;
  }

  private async flushIfNeeded(nextOps: number) {
    if (this.operationCount + nextOps > MAX_BATCH_OPERATIONS) {
      await this.flush();
    }
  }
}

function normalizeUid(data: FirebaseFirestore.DocumentData): string | null {
  const candidates = [data.uid, data.userId, data.memberId];
  for (const candidate of candidates) {
    const value = String(candidate ?? "").trim();
    if (value) return value;
  }
  return null;
}

function normalizePointsEarned(data: FirebaseFirestore.DocumentData): number | null {
  const raw = data.pointsEarned ?? data.potentialPoints;
  if (raw === undefined || raw === null || raw === "") return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildNormalization(data: FirebaseFirestore.DocumentData): Normalization {
  const normalization: Normalization = {};
  const currentUid = String(data.uid ?? "").trim();
  const legacyUid = normalizeUid(data);

  if (!currentUid && legacyUid) {
    normalization.uid = legacyUid;
    normalization.removeUserId = data.userId !== undefined;
    normalization.removeMemberId = data.memberId !== undefined;
  }

  const hasPointsEarned = Number.isFinite(Number(data.pointsEarned));
  const normalizedPoints = normalizePointsEarned(data);
  if (!hasPointsEarned && normalizedPoints !== null) {
    normalization.pointsEarned = normalizedPoints;
    normalization.removePotentialPoints = data.potentialPoints !== undefined;
  }

  return normalization;
}

function applyNormalizationToClone(data: FirebaseFirestore.DocumentData): FirebaseFirestore.DocumentData {
  const normalized: FirebaseFirestore.DocumentData = { ...data };
  const patch = buildNormalization(data);

  if (patch.uid) {
    normalized.uid = patch.uid;
    delete normalized.userId;
    delete normalized.memberId;
  }

  if (patch.pointsEarned !== undefined) {
    normalized.pointsEarned = patch.pointsEarned;
    delete normalized.potentialPoints;
  }

  return normalized;
}

function buildRootUpdate(data: FirebaseFirestore.DocumentData) {
  const patch = buildNormalization(data);
  const update: FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData> = {};

  if (patch.uid) {
    update.uid = patch.uid;
    if (patch.removeUserId) update.userId = FieldValue.delete();
    if (patch.removeMemberId) update.memberId = FieldValue.delete();
  }

  if (patch.pointsEarned !== undefined) {
    update.pointsEarned = patch.pointsEarned;
    if (patch.removePotentialPoints) update.potentialPoints = FieldValue.delete();
  }

  return { patch, update };
}

function hasUpdatePayload(update: FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData>) {
  return Object.keys(update).length > 0;
}

function isLegacyStoreTransactionPath(path: string) {
  const parts = path.split("/");
  return parts.length === 4 && parts[0] === STORE_COLLECTION && parts[2] === SUBCOLLECTION_NAME;
}

async function migrateLegacySubcollections(stats: Stats, batches: BatchManager) {
  const snap = await adminDb.collectionGroup(SUBCOLLECTION_NAME).get();

  for (const doc of snap.docs) {
    if (!isLegacyStoreTransactionPath(doc.ref.path)) continue;

    stats.auditedSubcollectionDocs += 1;

    const rootRef = adminDb.collection(ROOT_COLLECTION).doc(doc.id);
    const rootSnap = await rootRef.get();
    const normalizedData = applyNormalizationToClone(doc.data());

    if (rootSnap.exists) {
      stats.skippedRootConflicts += 1;
      console.warn(`[conflict] Root transaction already exists, skipped legacy copy: ${doc.ref.path} -> ${rootRef.path}`);
      continue;
    }

    console.log(`[migrate] ${doc.ref.path} -> ${rootRef.path}`);
    stats.copiedToRoot += 1;
    stats.deletedLegacyDocs += 1;

    await batches.set(rootRef, normalizedData);
    await batches.delete(doc.ref);
  }
}

async function normalizeRootTransactions(stats: Stats, batches: BatchManager) {
  const snap = await adminDb.collection(ROOT_COLLECTION).get();

  for (const doc of snap.docs) {
    stats.auditedRootDocs += 1;

    const { update } = buildRootUpdate(doc.data());
    if (!hasUpdatePayload(update)) {
      stats.skippedNoChanges += 1;
      continue;
    }

    console.log(`[normalize] ${doc.ref.path}`, update);
    stats.normalizedRootDocs += 1;
    await batches.update(doc.ref, update);
  }
}

async function main() {
  const stats: Stats = {
    auditedSubcollectionDocs: 0,
    auditedRootDocs: 0,
    copiedToRoot: 0,
    deletedLegacyDocs: 0,
    normalizedRootDocs: 0,
    skippedRootConflicts: 0,
    skippedNoChanges: 0,
    committedBatches: 0,
  };

  console.log("==================================================");
  console.log("Transactions Migration");
  console.log("==================================================");
  console.log(`Database: ${process.env.FIRESTORE_DATABASE_ID ?? "(default)"}`);
  console.log(`Dry run : ${IS_DRY_RUN ? "YES" : "NO"}`);
  console.log("");

  const batches = new BatchManager(stats);

  await migrateLegacySubcollections(stats, batches);
  await normalizeRootTransactions(stats, batches);
  await batches.flush();

  console.log("");
  console.log("Migration summary");
  console.log("--------------------------------------------------");
  console.log(`Audited legacy subcollection docs : ${stats.auditedSubcollectionDocs}`);
  console.log(`Audited root transaction docs     : ${stats.auditedRootDocs}`);
  console.log(`Copied to root                    : ${stats.copiedToRoot}`);
  console.log(`Deleted legacy docs               : ${stats.deletedLegacyDocs}`);
  console.log(`Normalized root docs              : ${stats.normalizedRootDocs}`);
  console.log(`Skipped root conflicts            : ${stats.skippedRootConflicts}`);
  console.log(`Skipped no changes                : ${stats.skippedNoChanges}`);
  console.log(`Committed batches                 : ${stats.committedBatches}`);

  if (IS_DRY_RUN) {
    console.log("");
    console.log("Dry run complete. No database writes were performed.");
    console.log("Set IS_DRY_RUN = false to execute the migration.");
  }
}

main().catch((error) => {
  console.error("Transaction migration failed:", error);
  process.exit(1);
});
