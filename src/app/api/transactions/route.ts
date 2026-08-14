import { NextRequest, NextResponse } from "next/server";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000/api/v1';

export async function GET(req: NextRequest) {
  try {
    const res = await fetch(`${API_BASE_URL}/admin/transactions`, {
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    });

    if (!res.ok) {
      return NextResponse.json([]);
    }

    const data = await res.json();
    const rawList = Array.isArray(data) ? data : (data.transactions ?? []);
    const txs = rawList.map((t: any) => ({
      docId: t.id,
      docPath: `transactions/${t.id}`,
      receiptNumber: t.external_order_id || t.id,
      transactionId: t.external_order_id || t.id,
      memberName: t.member_id || "Member",
      userId: t.member_id,
      uid: t.member_id,
      memberId: t.member_id,
      totalAmount: t.total_minor ? t.total_minor / 100 : (t.total_amount ?? 0),
      amount: t.total_minor ? t.total_minor / 100 : (t.total_amount ?? 0),
      status: String(t.status || "COMPLETED").toUpperCase(),
      createdAt: t.occurred_at || t.created_at || new Date().toISOString(),
    }));

    return NextResponse.json(txs);
  } catch (err: unknown) {
    console.error("[transactions-api] error:", err instanceof Error ? err.message : String(err));
    return NextResponse.json([]);
  }
}
