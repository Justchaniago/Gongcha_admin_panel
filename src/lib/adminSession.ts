import { cookies } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";

export type AdminPanelRole = "SUPER_ADMIN" | "STAFF";

export type AdminSession = {
  uid: string;
  email: string | null;
  role: AdminPanelRole;
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

export function normalizeAdminRole(rawRole: unknown): AdminPanelRole | null {
  const normalized = String(rawRole ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");

  if (["SUPER_ADMIN", "ADMIN", "MASTER"].includes(normalized)) {
    return "SUPER_ADMIN";
  }

  if (["STAFF", "MANAGER"].includes(normalized)) {
    return "STAFF";
  }

  return null;
}

export function isAdminAuthError(error: unknown): error is AdminAuthError {
  return error instanceof AdminAuthError;
}

export async function getAdminSession(
  options: GetAdminSessionOptions = {},
): Promise<AdminSession> {
  const allowedRoles = options.allowedRoles ?? ["SUPER_ADMIN", "STAFF"];
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
  if (profile.isActive !== true) {
    throw new AdminAuthError("Access denied. Account is inactive.", 403, "ACCOUNT_INACTIVE");
  }

  const role = normalizeAdminRole(profile.role);
  if (!role) {
    throw new AdminAuthError("Access denied. Invalid admin role.", 403, "ROLE_INVALID");
  }

  if (!allowedRoles.includes(role)) {
    throw new AdminAuthError("Access denied. You do not have permission.", 403, "ROLE_FORBIDDEN");
  }

  return {
    uid: claims.uid,
    email: claims.email ?? null,
    role,
    assignedStoreId: profile.assignedStoreId ?? null,
    profile,
    claims,
  };
}
