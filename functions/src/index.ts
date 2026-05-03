import { initializeApp } from 'firebase-admin/app';
import * as functions from 'firebase-functions';
import { Request, Response } from 'express';
import { TransactionCreateRequest } from './types';
import { handleEarnTransaction, handleRedeemTransaction } from './transactionHandler';

initializeApp();

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

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
    const body = req.body as TransactionCreateRequest;

    // Validate auth token (bearer token or custom auth)
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      res.status(401).json({ error: 'Missing authorization header' });
      return;
    }

    // TODO: Validate token and extract user context
    // For now, accept any auth header as proof of valid cashier app

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
  } catch (error) {
    console.error('Transaction error:', error);
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
