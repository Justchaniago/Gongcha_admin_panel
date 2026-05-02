import { adminDb } from "../src/lib/firebaseAdmin";

const APPLY = process.argv.includes("--apply");

async function main() {
  const snap = await adminDb.collection("users").get();
  let missing = 0;
  let updated = 0;

  const batch = adminDb.batch();
  let batchCount = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    const expected = (data.name || "").toLowerCase();
    if (data.nameLower === expected) continue;

    missing++;
    if (APPLY) {
      batch.update(doc.ref, { nameLower: expected });
      batchCount++;
      // Firestore batch limit is 500
      if (batchCount === 500) {
        await batch.commit();
        batchCount = 0;
        console.log(`  committed batch, ${updated + missing} processed...`);
      }
    }
  }

  if (APPLY && batchCount > 0) {
    await batch.commit();
    updated = missing;
  }

  console.log(`\nTotal users: ${snap.size}`);
  console.log(`Need backfill: ${missing}`);
  if (APPLY) console.log(`Updated: ${updated}`);
  else console.log("Dry run — run with --apply to update");
}

main().catch(console.error);
