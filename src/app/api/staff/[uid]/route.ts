import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseServer";
import * as admin from "firebase-admin";
import { Staff, StaffRole } from "@/types/firestore";

type Params = { params: Promise<{ uid: string }> };

// ── PATCH /api/staff/[uid] ────────────────────────────────────────────────────
export async function PATCH(req: NextRequest, { params }: Params) {
  const { uid } = await params;
  if (!uid) return NextResponse.json({ message: "UID diperlukan." }, { status: 400 });

  try {
    const body: Partial<Staff & { password?: string }> = await req.json();

    const docRef = adminDb.collection("staff").doc(uid);
    const snap   = await docRef.get();
    if (!snap.exists) {
      return NextResponse.json({ message: "Staff tidak ditemukan." }, { status: 404 });
    }

    const validRoles: StaffRole[] = ["cashier", "store_manager", "admin"];
    if (body.role && !validRoles.includes(body.role)) {
      return NextResponse.json({ message: "Role tidak valid." }, { status: 400 });
    }
    if (body.name !== undefined && !body.name.trim()) {
      return NextResponse.json({ message: "Nama tidak boleh kosong." }, { status: 400 });
    }

    const allowed: (keyof Staff)[] = ["name", "role", "storeLocation", "isActive"];
    const update: Record<string, unknown> = {};
    for (const key of allowed) {
      if (body[key] !== undefined) update[key] = body[key];
    }
    if (body.name) update.name = body.name.trim();

    if (Object.keys(update).length > 0) {
      await docRef.update(update);
    }

    if (body.name) {
      await admin.auth().updateUser(uid, { displayName: body.name.trim() }).catch(() => {});
    }
    if (body.password) {
      if (body.password.length < 8) {
        return NextResponse.json({ message: "Password minimal 8 karakter." }, { status: 400 });
      }
      await admin.auth().updateUser(uid, { password: body.password });
    }

    return NextResponse.json({ uid, ...update });
  } catch (err) {
    console.error("[PATCH /api/staff/:uid]", err);
    return NextResponse.json({ message: "Gagal memperbarui staff." }, { status: 500 });
  }
}

// ── DELETE /api/staff/[uid] ───────────────────────────────────────────────────
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { uid } = await params;
  if (!uid) return NextResponse.json({ message: "UID diperlukan." }, { status: 400 });

  try {
    const docRef = adminDb.collection("staff").doc(uid);
    const snap   = await docRef.get();
    if (!snap.exists) {
      return NextResponse.json({ message: "Staff tidak ditemukan." }, { status: 404 });
    }

    await docRef.delete();
    await admin.auth().deleteUser(uid).catch((e: { code?: string }) => {
      if (e.code !== "auth/user-not-found") throw e;
    });

    return NextResponse.json({ message: "Staff berhasil dihapus.", uid });
  } catch (err) {
    console.error("[DELETE /api/staff/:uid]", err);
    return NextResponse.json({ message: "Gagal menghapus staff." }, { status: 500 });
  }
}