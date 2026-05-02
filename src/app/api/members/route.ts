import { NextRequest, NextResponse } from "next/server";
import { getAdminSession, isAdminAuthError } from "@/lib/adminSession";
import { authorize, isRbacForbiddenError } from "@/lib/rbac";
import { adminDb } from "@/lib/firebaseAdmin";

const DEFAULT_PAGE_SIZE = 20;

export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession();
    await authorize(session, { permission: "member.read" });

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") ?? "";
    const tier = searchParams.get("tier") ?? "All";
    const sortBy = searchParams.get("sortBy") ?? "tier";
    const sortOrder = searchParams.get("sortOrder") ?? "desc";
    const pageSize = Math.min(
      parseInt(searchParams.get("pageSize") ?? String(DEFAULT_PAGE_SIZE), 10),
      100,
    );
    const afterId = searchParams.get("afterId");
    const includeStats = searchParams.get("includeStats") === "true";

    // Build query dynamically using Admin SDK method chaining
    const isSearching = !!search.trim();
    let q: FirebaseFirestore.Query = adminDb.collection("users");

    // Tier filter only when not searching — avoids composite index requirement
    if (!isSearching && tier !== "All") q = q.where("tier", "==", tier);

    if (isSearching) {
      const s = search.trim().toLowerCase();
      q = q.where("nameLower", ">=", s).where("nameLower", "<=", s + "");
      // Inequality on "nameLower" requires first orderBy to also be on "nameLower"
      q = q.orderBy("nameLower", "asc");
    } else {
      const orderField =
        sortBy === "largestPoints" ? "currentPoints" :
        sortBy === "tier" ? "tier" : "name";
      q = q.orderBy(orderField, sortOrder === "asc" ? "asc" : "desc");
    }

    q = q.limit(pageSize + 1); // +1 to detect hasMore

    if (!isSearching && afterId) {
      const afterDoc = await adminDb.collection("users").doc(afterId).get();
      if (afterDoc.exists) q = q.startAfter(afterDoc);
    }

    const snap = await q.get();
    const hasMore = snap.docs.length > pageSize;
    let docs = snap.docs.slice(0, pageSize);

    // When searching, apply tier filter in memory (avoids composite index)
    if (isSearching && tier !== "All") {
      docs = docs.filter((d) => d.data().tier === tier);
    }

    const users = docs.map((d) => ({ ...d.data(), uid: d.id }));

    let stats: Record<string, number> | undefined;
    if (includeStats) {
      const coll = adminDb.collection("users");
      const [t, p, g, s] = await Promise.all([
        coll.count().get(),
        coll.where("tier", "==", "Platinum").count().get(),
        coll.where("tier", "==", "Gold").count().get(),
        coll.where("tier", "==", "Silver").count().get(),
      ]);
      stats = {
        total: t.data().count,
        platinum: p.data().count,
        gold: g.data().count,
        silver: s.data().count,
      };
    }

    return NextResponse.json({ users, hasMore, ...(stats ? { stats } : {}) });
  } catch (err: unknown) {
    if (isAdminAuthError(err))
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (isRbacForbiddenError(err))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("[members] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
