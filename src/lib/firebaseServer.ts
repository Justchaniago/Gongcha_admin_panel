import * as admin from "firebase-admin";
import { getFirestore as getAdminFirestore } from "firebase-admin/firestore";

// Singleton — ensure only init once when Next.js server starts
if (!admin.apps.length) {
  // In production (Vercel), save service account as env var JSON string
  // In local dev, read from file path
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)
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

const rawFirestoreDatabaseId = process.env.FIRESTORE_DATABASE_ID?.trim();
const firestoreDatabaseId =
  rawFirestoreDatabaseId &&
  rawFirestoreDatabaseId !== "default" &&
  rawFirestoreDatabaseId !== "(default)"
    ? rawFirestoreDatabaseId
    : undefined;
export const adminDb = firestoreDatabaseId
  ? getAdminFirestore(admin.app(), firestoreDatabaseId)
  : getAdminFirestore(admin.app());
export const adminAuth = admin.auth();
