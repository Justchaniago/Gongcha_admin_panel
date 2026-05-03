/**
 * Cashier App Integration Guide
 * Copy-paste ready code for Gongcha Cashier App migration
 *
 * Files to create/modify:
 * 1. src/services/backendApi.ts (NEW)
 * 2. src/store/useCashierStore.ts (MODIFY)
 * 3. src/screens/CashierDashboard.tsx (MODIFY)
 * 4. .env.local (ADD env var)
 */

// ============================================================================
// FILE 1: src/services/backendApi.ts (NEW)
// ============================================================================

/*
import { getAuth } from 'firebase/auth';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL ||
  'https://us-central1-gongcha-app-4691f.cloudfunctions.net';

export interface TransactionRequest {
  receiptNumber: string;
  storeId: string;
  storeName: string;
  memberId?: string;
  memberName?: string;
  staffId: string;
  totalAmount: number;
  type: 'earn' | 'redeem';
  voucherCode?: string;
  voucherTitle?: string;
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

export async function postTransaction(
  data: TransactionRequest
): Promise<TransactionResponse> {
  try {
    const auth = getAuth();
    const user = auth.currentUser;

    if (!user) {
      throw new Error('User not authenticated');
    }

    const idToken = await user.getIdToken();

    const response = await fetch(`${BACKEND_URL}/transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Transaction failed');
    }

    return await response.json();
  } catch (error) {
    console.error('Backend API error:', error);
    throw error;
  }
}
*/

// ============================================================================
// FILE 2: src/store/useCashierStore.ts (MODIFY)
// ============================================================================

/*
// ADD IMPORT at top:
import { postTransaction } from '../services/backendApi';

// REMOVE these if only used for transactions:
// import { addDoc, collection, updateDoc, serverTimestamp } from 'firebase/firestore';

// ============================================================================
// MUTATION 1: processTransaction() ~line 143
// ============================================================================

OLD CODE (around line 166):
----
const transactionData = {
  receiptNumber,
  storeId: staff.assignedStoreId,
  storeName: staff.name,
  userId: activeMember?.uid || null,
  memberId: activeMember?.uid,
  memberName: activeMember?.name,
  staffId: staff.uid,
  totalAmount: amount,
  type: 'earn',
  status: 'COMPLETED',
  potentialPoints,
  createdAt: serverTimestamp(),
};

await addDoc(collection(firestoreDb, 'transactions'), transactionData);

// Update local state
set({
  dailyRevenue: get().dailyRevenue + amount,
  transactionCount: get().transactionCount + 1,
  activeMember: {
    ...activeMember!,
    points: (activeMember?.points || 0) + potentialPoints,
  },
});
----

NEW CODE:
----
const response = await postTransaction({
  receiptNumber,
  storeId: staff.assignedStoreId,
  storeName: staff.name,
  memberId: activeMember?.uid,
  memberName: activeMember?.name,
  staffId: staff.uid,
  totalAmount: amount,
  type: 'earn',
});

if (!response.success) {
  throw new Error(response.error || 'Transaction failed');
}

// Update local state with response
set({
  dailyRevenue: get().dailyRevenue + amount,
  transactionCount: get().transactionCount + 1,
  activeMember: activeMember ? {
    ...activeMember,
    points: response.newBalance || activeMember.points,
    tier: response.newTier || activeMember.tier,
  } : undefined,
});

return response;
----

// ============================================================================
// MUTATION 2: redeemVoucher() ~line 179
// ============================================================================

OLD CODE (around line 190-220):
----
const userRef = doc(firestoreDb, 'users', activeMember.uid);
const updatedVouchers = activeMember.vouchers.map((v) =>
  v.code === voucherCode ? { ...v, isUsed: true } : v
);
await updateDoc(userRef, { vouchers: updatedVouchers });

const transactionData = {
  receiptNumber: `REDEEM-${voucherCode}`,
  storeId: staff.assignedStoreId,
  storeName: staff.name,
  userId: activeMember.uid,
  memberId: activeMember.uid,
  memberName: activeMember.name,
  staffId: staff.uid,
  totalAmount: 0,
  type: 'redeem',
  status: 'COMPLETED',
  voucherCode,
  voucherTitle: scannedVoucher.title,
  createdAt: serverTimestamp(),
};

await addDoc(collection(firestoreDb, 'transactions'), transactionData);

set({
  // ... state updates ...
  activeMember: {
    ...activeMember,
    vouchers: updatedVouchers,
  },
});
----

NEW CODE:
----
const response = await postTransaction({
  receiptNumber: `REDEEM-${voucherCode}`,
  storeId: staff.assignedStoreId,
  storeName: staff.name,
  memberId: activeMember.uid,
  memberName: activeMember.name,
  staffId: staff.uid,
  totalAmount: 0,
  type: 'redeem',
  voucherCode,
  voucherTitle: scannedVoucher.title,
});

if (!response.success) {
  throw new Error(response.error || 'Redeem failed');
}

// Update local state
const updatedVouchers = activeMember.vouchers.map((v) =>
  v.code === voucherCode ? { ...v, isUsed: true, redeemedAt: new Date() } : v
);

set({
  // ... state updates ...
  activeMember: {
    ...activeMember,
    vouchers: updatedVouchers,
  },
});

return response;
----
*/

