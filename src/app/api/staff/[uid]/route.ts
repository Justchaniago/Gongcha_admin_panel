import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseServer";


export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ uid: string }> }
) {
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
  try {
    const { uid } = await context.params;
    await adminDb.collection("staff").doc(uid).delete();
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}