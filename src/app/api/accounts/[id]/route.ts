import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseServer";
import { Account } from "@/types/firestore";

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
export async function GET() {
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
  try {
    const body: Partial<Account> & { customId?: string } = await req.json();

    const err = validateAccountPayload(body);
    if (err) return NextResponse.json({ message: err }, { status: 400 });

    // Validate custom ID format if provided
    const customId = body.customId?.trim();
    if (customId) {
      const idRe = /^[a-zA-Z0-9_-]+$/;
      if (!idRe.test(customId)) {
        return NextResponse.json({ message: "Document ID hanya boleh huruf, angka, - dan _." }, { status: 400 });
      }
      // Check if ID already exists
      const idSnap = await adminDb.collection("accounts").doc(customId).get();
      if (idSnap.exists) {
        return NextResponse.json({ message: `Document ID "${customId}" sudah digunakan.` }, { status: 409 });
      }
    }

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

    let finalId: string;
    if (customId) {
      // Use custom document ID with .doc().set()
      await adminDb.collection("accounts").doc(customId).set(payload);
      finalId = customId;
    } else {
      // Auto-generate ID with .add()
      const docRef = await adminDb.collection("accounts").add(payload);
      finalId = docRef.id;
    }

    return NextResponse.json({ id: finalId, ...payload }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/accounts]", err);
    return NextResponse.json({ message: "Gagal membuat akun." }, { status: 500 });
  }
}