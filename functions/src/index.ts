import { initializeApp, getApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import * as functions from 'firebase-functions';
import * as express from 'express';
import { TransactionCreateRequest } from './types';
import { handleEarnTransaction, handleRedeemTransaction } from './transactionHandler';

initializeApp();

const DB_NAME = 'gongcha-ver001';
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const ALLOWED_ROLES = ['STAFF', 'ADMIN', 'SUPER_ADMIN', 'MANAGER', 'STORE_MANAGER'];

interface AuthResult {
  uid: string;
  role?: string;
}

async function verifyStaffToken(authHeader: string | undefined): Promise<AuthResult | { error: string; status: number }> {
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: 'Missing or invalid Authorization header', status: 401 };
  }

  const token = authHeader.slice(7);
  let decoded: import('firebase-admin/auth').DecodedIdToken;
  try {
    decoded = await getAuth().verifyIdToken(token);
  } catch (err: any) {
    console.warn('[auth] verifyIdToken failed:', err?.code, err?.message);
    return { error: 'Invalid or expired token', status: 401 };
  }

  const db = getFirestore(getApp(), DB_NAME);
  const profileSnap = await db.collection('admin_users').doc(decoded.uid).get();
  if (!profileSnap.exists) {
    return { error: `Staff profile not found for uid ${decoded.uid}`, status: 403 };
  }

  const profile = profileSnap.data()!;
  if (profile.isActive === false) {
    return { error: 'Account is inactive', status: 403 };
  }

  const rawRole = String(profile.role ?? '').toUpperCase();
  if (!ALLOWED_ROLES.includes(rawRole)) {
    return { error: `Role "${profile.role}" is not authorized for transactions`, status: 403 };
  }

  const normalizedRole = rawRole === 'STORE_MANAGER' || rawRole === 'MANAGER' ? 'STAFF' : rawRole;
  return { uid: decoded.uid, role: normalizedRole };
}

async function verifyMemberToken(authHeader: string | undefined): Promise<AuthResult | { error: string; status: number }> {
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: 'Missing or invalid Authorization header', status: 401 };
  }

  const token = authHeader.slice(7);
  try {
    const decoded = await getAuth().verifyIdToken(token);
    return { uid: decoded.uid };
  } catch (err: any) {
    console.warn('[auth] verifyIdToken failed:', err?.code, err?.message);
    return { error: 'Invalid or expired token', status: 401 };
  }
}

function corsMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (req.method === 'OPTIONS') {
    res.set(CORS_HEADERS).status(204).send('');
    return;
  }
  res.set(CORS_HEADERS);
  next();
}

const app = express.default();
app.use(express.json());
app.use(corsMiddleware);

