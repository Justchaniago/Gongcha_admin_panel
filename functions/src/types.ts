export interface TransactionCreateRequest {
  receiptNumber: string;
  storeId: string;
  storeName: string;
  memberId: string;
  memberName: string;
  staffId: string;
  totalAmount: number;
  type: 'earn' | 'redeem';
  voucherCode?: string;
  voucherTitle?: string;
}

export interface PointsCalculation {
  basePoints: number;
  tierMultiplier: number;
  finalPoints: number;
  earnedAt: Date;
}

export interface TransactionRecord {
  id: string;
  receiptNumber: string;
  storeId: string;
  storeName: string;
  memberId: string;
  memberName: string;
  staffId: string;
  totalAmount: number;
  type: 'earn' | 'redeem';
  status: 'COMPLETED' | 'REFUNDED' | 'PENDING';
  pointsEarned: number;
  voucherCode?: string;
  voucherTitle?: string;
  createdAt: Date;
  createdBy: string;
  approvedBy?: string;
  approvedAt?: Date;
}

export interface UserPoints {
  currentBalance: number;
  totalEarned: number;
  totalRedeemed: number;
  tier: 'REGULAR' | 'SILVER' | 'GOLD' | 'PLATINUM';
  tierPoints: number;
  lastUpdated: Date;
}

export interface ActivityLogEntry {
  id: string;
  action: string;
  actor: string;
  resource: string;
  resourceId: string;
  changes: Record<string, unknown>;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface TransactionResponse {
  success: boolean;
  transactionId?: string;
  pointsEarned?: number;
  newBalance?: number;
  newTier?: string;
  error?: string;
  code?: string;
}
