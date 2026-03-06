const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id,
});

const firestoreDatabaseId = process.env.FIRESTORE_DATABASE_ID || 'gongcha-ver001';
const db = getFirestore(admin.app(), firestoreDatabaseId);

async function removeTestRejectedTransactions() {
  try {
    console.log('[Script] Removing test rejected transactions...');

    const testNames = ['Test User 1', 'Test User 2'];
    const snapshot = await db.collection('transactions').where('status', '==', 'rejected').get();

    const targets = snapshot.docs.filter((doc) => {
      const data = doc.data() || {};
      return testNames.includes(data.memberName);
    });

    if (targets.length === 0) {
      console.log('[Script] No matching test transactions found.');
      process.exit(0);
    }

    const batch = db.batch();
    targets.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();

    console.log(`[Script] ✅ Removed ${targets.length} test transaction(s).`);
    process.exit(0);
  } catch (error) {
    console.error('[Script] ❌ Error:', error);
    process.exit(1);
  }
}

removeTestRejectedTransactions();
