import { getAdminSession, type AdminSession } from "@/lib/adminSession";

type AuditPermissionLevel = "none" | "read" | "manage";

export type AuditAccess = {
  canRead: boolean;
  canManage: boolean;
  level: AuditPermissionLevel;
};

function parseAllowlist(raw: string | undefined) {
  return new Set(
    String(raw ?? "")
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean),
  );
}

const READ_UIDS = parseAllowlist(process.env.AUDIT_LOG_READ_ALLOWLIST_UIDS);
const READ_EMAILS = parseAllowlist(process.env.AUDIT_LOG_READ_ALLOWLIST_EMAILS);
const MANAGE_UIDS = parseAllowlist(process.env.AUDIT_LOG_MANAGE_ALLOWLIST_UIDS);
const MANAGE_EMAILS = parseAllowlist(process.env.AUDIT_LOG_MANAGE_ALLOWLIST_EMAILS);

export function getAuditAccessForIdentity(identity: { uid: string; email: string | null }): AuditAccess {
  const email = String(identity.email ?? "").trim().toLowerCase();
  const canManage = MANAGE_UIDS.has(identity.uid.toLowerCase()) || (email ? MANAGE_EMAILS.has(email) : false);
  const canRead = canManage || READ_UIDS.has(identity.uid.toLowerCase()) || (email ? READ_EMAILS.has(email) : false);

  return {
    canRead,
    canManage,
    level: canManage ? "manage" : canRead ? "read" : "none",
  };
}

export function getAuditAccessFromSession(session: AdminSession): AuditAccess {
  return getAuditAccessForIdentity({ uid: session.uid, email: session.email });
}

export async function getAuditSession(required: "read" | "manage" = "read") {
  const session = await getAdminSession({ allowedRoles: ["SUPER_ADMIN", "STAFF"] });
  const access = getAuditAccessFromSession(session);

  if (required === "manage" && !access.canManage) {
    const error = new Error("Access denied. Audit log manage permission is required.");
    (error as Error & { status?: number }).status = 403;
    throw error;
  }

  if (required === "read" && !access.canRead) {
    const error = new Error("Access denied. Audit log access is restricted.");
    (error as Error & { status?: number }).status = 403;
    throw error;
  }

  return { session, access };
}
