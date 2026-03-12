import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { cookies } from "next/headers";

// Memaksa API ini tidak pernah di-cache oleh Next.js (Wajib di Next 15)
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { idToken } = await req.json();
    if (!idToken) return NextResponse.json({ error: "Missing token" }, { status: 400 });

    // Buat cookie session berlaku 5 hari
    const expiresIn = 60 * 60 * 24 * 5 * 1000;
    const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn });
    
    const cookieStore = await cookies();
    cookieStore.set("session", sessionCookie, {
      maxAge: expiresIn / 1000, // Harus dalam satuan detik
      httpOnly: true,
      // Hanya wajibkan HTTPS jika sedang berjalan di server Vercel (bukan lokal)
      secure: process.env.VERCEL === "1" || process.env.NODE_ENV === "production" && req.headers.get("x-forwarded-proto") === "https",
      path: "/",
      sameSite: "lax",
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Session creation error:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete("session");
  return NextResponse.json({ success: true });
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session")?.value;

    if (!sessionCookie) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);

    let adminData: FirebaseFirestore.DocumentData | null = null;
    try {
      const adminSnap = await adminDb.collection("admin_users").doc(decoded.uid).get();
      adminData = adminSnap.exists ? (adminSnap.data() ?? null) : null;
    } catch (profileError) {
      // Keep session valid even if profile lookup fails (e.g. Firestore misconfigured/unavailable).
      console.warn("[api/auth/session] Profile lookup failed, continuing without profile:", profileError);
    }

    return NextResponse.json({
      authenticated: true,
      uid: decoded.uid,
      email: decoded.email ?? null,
      name: decoded.name ?? null,
      roleHint: (decoded as any)?.role ?? null,
      profile: adminData
        ? {
            uid: decoded.uid,
            email: adminData.email ?? decoded.email ?? null,
            name: adminData.name ?? decoded.name ?? decoded.email?.split("@")[0] ?? "Admin",
            role: adminData.role ?? "STAFF",
            isActive: adminData.isActive !== false,
            assignedStoreId: adminData.assignedStoreId ?? null,
          }
        : null,
    });
  } catch {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
}