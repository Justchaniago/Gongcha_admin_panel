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
  return getAdminSession({ allowedRoles: ["SUPER_ADMIN", "STAFF"] });
}

function parseStoreBody(body: any): Omit<Store, "id"> {
  const name = String(body?.name ?? "").trim();
  if (!name) throw new Error("Incomplete data");

  const address = String(body?.address ?? "").trim();

  const latRaw = body?.location?.lat ?? body?.location?.latitude ?? body?.latitude;
  const lngRaw = body?.location?.lng ?? body?.location?.longitude ?? body?.longitude;
  const lat = Number(latRaw);
  const lng = Number(lngRaw);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error("Invalid location");
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

  if (!open || !close) {
    throw new Error("Invalid operationalHours");
  }

  return {
    name,
    address,
    location: new GeoPoint(lat, lng) as any,
    operationalHours: { open, close },
    isForceClosed: Boolean(body?.isForceClosed ?? false),
    isActive: Boolean(body?.isActive ?? true),
  };
}

export async function GET() {
  try {
    await verifyAdminAccess();
    const snap = await adminDb.collection("stores").withConverter(storeConverter as any).get();
    const stores = snap.docs.map((d) => serializeStore(d.id, d.data() as Store));
    return NextResponse.json({ data: stores }, { status: 200 });
  } catch (error: any) {
    if (isAdminAuthError(error)) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await getAdminSession({ allowedRoles: ["SUPER_ADMIN"] });

    const body = await req.json();
    const storeId = String(body?.storeId ?? "").trim();
    if (!storeId) {
      return NextResponse.json({ message: "Incomplete data" }, { status: 400 });
    }

    const payload = parseStoreBody(body);
    const ref = storeDoc(storeId);

    await ref.set(storeConverter.toFirestore(payload as any));
    await writeActivityLog({
      actor,
      action: "STORE_CREATED",
      targetType: "store",
      targetId: storeId,
      targetLabel: payload.name,
      summary: `Created store ${payload.name}`,
      source: "api/stores:POST",
      metadata: payload,
    });

    return NextResponse.json(
      { message: "Store created", data: serializeStore(storeId, payload as Store) },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("POST STORE ERROR:", error);
    if (isAdminAuthError(error)) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    const message = error?.message;
    if (["Incomplete data", "Invalid location", "Invalid operationalHours"].includes(message)) {
      return NextResponse.json({ message }, { status: 400 });
    }
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
