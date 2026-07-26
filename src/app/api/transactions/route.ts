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
    const txs = (data.transactions ?? []).map((t: any) => ({
      docId: t.id,
      docPath: `transactions/${t.id}`,
      receiptNumber: t.order_number,
      transactionId: t.order_number,
      memberName: t.member_id,
      userId: t.member_id,
      uid: t.member_id,
      memberId: t.member_id,
      totalAmount: t.total_amount,
      amount: t.total_amount,
      status: t.status,
      createdAt: t.created_at,
    }));

    return NextResponse.json(txs);
  } catch (err: unknown) {
    console.error("[transactions-api] error:", err);
    return NextResponse.json([]);
  }
}
