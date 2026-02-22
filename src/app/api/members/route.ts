import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseServer";
import * as admin from "firebase-admin";
import { User, UserRole, UserTier } from "@/types/firestore";
import { getToken } from "next-auth/jwt";

interface CreateMemberBody {
  name:        string;
  email:       string;
  phoneNumber?: string;
  tier?:       UserTier;
  role?:       UserRole;
  password:    string;
}

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
  // Hanya admin dan master yang bisa create member
  if (!['admin', 'master'].includes(userRole)) {
    return { error: "Akses ditolak. Anda tidak memiliki izin.", status: 403 };
  }
  
  return { token, userRole, error: null };
}

// ── POST /api/members — create Firebase Auth user + Firestore doc ────────────
export async function POST(req: NextRequest) {
  // Validasi session
  const validation = await validateSession(req);
  if (validation.error) {
    return NextResponse.json({ message: validation.error }, { status: validation.status });
  }

  try {
    const body: CreateMemberBody = await req.json();

    // Validate
    if (!body.name?.trim())     return NextResponse.json({ message: "Nama tidak boleh kosong." },     { status: 400 });
    if (!body.email?.trim())    return NextResponse.json({ message: "Email tidak boleh kosong." },    { status: 400 });
    if (!body.password)         return NextResponse.json({ message: "Password tidak boleh kosong." }, { status: 400 });
    if (body.password.length < 8) return NextResponse.json({ message: "Password minimal 8 karakter." }, { status: 400 });

    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRe.test(body.email)) return NextResponse.json({ message: "Format email tidak valid." }, { status: 400 });

    // Create Firebase Auth user
    let authUser: admin.auth.UserRecord;
    try {
      authUser = await admin.auth().createUser({
        email:       body.email.toLowerCase().trim(),
        password:    body.password,
        displayName: body.name.trim(),
      });
    } catch (authErr: unknown) {
      const code = (authErr as { code?: string }).code;
      if (code === "auth/email-already-exists") {
        return NextResponse.json({ message: "Email sudah terdaftar di Firebase Auth." }, { status: 409 });
      }
      throw authErr;
    }

    const now = new Date().toISOString();
    const userData: User & { uid: string } = {
      name:           body.name.trim(),
      email:          body.email.toLowerCase().trim(),
      phoneNumber:    body.phoneNumber?.trim() ?? "",
      photoURL:       "",
      role:           body.role ?? "member",
      tier:           body.tier ?? "Silver",
      currentPoints:  0,
      lifetimePoints: 0,
      joinedDate:     now,
      xpHistory:      [],
      vouchers:       [],
      uid:            authUser.uid,
    };

    // Write Firestore doc with same UID as Auth user
    await adminDb.collection("users").doc(authUser.uid).set(userData);

    return NextResponse.json(userData, { status: 201 });
  } catch (err) {
    console.error("[POST /api/members]", err);
    return NextResponse.json({ message: "Gagal membuat member." }, { status: 500 });
  }
}
