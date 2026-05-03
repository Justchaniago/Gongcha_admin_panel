# Cashier App Migration: Direct Firestore → Backend API

**Objective:** Replace direct `addDoc(transactions)` calls with `POST /transactions` API calls to Backend Cloud Functions.

**Scope:** 3 mutation points in `src/store/useCashierStore.ts` + 2 callers in `src/screens/CashierDashboard.tsx`.

---

## Step 1: Add API Client Service

Create `src/services/backendApi.ts`:

```typescript
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
```

---

## Step 2: Update useCashierStore.ts

### **Mutation Point 1: EARN Transaction (line ~166)**

**Before:**
```typescript
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
```

**After:**
```typescript
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

const transactionId = response.transactionId;
const pointsEarned = response.pointsEarned || potentialPoints;
```

### **Mutation Point 2: REDEEM Voucher Transaction (line ~212)**

**Before:**
```typescript
// First update user vouchers
const userRef = doc(firestoreDb, 'users', activeMember.uid);
const updatedVouchers = activeMember.vouchers.map((v) =>
  v.code === voucherCode ? { ...v, isUsed: true } : v
);
await updateDoc(userRef, { vouchers: updatedVouchers });

// Then record transaction
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
```

**After:**
```typescript
// Call backend API (handles voucher update atomically)
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

// No longer update user doc locally—backend handles atomicity
const transactionId = response.transactionId;
```

### **Mutation Point 3: Remove Direct Firestore Import (if not used elsewhere)**

Check if `addDoc`, `updateDoc`, `serverTimestamp` are still needed elsewhere. If not, remove:

```typescript
// Remove these if only used for transactions:
import { addDoc, collection, updateDoc, serverTimestamp } from 'firebase/firestore';
```

---

## Step 3: Update CashierDashboard.tsx Callers

### **Caller 1: processTransaction() (line ~168)**

**Before:**
```typescript
try {
  await processTransaction(amount, posTrxId.trim(), true);
  const pts = Math.floor(amount / 1000);
  onShowAlert(`Transaksi sukses! Pelanggan mendapat +${pts} Pts.`, 'success');
} catch (error) {
  onShowAlert("Gagal memproses transaksi. Periksa koneksi internet.", "error");
}
```

**After:**
```typescript
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
```

**Update processTransaction return type:**

In `useCashierStore.ts`, make `processTransaction` return response:

```typescript
async processTransaction(amount: number, receiptNumber: string, isEarn: boolean) {
  // ... validation ...
  
  const response = await postTransaction({ /* ... */ });
  
  // Update local state with response
  set({
    // ... local updates using response data ...
    dailyRevenue: get().dailyRevenue + amount,
    transactionCount: get().transactionCount + 1,
  });
  
  return response;
}
```

### **Caller 2: redeemVoucher() (line ~588)**

**Before:**
```typescript
try {
  await redeemVoucher();
  onShowAlert("Voucher berhasil ditukar!", "success");
} catch (error) {
  onShowAlert("Gagal menukar voucher. Coba lagi.", "error");
}
```

**After:**
```typescript
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
```

---

## Step 4: Environment Configuration

**Add to `.env.local`:**

```bash
# Backend Cloud Functions URL
REACT_APP_BACKEND_URL=https://us-central1-gongcha-app-4691f.cloudfunctions.net
```

For local dev (Firebase Emulator):
```bash
REACT_APP_BACKEND_URL=http://localhost:5001/gongcha-app-4691f/us-central1
```

---

## Step 5: Test Checklist

- [ ] Auth: Login as cashier → token extracted successfully
- [ ] EARN: Scan member → enter amount → confirm → transaction created via API
- [ ] Verify response: `pointsEarned`, `newBalance`, `newTier` shown in UI
- [ ] REDEEM: Scan voucher → confirm → voucher marked used via API
- [ ] Error: Try duplicate receipt → API returns `code: 'DUPLICATE_RECEIPT'`
- [ ] Error: Try non-member earn → API returns `code: 'USER_NOT_FOUND'`
- [ ] Network: Airplane mode → clear error message (not generic "check internet")

---

## Step 6: Rollback Plan

If API fails mid-deployment:

1. Revert to direct Firestore writes (undo steps 1–3)
2. Keep daily_stats Cloud Function (still aggregates revenue)
3. Manually reconcile transactions from `activity_logs` vs `transactions`

---

## Integration Timeline

1. **Create backendApi.ts** (5 min)
2. **Update useCashierStore.ts** (15 min)
3. **Update CashierDashboard.tsx** (10 min)
4. **Test earn + redeem flows** (30 min)
5. **QA: edge cases + error handling** (1–2 hours)
6. **Deploy to staging, then prod** (after approval)

**Est. total:** 2–3 hours including QA.

---

## Backend API Contract (Reference)

**Endpoint:** `POST https://us-central1-gongcha-app-4691f.cloudfunctions.net/transactions`

**Request:** (See backendApi.ts `TransactionRequest`)

**Response (Success 201):**
```json
{
  "success": true,
  "transactionId": "trx-abc123",
  "pointsEarned": 50,
  "newBalance": 550,
  "newTier": "SILVER"
}
```

**Response (Error 400):**
```json
{
  "success": false,
  "error": "Duplicate receipt detected",
  "code": "DUPLICATE_RECEIPT"
}
```

---

## Notes

- Backend validates **staff auth** + **store assignment** → remove client-side auth checks if redundant
- Voucher atomicity now guaranteed server-side → no risk of orphaned "used" vouchers
- Points locked immediately → no more "potential points" uncertainty
- Activity logging automatic → no need for client-side audit trail
