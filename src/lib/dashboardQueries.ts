import { adminDb } from "@/lib/firebaseServer";

export interface DashboardData {
  // KPI
  totalRevenue: number;           // sum of amount dari semua verified transactions
  totalMembers: number;           // count users collection
  activeStores: number;           // count stores where isActive = true
  totalStores: number;            // count all stores
  pendingCount: number;           // count pending transactions (collectionGroup)
  pendingPointsHeld: number;      // sum potentialPoints dari pending transactions

  // Recent transactions (5 terbaru dari collectionGroup)
  recentTransactions: {
    docId: string;
    transactionId: string;
    memberName: string;
    storeLocation: string;
    amount: number;
    status: string;
    createdAt: string;
  }[];

  // Top stores by total revenue
  topStores: {
    storeId: string;
    storeName: string;
    totalRevenue: number;
    txCount: number;
  }[];
}

export async function getDashboardData(): Promise<DashboardData> {
  // ─── 1. Total Members ───────────────────────────────────────────────────────
  const usersSnap = await adminDb.collection("users").count().get();
  const totalMembers = usersSnap.data().count;

  // ─── 2. Stores: active vs total ────────────────────────────────────────────
  const storesSnap = await adminDb.collection("stores").get();
  const totalStores = storesSnap.size;
  const activeStores = storesSnap.docs.filter((d) => d.data().isActive === true).length;

  // Build storeId → storeName map untuk lookup
  const storeNameMap: Record<string, string> = {};
  storesSnap.docs.forEach((d) => {
    storeNameMap[d.id] = d.data().name as string;
  });

  // ─── 3. Transactions (collectionGroup) ─────────────────────────────────────
  // Firestore collectionGroup query: semua subcollection bernama "transactions"
  // di bawah stores/{storeId}/transactions
  const allTxSnap = await adminDb.collectionGroup("transactions").get();

  let totalRevenue = 0;
  let pendingCount = 0;
  let pendingPointsHeld = 0;

  // Per-store aggregation untuk Top Stores
  const storeStats: Record<string, { revenue: number; txCount: number }> = {};

  allTxSnap.docs.forEach((doc) => {
    const tx = doc.data();
    const storeId = tx.storeLocation as string;
    const amount = (tx.amount as number) ?? 0;
    const status = tx.status as string;

    // Hanya hitung revenue dari yang verified
    if (status === "verified") {
      totalRevenue += amount;
    }

    // Pending metrics
    if (status === "pending") {
      pendingCount++;
      pendingPointsHeld += (tx.potentialPoints as number) ?? 0;
    }

    // Aggregasi per store (semua transaksi)
    if (!storeStats[storeId]) storeStats[storeId] = { revenue: 0, txCount: 0 };
    storeStats[storeId].txCount++;
    if (status === "verified") storeStats[storeId].revenue += amount;
  });

  // ─── 4. Recent Transactions (5 terbaru, sort di memory) ──────────────────
  const recentSnap = await adminDb
    .collectionGroup("transactions")
    .get();

  const recentTransactions = recentSnap.docs
    .map((doc) => {
      const d = doc.data();
      return {
        docId: doc.id,
        transactionId: d.transactionId as string,
        memberName: d.memberName as string,
        storeLocation: d.storeLocation as string,
        amount: d.amount as number,
        status: d.status as string,
        createdAt: d.createdAt?.toDate?.()?.toISOString?.() ?? d.createdAt ?? "",
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);

  // ─── 5. Top Stores (sorted by revenue) ─────────────────────────────────────
  const topStores = Object.entries(storeStats)
    .map(([storeId, stats]) => ({
      storeId,
      storeName: storeNameMap[storeId] ?? storeId,
      totalRevenue: stats.revenue,
      txCount: stats.txCount,
    }))
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .slice(0, 5);

  return {
    totalRevenue,
    totalMembers,
    activeStores,
    totalStores,
    pendingCount,
    pendingPointsHeld,
    recentTransactions,
    topStores,
  };
}
