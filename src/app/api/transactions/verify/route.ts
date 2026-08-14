import { NextRequest, NextResponse } from "next/server";

interface VerifyResponse {
  success: boolean;
  status?: "COMPLETED" | "CANCELLED";
  reason?: string;
  message: string;
}

export async function POST(_req: NextRequest): Promise<NextResponse<VerifyResponse>> {
  return NextResponse.json(
    {
      success: false,
      message: "Manual transaction verification is disabled. Transactions are verified and processed automatically in real-time via ESB/POS integration.",
    },
    { status: 400 }
  );
}
