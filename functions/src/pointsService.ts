import { UserPoints } from './types';

const TIER_THRESHOLDS = {
  REGULAR: 0,
  SILVER: 500,
  GOLD: 2000,
  PLATINUM: 5000,
};

const TIER_MULTIPLIERS = {
  REGULAR: 1.0,
  SILVER: 1.1,
  GOLD: 1.2,
  PLATINUM: 1.25,
};

const BASE_POINTS_RATE = 1000; // Rp 1000 = 1 point
const MAX_POINTS_PER_MONTH = 500;

export function calculatePoints(
  amount: number,
  currentTier: string = 'REGULAR'
): { basePoints: number; multiplier: number; finalPoints: number } {
  const basePoints = Math.floor(amount / BASE_POINTS_RATE);
  const multiplier = TIER_MULTIPLIERS[currentTier as keyof typeof TIER_MULTIPLIERS] || 1.0;
  const finalPoints = Math.floor(basePoints * multiplier);

  return { basePoints, multiplier, finalPoints };
}

export function determineTier(totalPoints: number): string {
  if (totalPoints >= TIER_THRESHOLDS.PLATINUM) return 'PLATINUM';
  if (totalPoints >= TIER_THRESHOLDS.GOLD) return 'GOLD';
  if (totalPoints >= TIER_THRESHOLDS.SILVER) return 'SILVER';
  return 'REGULAR';
}

export function updateUserPoints(
  currentUser: any,
  pointsEarned: number
): UserPoints {
  const newBalance = (currentUser.points || 0) + pointsEarned;
  const newTier = determineTier(newBalance);

  return {
    currentBalance: newBalance,
    totalEarned: (currentUser.totalEarned || 0) + pointsEarned,
    totalRedeemed: currentUser.totalRedeemed || 0,
    tier: newTier as 'REGULAR' | 'SILVER' | 'GOLD' | 'PLATINUM',
    tierPoints: newBalance,
    lastUpdated: new Date(),
  };
}

export function validatePointsUpdate(
  currentBalance: number,
  earnedThisMonth: number,
  pointsToAdd: number
): { valid: boolean; reason?: string } {
  if (earnedThisMonth + pointsToAdd > MAX_POINTS_PER_MONTH) {
    return {
      valid: false,
      reason: `Monthly points cap exceeded. Current: ${earnedThisMonth}, Limit: ${MAX_POINTS_PER_MONTH}`,
    };
  }

  return { valid: true };
}
