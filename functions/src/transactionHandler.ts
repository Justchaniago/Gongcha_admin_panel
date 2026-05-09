import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getApp } from 'firebase-admin/app';
import { randomUUID } from 'crypto';
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
  if (!receiptNumber?.trim() || !storeId?.trim() || !memberId?.trim() || !staffId?.trim() || totalAmount <= 0) {
    return {
      success: false,
      error: 'Invalid request parameters',
      code: 'INVALID_PARAMS',
    };
  }

  if (totalAmount < 1000 || totalAmount > 10_000_000) {
    return {
      success: false,
      error: `totalAmount out of range: ${totalAmount}. Must be between 1000 and 10000000`,
      code: 'INVALID_AMOUNT',
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

  // Update pendingPoints so member app can display them while awaiting approval
  const notifId = randomUUID();
  const amountFormatted = `Rp ${totalAmount.toLocaleString('id-ID')}`;
  await Promise.all([
    userRef.update({
      pendingPoints: FieldValue.increment(finalPoints),
      updatedAt: new Date(),
    }),
    db.collection('users').doc(memberId).collection('notifications').doc(notifId).set({
      type: 'points_pending',
      title: '⏳ Poin Pending Masuk!',
      body: `Transaksi ${receiptNumber} di ${storeName || storeId} (${amountFormatted}) sedang diverifikasi. ${finalPoints} poin akan dikreditkan setelah verifikasi.`,
      isRead: false,
      createdAt: new Date().toISOString(),
      data: {
        transactionId: transactionRef.id,
        receiptNumber,
        storeId,
        storeName,
        points: finalPoints,
        totalAmount,
      },
    }),
  ]);

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
  if (!receiptNumber?.trim() || !storeId?.trim() || !memberId?.trim() || !staffId?.trim() || !voucherCode?.trim()) {
    return {
      success: false,
      error: 'Invalid request parameters',
      code: 'INVALID_PARAMS',
    };
  }

  // Check for duplicate redemption — only block on COMPLETED, not stale PENDING
  const existingReceipt = await db
    .collection('transactions')
    .where('receiptNumber', '==', receiptNumber)
    .where('storeId', '==', storeId)
    .limit(10)
    .get();

  const alreadyCompleted = existingReceipt.docs.some(d => d.data().status === 'COMPLETED');
  if (alreadyCompleted) {
    return {
      success: false,
      error: 'Receipt already processed',
      code: 'DUPLICATE_RECEIPT',
    };
  }

  const userRef = db.collection('users').doc(memberId);
  const now = new Date();
  const transactionRef = db.collection('transactions').doc();

  let finalUserData: any;

  try {
    await db.runTransaction(async (tx) => {
      const userSnap = await tx.get(userRef);

      if (!userSnap.exists) {
        throw Object.assign(new Error('User not found'), { code: 'USER_NOT_FOUND' });
      }

      finalUserData = userSnap.data();
      const userVouchers = finalUserData?.vouchers || [];
      const voucherIndex = userVouchers.findIndex(
        (v: any) => v.code === voucherCode && !v.isUsed
      );

      if (voucherIndex === -1) {
        throw Object.assign(new Error('Voucher not found or already redeemed'), { code: 'VOUCHER_NOT_FOUND' });
      }

      const updatedVouchers = [...userVouchers];
      updatedVouchers[voucherIndex] = {
        ...updatedVouchers[voucherIndex],
        isUsed: true,
        redeemedAt: now.toISOString(),
        usedAtStore: storeName,
      };

      const transactionData: Omit<TransactionRecord, 'id'> = {
        receiptNumber,
        storeId,
        storeName,
        memberId,
        memberName,
        staffId,
        totalAmount: 0,
        type: 'redeem',
        status: 'COMPLETED',
        pointsEarned: 0,
        voucherCode,
        voucherTitle,
        createdAt: now,
        createdBy: staffId,
      };

      tx.set(transactionRef, transactionData);
      tx.update(userRef, { vouchers: updatedVouchers });
    });
  } catch (err: any) {
    if (err.code === 'USER_NOT_FOUND' || err.code === 'VOUCHER_NOT_FOUND') {
      return { success: false, error: err.message, code: err.code };
    }
    throw err;
  }

  try {
    await logTransaction(transactionRef.id, staffId, memberId, 0, 0, {
      voucherCode,
      voucherTitle,
      status: 'COMPLETED',
    });
  } catch (err) {
    console.error('Failed to log activity:', err);
  }

  return {
    success: true,
    transactionId: transactionRef.id,
    pointsEarned: 0,
    newBalance: finalUserData?.points || 0,
    newTier: finalUserData?.tier || 'REGULAR',
  };
}
