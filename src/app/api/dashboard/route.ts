import { NextRequest, NextResponse } from "next/server";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000/api/v1';

export async function GET(req: NextRequest) {
  try {
    const res = await fetch(`${API_BASE_URL}/admin/dashboard/stats`, {
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      // Fallback response if backend offline
      return NextResponse.json({
        dailyStats: [],
        memberSummary: { total: 0, tiers: { Platinum: 0, Gold: 0, Silver: 0 } },
        stores: [],
      });
    }

    const stats = await res.json();

    const memberSummary = {
      total: stats.total_members ?? 0,
      tiers: { Platinum: 0, Gold: 0, Silver: 0 },
    };

    const dailyStats = [
      {
        id: 'today',
        totalRevenue: stats.total_revenue_today ?? 0,
        totalTransactions: stats.total_transactions_today ?? 0,
        activeVouchers: stats.active_vouchers ?? 0,
        pointsIssued: stats.total_points_issued ?? 0,
      }
    ];

    // Fetch stores list
    const storesRes = await fetch(`${API_BASE_URL}/admin/stores`, { cache: 'no-store' });
    const storesData = storesRes.ok ? await storesRes.json() : { stores: [] };

    return NextResponse.json({
      dailyStats,
      memberSummary,
      stores: storesData.stores ?? [],
      rawStats: stats,
    });
  } catch (err: unknown) {
    console.error("[dashboard-api] error:", err);
    return NextResponse.json({
      dailyStats: [],
      memberSummary: { total: 0, tiers: { Platinum: 0, Gold: 0, Silver: 0 } },
      stores: [],
    });
  }
}
