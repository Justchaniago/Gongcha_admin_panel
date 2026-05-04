import { adminDb } from "../src/lib/firebaseAdmin";
import { normalizeAdminRbac } from "../src/lib/rbac";

const APPLY = process.argv.includes("--apply");

async function main() {
  const snap = await adminDb.collection("admin_users").get();
  let missing = 0;
  let updated = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    const normalized = normalizeAdminRbac(data);
    const hasTargetShape =
      typeof data.accessProfile === "string" &&
      Array.isArray(data.permissions) &&
      data.scope &&
      typeof data.scope.type === "string" &&
      Array.isArray(data.scope.storeIds);

    if (hasTargetShape) {
      console.log(`[ok] ${doc.id} ${data.email ?? ""} role=${normalized?.role ?? data.role}`);
      continue;
    }

    missing++;
    if (!normalized) {
      console.log(`[skip-invalid-role] ${doc.id} ${data.email ?? ""} role=${data.role ?? "<missing>"}`);
      continue;
    }

    const patch = {
      accessProfile: normalized.accessProfile,
      permissions: normalized.permissions,
      scope: normalized.scope,
      updatedAt: new Date().toISOString(),
      rbacMigratedAt: new Date().toISOString(),
    };

    console.log(
      `[${APPLY ? "update" : "dry-run"}] ${doc.id} ${data.email ?? ""} role=${normalized.role} profile=${patch.accessProfile} scope=${patch.scope.type}:${patch.scope.storeIds.join(",")}`,
    );

    if (APPLY) {
      await doc.ref.set(patch, { merge: true });
      updated++;
    }
  }

  console.log(JSON.stringify({ total: snap.size, missing, updated, apply: APPLY }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
