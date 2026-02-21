import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseServer";
import * as admin from "firebase-admin";
import { Staff, StaffRole } from "@/types/firestore";

interface CreateStaffBody {
  name:          string;
  email:         string;
  role?:         StaffRole;
  storeLocation?: string;
  password:      string;
}

// ── POST /api/staff — create Firebase Auth user + Firestore staff doc ────────
export async function POST(req: NextRequest) {
  try {
    const body: CreateStaffBody = await req.json();

    if (!body.name?.trim())     return NextResponse.json({ message: "Nama tidak boleh kosong." },     { status: 400 });
    if (!body.email?.trim())    return NextResponse.json({ message: "Email tidak boleh kosong." },    { status: 400 });
    if (!body.password)         return NextResponse.json({ message: "Password tidak boleh kosong." }, { status: 400 });
    if (body.password.length < 8) return NextResponse.json({ message: "Password minimal 8 karakter." }, { status: 400 });

    const validRoles: StaffRole[] = ["cashier", "store_manager", "admin"];
    if (body.role && !validRoles.includes(body.role)) {
      return NextResponse.json({ message: "Role staff tidak valid." }, { status: 400 });
    }

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
        return NextResponse.json({ message: "Email sudah terdaftar." }, { status: 409 });
      }
      throw authErr;
    }

    const staffData: Staff = {
      name:          body.name.trim(),
      email:         body.email.toLowerCase().trim(),
      role:          body.role          ?? "cashier",
      storeLocation: body.storeLocation ?? "",
      isActive:      true,
    };

    await adminDb.collection("staff").doc(authUser.uid).set(staffData);

    return NextResponse.json({ uid: authUser.uid, ...staffData }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/staff]", err);
    return NextResponse.json({ message: "Gagal membuat staff." }, { status: 500 });
  }
}