import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { GeoPoint } from "firebase-admin/firestore";
import { Store, storeConverter } from "@/types/firestore";
import { getAdminSession, isAdminAuthError } from "@/lib/adminSession";
import { writeActivityLog } from "@/lib/activityLog";

type StoreResponse = Omit<Store, "location"> & {
  id: string;
  location: { lat: number; lng: number };
};

function storeDoc(id: string) {
  return adminDb.collection("stores").doc(id).withConverter(storeConverter as any);
}

function serializeStore(id: string, data: Store): StoreResponse {
  return {
    id,
    name: data.name,
    address: data.address,
    location: {
      lat: data.location.latitude,
      lng: data.location.longitude,
    },
    operationalHours: data.operationalHours,
    isForceClosed: data.isForceClosed,
    isActive: data.isActive,
  };
}

async function verifyAdminAccess() {
  await getAdminSession({ allowedRoles: ["SUPER_ADMIN", "STAFF"] });
}

function parsePatchBody(body: any): Partial<Omit<Store, "id">> {
  const updates: Partial<Omit<Store, "id">> = {};

  if (typeof body?.name === "string") updates.name = body.name.trim();
  if (typeof body?.address === "string") updates.address = body.address.trim();

  const latRaw = body?.location?.lat ?? body?.location?.latitude ?? body?.latitude;
  const lngRaw = body?.location?.lng ?? body?.location?.longitude ?? body?.longitude;
  if (latRaw != null && lngRaw != null) {
    const lat = Number(latRaw);
    const lng = Number(lngRaw);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new Error("Invalid location");
    }
    updates.location = new GeoPoint(lat, lng) as any;
  }

  let open = body?.operationalHours?.open;
  let close = body?.operationalHours?.close;
  if ((!open || !close) && typeof body?.openHours === "string") {
    const parts = body.openHours.split("-").map((v: string) => v.trim());
    if (parts.length === 2) {
      open = parts[0];
      close = parts[1];
    }
  }

  if (open && close) {
    updates.operationalHours = { open, close };
  }

  if (typeof body?.isForceClosed === "boolean") updates.isForceClosed = body.isForceClosed;
  if (typeof body?.isActive === "boolean") updates.isActive = body.isActive;

  return updates;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await verifyAdminAccess();
    const { id } = await params;
    const snap = await storeDoc(id).get();

    if (!snap.exists) {
      return NextResponse.json({ message: `Store "${id}" tidak ditemukan.` }, { status: 404 });
    }

    return NextResponse.json({ data: serializeStore(id, snap.data() as Store) }, { status: 200 });
  } catch (error: any) {
    if (isAdminAuthError(error)) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> } // Wajib Promise di Next.js 15
) {
  try {
    const { id } = await params; // Await params
    const actor = await getAdminSession({ allowedRoles: ["SUPER_ADMIN"] });

    const body = await req.json();
    const updates = parsePatchBody(body);

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ message: "No valid fields to update" }, { status: 400 });
    }

    const ref = storeDoc(id);
    const existing = await ref.get();
    if (!existing.exists) {
      return NextResponse.json({ message: `Store "${id}" tidak ditemukan.` }, { status: 404 });
    }
    const before = existing.data();

    await ref.set(storeConverter.toFirestore(updates as any), { merge: true });
    await writeActivityLog({
      actor,
      action: "STORE_UPDATED",
      targetType: "store",
      targetId: id,
      targetLabel: String(before?.name ?? updates.name ?? id),
      summary: `Updated store ${id}`,
      source: "api/stores/[id]:PATCH",
      metadata: { before, changes: updates },
    });
    const updated = await ref.get();

    return NextResponse.json({
      message: "Updated",
      data: serializeStore(id, updated.data() as Store),
    });
  } catch (error: any) {
    console.error("PATCH STORE ERROR:", error);
    if (isAdminAuthError(error)) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    const message = error?.message;
    if (message === "Invalid location") {
      return NextResponse.json({ message }, { status: 400 });
    }
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
