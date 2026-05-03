# Cashier App Migration: Integrate Backend API for Server-Authoritative Transactions

**Objective:** Route transaction processing through Backend API (Admin Panel Cloud Functions) for centralized validation, points ledger, and audit logging.

**Current State (Audit Result):**
- Cashier App already abstracts Firestore via `TransactionService` (lines 230, 272 in `useCashierStore.ts`)
- Uses Cloud Functions: `recordCashierEarnTransaction()`, `recordCashierRedeemClaim()`
- Cashier App has own `functions/` directory with Cloud Functions
- **NOT** direct Firestore mutations from UI ✓

**Problem:** Cashier App Cloud Functions likely perform direct Firestore writes without:
- Points ledger (locked to `users.points`)
- Tier advancement logic
- Activity audit logging
- Duplicate receipt validation at backend

---

## Architecture Decision: Two Approaches

### **Option A: Delegate to Admin Panel Backend API** (Recommended)

**Approach:** Modify `TransactionService` methods to call Admin Panel Backend API instead of own Cloud Functions.

**Pros:**
- Single source of truth for business logic (Admin Panel)
- Points, tier, audit logging centralized
- Easier to maintain + evolve rules
- Cashier App becomes thin client

**Cons:**
- Network dependency on Admin Panel backend (slightly higher latency)
- Requires coordination if Admin Panel deploys

**Effort:** 2–3 hours (modify TransactionService + test)

---

### **Option B: Enhance Cashier App Cloud Functions** (Local)

**Approach:** Keep Cashier App's own Cloud Functions, add points/tier/audit logic inline.

**Pros:**
- No cross-service dependency
- Faster (local function calls)
- Can evolve independently

**Cons:**
- Business logic duplicated (both Admin + Cashier have points calculation)
- Tier/audit logic drift risk
- Harder to maintain consistency

**Effort:** 3–4 hours (duplicate logic + test both services)

---

## Recommended Path: **Option A** (Admin Panel Backend API)

Why: Single backend, consistent rules, easier long-term.

**Scope:** 2 mutation points in `src/services/TransactionService.ts`

---

## Implementation Plan (Option A)

### Step 1: Create Backend API Client

Create `src/services/backendApi.ts` in Cashier App workspace:

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

### Step 2: Update TransactionService.ts

**File location:** `src/services/TransactionService.ts`

**Current state:** Has `recordCashierEarnTransaction()` and `recordCashierRedeemClaim()` methods that write directly to Firestore OR call own Cloud Functions.

**Action:** Modify both to call Admin Panel Backend API via `backendApi.postTransaction()`.

#### **Mutation Point 1: recordCashierEarnTransaction() (line ~56)**

**Before (Direct or own CF):**
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

### Step 2b: Add Import to TransactionService.ts

At top of `src/services/TransactionService.ts`, add:

```typescript
import { postTransaction, TransactionRequest, TransactionResponse } from './backendApi';
```

---

### Step 2c: Modify recordCashierEarnTransaction()

**Current method location:** `src/services/TransactionService.ts` (line ~56)

**Current behavior:** Likely writes directly to Firestore or calls own Cloud Function

**New implementation:**
```typescript
static async recordCashierEarnTransaction(
  receiptNumber: string,
  storeId: string,
  storeName: string,
  memberId: string,
  memberName: string,
  staffId: string,
  totalAmount: number
): Promise<TransactionResponse> {
  try {
    const response = await postTransaction({
      receiptNumber,
      storeId,
      storeName,
      memberId,
      memberName,
      staffId,
      totalAmount,
      type: 'earn',
    });

    if (!response.success) {
      throw new Error(response.error || 'Transaction failed');
    }

    return response; // Returns: transactionId, pointsEarned, newBalance, newTier
  } catch (error) {
    console.error('recordCashierEarnTransaction error:', error);
    throw error;
  }
}
```

---

### Step 2d: Modify recordCashierRedeemClaim()

**Current method location:** `src/services/TransactionService.ts` (line ~100)

**Current behavior:** Likely writes directly to Firestore or calls own Cloud Function

**New implementation:**
```typescript
static async recordCashierRedeemClaim(
  receiptNumber: string,
  storeId: string,
  storeName: string,
  memberId: string,
  memberName: string,
  staffId: string,
  voucherCode: string,
  voucherTitle: string
): Promise<TransactionResponse> {
  try {
    const response = await postTransaction({
      receiptNumber,
      storeId,
      storeName,
      memberId,
      memberName,
      staffId,
      totalAmount: 0,
      type: 'redeem',
      voucherCode,
      voucherTitle,
    });

    if (!response.success) {
      throw new Error(response.error || 'Redeem failed');
    }

    return response;
  } catch (error) {
    console.error('recordCashierRedeemClaim error:', error);
    throw error;
  }
}
```

---

### Step 3: Fix Missing Import

**File:** `src/screens/CashierDashboard.tsx` (line ~267)

**Issue:** `TransactionService.hasTodayReceipt()` called without import

**Fix - Add to imports:**
```typescript
import { TransactionService } from '../services/TransactionService';
```

---

## Step 4: Update Error Handling (Optional but Recommended)

---

### Step 4b: Error Handling Enhancement (Optional)

In `useCashierStore.ts`, improve error messages when calling `TransactionService`:

