import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebaseAdmin";
import { cookies } from "next/headers";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> } // Wajib Promise di Next.js 15
) {
  try {
    const { id } = await params; // Await params
    const cookieStore = await cookies(); // Await cookies
    const sessionCookie = cookieStore.get("session")?.value;

    if (!sessionCookie) {
      return NextResponse.json({ message: "Invalid Session" }, { status: 401 });
    }

    const decodedClaims = await adminAuth.verifySessionCookie(sessionCookie, true);
    
    // Role Check
    const userDoc = await adminDb.collection("users").doc(decodedClaims.uid).get();
    const role = userDoc.data()?.role?.toLowerCase();

    if (!["admin", "master"].includes(role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
    }

    const body = await req.json();
    await adminDb.collection("stores").doc(id).update({
      ...body,
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({ message: "Updated" });
  } catch (error: any) {
    console.error("PATCH STORE ERROR:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}