// ============================================================================
// FILE 3: src/screens/CashierDashboard.tsx (MODIFY)
// ============================================================================

/*
// CALLER 1: processTransaction (around line 168)

OLD CODE:
----
try {
  await processTransaction(amount, posTrxId.trim(), true);
  const pts = Math.floor(amount / 1000);
  onShowAlert(`Transaksi sukses! Pelanggan mendapat +${pts} Pts.`, 'success');
} catch (error) {
  onShowAlert("Gagal memproses transaksi. Periksa koneksi internet.", "error");
}
----

NEW CODE:
----
try {
  const result = await processTransaction(amount, posTrxId.trim(), true);
  onShowAlert(
    `Transaksi sukses! Pelanggan mendapat +${result.pointsEarned} Pts. (${result.newTier})`,
    'success'
  );
} catch (error) {
  const msg = error instanceof Error ? error.message : 'Unknown error';
  onShowAlert(
    `Gagal memproses transaksi: ${msg}. Coba lagi atau hubungi support.`,
    "error"
  );
}
----

// CALLER 2: redeemVoucher (around line 588)

OLD CODE:
----
try {
  await redeemVoucher();
  onShowAlert("Voucher berhasil ditukar!", "success");
} catch (error) {
  onShowAlert("Gagal menukar voucher. Coba lagi.", "error");
}
----

NEW CODE:
----
try {
  const result = await redeemVoucher();
  onShowAlert(
    `Voucher "${result.voucherTitle}" berhasil ditukar!`,
    "success"
  );
} catch (error) {
  const msg = error instanceof Error ? error.message : 'Unknown error';
  onShowAlert(
    `Gagal menukar voucher: ${msg}. Periksa kode atau hubungi support.`,
    "error"
  );
}
----
*/

// ============================================================================
// FILE 4: .env.local (ADD)
// ============================================================================

/*
# Backend Cloud Functions URL
REACT_APP_BACKEND_URL=https://us-central1-gongcha-app-4691f.cloudfunctions.net

# Local dev (Firebase Emulator):
# REACT_APP_BACKEND_URL=http://localhost:5001/gongcha-app-4691f/us-central1
*/

// ============================================================================
// Testing Checklist
// ============================================================================

/*
✓ Auth: Login as cashier → token extracted successfully
✓ EARN: Scan member → enter amount → confirm → transaction created via API
✓ Response: pointsEarned, newBalance, newTier displayed in UI
✓ REDEEM: Scan voucher → confirm → voucher marked used via API
✓ Error: Duplicate receipt → API returns code: 'DUPLICATE_RECEIPT'
✓ Error: Non-member earn → API returns code: 'USER_NOT_FOUND'
✓ Network error: Show clear message (not generic "check internet")
✓ Load test: Multiple rapid transactions → no race conditions
*/

export {};
