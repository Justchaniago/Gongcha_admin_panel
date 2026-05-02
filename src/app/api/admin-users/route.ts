import { NextRequest, NextResponse } from "next/server";
import { getAdminSession, isAdminAuthError } from "@/lib/adminSession";
import { authorize, isRbacForbiddenError } from "@/lib/rbac";
import { adminDb } from "@/lib/firebaseAdmin";

export async function GET(_req: NextRequest) {
  try {
    const session = await getAdminSession();
    await authorize(session, { permission: "staff.read" });

    const [staffSnap, storesSnap] = await Promise.all([
      adminDb.collection("admin_users").orderBy("name").get(),
      adminDb.collection("stores").orderBy("name").get(),
    ]);

    const staff = staffSnap.docs.map((d) => ({ ...d.data(), uid: d.id }));
    const stores = storesSnap.docs.map((d) => ({
      id: d.id,
      name: (d.data().name as string) ?? d.id,
    }));

    return NextResponse.json({ staff, stores });
  } catch (err: unknown) {
    if (isAdminAuthError(err))
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (isRbacForbiddenError(err))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("[admin-users] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
