import * as admin from "firebase-admin";
import * as dotenv from "dotenv";

dotenv.config({ path: require("path").resolve(process.cwd(), ".env.local") });

if (!admin.apps.length) {
  const base64Key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_BASE64;
  if (!base64Key) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY_BASE64 env var not set.");
  }
  const serviceAccount = JSON.parse(
    Buffer.from(base64Key, "base64").toString("utf-8")
  );
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

export const adminDb = admin.firestore();
export const FieldValue = admin.firestore.FieldValue;
export const Timestamp = admin.firestore.Timestamp;
export const adminAuth = admin.auth();
