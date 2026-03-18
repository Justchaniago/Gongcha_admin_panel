import { NextRequest, NextResponse } from "next/server";
import { getAdminSession, isAdminAuthError } from "@/lib/adminSession";
import { getAuditAccessFromSession } from "@/lib/auditAccess";

// Keylog validation dilakukan client-side.
// Server hanya mengembalikan apakah UID ada di whitelist (inWhitelist),
// dan level apa yang dimiliki (read/manage/none) TANPA keylog.
// Client yang kemudian memutuskan apakah keylog yang diinput cocok dengan level tersebut.
//
// Server TIDAK pernah menerima atau memvalidasi keylog — keylog tidak pernah meninggalkan browser.

export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession({ allowedRoles: ["SUPER_ADMIN", "STAFF"] });
    const access = getAuditAccessFromSession(session);

    return NextResponse.json({
      authenticated: true,
      // Kembalikan apakah UID ada di whitelist read atau manage
      // tapi jangan expose canRead/canManage final — itu dikombinasikan dengan keylog di client
      inReadWhitelist:   access.canRead,
      inManageWhitelist: access.canManage,
      // canRead dan canManage final ditentukan di client setelah keylog diverifikasi
      canRead:   false, // selalu false dari server — client yang set setelah keylog OK
      canManage: false,
      level:     "none" as const,
    });
  } catch (error) {
    if (isAdminAuthError(error)) {
      return NextResponse.json(
        { authenticated: false, canRead: false, canManage: false, level: "none", inReadWhitelist: false, inManageWhitelist: false, message: error.message },
        { status: error.status },
      );
    }
    return NextResponse.json(
      { authenticated: false, canRead: false, canManage: false, level: "none", inReadWhitelist: false, inManageWhitelist: false, message: "Internal server error." },
      { status: 500 },
    );
  }
}
