import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseServer";
import { getAuth } from "firebase-admin/auth";

// Handler untuk UPDATE (Edit) data member
export async function PATCH(req: Request, { params }: { params: Promise<{ uid: string }> }) {
  try {
    const resolvedParams = await params;
    const uid = resolvedParams.uid;
    const body = await req.json();
    const { adminUid, ...updateData } = body;

    // 1. Verifikasi Keamanan Lapis Dua (Hanya Admin/Manager)
    if (!adminUid) {
      return NextResponse.json({ error: "Akses Ditolak: Admin UID diperlukan." }, { status: 401 });
    }
    const adminDoc = await adminDb.collection("users").doc(adminUid).get();
    const role = adminDoc.data()?.role;
    if (!adminDoc.exists || (role !== "admin" && role !== "manager")) {
      return NextResponse.json({ error: "Akses Ditolak: Otorisasi API gagal." }, { status: 403 });
    }
    // 2. Lakukan Update Data ke Firestore
    await adminDb.collection("users").doc(uid).update({
      ...updateData,
      updatedAt: new Date().toISOString()
    });
    return NextResponse.json({ success: true, message: "Data member berhasil diperbarui." });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Handler untuk DELETE (Hapus) data member
export async function DELETE(req: Request, { params }: { params: Promise<{ uid: string }> }) {
  try {
    const resolvedParams = await params;
    const uid = resolvedParams.uid;
    const url = new URL(req.url);
    const adminUid = url.searchParams.get("adminUid");

    // 1. Verifikasi Keamanan
    if (!adminUid) {
      return NextResponse.json({ error: "Akses Ditolak: Admin UID diperlukan." }, { status: 401 });
    }
    const adminDoc = await adminDb.collection("users").doc(adminUid).get();
    const role = adminDoc.data()?.role;
    if (!adminDoc.exists || (role !== "admin" && role !== "manager")) {
      return NextResponse.json({ error: "Akses Ditolak: Otorisasi API gagal." }, { status: 403 });
    }
    // 2. Hapus data dari Firebase Auth (Jika ada)
    try {
      await getAuth().deleteUser(uid);
    } catch (authError: any) {
      if (authError.code !== 'auth/user-not-found') {
        console.error("Auth Deletion Error:", authError);
      }
    }
    // 3. Hapus data dari Firestore
    await adminDb.collection("users").doc(uid).delete();
    return NextResponse.json({ success: true, message: "Akun dan data member berhasil dihapus." });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}