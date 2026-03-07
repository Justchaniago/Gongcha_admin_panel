import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebaseAdmin";
import { cookies } from "next/headers";

export async function POST(req: NextRequest) {
  try {
    // 1. Ambil cookie (Wajib await di Next.js 15)
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session")?.value;

    if (!sessionCookie) {
      return NextResponse.json({ message: "Invalid Session" }, { status: 401 });
    }

    // 2. Verifikasi Token
    const decodedClaims = await adminAuth.verifySessionCookie(sessionCookie, true);
    const uid = decodedClaims.uid;

    // 3. Fresh Role Check — canonical admin_users only
    // ✅ FIX GAP #1
    const adminDoc = await adminDb.collection("admin_users").doc(uid).get();
    if (!adminDoc.exists) {
      return NextResponse.json({ message: "Akses Ditolak: Profil admin tidak ditemukan." }, { status: 403 });
    }
    const role: string = adminDoc.data()?.role ?? "";
    if (role !== "SUPER_ADMIN") {
      return NextResponse.json({ message: "Akses Ditolak: Hanya SUPER_ADMIN." }, { status: 403 });
    }

    // 4. Proses Data
    const body = await req.json();
    const { storeId, name, address, latitude, longitude, openHours, statusOverride, isActive } = body;

    if (!storeId || !name) {
      return NextResponse.json({ message: "Incomplete data" }, { status: 400 });
    }

    const namePlace = name.replace(/^Gong Cha\s*/i, '').trim();
    await adminDb.collection("stores").doc(storeId).set({
      name,
      namePlace,
      address: address || "",
      latitude: latitude ? Number(latitude) : null,
      longitude: longitude ? Number(longitude) : null,
      openHours: openHours || "",
      statusOverride: statusOverride || "open",
      isActive: isActive ?? true,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({ message: "Store created" }, { status: 201 });
  } catch (error: any) {
    console.error("POST STORE ERROR:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}