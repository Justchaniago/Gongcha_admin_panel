import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { writeActivityLog } from "@/lib/activityLog";

/**
 * POST /api/vouchers/redeem
 * Member redeems a reward → creates voucher + deducts points
 * Auth: Firebase ID token (member)
 */
export async function POST(req: NextRequest) {
  try {
    // Verify Firebase Auth token
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Missing or invalid Authorization header" },
        { status: 401 }
      );
    }

    const token = authHeader.slice(7);
    let decoded;
    try {
      decoded = await adminAuth.verifyIdToken(token);
    } catch (err: any) {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401 }
      );
    }

    const memberId = decoded.uid;
    const body = await req.json();
    const rewardId = String(body.rewardId ?? "").trim();

    if (!rewardId) {
      return NextResponse.json(
        { error: "rewardId is required" },
        { status: 400 }
      );
    }

    // Get reward
    const rewardRef = adminDb.collection("rewards_catalog").doc(rewardId);
    const rewardSnap = await rewardRef.get();

    if (!rewardSnap.exists) {
      return NextResponse.json(
        { error: "Reward not found" },
        { status: 404 }
      );
    }

    const reward = rewardSnap.data()!;
    if (!reward.isActive || !reward.isRedeemable) {
      return NextResponse.json(
        { error: "Reward is not available" },
        { status: 400 }
      );
    }

    // Get member profile
    const userRef = adminDb.collection("users").doc(memberId);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    const userData = userSnap.data()!;
    const currentPoints = userData.currentPoints || userData.points || 0;
    const pointsRequired = Number(reward.pointsrequired ?? 0);

    // Validate points balance
    if (currentPoints < pointsRequired) {
      return NextResponse.json(
        {
          error: "Insufficient points",
          code: "INSUFFICIENT_POINTS",
          required: pointsRequired,
          current: currentPoints,
        },
        { status: 400 }
      );
    }

    // Generate voucher code
    const voucherCode = generateVoucherCode();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

    const newVoucher = {
      code: voucherCode,
      title: reward.title,
      description: reward.description,
      rewardId,
      createdAt: now,
      expiresAt,
      isUsed: false,
    };

    // Deduct points + update tier
    const newBalance = currentPoints - pointsRequired;
    const newTier = determineTierForPoints(newBalance);

    // Update user: deduct points, add voucher
    await userRef.update({
      currentPoints: newBalance,
      points: newBalance, // Keep both for compatibility
      tier: newTier,
      vouchers: (userData.vouchers || []).concat([newVoucher]),
      lastRedemptionAt: now,
    });

    // Log activity (member action, no admin actor)
    try {
      // Member redemptions logged separately in activity_logs for audit trail
      // using backend-only logging (not admin session-based)
      const activityRef = adminDb.collection("activity_logs").doc();
      await activityRef.set({
        actorUid: memberId,
        actorEmail: decoded.email ?? null,
        actorRole: null,
        action: "VOUCHER_REDEEMED",
        targetType: "voucher",
        targetId: voucherCode,
        targetLabel: `${reward.title} (${rewardId})`,
        summary: `Member redeemed reward: ${reward.title}`,
        source: "api/vouchers:redeem:POST",
        status: "success",
        metadata: {
          memberId,
          rewardId,
          pointsDeducted: pointsRequired,
          newBalance,
          newTier,
          voucherCode,
          expiresAt: expiresAt.toISOString(),
        },
        createdAt: new Date(),
      });
    } catch (logErr) {
      console.error("Failed to log redemption:", logErr);
      // Don't fail the request if audit log fails
    }

    return NextResponse.json(
      {
        success: true,
        voucher: newVoucher,
        newBalance,
        newTier,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("[vouchers/redeem] error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}

/**
 * Generate a random voucher code (e.g., GONGCHA-ABC123)
 */
function generateVoucherCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "GONGCHA-";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Determine tier based on points (from rbac.ts thresholds)
 * REGULAR: 0-499, SILVER: 500-1999, GOLD: 2000-4999, PLATINUM: 5000+
 */
function determineTierForPoints(points: number): string {
  if (points >= 5000) return "PLATINUM";
  if (points >= 2000) return "GOLD";
  if (points >= 500) return "SILVER";
  return "REGULAR";
}
