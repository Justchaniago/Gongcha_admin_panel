const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('../serviceAccountKey.json');

// Initialize Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id,
});

const firestoreDatabaseId = process.env.FIRESTORE_DATABASE_ID || 'gongcha-ver001';
const db = getFirestore(admin.app(), firestoreDatabaseId);

async function updateCompletedToVerified() {
  try {
    console.log("[Script] Starting update of 'COMPLETED' → 'verified' in Firestore...");

    const snapshot = await db
      .collection("transactions")
      .where("status", "==", "COMPLETED")
      .get();

    console.log(`[Script] Found ${snapshot.size} transactions with status "COMPLETED"`);

    let updatedCount = 0;
    const batch = db.batch();

    snapshot.docs.forEach((doc) => {
      batch.update(doc.ref, { status: "verified" });
      updatedCount++;
    });

    if (updatedCount > 0) {
      await batch.commit();
      console.log(`[Script] ✅ Successfully updated ${updatedCount} transactions to "verified"`);
    } else {
      console.log("[Script] ℹ️ No transactions found with status 'COMPLETED'");
    }

    process.exit(0);
  } catch (error) {
    console.error("[Script] ❌ Error during update:", error);
    process.exit(1);
  }
}

updateCompletedToVerified();