// POST /vouchers/redeem (Member App - redeem reward)
app.post('/vouchers/redeem', async (req: express.Request, res: express.Response) => {
  try {
    const authResult = await verifyMemberToken(req.headers.authorization as string);
    if ('error' in authResult) {
      return res.status(authResult.status).json({ error: authResult.error });
    }

    const memberId = authResult.uid;
    const rewardId = String(req.body.rewardId ?? '').trim();

    if (!rewardId) {
      return res.status(400).json({ error: 'rewardId is required' });
    }

    const db = getFirestore(getApp(), DB_NAME);
    const rewardRef = db.collection('rewards_catalog').doc(rewardId);
    const rewardSnap = await rewardRef.get();

    if (!rewardSnap.exists) {
      return res.status(404).json({ error: 'Reward not found' });
    }

    const reward = rewardSnap.data()!;
    if (!reward.isActive || !reward.isRedeemable) {
      return res.status(400).json({ error: 'Reward is not available' });
    }

    const userRef = db.collection('users').doc(memberId);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      return res.status(404).json({ error: 'Member not found' });
    }

    const userData = userSnap.data()!;
    const currentPoints = userData.currentPoints || userData.points || 0;
    const pointsRequired = Number(reward.pointsrequired ?? 0);

    if (currentPoints < pointsRequired) {
      return res.status(400).json({
        error: 'Insufficient points',
        code: 'INSUFFICIENT_POINTS',
        required: pointsRequired,
        current: currentPoints,
      });
    }

    const voucherCode = generateVoucherCode();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const newVoucher = {
      code: voucherCode,
      title: reward.title,
      description: reward.description,
      rewardId,
      createdAt: now,
      expiresAt,
      isUsed: false,
    };

    const newBalance = currentPoints - pointsRequired;
    const newTier = determineTierForPoints(newBalance);

    await userRef.update({
      currentPoints: newBalance,
      points: newBalance,
      tier: newTier,
      vouchers: (userData.vouchers || []).concat([newVoucher]),
      lastRedemptionAt: now,
    });

    try {
      const activityRef = db.collection('activity_logs').doc();
      await activityRef.set({
        actorUid: memberId,
        actorEmail: null,
        actorRole: null,
        action: 'VOUCHER_REDEEMED',
        targetType: 'voucher',
        targetId: voucherCode,
        targetLabel: `${reward.title} (${rewardId})`,
        summary: `Member redeemed reward: ${reward.title}`,
        source: 'api/vouchers:redeem:POST',
        status: 'success',
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
      console.error('Failed to log redemption:', logErr);
    }

    res.status(201).json({
      success: true,
      voucher: newVoucher,
      newBalance,
      newTier,
    });
  } catch (error: any) {
    console.error('[vouchers/redeem] error:', error);
    res.status(500).json({ error: 'Internal server error', code: 'SERVER_ERROR' });
  }
});

// GET /members/me/transactions (Member App - transaction history)
app.get('/members/me/transactions', async (req: express.Request, res: express.Response) => {
  try {
    const authResult = await verifyMemberToken(req.headers.authorization as string);
    if ('error' in authResult) {
      return res.status(authResult.status).json({ error: authResult.error });
    }

    const memberId = authResult.uid;
    const status = (req.query.status as string) || undefined;
    const limit = Math.min(parseInt((req.query.limit as string) || '50', 10), 100);
    const startAfter = (req.query.startAfter as string) || undefined;

    const db = getFirestore(getApp(), DB_NAME);
    let q: FirebaseFirestore.Query = db.collection('transactions').where('memberId', '==', memberId);

    if (status) {
      const statusValue = normalizeStatus(status);
      q = q.where('status', '==', statusValue);
    }

    q = q.orderBy('createdAt', 'desc');

    if (startAfter) {
      const afterDoc = await db.collection('transactions').doc(startAfter).get();
      if (afterDoc.exists) {
        q = q.startAfter(afterDoc);
      }
    }

    q = q.limit(limit + 1);
    const snap = await q.get();

    const hasMore = snap.docs.length > limit;
    const docs = snap.docs.slice(0, limit);

    const transactions = docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        receiptNumber: data.receiptNumber,
        type: data.type,
        status: data.status,
        pointsEarned: data.pointsEarned || 0,
        pointsDeducted: data.pointsDeducted || 0,
        amount: data.totalAmount || 0,
        voucherCode: data.voucherCode,
        voucherTitle: data.voucherTitle,
        createdAt: data.createdAt?.toDate?.()?.toISOString?.() ?? data.createdAt,
        verifiedAt: data.verifiedAt?.toDate?.()?.toISOString?.() ?? data.verifiedAt,
        verifiedBy: data.verifiedBy,
      };
    });

    res.status(200).json({
      transactions,
      hasMore,
      limit,
      count: transactions.length,
    });
  } catch (error: any) {
    console.error('[members/me/transactions] error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Health check
app.get('/health', (req: express.Request, res: express.Response) => {
  res.status(200).json({ status: 'ok' });
});

function generateVoucherCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = 'GONGCHA-';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function determineTierForPoints(points: number): string {
  if (points >= 5000) return 'PLATINUM';
  if (points >= 2000) return 'GOLD';
  if (points >= 500) return 'SILVER';
  return 'REGULAR';
}

function normalizeStatus(status: unknown): string {
  const s = String(status ?? '').toUpperCase();
  switch (s) {
    case 'PENDING':
      return 'PENDING';
    case 'VERIFIED':
    case 'APPROVED':
    case 'COMPLETED':
      return 'COMPLETED';
    case 'REJECTED':
    case 'CANCELLED':
      return 'CANCELLED';
    default:
      return 'PENDING';
  }
}

// Legacy transactions endpoint (Cashier App backward compatibility)
export const transactions = functions.https.onRequest(async (req, res) => {
  res.set(CORS_HEADERS);
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const authResult = await verifyStaffToken(req.headers.authorization as string);
    if ('error' in authResult) {
      res.status(authResult.status).json({ success: false, error: authResult.error, code: 'UNAUTHORIZED' });
      return;
    }

    const body = req.body as TransactionCreateRequest;
    let result;
    if (body.type === 'earn') {
      result = await handleEarnTransaction(body);
    } else if (body.type === 'redeem') {
      result = await handleRedeemTransaction(body);
    } else {
      res.status(400).json({ success: false, error: 'Invalid transaction type', code: 'INVALID_TYPE' });
      return;
    }

    if (result.success) {
      res.status(201).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error: any) {
    console.error('Transaction error:', error?.message ?? error);
    res.status(500).json({ success: false, error: 'Internal server error', code: 'SERVER_ERROR' });
  }
});

// Member API endpoints (new)
export const api = functions.https.onRequest(app);

// Health check
export const health = functions.https.onRequest((req, res) => {
  res.set(CORS_HEADERS);
  res.status(200).json({ status: 'ok' });
});
