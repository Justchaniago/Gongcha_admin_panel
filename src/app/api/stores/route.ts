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

    // 3. Fresh Role Check
    const userDoc = await adminDb.collection("users").doc(uid).get();
    const staffDoc = await adminDb.collection("staff").doc(uid).get();
    const profile = userDoc.exists ? userDoc.data() : staffDoc.exists ? staffDoc.data() : null;
    const role = profile?.role?.toLowerCase();

    if (!["admin", "master"].includes(role)) {
      return NextResponse.json({ message: "Akses Ditolak" }, { status: 403 });
    }

    // 4. Proses Data
    const body = await req.json();
    const { storeId, name, address, latitude, longitude, openHours, statusOverride, isActive } = body;

    if (!storeId || !name) {
      return NextResponse.json({ message: "Data tidak lengkap" }, { status: 400 });
    }

    await adminDb.collection("stores").doc(storeId).set({
      name,
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