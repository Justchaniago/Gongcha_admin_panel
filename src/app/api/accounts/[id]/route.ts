import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseServer";
import { Account } from "@/types/firestore";
import { getToken } from "next-auth/jwt";

type Params = { params: Promise<{ id: string }> };

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

// ── GET /api/accounts/[id] ─────────────────────────────────────────────────
export async function GET(req: NextRequest, { params }: Params) {
  // Validasi session
  const validation = await validateSession(req);
  if (validation.error) {
    return NextResponse.json({ message: validation.error }, { status: validation.status });
  }

  try {
    const { id } = await params;
    const snap = await adminDb.collection("accounts").doc(id).get();
    if (!snap.exists) {
      return NextResponse.json({ message: "Akun tidak ditemukan." }, { status: 404 });
    }
    return NextResponse.json({ id: snap.id, ...snap.data() });
  } catch (err) {
    console.error("[GET /api/accounts/:id]", err);
    return NextResponse.json({ message: "Gagal mengambil data akun." }, { status: 500 });
  }
}

// ── PATCH /api/accounts/[id] ─────────────────────────────────────────────────
export async function PATCH(req: NextRequest, { params }: Params) {
  // Validasi session
  const validation = await validateSession(req);
  if (validation.error) {
    return NextResponse.json({ message: validation.error }, { status: validation.status });
  }

  try {
    const { id } = await params;
    const body: Partial<Account> = await req.json();

    const err = validateAccountPayload(body);
    if (err) return NextResponse.json({ message: err }, { status: 400 });

    const docRef = adminDb.collection("accounts").doc(id);
    const snap = await docRef.get();
    if (!snap.exists) {
      return NextResponse.json({ message: "Akun tidak ditemukan." }, { status: 404 });
    }

    const updateData: Partial<Account> = {};
    if (body.name) updateData.name = body.name.trim();
    if (body.email) updateData.email = body.email.toLowerCase().trim();
    if (body.phoneNumber !== undefined) updateData.phoneNumber = body.phoneNumber.trim();
    if (body.role) updateData.role = body.role;
    if (body.status) updateData.status = body.status;
    if (body.notes !== undefined) updateData.notes = body.notes.trim();

    await docRef.update(updateData);
    return NextResponse.json({ id, ...updateData });
  } catch (err) {
    console.error("[PATCH /api/accounts/:id]", err);
    return NextResponse.json({ message: "Gagal memperbarui akun." }, { status: 500 });
  }
}

// ── DELETE /api/accounts/[id] ─────────────────────────────────────────────────
export async function DELETE(req: NextRequest, { params }: Params) {
  // Validasi session
  const validation = await validateSession(req);
  if (validation.error) {
    return NextResponse.json({ message: validation.error }, { status: validation.status });
  }

  try {
    const { id } = await params;
    const docRef = adminDb.collection("accounts").doc(id);
    const snap = await docRef.get();
    if (!snap.exists) {
      return NextResponse.json({ message: "Akun tidak ditemukan." }, { status: 404 });
    }

    await docRef.delete();
    return NextResponse.json({ message: "Akun berhasil dihapus." });
  } catch (err) {
    console.error("[DELETE /api/accounts/:id]", err);
    return NextResponse.json({ message: "Gagal menghapus akun." }, { status: 500 });
  }
}
