import { getFirestore } from 'firebase-admin/firestore';
import { getApp } from 'firebase-admin/app';
import { TransactionCreateRequest, TransactionResponse, TransactionRecord } from './types';
import { calculatePoints, updateUserPoints, validatePointsUpdate, determineTier } from './pointsService';
import { logTransaction } from './auditService';

const DB_NAME = 'gongcha-ver001';

export async function handleEarnTransaction(
  req: TransactionCreateRequest
): Promise<TransactionResponse> {
  const db = getFirestore(getApp(), DB_NAME);
  const {
    receiptNumber,
    storeId,
    storeName,
    memberId,
    memberName,
    staffId,
    totalAmount,
  } = req;

  // Validate request
  if (!receiptNumber || !storeId || !memberId || !staffId || totalAmount <= 0) {
    return {
      success: false,
      error: 'Invalid request parameters',
      code: 'INVALID_PARAMS',
    };
  }

  // Check for duplicate receipt
  const existingReceipt = await db
    .collection('transactions')
    .where('receiptNumber', '==', receiptNumber)
    .where('storeId', '==', storeId)
    .limit(1)
    .get();

  if (!existingReceipt.empty) {
    return {
      success: false,
      error: 'Receipt already processed',
      code: 'DUPLICATE_RECEIPT',
    };
  }

  // Get user profile
  const userRef = db.collection('users').doc(memberId);
  const userSnap = await userRef.get();

  if (!userSnap.exists) {
    return {
      success: false,
      error: 'User not found',
      code: 'USER_NOT_FOUND',
    };
  }

  const userData = userSnap.data();
  const currentTier = userData?.tier || 'REGULAR';

  // Calculate points with tier multiplier
  const { basePoints, multiplier, finalPoints } = calculatePoints(totalAmount, currentTier);

  // Validate monthly cap
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const monthTransactions = await db
    .collection('transactions')
    .where('memberId', '==', memberId)
    .where('type', '==', 'earn')
    .where('status', '==', 'COMPLETED')
    .where('createdAt', '>=', monthStart)
    .get();

  const earnedThisMonth = monthTransactions.docs.reduce((sum, doc) => {
    return sum + (doc.data().pointsEarned || 0);
  }, 0);

  const validationResult = validatePointsUpdate(userData?.points || 0, earnedThisMonth, finalPoints);
  if (!validationResult.valid) {
    return {
      success: false,
      error: validationResult.reason,
      code: 'MONTHLY_CAP_EXCEEDED',
    };
  }

  // Create transaction record (PENDING — awaiting admin approval)
  const now = new Date();
  const transactionData: Omit<TransactionRecord, 'id'> = {
    receiptNumber,
    storeId,
    storeName,
    memberId,
    memberName,
    staffId,
    totalAmount,
    type: 'earn',
    status: 'PENDING',  // Hold for admin approval
    pointsEarned: finalPoints,
    createdAt: now,
    createdBy: staffId,
  };

  const transactionRef = await db.collection('transactions').add(transactionData);

  // DO NOT update user points yet — points held pending admin approval
  // Admin PATCH /api/transactions will call applyTransactionReward() when approved

  // Log activity
  try {
    await logTransaction(transactionRef.id, staffId, memberId, totalAmount, finalPoints, {
      basePoints,
      multiplier,
      receiptNumber,
      status: 'PENDING',
    });
  } catch (err) {
    console.error('Failed to log activity:', err);
    // Don't fail the transaction if audit log fails
  }

  // Return current balance (unchanged) — points held until approval
  const currentBalance = userData?.points || 0;

  return {
    success: true,
    transactionId: transactionRef.id,
    pointsEarned: finalPoints,  // What will be added when approved
    newBalance: currentBalance,  // Current balance (unchanged)
    newTier: currentTier,        // Current tier (unchanged, already declared at line 61)
  };
}

export async function handleRedeemTransaction(
  req: TransactionCreateRequest
): Promise<TransactionResponse> {
  const db = getFirestore(getApp(), DB_NAME);
  const {
    receiptNumber,
    storeId,
    storeName,
    memberId,
    memberName,
    staffId,
    voucherCode,
    voucherTitle,
  } = req;

  // Validate request
  if (!receiptNumber || !storeId || !memberId || !staffId || !voucherCode) {
    return {
      success: false,
      error: 'Invalid request parameters',
      code: 'INVALID_PARAMS',
    };
  }

  // Check for duplicate redemption receipt
  const existingReceipt = await db
    .collection('transactions')
    .where('receiptNumber', '==', receiptNumber)
    .where('storeId', '==', storeId)
    .limit(1)
    .get();

  if (!existingReceipt.empty) {
    return {
      success: false,
      error: 'Receipt already processed',
      code: 'DUPLICATE_RECEIPT',
    };
  }

  // Get user and verify voucher ownership
  const userRef = db.collection('users').doc(memberId);
  const userSnap = await userRef.get();

  if (!userSnap.exists) {
    return {
      success: false,
      error: 'User not found',
      code: 'USER_NOT_FOUND',
    };
  }

  const userData = userSnap.data();
  const userVouchers = userData?.vouchers || [];
  const voucherIndex = userVouchers.findIndex(
    (v: any) => v.code === voucherCode && !v.isUsed
  );

  if (voucherIndex === -1) {
    return {
      success: false,
      error: 'Voucher not found or already redeemed',
      code: 'VOUCHER_NOT_FOUND',
    };
  }

  // Create redemption transaction record (PENDING — awaiting admin approval)
  const now = new Date();
  const transactionData: Omit<TransactionRecord, 'id'> = {
    receiptNumber,
    storeId,
    storeName,
    memberId,
    memberName,
    staffId,
    totalAmount: 0,
    type: 'redeem',
    status: 'PENDING',  // Hold for admin approval
    pointsEarned: 0,
    voucherCode,
    voucherTitle,
    createdAt: now,
    createdBy: staffId,
  };

  const transactionRef = await db.collection('transactions').add(transactionData);

  // DO NOT update user vouchers yet — voucher held pending admin approval
  // Admin PATCH /api/transactions will update voucher status when approved

  // Log activity
  try {
    await logTransaction(transactionRef.id, staffId, memberId, 0, 0, {
      voucherCode,
      voucherTitle,
      status: 'PENDING',
    });
  } catch (err) {
    console.error('Failed to log activity:', err);
  }

  return {
    success: true,
    transactionId: transactionRef.id,
    pointsEarned: 0,
    newBalance: userData?.points || 0,  // Unchanged
    newTier: userData?.tier || 'REGULAR',  // Unchanged
  };
}
