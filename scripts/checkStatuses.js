const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id,
});

const db = admin.firestore();

async function checkStatuses() {
  try {
    console.log("[Script] Checking all statuses in transactions...");

    const snapshot = await db.collection("transactions").limit(50).get();

    const statuses = new Set();
    snapshot.docs.forEach((doc) => {
      const status = doc.data().status;
      statuses.add(status);
    });

    console.log(`[Script] Found ${snapshot.size} transactions`);
    console.log("[Script] Unique statuses:", Array.from(statuses));

    process.exit(0);
  } catch (error) {
    console.error("[Script] Error:", error);
    process.exit(1);
  }
}

checkStatuses();
