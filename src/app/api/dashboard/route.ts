import { NextRequest, NextResponse } from "next/server";
import { getAdminSession, isAdminAuthError } from "@/lib/adminSession";
import { authorize, isRbacForbiddenError } from "@/lib/rbac";
import { adminDb } from "@/lib/firebaseAdmin";

function todayStr() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession();
    await authorize(session, { permission: "transaction.read" });

    const { searchParams } = new URL(req.url);
    const today = todayStr();
    const from = searchParams.get("from") ?? today;
    const to = searchParams.get("to") ?? today;
    const requestedStore = searchParams.get("storeId") ?? "all";

    // Enforce scope: STORE-scoped users can only see their assigned store
    const isScopeStore = session.scope?.type === "STORE";
    const assignedStoreId =
      session.scope?.storeIds?.[0] ?? session.assignedStoreId ?? null;
    const storeId =
      isScopeStore && assignedStoreId ? assignedStoreId : requestedStore;

    // 1. Fetch daily_stats
    let dailyStats: Record<string, unknown>[] = [];
    if (from === to) {
      const docId =
        storeId === "all" ? `${from}_GLOBAL` : `${from}_${storeId}`;
      const snap = await adminDb.collection("daily_stats").doc(docId).get();
      if (snap.exists) dailyStats = [{ id: snap.id, ...snap.data() }];
    } else {
      const baseQ = adminDb
        .collection("daily_stats")
        .where("date", ">=", from)
        .where("date", "<=", to)
        .orderBy("date", "asc");
      const q =
        storeId === "all"
          ? baseQ.where("type", "==", "GLOBAL")
          : baseQ.where("storeId", "==", storeId);
      const snap = await q.get();
      dailyStats = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    }

    // 2. Fetch member summary — only for non-STORE-scoped users
    const memberSummary = {
      total: 0,
      tiers: { Platinum: 0, Gold: 0, Silver: 0 } as Record<string, number>,
    };
    if (!isScopeStore) {
      const usersSnap = await adminDb.collection("users").select("tier").get();
      memberSummary.total = usersSnap.size;
      usersSnap.docs.forEach((d) => {
        const tier = (d.data() as { tier?: string }).tier ?? "";
        if (tier in memberSummary.tiers) memberSummary.tiers[tier]++;
      });
    }

    // 3. Fetch stores for filter dropdown
    const storesSnap = await adminDb.collection("stores").get();
    const stores = storesSnap.docs.map((d) => ({
      id: d.id,
      uid: d.id,
      ...d.data(),
    }));

    return NextResponse.json({ dailyStats, memberSummary, stores });
  } catch (err: unknown) {
    if (isAdminAuthError(err))
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (isRbacForbiddenError(err))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("[dashboard] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
