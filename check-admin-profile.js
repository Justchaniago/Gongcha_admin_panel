const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

async function checkAdminProfile(uid) {
  const db = admin.firestore();

  console.log("🔍 Checking admin_users document for UID:", uid);

  try {
    const doc = await db.collection("admin_users").doc(uid).get();

    if (doc.exists) {
      const data = doc.data();
      console.log("✓ admin_users document EXISTS");
      console.log("  Email:", data.email);
      console.log("  Name:", data.name);
      console.log("  Role:", data.role);
      console.log("  isActive:", data.isActive);
      console.log("  assignedStoreId:", data.assignedStoreId);

      if (data.isActive !== true) {
        console.log("⚠️  WARNING: isActive is not true - user cannot access admin panel");
        return false;
      }

      console.log("✓ Profile looks good for admin access");
      return true;
    } else {
      console.log("✗ admin_users document MISSING");
      console.log("  This is why the store page is not live!");
      console.log("  Run: node fix-admin-profile.js", uid, "your-email@example.com");
      return false;
    }
  } catch (error) {
    console.error("❌ Error checking admin profile:", error);
    return false;
  }
}

// Usage
const uid = process.argv[2];

if (!uid) {
  console.error("Usage: node check-admin-profile.js <uid>");
  console.error("Get UID from Firebase Auth Console or browser console: firebase.auth().currentUser.uid");
  process.exit(1);
}

checkAdminProfile(uid)
  .then((ok) => {
    if (!ok) {
      console.log("\n🔧 To fix: Run the fix script with your email");
    }
    process.exit(ok ? 0 : 1);
  })
  .catch((err) => {
    console.error("Script error:", err);
    process.exit(1);
  });