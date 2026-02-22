// scripts/migrateAddUidToUsers.ts
// Jalankan: npx ts-node scripts/migrateAddUidToUsers.ts
import admin from 'firebase-admin';
import serviceAccount from '../serviceAccountKey.json';

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as any),
});

const db = admin.firestore();

async function migrate() {
  const usersSnap = await db.collection('users').get();
  let updated = 0;
  for (const doc of usersSnap.docs) {
    const data = doc.data();
    if (!data.uid || data.uid !== doc.id) {
      await doc.ref.update({ uid: doc.id });
      updated++;
      console.log(`Updated user ${doc.id}`);
    }
  }
  console.log(`Done. Updated ${updated} users.`);
  process.exit(0);
}

migrate().catch(e => { console.error(e); process.exit(1); });
