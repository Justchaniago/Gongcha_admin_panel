import { cookies } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import {
  normalizeAdminRbac,
  type AccessProfile,
  type AdminPanelRole,
  type Permission,
  type RbacScope,
} from "@/lib/rbac";

export type AdminSession = {
  uid: string;
  email: string | null;
  role: AdminPanelRole;
  accessProfile: AccessProfile;
  permissions: Permission[];
  scope: RbacScope;
  assignedStoreId: string | null;
  profile: FirebaseFirestore.DocumentData;
  claims: Awaited<ReturnType<typeof adminAuth.verifySessionCookie>>;
};

type GetAdminSessionOptions = {
  allowedRoles?: AdminPanelRole[];
};

export class AdminAuthError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 401, code = "UNAUTHORIZED") {
    super(message);
    this.name = "AdminAuthError";
    this.status = status;
    this.code = code;
  }
}

export function isAdminAuthError(error: unknown): error is AdminAuthError {
  return error instanceof AdminAuthError;
}

export async function getAdminSession(
  options: GetAdminSessionOptions = {},
): Promise<AdminSession> {
  const allowedRoles = options.allowedRoles ?? ["SUPER_ADMIN", "ADMIN", "STAFF", "AUDITOR"];
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;

  if (!sessionCookie) {
    throw new AdminAuthError("Session not found. Please login again.", 401, "SESSION_MISSING");
  }

  let claims: Awaited<ReturnType<typeof adminAuth.verifySessionCookie>>;
  try {
    claims = await adminAuth.verifySessionCookie(sessionCookie, true);
  } catch {
    throw new AdminAuthError("Invalid session. Please login again.", 401, "SESSION_INVALID");
  }

  const profileSnap = await adminDb.collection("admin_users").doc(claims.uid).get();
  if (!profileSnap.exists) {
    throw new AdminAuthError("Access denied. Admin profile not found.", 403, "PROFILE_MISSING");
  }

  const profile = profileSnap.data() ?? {};
  // Keep server-side access semantics aligned with client/rules:
  // legacy docs without isActive should be treated as active.
  if (profile.isActive === false) {
    throw new AdminAuthError("Access denied. Account is inactive.", 403, "ACCOUNT_INACTIVE");
  }

  const rbac = normalizeAdminRbac(profile);
  if (!rbac) {
    throw new AdminAuthError("Access denied. Invalid admin role.", 403, "ROLE_INVALID");
  }

  if (!allowedRoles.includes(rbac.role)) {
    throw new AdminAuthError("Access denied. You do not have permission.", 403, "ROLE_FORBIDDEN");
  }

  return {
    uid: claims.uid,
    email: claims.email ?? null,
    role: rbac.role,
    accessProfile: rbac.accessProfile,
    permissions: rbac.permissions,
    scope: rbac.scope,
    assignedStoreId: profile.assignedStoreId ?? null,
    profile,
    claims,
  };
}
