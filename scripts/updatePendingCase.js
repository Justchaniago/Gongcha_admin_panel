const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id,
});

const db = admin.firestore();

async function updatePendingCase() {
  try {
    console.log("[Script] Starting update of 'PENDING' → 'pending' in Firestore...");

    const snapshot = await db
      .collection("transactions")
      .where("status", "==", "PENDING")
      .get();

    console.log(`[Script] Found ${snapshot.size} transactions with status "PENDING"`);

    let updatedCount = 0;
    const batch = db.batch();

    snapshot.docs.forEach((doc) => {
      batch.update(doc.ref, { status: "pending" });
      updatedCount++;
    });

    if (updatedCount > 0) {
      await batch.commit();
      console.log(`[Script] ✅ Successfully updated ${updatedCount} transactions to "pending"`);
    } else {
      console.log("[Script] ℹ️ No transactions found with status 'PENDING'");
    }

    process.exit(0);
  } catch (error) {
    console.error("[Script] ❌ Error during update:", error);
    process.exit(1);
  }
}

updatePendingCase();
