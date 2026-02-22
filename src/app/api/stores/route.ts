// src/app/api/stores/route.ts
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
  // Hanya admin dan master yang bisa akses stores
  if (!['admin', 'master'].includes(userRole)) {
    return { error: "Akses ditolak. Anda tidak memiliki izin.", status: 403 };
  }
  
  return { token, userRole, error: null };
}

// GET — list all
export async function GET(req: NextRequest) {
  // Validasi session
  const validation = await validateSession(req);
  if (validation.error) {
    return NextResponse.json({ message: validation.error }, { status: validation.status });
  }

  try {
    const snap = await adminDb.collection("stores").orderBy("name").get();
    const stores = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return NextResponse.json(stores);
  } catch (e: any) {
    return NextResponse.json({ message: e.message }, { status: 500 });
  }
}

// POST — create store dengan custom document ID
export async function POST(req: NextRequest) {
  // Validasi session
  const validation = await validateSession(req);
  if (validation.error) {
    return NextResponse.json({ message: validation.error }, { status: validation.status });
  }

  try {
    const body = await req.json();
    const {
      storeId,       // ← custom doc ID dari form
      name, address, latitude, longitude,
      openHours, statusOverride, isActive,
    } = body;

    if (!name?.trim()) {
      return NextResponse.json({ message: "Nama outlet wajib diisi." }, { status: 400 });
    }
    if (!storeId?.trim()) {
      return NextResponse.json({ message: "Store ID wajib diisi." }, { status: 400 });
    }

    // Validasi format ID: hanya huruf kecil, angka, underscore, dan dash
    const idRegex = /^[a-z0-9_-]+$/;
    if (!idRegex.test(storeId.trim())) {
      return NextResponse.json({
        message: "Store ID hanya boleh mengandung huruf kecil, angka, underscore (_) dan dash (-).",
      }, { status: 400 });
    }

    // Cek apakah ID sudah dipakai
    const existing = await adminDb.collection("stores").doc(storeId.trim()).get();
    if (existing.exists) {
      return NextResponse.json({
        message: `Store ID "${storeId}" sudah digunakan. Pilih ID lain.`,
      }, { status: 409 });
    }

    const data = {
      name:           name.trim(),
      address:        address?.trim()       ?? "",
      latitude:       latitude  != null && latitude  !== "" ? Number(latitude)  : null,
      longitude:      longitude != null && longitude !== "" ? Number(longitude) : null,
      openHours:      openHours?.trim()     ?? "",
      statusOverride: statusOverride        ?? "open",
      isActive:       isActive              ?? true,
      createdAt:      new Date().toISOString(),
    };

    // Pakai .doc(storeId).set() bukan .add() supaya ID bisa dikontrol
    await adminDb.collection("stores").doc(storeId.trim()).set(data);

    return NextResponse.json({ id: storeId.trim(), ...data }, { status: 201 });
  } catch (e: any) {
    console.error("[POST /api/stores]", e);
    return NextResponse.json({ message: e.message ?? "Internal server error" }, { status: 500 });
  }
}
