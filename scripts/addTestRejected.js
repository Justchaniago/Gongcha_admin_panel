const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id,
});

const firestoreDatabaseId = process.env.FIRESTORE_DATABASE_ID || 'gongcha-ver001';
const db = getFirestore(admin.app(), firestoreDatabaseId);

async function addTestRejectedTransactions() {
  try {
    console.log("[Script] Adding test rejected transactions...");

    const batch = db.batch();
    const now = new Date();

    const testTransactions = [
      {
        memberName: "Test User 1",
        amount: 50000,
        potentialPoints: 50,
        type: "earn",
        status: "rejected",
        reason: "POS data not found",
        createdAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
        storeId: "store_tp6",
      },
      {
        memberName: "Test User 2",
        amount: 75000,
        potentialPoints: 75,
        type: "earn",
        status: "rejected",
        reason: "Amount mismatch with POS",
        createdAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
        storeId: "store_tp6",
      },
    ];

    testTransactions.forEach((txData) => {
      const docRef = db.collection("transactions").doc();
      batch.set(docRef, {
        ...txData,
        createdAt: admin.firestore.Timestamp.fromDate(txData.createdAt),
      });
    });

    await batch.commit();
    console.log("[Script] ✅ Added 2 test rejected transactions");
    process.exit(0);
  } catch (error) {
    console.error("[Script] ❌ Error:", error);
    process.exit(1);
  }
}

addTestRejectedTransactions();
