import { NextRequest, NextResponse } from "next/server";
// Pastikan hanya menggunakan firebaseAdmin, jangan campur dengan firebaseServer
import { adminDb } from "@/lib/firebaseAdmin";
import { getAdminSession, isAdminAuthError } from "@/lib/adminSession";
import { writeActivityLog } from "@/lib/activityLog";

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
// ── GET — read settings ───────────────────────────────────────────────────────
export async function GET() {
  try {
    await getAdminSession({ allowedRoles: ["SUPER_ADMIN"] });

    const snap = await adminDb.doc(SETTINGS_DOC).get();
    if (!snap.exists) {
      return NextResponse.json(DEFAULTS);
    }
    return NextResponse.json({ ...DEFAULTS, ...snap.data() });
  } catch (e: any) {
    console.error("[GET /api/settings]", e);
    if (isAdminAuthError(e)) {
      return NextResponse.json({ message: e.message }, { status: e.status });
    }
    return NextResponse.json({ message: e.message || "Internal Server Error" }, { status: 500 });
  }
}

// ── PATCH — update settings ───────────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  try {
    const auth = await getAdminSession({ allowedRoles: ["SUPER_ADMIN"] });
    const beforeSnap = await adminDb.doc(SETTINGS_DOC).get();
    const beforeData = beforeSnap.exists ? { ...DEFAULTS, ...beforeSnap.data() } : { ...DEFAULTS };

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
      return NextResponse.json({ message: "No valid data to save." }, { status: 400 });
    }

    update.updatedAt = new Date().toISOString();
    update.updatedBy = auth.uid;
    const afterData = { ...beforeData, ...update };

    // 4. Simpan ke Firestore
    await adminDb.doc(SETTINGS_DOC).set(update, { merge: true });
    await writeActivityLog({
      actor: auth,
      action: "SETTINGS_UPDATED",
      targetType: "settings",
      targetId: SETTINGS_DOC,
      targetLabel: "Global settings",
      summary: "Updated global application settings",
      source: "api/settings:PATCH",
      metadata: {
        before: beforeData,
        after: afterData,
        changes: update,
      },
    });

    // 5. Kembalikan data terbaru
    const snap = await adminDb.doc(SETTINGS_DOC).get();
    return NextResponse.json({ ...DEFAULTS, ...snap.data() });
    
  } catch (e: any) {
    console.error("[PATCH /api/settings] Error:", e);
    if (isAdminAuthError(e)) {
      return NextResponse.json({ message: e.message }, { status: e.status });
    }
    // Sekarang error tidak akan membuat server crash blank (500 tanpa info), melainkan mengembalikan pesan JSON.
    return NextResponse.json({ message: e.message || "Gagal menyimpan ke server" }, { status: 500 });
  }
}
