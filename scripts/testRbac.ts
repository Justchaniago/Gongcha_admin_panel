import assert from "node:assert/strict";
import { authorize, normalizeAdminRbac } from "../src/lib/rbac";

const root = normalizeAdminRbac({ role: "SUPER_ADMIN" });
assert(root);
authorize(root, { permission: "settings.update" });

const staff = normalizeAdminRbac({ role: "STAFF", assignedStoreId: "store_a" });
assert(staff);
authorize(staff, { permission: "transaction.verify", resource: { storeId: "store_a" } });
assert.throws(() => authorize(staff, { permission: "transaction.verify", resource: { storeId: "store_b" } }));
assert.throws(() => authorize(staff, { permission: "transaction.delete", resource: { storeId: "store_a" } }));
assert.throws(() => authorize(staff, { permission: "transaction.verify" }));

const marketing = normalizeAdminRbac({ role: "ADMIN", accessProfile: "MARKETING" });
assert(marketing);
authorize(marketing, { permission: "reward.update" });
assert.throws(() => authorize(marketing, { permission: "settings.update" }));

console.log("RBAC helper checks passed");
