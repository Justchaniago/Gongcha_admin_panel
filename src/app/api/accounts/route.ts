import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseServer";
import { Account } from "@/types/firestore";
import { getToken } from "next-auth/jwt";

// Helper untuk validasi session
async function validateSession(req: NextRequest) {
  const token = await getToken({ 
    req, 
    secret: process.env.NEXTAUTH_SECRET,
    secureCookie: process.env.NODE_ENV === "production"
  });
  
  if (!token) {
    return { error: "Session tidak ditemukan. Silakan login ulang.", status: 403 };
  }
  
  const userRole = token.role as string;
  // Hanya admin dan master yang bisa akses accounts
  if (!['admin', 'master'].includes(userRole)) {
    return { error: "Akses ditolak. Anda tidak memiliki izin.", status: 403 };
  }
  
  return { token, userRole, error: null };
}

// ── Validation ────────────────────────────────────────────────────────────────
function validateAccountPayload(body: Partial<Account>): string | null {
  if (!body.name?.trim())  return "Nama tidak boleh kosong.";
  if (!body.email?.trim()) return "Email tidak boleh kosong.";
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRe.test(body.email)) return "Format email tidak valid.";
  const validRoles   = ["master", "admin", "manager", "viewer"];
  const validStatuses = ["active", "suspended", "pending"];
  if (body.role   && !validRoles.includes(body.role))     return "Role tidak valid.";
  if (body.status && !validStatuses.includes(body.status)) return "Status tidak valid.";
  return null;
}

// ── GET /api/accounts — list all (fallback if onSnapshot unavailable) ─────────
export async function GET(req: NextRequest) {
  // Validasi session
  const validation = await validateSession(req);
  if (validation.error) {
    return NextResponse.json({ message: validation.error }, { status: validation.status });
  }

  try {
    const snap = await adminDb.collection("accounts").orderBy("createdAt", "desc").get();
    const accounts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return NextResponse.json({ accounts });
  } catch (err) {
    console.error("[GET /api/accounts]", err);
    return NextResponse.json({ message: "Gagal mengambil data akun." }, { status: 500 });
  }
}

// ── POST /api/accounts — create new account ───────────────────────────────────
export async function POST(req: NextRequest) {
  // Validasi session
  const validation = await validateSession(req);
  if (validation.error) {
    return NextResponse.json({ message: validation.error }, { status: validation.status });
  }

  try {
    const body: Partial<Account> = await req.json();

    const err = validateAccountPayload(body);
    if (err) return NextResponse.json({ message: err }, { status: 400 });

    // Check for duplicate email
    const existing = await adminDb
      .collection("accounts")
      .where("email", "==", body.email!.toLowerCase().trim())
      .limit(1)
      .get();

    if (!existing.empty) {
      return NextResponse.json({ message: "Email sudah terdaftar." }, { status: 409 });
    }

    const now = new Date().toISOString();
    const payload: Omit<Account, "id"> = {
      name:        body.name!.trim(),
      email:       body.email!.toLowerCase().trim(),
      phoneNumber: body.phoneNumber?.trim() ?? "",
      role:        body.role        ?? "viewer",
      status:      body.status      ?? "active",
      notes:       body.notes?.trim() ?? "",
      createdAt:   now,
      lastLogin:   null,
    };

    const docRef = await adminDb.collection("accounts").add(payload);
    return NextResponse.json({ id: docRef.id, ...payload }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/accounts]", err);
    return NextResponse.json({ message: "Gagal membuat akun." }, { status: 500 });
  }
}
