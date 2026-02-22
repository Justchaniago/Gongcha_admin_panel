import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseServer";
import { getToken } from "next-auth/jwt";

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
  // Hanya admin dan master yang bisa modify staff
  if (!['admin', 'master'].includes(userRole)) {
    return { error: "Akses ditolak. Anda tidak memiliki izin.", status: 403 };
  }
  
  return { token, userRole, error: null };
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ uid: string }> }
) {
  // Validasi session
  const validation = await validateSession(req);
  if (validation.error) {
    return NextResponse.json({ message: validation.error }, { status: validation.status });
  }

  try {
    const body = await req.json();
    const { uid } = await context.params;

    const {
      name, role, isActive,
      storeLocations, accessAllStores,
      storeLocation, // legacy field dari frontend
    } = body;

    const updateData: Record<string, any> = {};
    if (name          !== undefined) updateData.name          = name;
    if (role          !== undefined) updateData.role          = role;
    if (isActive      !== undefined) updateData.isActive      = isActive;
    if (storeLocation !== undefined) updateData.storeLocation = storeLocation;

    // Field baru
    if (storeLocations  !== undefined) updateData.storeLocations  = storeLocations;
    if (accessAllStores !== undefined) updateData.accessAllStores = accessAllStores;

    await adminDb.collection("staff").doc(uid).update(updateData);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}


export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ uid: string }> }
) {
  // Validasi session
  const validation = await validateSession(_req);
  if (validation.error) {
    return NextResponse.json({ message: validation.error }, { status: validation.status });
  }

  try {
    const { uid } = await context.params;
    await adminDb.collection("staff").doc(uid).delete();
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
