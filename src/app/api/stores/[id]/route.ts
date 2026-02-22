// src/app/api/stores/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseServer";
import { getToken } from "next-auth/jwt";

type RouteContext = { params: Promise<{ id: string }> };

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
  // Hanya admin dan master yang bisa akses stores
  if (!['admin', 'master'].includes(userRole)) {
    return { error: "Akses ditolak. Anda tidak memiliki izin.", status: 403 };
  }
  
  return { token, userRole, error: null };
}

// PATCH — update store (semua field sesuai Firestore)
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  // Validasi session
  const validation = await validateSession(req);
  if (validation.error) {
    return NextResponse.json({ message: validation.error }, { status: validation.status });
  }

  try {
    const { id } = await ctx.params;
    if (!id) return NextResponse.json({ message: "ID wajib diisi." }, { status: 400 });

    const body = await req.json();
    const { name, address, latitude, longitude, openHours, statusOverride, isActive } = body;

    if (!name?.trim()) {
      return NextResponse.json({ message: "Nama outlet wajib diisi." }, { status: 400 });
    }

    const ref  = adminDb.collection("stores").doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ message: `Store "${id}" tidak ditemukan.` }, { status: 404 });
    }

    const updates: Record<string, any> = {
      name:           name.trim(),
      address:        address?.trim()   ?? "",
      openHours:      openHours?.trim() ?? "",
      statusOverride: statusOverride    ?? "open",
      isActive:       isActive          ?? true,
      updatedAt:      new Date().toISOString(),
    };

    if (latitude  != null && latitude  !== "") updates.latitude  = Number(latitude);
    if (longitude != null && longitude !== "") updates.longitude = Number(longitude);

    await ref.update(updates);
    return NextResponse.json({ id, ...updates });
  } catch (e: any) {
    console.error("[PATCH /api/stores/:id]", e);
    return NextResponse.json({ message: e.message ?? "Internal server error" }, { status: 500 });
  }
}

// DELETE — hapus store
export async function DELETE(req: NextRequest, ctx: RouteContext) {
  // Validasi session
  const validation = await validateSession(req);
  if (validation.error) {
    return NextResponse.json({ message: validation.error }, { status: validation.status });
  }

  try {
    const { id } = await ctx.params;
    if (!id) return NextResponse.json({ message: "ID wajib diisi." }, { status: 400 });

    const ref  = adminDb.collection("stores").doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ message: `Store "${id}" tidak ditemukan.` }, { status: 404 });
    }

    await ref.delete();
    return NextResponse.json({ success: true, id });
  } catch (e: any) {
    console.error("[DELETE /api/stores/:id]", e);
    return NextResponse.json({ message: e.message ?? "Internal server error" }, { status: 500 });
  }
}
