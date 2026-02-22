import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseServer";
import * as admin from "firebase-admin";
import { User, UserRole, UserTier } from "@/types/firestore";
import { getToken } from "next-auth/jwt";

type Params = { params: Promise<{ uid: string }> };

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
  // Hanya admin dan master yang bisa modify member
  if (!['admin', 'master'].includes(userRole)) {
    return { error: "Akses ditolak. Anda tidak memiliki izin.", status: 403 };
  }
  
  return { token, userRole, error: null };
}

// ── PATCH /api/members/[uid] — update member ──────────────────────────────────
export async function PATCH(req: NextRequest, { params }: Params) {
  const { uid } = await params;
  if (!uid) return NextResponse.json({ message: "UID diperlukan." }, { status: 400 });

  // Validasi session
  const validation = await validateSession(req);
  if (validation.error) {
    return NextResponse.json({ message: validation.error }, { status: validation.status });
  }

  try {
    const body: Partial<User & { password?: string }> = await req.json();

    const docRef = adminDb.collection("users").doc(uid);
    const snap   = await docRef.get();
    if (!snap.exists) {
      return NextResponse.json({ message: "Member tidak ditemukan." }, { status: 404 });
    }

    // Validate
    if (body.name !== undefined && !body.name.trim()) {
      return NextResponse.json({ message: "Nama tidak boleh kosong." }, { status: 400 });
    }

    const validRoles: UserRole[] = ["master", "trial", "admin", "member"];
    const validTiers: UserTier[] = ["Silver", "Gold", "Platinum"];
    if (body.role && !validRoles.includes(body.role)) {
      return NextResponse.json({ message: "Role tidak valid." }, { status: 400 });
    }
    if (body.tier && !validTiers.includes(body.tier)) {
      return NextResponse.json({ message: "Tier tidak valid." }, { status: 400 });
    }

    // Update Firestore — only allowed fields
    const allowed: (keyof User)[] = [
      "name", "phoneNumber", "tier", "role", "currentPoints", "lifetimePoints",
    ];
    const firestoreUpdate: Record<string, unknown> = {};
    for (const key of allowed) {
      if (body[key] !== undefined) firestoreUpdate[key] = body[key];
    }
    if (body.name) firestoreUpdate.name = body.name.trim();

    if (Object.keys(firestoreUpdate).length > 0) {
      await docRef.update(firestoreUpdate);
    }

    // Optionally update Auth display name
    if (body.name) {
      await admin.auth().updateUser(uid, { displayName: body.name.trim() }).catch(() => {
        // Auth user might not exist — not fatal
      });
    }

    // Optionally update password
    if (body.password) {
      if (body.password.length < 8) {
        return NextResponse.json({ message: "Password minimal 8 karakter." }, { status: 400 });
      }
      await admin.auth().updateUser(uid, { password: body.password });
    }

    return NextResponse.json({ uid, ...firestoreUpdate });
  } catch (err) {
    console.error("[PATCH /api/members/:uid]", err);
    return NextResponse.json({ message: "Gagal memperbarui member." }, { status: 500 });
  }
}

// ── DELETE /api/members/[uid] — delete member + auth user ────────────────────
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { uid } = await params;
  if (!uid) return NextResponse.json({ message: "UID diperlukan." }, { status: 400 });

  // Validasi session
  const validation = await validateSession(_req);
  if (validation.error) {
    return NextResponse.json({ message: validation.error }, { status: validation.status });
  }

  try {
    const docRef = adminDb.collection("users").doc(uid);
    const snap   = await docRef.get();
    if (!snap.exists) {
      return NextResponse.json({ message: "Member tidak ditemukan." }, { status: 404 });
    }

    // Delete Firestore doc
    await docRef.delete();

    // Delete Firebase Auth user (non-fatal if not found)
    await admin.auth().deleteUser(uid).catch((e: { code?: string }) => {
      if (e.code !== "auth/user-not-found") throw e;
    });

    return NextResponse.json({ message: "Member berhasil dihapus.", uid });
  } catch (err) {
    console.error("[DELETE /api/members/:uid]", err);
    return NextResponse.json({ message: "Gagal menghapus member." }, { status: 500 });
  }
}