```typescript
try {
  const response = await TransactionService.recordCashierEarnTransaction(
    receiptNumber, storeId, storeName, memberId, memberName, staffId, totalAmount
  );
  
  // Show response: pointsEarned, newBalance, newTier
  set({
    dailyRevenue: get().dailyRevenue + amount,
    transactionCount: get().transactionCount + 1,
  });
  
  return response;
} catch (error) {
  const msg = error instanceof Error ? error.message : 'Unknown error';
  console.error('processTransaction error:', msg);
  throw new Error(`Transaction failed: ${msg}`);
}
```

---

## Step 5: Environment Configuration

**Add to `.env.local` (Cashier App):**

```bash
# Admin Panel Backend Cloud Functions URL
REACT_APP_BACKEND_URL=https://us-central1-gongcha-app-4691f.cloudfunctions.net
```

For local dev (Admin Panel functions emulator):
```bash
REACT_APP_BACKEND_URL=http://localhost:5001/gongcha-app-4691f/us-central1
```

**Note:** Make sure Admin Panel Cloud Functions are deployed before testing:
```bash
cd /path/to/gongcha-adminnew/functions
npm run build && firebase deploy --only functions
```

---

## Step 6: Test Checklist

- [ ] Auth: Login as cashier → Firebase token available
- [ ] EARN: Enter amount → click confirm → `recordCashierEarnTransaction()` calls backend API
- [ ] Verify: Transaction success response shows `pointsEarned`, `newBalance`, `newTier`
- [ ] REDEEM: Scan voucher → click confirm → `recordCashierRedeemClaim()` calls backend API
- [ ] Verify: Voucher marked as used in Firestore
- [ ] Error (duplicate): Try same receipt twice → API returns `code: 'DUPLICATE_RECEIPT'`
- [ ] Error (monthly cap): Try earning > 500 points in month → API returns `code: 'MONTHLY_CAP_EXCEEDED'`
- [ ] Error (network): Kill backend → clear error message shown in UI
- [ ] Import fix: Check `CashierDashboard.tsx:267` has `TransactionService` import
- [ ] Check Admin Panel `functions/lib/` compiled successfully before testing

---

## Step 7: Verify Audit Logging

After first earn transaction, check Admin Panel Firestore:

1. Open `activity_logs` collection
2. Find entry with `action: 'transaction.created'`, `resource: 'transactions'`
3. Verify fields: `actor` (staffId), `timestamp`, `changes` (amount, pointsEarned)

This proves server-side audit trail is working.

---

## Rollback Plan (If needed)

If Backend API is down or broken:

1. Keep Cashier App working with own Cloud Functions (revert backendApi.ts + TransactionService changes)
2. Points calculation remains client-side (less reliable but functional)
3. Manually backfill transactions to activity_logs once backend is fixed

---

## Integration Timeline

1. **Create backendApi.ts** (10 min)
2. **Add TransactionService import** (2 min)
3. **Modify recordCashierEarnTransaction()** (10 min)
4. **Modify recordCashierRedeemClaim()** (10 min)
5. **Fix CashierDashboard import** (2 min)
6. **Add .env.local config** (2 min)
7. **Test earn + redeem flows locally** (30 min)
8. **Verify audit logs in Firestore** (10 min)
9. **Test edge cases (duplicates, monthly cap, network errors)** (30 min)

**Est. total:** 2–3 hours including QA.

---

## Backend API Reference

**Endpoint:** `POST https://us-central1-gongcha-app-4691f.cloudfunctions.net/transactions`

**Request headers:**
```
Authorization: Bearer <Firebase ID Token>
Content-Type: application/json
```

**Request body (EARN):**
```json
{
  "receiptNumber": "string",
  "storeId": "string",
  "storeName": "string",
  "memberId": "string",
  "memberName": "string",
  "staffId": "string",
  "totalAmount": 50000,
  "type": "earn"
}
```

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

**Possible error codes:**
- `DUPLICATE_RECEIPT` — Receipt already processed in this store
- `USER_NOT_FOUND` — Member UID does not exist
- `MONTHLY_CAP_EXCEEDED` — Earned > 500 points this month
- `INVALID_PARAMS` — Missing required fields
- `SERVER_ERROR` — Internal error

---

## Key Differences: Option A vs Option B

| Aspect | Option A (Recommended) | Option B |
|--------|---|---|
| Business logic | Single source (Admin Panel) | Duplicated (both services) |
| Points calculation | Backend-authoritative | Sync needed between services |
| Tier advancement | One place to update | Two places to update |
| Audit logging | Centralized | Service-specific |
| Testing scope | Smaller (1 backend) | Larger (2 backends) |
| Maintenance burden | Lower (less duplication) | Higher (sync issues) |

---

## Notes & Best Practices

- **Token handling:** Ensure Firebase auth is initialized before calling `postTransaction()`. If user logs out mid-transaction, API rejects (good).
- **Retry logic:** If network fails, transaction is idempotent (duplicate receipt check prevents re-processing).
- **Voucher atomicity:** Backend guarantees voucher is marked used ONLY after transaction succeeds (no orphaned vouchers).
- **Points lock:** Points written to `users.points` immediately (no "potential points" uncertainty).
- **Staff auth:** Backend validates staff can transact at assigned store (client-side auth checks can be removed if redundant).
