import * as admin from "firebase-admin";

// Singleton — pastikan hanya init sekali saat Next.js server start
if (!admin.apps.length) {
  // Di production (Vercel), simpan service account sebagai env var JSON string
  // Di local dev, baca dari file path
  const jsonEnv = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const serviceAccount = (jsonEnv && jsonEnv.trim().startsWith("{"))
    ? JSON.parse(jsonEnv)
    : (() => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const fs = require("fs");
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const path = require("path");
        const filePath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH ?? "./serviceAccountKey.json";
        return JSON.parse(fs.readFileSync(path.resolve(filePath), "utf-8"));
      })();

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

export const adminDb = admin.firestore();
export const adminAuth = admin.auth();
