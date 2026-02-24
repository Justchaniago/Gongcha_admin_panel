import { NextRequest, NextResponse } from "next/server";
// Pastikan hanya menggunakan firebaseAdmin, jangan campur dengan firebaseServer
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { cookies } from "next/headers";

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
async function validateAdmin() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;
  
  if (!sessionCookie) {
    return { error: "Sesi tidak ditemukan. Silakan login ulang.", status: 401, token: null };
  }
  
  const decodedClaims = await adminAuth.verifySessionCookie(sessionCookie, true);
  const uid = decodedClaims.uid;

  // Fresh Role Fetching
  const userDoc = await adminDb.collection("users").doc(uid).get();
  const staffDoc = await adminDb.collection("staff").doc(uid).get();
  const profile = userDoc.exists ? userDoc.data() : staffDoc.exists ? staffDoc.data() : null;
  const role = profile?.role?.toLowerCase(); 

  const allowedRoles = ["admin", "master"];
  if (!role || !allowedRoles.includes(role)) {
    return { error: "Akses ditolak. Role Anda tidak diizinkan mengubah pengaturan.", status: 403, token: null };
  }
  return { token: decodedClaims, error: null, status: 200 };
}

// ── GET — read settings ───────────────────────────────────────────────────────
export async function GET() {
  try {
    const auth = await validateAdmin();
    if (auth.error) return NextResponse.json({ message: auth.error }, { status: auth.status });

    const snap = await adminDb.doc(SETTINGS_DOC).get();
    if (!snap.exists) {
      return NextResponse.json(DEFAULTS);
    }
    return NextResponse.json({ ...DEFAULTS, ...snap.data() });
  } catch (e: any) {
    console.error("[GET /api/settings]", e);
    return NextResponse.json({ message: e.message || "Internal Server Error" }, { status: 500 });
  }
}

// ── PATCH — update settings ───────────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  try {
    // 1. Validasi Auth dimasukkan ke dalam try-catch!
    const auth = await validateAdmin();
    if (auth.error) {
      return NextResponse.json({ message: auth.error }, { status: auth.status });
    }

    // 2. Parse Body JSON
    const body = await req.json();

    // 3. Whitelist allowed fields
    const allowed = [
      "pointsPerThousand", "minimumTransaction", "pointsExpiry",
      "tiers", "notifications",
    ];
    
    const update: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in body) update[key] = body[key];
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ message: "Tidak ada data valid untuk disimpan." }, { status: 400 });
    }

    update.updatedAt = new Date().toISOString();
    update.updatedBy = auth.token!.uid as string;

    // 4. Simpan ke Firestore
    await adminDb.doc(SETTINGS_DOC).set(update, { merge: true });

    // 5. Kembalikan data terbaru
    const snap = await adminDb.doc(SETTINGS_DOC).get();
    return NextResponse.json({ ...DEFAULTS, ...snap.data() });
    
  } catch (e: any) {
    console.error("[PATCH /api/settings] Error:", e);
    // Sekarang error tidak akan membuat server crash blank (500 tanpa info), melainkan mengembalikan pesan JSON.
    return NextResponse.json({ message: e.message || "Gagal menyimpan ke server" }, { status: 500 });
  }
}