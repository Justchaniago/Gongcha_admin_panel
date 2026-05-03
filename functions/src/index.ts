import { initializeApp, getApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import * as functions from 'firebase-functions';
import { Request, Response } from 'express';
import { TransactionCreateRequest } from './types';
import { handleEarnTransaction, handleRedeemTransaction } from './transactionHandler';

initializeApp();

const DB_NAME = 'gongcha-ver001';
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Roles permitted to submit transactions via Cashier App
const ALLOWED_ROLES = ['STAFF', 'ADMIN', 'SUPER_ADMIN', 'MANAGER', 'STORE_MANAGER'];

interface AuthResult {
  uid: string;
  role: string;
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
  const normalizedRole = rawRole === 'STORE_MANAGER' || rawRole === 'MANAGER' ? 'STAFF' : rawRole;

  if (!ALLOWED_ROLES.includes(rawRole)) {
    return { error: `Role "${profile.role}" is not authorized for transactions`, status: 403 };
  }

  return { uid: decoded.uid, role: normalizedRole };
}

function corsWrapper(req: Request, res: Response): boolean {
  if (req.method === 'OPTIONS') {
    res.set(CORS_HEADERS);
    res.status(204).send('');
    return false;
  }
  res.set(CORS_HEADERS);
  return true;
}

export const transactions = functions.https.onRequest(async (req: Request, res: Response) => {
  if (!corsWrapper(req, res)) return;

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const authResult = await verifyStaffToken(req.headers.authorization);
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
      res.status(400).json({
        success: false,
        error: 'Invalid transaction type',
        code: 'INVALID_TYPE',
      });
      return;
    }

    if (result.success) {
      res.status(201).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error: any) {
    console.error('Transaction error:', error?.message ?? error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'SERVER_ERROR',
    });
  }
});

// Health check endpoint
export const health = functions.https.onRequest((req: Request, res: Response) => {
  res.set(CORS_HEADERS);
  res.status(200).json({ status: 'ok' });
});
