const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

async function fixAdminProfile(uid, email) {
  const db = admin.firestore();

  // Check if document exists
  const doc = await db.collection("admin_users").doc(uid).get();

  if (doc.exists) {
    console.log("✓ admin_users document exists");
    console.log("Data:", doc.data());

    // If exists but isActive is false, fix it
    if (doc.data().isActive === false) {
      await db.collection("admin_users").doc(uid).update({
        isActive: true,
        updatedAt: new Date(),
      });
      console.log("✓ Activated user account");
    }
  } else {
    console.log("✗ admin_users document MISSING - creating it now");
    await db.collection("admin_users").doc(uid).set({
      email: email,
      name: email.split("@")[0],
      role: "SUPER_ADMIN",
      isActive: true,
      assignedStoreId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log("✓ Created admin_users document");
  }
}

// Usage
const uid = process.argv[2]; // Pass as: node fix-admin-profile.js your-uid
const email = process.argv[3]; // Pass as: node fix-admin-profile.js your-uid your-email@example.com

if (!uid || !email) {
  console.error("Usage: node fix-admin-profile.js <uid> <email>");
  process.exit(1);
}

fixAdminProfile(uid, email)
  .then(() => {
    console.log("\n✓ Fix complete! Try logging in again.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });