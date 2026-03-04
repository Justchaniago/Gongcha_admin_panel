import { adminDb } from "../src/lib/firebaseAdmin";

async function updateCompletedToVerified() {
  try {
    console.log("[Script] Starting update of 'completed' → 'verified' in Firestore...");

    const snapshot = await adminDb
      .collection("transactions")
      .where("status", "==", "completed")
      .get();

    console.log(`[Script] Found ${snapshot.size} transactions with status "completed"`);

    let updatedCount = 0;
    const batch = adminDb.batch();

    snapshot.docs.forEach((doc) => {
      batch.update(doc.ref, { status: "verified" });
      updatedCount++;
    });

    if (updatedCount > 0) {
      await batch.commit();
      console.log(`[Script] ✅ Successfully updated ${updatedCount} transactions to "verified"`);
    } else {
      console.log("[Script] ℹ️ No transactions found with status 'completed'");
    }
  } catch (error) {
    console.error("[Script] ❌ Error during update:", error);
    process.exit(1);
  }
}

updateCompletedToVerified();
