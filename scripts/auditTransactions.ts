import { adminDb } from "../src/lib/firebaseAdmin";

const PRIMARY_COLLECTION = "transactions";
const LEGACY_TYPO_COLLECTION = "transactions ";
const DAILY_STATS_COLLECTION = "daily_stats";

type Args = {
  apply: boolean;
  deleteSource: boolean;
};

function parseArgs(argv: string[]): Args {
  const flags = new Set(argv.slice(2));
  return {
    apply: flags.has("--apply"),
    deleteSource: flags.has("--delete-source"),
  };
}

function safeDate(value: unknown): string | null {
  if (value && typeof value === "object" && "toDate" in (value as Record<string, unknown>)) {
    const date = (value as { toDate?: () => Date }).toDate?.();
    return date instanceof Date ? date.toISOString() : null;
  }
  if (typeof value === "string") return value;
  return null;
}

function isLikelyTransaction(data: FirebaseFirestore.DocumentData): boolean {
  const keys = [
    "receiptNumber",
    "transactionId",
    "posTransactionId",
    "memberId",
    "userId",
    "storeId",
    "potentialPoints",
    "status",
    "type",
  ];
  return keys.some((key) => {
    const value = data[key];
    return value !== undefined && value !== null && String(value).trim() !== "";
  });
}

function summarizeDoc(
  collection: string,
  snap: FirebaseFirestore.QueryDocumentSnapshot<FirebaseFirestore.DocumentData>
) {
  const data = snap.data();
  return {
    collection,
    id: snap.id,
    receiptNumber: data.receiptNumber ?? data.posTransactionId ?? data.transactionId ?? null,
    type: data.type ?? null,
    status: data.status ?? null,
    totalAmount: data.totalAmount ?? data.amount ?? null,
    storeId: data.storeId ?? null,
    createdAt: safeDate(data.createdAt),
    likelyTransaction: isLikelyTransaction(data),
  };
}

async function main() {
  const args = parseArgs(process.argv);

  const [primarySnap, typoSnap, dailyStatsSnap] = await Promise.all([
    adminDb.collection(PRIMARY_COLLECTION).get(),
    adminDb.collection(LEGACY_TYPO_COLLECTION).get(),
    adminDb.collection(DAILY_STATS_COLLECTION).limit(10).get(),
  ]);

  console.log("Firestore transaction audit");
  console.log(JSON.stringify({
    primaryCollection: PRIMARY_COLLECTION,
    primaryCount: primarySnap.size,
    typoCollection: LEGACY_TYPO_COLLECTION,
    typoCount: typoSnap.size,
    dailyStatsCollection: DAILY_STATS_COLLECTION,
    dailyStatsCount: dailyStatsSnap.size,
    apply: args.apply,
    deleteSource: args.deleteSource,
  }, null, 2));

  if (!typoSnap.empty) {
    console.log("\nDocuments in typo collection:");
    typoSnap.docs.forEach((doc) => {
      console.log(JSON.stringify(summarizeDoc(LEGACY_TYPO_COLLECTION, doc), null, 2));
    });
  }

  if (!dailyStatsSnap.empty) {
    console.log("\nSample daily_stats documents:");
    dailyStatsSnap.docs.forEach((doc) => {
      const data = doc.data();
      console.log(JSON.stringify({
        id: doc.id,
        date: data.date ?? null,
        type: data.type ?? null,
        storeId: data.storeId ?? null,
        totalRevenue: data.totalRevenue ?? null,
        totalTransactions: data.totalTransactions ?? null,
      }, null, 2));
    });
  }

  const candidates = typoSnap.docs.filter((doc) => isLikelyTransaction(doc.data()));
  const skipped = typoSnap.docs.filter((doc) => !isLikelyTransaction(doc.data()));

  console.log(`\nValid migration candidates: ${candidates.length}`);
  console.log(`Skipped malformed/test docs: ${skipped.length}`);

  if (!args.apply) {
    console.log("\nDry run only. Re-run with --apply to migrate valid docs.");
    console.log("Add --delete-source to remove migrated docs from the typo collection.");
    return;
  }

  for (const doc of candidates) {
    const targetRef = adminDb.collection(PRIMARY_COLLECTION).doc(doc.id);
    const targetSnap = await targetRef.get();

    if (targetSnap.exists) {
      console.log(`SKIP existing target: ${doc.id}`);
      continue;
    }

    await targetRef.set(doc.data());
    console.log(`MIGRATED ${LEGACY_TYPO_COLLECTION}/${doc.id} -> ${PRIMARY_COLLECTION}/${doc.id}`);

    if (args.deleteSource) {
      await doc.ref.delete();
      console.log(`DELETED source ${LEGACY_TYPO_COLLECTION}/${doc.id}`);
    }
  }

  if (skipped.length > 0) {
    console.log("\nSkipped docs still need manual review before deletion:");
    skipped.forEach((doc) => console.log(`- ${LEGACY_TYPO_COLLECTION}/${doc.id}`));
  }
}

main().catch((error) => {
  console.error("Transaction audit failed:", error);
  process.exit(1);
});
