import * as admin from "firebase-admin";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

function initAdmin() {
  if (admin.apps.length) return;
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_BASE64;
  if (!b64) throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY_BASE64 not found");
  const sa = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}

function inferType(value: any): string {
  if (value === null) return "null";
  if (value instanceof admin.firestore.Timestamp) return "Timestamp";
  if (value instanceof admin.firestore.DocumentReference) return "DocumentReference";
  if (Array.isArray(value)) {
    const inner = value.length > 0 ? inferType(value[0]) : "unknown";
    return `Array<${inner}>`;
  }
  if (typeof value === "object") return "map";
  return typeof value;
}

function sampleFields(data: Record<string, any>, depth = 0): Record<string, any> {
  if (depth > 3) return { "...": "truncated" };
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(data)) {
    if (Array.isArray(v)) {
      out[k] = { _type: `Array<${v.length > 0 ? inferType(v[0]) : "unknown"}>`, _sample: v.slice(0, 2) };
    } else if (v instanceof admin.firestore.Timestamp) {
      out[k] = { _type: "Timestamp", _sample: v.toDate().toISOString() };
    } else if (v instanceof admin.firestore.DocumentReference) {
      out[k] = { _type: "DocumentReference", _path: v.path };
    } else if (v !== null && typeof v === "object") {
      out[k] = { _type: "map", _fields: sampleFields(v, depth + 1) };
    } else {
      out[k] = { _type: inferType(v), _sample: v };
    }
  }
  return out;
}

async function inspectCollection(db: admin.firestore.Firestore, colPath: string, depth = 0): Promise<any> {
  const col = db.collection(colPath);
  const snap = await col.limit(5).get();
  if (snap.empty) return { _empty: true, _count: 0 };

  const total = await col.count().get();
  const allFields: Record<string, Set<string>> = {};
  const sampleDocs: any[] = [];

  for (const doc of snap.docs) {
    const data = doc.data();
    sampleDocs.push({ id: doc.id, fields: sampleFields(data) });
    for (const k of Object.keys(data)) {
      if (!allFields[k]) allFields[k] = new Set();
      allFields[k].add(inferType(data[k]));
    }
  }

  // Check subcollections on first doc
  const subcols: Record<string, any> = {};
  if (depth < 2 && snap.docs.length > 0) {
    const subSnaps = await snap.docs[0].ref.listCollections();
    for (const sub of subSnaps) {
      subcols[sub.id] = await inspectCollection(db, `${colPath}/${snap.docs[0].id}/${sub.id}`, depth + 1);
    }
  }

  return {
    _count: total.data().count,
    _fields: Object.fromEntries(Object.entries(allFields).map(([k, v]) => [k, Array.from(v).join(" | ")])),
    _sample: sampleDocs[0]?.fields ?? {},
    ...(Object.keys(subcols).length > 0 ? { _subcollections: subcols } : {}),
  };
}

async function main() {
  initAdmin();
  const db = admin.firestore();
  const dbId = process.env.FIRESTORE_DATABASE_ID ?? "(default)";
  // @ts-ignore
  db.settings({ databaseId: dbId });

  console.log(`Inspecting Firestore database: ${dbId}\n`);

  const rootCols = await db.listCollections();
  const result: Record<string, any> = {};

  for (const col of rootCols) {
    console.log(`  → scanning: ${col.id}`);
    result[col.id] = await inspectCollection(db, col.id);
  }

  console.log("\n=== RESULT JSON ===");
  console.log(JSON.stringify(result, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
