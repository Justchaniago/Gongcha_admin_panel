import { NextRequest, NextResponse } from "next/server";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000/api/v1';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") ?? "";
    const page = searchParams.get("page") ?? "1";
    const limit = searchParams.get("pageSize") ?? "20";

    const res = await fetch(`${API_BASE_URL}/admin/members?query=${encodeURIComponent(search)}&page=${page}&limit=${limit}`, {
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    });

    if (!res.ok) {
      return NextResponse.json({ users: [], hasMore: false });
    }

    const data = await res.json();
    const users = (data.members ?? []).map((m: any) => ({
      uid: m.member_id,
      id: m.member_id,
      name: m.display_name,
      email: m.email,
      phone: m.phone_number,
      tier: m.tier,
      currentPoints: m.points_balance,
      createdAt: m.created_at,
    }));

    return NextResponse.json({
      users,
      hasMore: data.total > parseInt(page, 10) * parseInt(limit, 10),
      stats: {
        total: data.total ?? users.length,
        platinum: 0,
        gold: 0,
        silver: 0,
      }
    });
  } catch (err: unknown) {
    console.error("[members-api] error:", err);
    return NextResponse.json({ users: [], hasMore: false });
  }
}
