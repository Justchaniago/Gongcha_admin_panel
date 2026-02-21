// src/app/api/stores/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseServer";

type RouteContext = { params: Promise<{ id: string }> };

// PATCH — update store (semua field sesuai Firestore)
export async function PATCH(req: NextRequest, ctx: RouteContext) {
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
export async function DELETE(_req: NextRequest, ctx: RouteContext) {
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