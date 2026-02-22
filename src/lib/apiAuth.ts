// src/lib/apiAuth.ts
// Uses next-auth/jwt getToken — correctly handles NextAuth's JWE-encrypted session tokens.

import { getToken } from "next-auth/jwt";
import { NextRequest } from "next/server";

export interface ApiToken {
  uid:   string;
  role:  string;
  email: string;
  name:  string;
  sub:   string;
  [key: string]: unknown;
}

/**
 * Reads and verifies the NextAuth session cookie using next-auth/jwt getToken.
 * Returns the decoded token payload, or null if missing/invalid.
 */
export async function getApiToken(req: NextRequest): Promise<ApiToken | null> {
  try {
    const token = await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET,
    });
    if (!token) return null;
    return token as unknown as ApiToken;
  } catch {
    return null;
  }
}

/**
 * Convenience: returns token or throws a 401 Response.
 * Usage: const token = await requireAuth(req);
 */
export async function requireAuth(req: NextRequest): Promise<ApiToken> {
  const token = await getApiToken(req);
  if (!token) {
    throw Object.assign(new Error("Session tidak ditemukan. Silakan login ulang."), { status: 401 });
  }
  return token;
}

/**
 * Convenience: returns token only if role is admin/master, else throws 403.
 */
export async function requireAdmin(req: NextRequest): Promise<ApiToken> {
  const token = await requireAuth(req);
  const role = token.role as string;
  if (!["admin", "master"].includes(role)) {
    throw Object.assign(new Error("Hanya admin yang dapat mengakses fitur ini."), { status: 403 });
  }
  return token;
}
