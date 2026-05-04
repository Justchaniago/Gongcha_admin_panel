export type AdminPanelRole = "SUPER_ADMIN" | "ADMIN" | "STAFF" | "AUDITOR";
export type AccessProfile =
  | "ROOT"
  | "OPERATIONS"
  | "MARKETING"
  | "FINANCE"
  | "SUPPORT"
  | "STORE_MANAGER"
  | "READ_ONLY";
export type ScopeType = "GLOBAL" | "STORE";

export type Permission =
  | "dashboard.read"
  | "transaction.read"
  | "transaction.verify"
  | "transaction.reject"
  | "transaction.refund"
  | "transaction.override"
  | "transaction.delete"
  | "member.read"
  | "member.create"
  | "member.update"
  | "member.disable"
  | "points.read"
  | "points.adjust.override"
  | "points.recalculate"
  | "reward.read"
  | "reward.create"
  | "reward.update"
  | "reward.delete"
  | "voucher.read"
  | "voucher.issue"
  | "voucher.cancel"
  | "store.read"
  | "store.create"
  | "store.update"
  | "store.delete"
  | "menu.read"
  | "menu.create"
  | "menu.update"
  | "menu.delete"
  | "staff.read"
  | "staff.create"
  | "staff.update"
  | "staff.disable"
  | "staff.manage_rbac"
  | "settings.read"
  | "settings.update"
  | "audit.read"
  | "audit.manage"
  | "notification.send"
  | "asset.manage";

export type RbacScope = {
  type: ScopeType;
  storeIds: string[];
};

export type NormalizedRbac = {
  role: AdminPanelRole;
  accessProfile: AccessProfile;
  permissions: Permission[];
  scope: RbacScope;
};

export const ALL_PERMISSIONS: Permission[] = [
  "dashboard.read",
  "transaction.read",
  "transaction.verify",
  "transaction.reject",
  "transaction.refund",
  "transaction.override",
  "transaction.delete",
  "member.read",
  "member.create",
  "member.update",
  "member.disable",
  "points.read",
  "points.adjust.override",
  "points.recalculate",
  "reward.read",
  "reward.create",
  "reward.update",
  "reward.delete",
  "voucher.read",
  "voucher.issue",
  "voucher.cancel",
  "store.read",
  "store.create",
  "store.update",
  "store.delete",
  "menu.read",
  "menu.create",
  "menu.update",
  "menu.delete",
  "staff.read",
  "staff.create",
  "staff.update",
  "staff.disable",
  "staff.manage_rbac",
  "settings.read",
  "settings.update",
  "audit.read",
  "audit.manage",
  "notification.send",
  "asset.manage",
];

export const PROFILE_PERMISSIONS: Record<AccessProfile, Permission[]> = {
  ROOT: ALL_PERMISSIONS,
  OPERATIONS: [
    "dashboard.read",
    "transaction.read",
    "transaction.verify",
    "transaction.reject",
    "store.read",
    "store.update",
    "menu.read",
    "menu.update",
    "member.read",
    "member.create",
  ],
  MARKETING: [
    "reward.read",
    "reward.create",
    "reward.update",
    "reward.delete",
    "voucher.read",
    "voucher.issue",
    "voucher.cancel",
    "notification.send",
    "asset.manage",
  ],
  FINANCE: ["dashboard.read", "transaction.read", "transaction.refund", "audit.read"],
  SUPPORT: ["member.read", "transaction.read", "voucher.read", "voucher.issue", "audit.read"],
  STORE_MANAGER: [
    "dashboard.read",
    "transaction.read",
    "transaction.verify",
    "transaction.reject",
    "member.read",
    "store.read",
    "menu.read",
  ],
  READ_ONLY: [
    "dashboard.read",
    "transaction.read",
    "reward.read",
    "voucher.read",
    "store.read",
    "menu.read",
    "audit.read",
  ],
};

const PERMISSION_SET = new Set<string>(ALL_PERMISSIONS);
const ACCESS_PROFILES = new Set<string>(Object.keys(PROFILE_PERMISSIONS));

export class RbacForbiddenError extends Error {
  status = 403;
  code = "RBAC_FORBIDDEN";

  constructor(message = "Access denied. You do not have permission.") {
    super(message);
    this.name = "RbacForbiddenError";
  }
}

