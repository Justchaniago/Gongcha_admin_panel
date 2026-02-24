// src/app/api/settings/route.ts
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseServer";
import { cookies } from "next/headers";
import { adminAuth } from "@/lib/firebaseAdmin";

const SETTINGS_DOC = "settings/global";

// ── Default settings ──────────────────────────────────────────────────────────
const DEFAULTS = {
  pointsPerThousand:   10,
  minimumTransaction:  25000,
  pointsExpiry:        "12_months",
  tiers: {
    silver:   { minPoints: 0,     bonus: "0%",  label: "Silver" },
    gold:     { minPoints: 10000, bonus: "10%", label: "Gold" },
    platinum: { minPoints: 50000, bonus: "25%", label: "Platinum" },
  },
  notifications: {
    email:  true,
    push:   true,
    weekly: false,
  },
  updatedAt: null as string | null,
  updatedBy: null as string | null,
};

// ── Auth helper ───────────────────────────────────────────────────────────────
async function validateAdmin(req: NextRequest) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;
  if (!sessionCookie) return { error: "Unauthorized", status: 401, token: null };
  const decodedClaims = await adminAuth.verifySessionCookie(sessionCookie, true);
  const uid = decodedClaims.uid;

  // Fresh Role Fetching
  const userDoc = await adminDb.collection("users").doc(uid).get();
  const staffDoc = await adminDb.collection("staff").doc(uid).get();
  const profile = userDoc.exists ? userDoc.data() : staffDoc.exists ? staffDoc.data() : null;
  const role = profile?.role?.toLowerCase(); // Case-insensitive

  const allowedRoles = ["admin", "master"];
  if (!role || !allowedRoles.includes(role)) {
    return { error: "Akses ditolak. Role tidak diizinkan.", status: 403, token: null };
  }
  return { token: decodedClaims, error: null, status: 200 };
}

// ── GET — read settings ───────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const auth = await validateAdmin(req);
  if (auth.error) return NextResponse.json({ message: auth.error }, { status: auth.status });

  try {
    const snap = await adminDb.doc(SETTINGS_DOC).get();
    if (!snap.exists) {
      // Return defaults if not yet configured
      return NextResponse.json(DEFAULTS);
    }
    return NextResponse.json({ ...DEFAULTS, ...snap.data() });
  } catch (e: any) {
    console.error("[GET /api/settings]", e);
    return NextResponse.json({ message: e.message }, { status: 500 });
  }
}

// ── PATCH — update settings ───────────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  const auth = await validateAdmin(req);
  if (auth.error) return NextResponse.json({ message: auth.error }, { status: auth.status });

  try {
    const body = await req.json();

    // Whitelist allowed fields
    const allowed = [
      "pointsPerThousand", "minimumTransaction", "pointsExpiry",
      "tiers", "notifications",
    ];
    const update: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in body) update[key] = body[key];
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ message: "Tidak ada field yang valid untuk diupdate." }, { status: 400 });
    }

    update.updatedAt = new Date().toISOString();
    update.updatedBy = auth.token!.uid as string;

    await adminDb.doc(SETTINGS_DOC).set(update, { merge: true });

    // Return the full merged settings
    const snap = await adminDb.doc(SETTINGS_DOC).get();
    return NextResponse.json({ ...DEFAULTS, ...snap.data() });
  } catch (e: any) {
    console.error("[PATCH /api/settings]", e);
    return NextResponse.json({ message: e.message }, { status: 500 });
  }
}
