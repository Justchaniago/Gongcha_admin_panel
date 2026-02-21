import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseServer";
import { getAuth } from "firebase-admin/auth";

export async function POST(req: Request) {
  try {
    const { email, password, role, type, adminUid } = await req.json();

    // 1. Verifikasi Keamanan Lapis Dua: Pastikan pemanggil API ini benar-benar Admin/Manager
    const adminDoc = await adminDb.collection("users").doc(adminUid).get();
    if (!adminDoc.exists || (adminDoc.data()?.role !== "admin" && adminDoc.data()?.role !== "manager")) {
      return NextResponse.json({ error: "Akses Ditolak: Otorisasi API gagal." }, { status: 403 });
    }

    // 2. Registrasi akun ke Firebase Authentication
    const userRecord = await getAuth().createUser({
      email,
      password,
    });

    // 3. Simpan identitas & role ke Firestore menggunakan UID resmi dari Auth
    const timestamp = new Date().toISOString();

    // Selalu catat hak akses dasar di koleksi 'users' agar user bisa login
    await adminDb.collection("users").doc(userRecord.uid).set({
      email,
      role,
      createdAt: timestamp,
    });

    // Jika dia staf, gandakan datanya ke koleksi khusus 'staff' untuk manajemen HR
    if (type === "staff") {
      await adminDb.collection("staff").doc(userRecord.uid).set({
        email,
        role,
        createdAt: timestamp,
      });
    }

    return NextResponse.json({ success: true, uid: userRecord.uid, message: "Akun berhasil dibuat dan diamankan." });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}