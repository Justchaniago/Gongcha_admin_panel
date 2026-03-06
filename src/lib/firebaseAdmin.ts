import * as admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

const firestoreDatabaseId = process.env.FIRESTORE_DATABASE_ID || "gongcha-ver001";

function resolveServiceAccount() {
  const base64Key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_BASE64;
  if (base64Key) {
    return JSON.parse(Buffer.from(base64Key, "base64").toString("utf-8"));
  }

  const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (rawJson) {
    return JSON.parse(rawJson);
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (projectId && clientEmail && privateKey) {
    return { projectId, clientEmail, privateKey };
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require("fs");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require("path");
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH ?? "./serviceAccountKey.json";
  return JSON.parse(fs.readFileSync(path.resolve(serviceAccountPath), "utf-8"));
}

const serviceAccount = resolveServiceAccount();

// Inisialisasi yang aman untuk Next.js Hot Reload
const app = admin.apps.length 
  ? admin.app() 
  : admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

// Ekspor Auth & DB dengan melempar 'app' secara eksplisit
export const adminAuth = admin.auth(app);
export const adminDb = getFirestore(app, firestoreDatabaseId);