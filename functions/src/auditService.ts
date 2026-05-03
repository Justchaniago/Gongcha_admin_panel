import { getFirestore } from 'firebase-admin/firestore';
import { getApp } from 'firebase-admin/app';
import { ActivityLogEntry } from './types';

const DB_NAME = 'gongcha-ver001';

export async function logActivity(
  action: string,
  actor: string,
  resource: string,
  resourceId: string,
  changes: Record<string, unknown>,
  metadata?: Record<string, unknown>
): Promise<string> {
  const db = getFirestore(getApp(), DB_NAME);
  const now = new Date();

  const entry: ActivityLogEntry = {
    id: '', // Will be set by Firestore
    action,
    actor,
    resource,
    resourceId,
    changes,
    timestamp: now,
    metadata,
  };

  const docRef = await db.collection('activity_logs').add({
    ...entry,
    timestamp: now,
  });

  return docRef.id;
}

export async function logTransaction(
  transactionId: string,
  staffId: string,
  memberId: string,
  amount: number,
  pointsEarned: number,
  changes: Record<string, unknown>
): Promise<string> {
  return logActivity(
    'transaction.created',
    staffId,
    'transactions',
    transactionId,
    {
      ...changes,
      amount,
      pointsEarned,
    },
    {
      memberId,
      type: changes.type,
    }
  );
}