export function isRbacForbiddenError(error: unknown): error is RbacForbiddenError {
  return error instanceof RbacForbiddenError;
}

export function normalizeRole(rawRole: unknown): AdminPanelRole | null {
  const normalized = String(rawRole ?? "").trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (["SUPER_ADMIN", "MASTER"].includes(normalized)) return "SUPER_ADMIN";
  if (normalized === "ADMIN") return "ADMIN";
  if (normalized === "AUDITOR") return "AUDITOR";
  if (normalized === "STAFF") return "STAFF";
  if (["MANAGER", "STORE_MANAGER"].includes(normalized)) return "STAFF";
  return null;
}

function normalizeAccessProfile(rawProfile: unknown, role: AdminPanelRole): AccessProfile {
  const normalized = String(rawProfile ?? "").trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (ACCESS_PROFILES.has(normalized)) return normalized as AccessProfile;
  if (role === "SUPER_ADMIN") return "ROOT";
  if (role === "AUDITOR") return "READ_ONLY";
  if (role === "STAFF") return "STORE_MANAGER";
  return "OPERATIONS";
}

function normalizePermissions(rawPermissions: unknown, accessProfile: AccessProfile): Permission[] {
  const explicit = Array.isArray(rawPermissions)
    ? rawPermissions.filter((permission): permission is Permission => PERMISSION_SET.has(String(permission)))
    : [];
  return explicit.length ? Array.from(new Set(explicit)) : PROFILE_PERMISSIONS[accessProfile];
}

function cleanStoreIds(values: unknown[]) {
  return Array.from(
    new Set(
      values
        .map((value) => String(value ?? "").trim())
        .filter(Boolean),
    ),
  );
}

function normalizeScope(rawScope: any, role: AdminPanelRole, accessProfile: AccessProfile, assignedStoreId?: unknown): RbacScope {
  if (role === "SUPER_ADMIN" || accessProfile === "ROOT") {
    return { type: "GLOBAL", storeIds: [] };
  }

  const rawType = String(rawScope?.type ?? "").trim().toUpperCase();
  const rawStoreIds = Array.isArray(rawScope?.storeIds) ? rawScope.storeIds : [];
  const storeIds = cleanStoreIds([...rawStoreIds, assignedStoreId]);

  if (!rawType && (role === "ADMIN" || role === "AUDITOR") && accessProfile !== "STORE_MANAGER") {
    return { type: "GLOBAL", storeIds: [] };
  }

  if (rawType === "GLOBAL") {
    return { type: "GLOBAL", storeIds: [] };
  }

  return { type: "STORE", storeIds };
}

export function normalizeAdminRbac(profile: Record<string, any>): NormalizedRbac | null {
  const role = normalizeRole(profile.role);
  if (!role) return null;
  const accessProfile = normalizeAccessProfile(profile.accessProfile, role);
  return {
    role,
    accessProfile,
    permissions: normalizePermissions(profile.permissions, accessProfile),
    scope: normalizeScope(profile.scope, role, accessProfile, profile.assignedStoreId),
  };
}

export function hasPermission(session: { role: AdminPanelRole; permissions?: string[]; accessProfile?: AccessProfile }, permission: Permission) {
  if (session.role === "SUPER_ADMIN" && session.accessProfile === "ROOT") return true;
  return Array.isArray(session.permissions) && session.permissions.includes(permission);
}

export function isWithinScope(
  session: { role: AdminPanelRole; accessProfile?: AccessProfile; scope?: RbacScope },
  resource?: { storeId?: string | null },
) {
  if (session.role === "SUPER_ADMIN" && session.accessProfile === "ROOT") return true;
  if (!session.scope || session.scope.type === "GLOBAL") return true;

  const storeId = String(resource?.storeId ?? "").trim();
  if (!storeId) return false;
  return session.scope.storeIds.includes(storeId);
}

export function authorize(
  session: { role: AdminPanelRole; accessProfile?: AccessProfile; permissions?: string[]; scope?: RbacScope },
  request: { permission: Permission; resource?: { storeId?: string | null } },
) {
  if (!hasPermission(session, request.permission)) {
    throw new RbacForbiddenError(`Missing permission: ${request.permission}`);
  }
  if (!isWithinScope(session, request.resource)) {
    throw new RbacForbiddenError("Access denied. Resource is outside your assigned scope.");
  }
}
