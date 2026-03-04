# Transaction Flow Analysis & Issues

## Current State vs Expected State

### 🔴 ISSUE #1: Two Different Verification Workflows

#### Old Workflow (Current Transaction Page)
**Location**: `/transactions` page + `/api/transactions` route
- **Manual Verification**: Staff manually clicks "✓ Verifikasi" button
- **NO POS Data Matching**: Doesn't check transaction number, date, or amount
- **Single Action**: Just updates status to "verified" instantly
- **Points Released**: Immediately when verified
- **Flow**:
  ```
  Staff Manual Verify Click
        ↓
  Update status: pending → verified
        ↓
  Disburse points to member
        ↓
  Done ✓
  ```

#### New Workflow (POS-Based Verification)
**Location**: `/api/transactions/verify` endpoint
- **POS Data Matching**: Requires 3 fields to match:
  1. Transaction ID (transactionId)
  2. Date (posDate in YYYY-MM-DD format)
  3. Amount (posAmount)
- **Auto-Status**: Auto-determines verified/rejected based on match
- **Manual Review Flag**: Rejected transactions flagged with `needsManualReview: true`
- **Points Released Only on Match**: Only released when all 3 match
- **Flow**:
  ```
  POS Data Submission
        ↓
  Check: transactionId match? ✓
  Check: date match? ✓
  Check: amount match? ✓
        ↓
  All match → Status: verified → Release points
             OR
  Any mismatch → Status: rejected + needsManualReview=true
        ↓
  Awaiting manual verification
  ```

---

## 🔴 ISSUE #2: Transaction Page Not Using POS Verification

### Current Transaction Page Flow:

```
┌─ CSV Upload Panel ──────────────────────────────────────┐
│  • Upload CSV from POS                                  │
│  • Match by transactionId ONLY                          │
│  • Bulk verify matched rows                             │
│  • Calls: /api/transactions (POST - action: "verify")   │
└────────────────────────────────────────────────────────┘
         ↓
    Just matches transaction ID, then verifies
    WITHOUT checking date and amount!
```

**What it should do**:
```
┌─ CSV Upload Panel ──────────────────────────────────────┐
│  • Parse: transactionId, amount, date from CSV          │
│  • Extract these fields from Firebase transaction       │
│  • For each record call: /api/transactions/verify       │
│  • Pass: { transactionId, posAmount, posDate }          │
│  • Let endpoint handle: validation + status update      │
└────────────────────────────────────────────────────────┘
         ↓
    Verification based on 3-field match
    Status set by verification logic (verified/rejected)
    Points released only if verified
```

---

## 📊 Data Flow Issues

### Issue #2a: CSV Data Parsing
**Current** (`tx-helpers.tsx` line 33-45):
```javascript
// Parses CSV columns: transactionid, transaction_id, id, txid
// But NO column parsing for: amount, date
// So bulk verify has: ✓ transactionId, ✗ amount, ✗ date
```

**Should be**:
```javascript
// Parse from CSV:
// - Column: transactionid / transaction_id / id
// - Column: amount / total / quantity_value  
// - Column: date / transaction_date / tanggal
// Map to: { transactionId, posAmount, posDate }
```

---

### Issue #2b: Bulk Verify Missing POS Data
**Current** (`TransactionsClient.tsx` line 108-117):
```typescript
// handleMatchVerify calls /api/transactions (POST)
// Sends: { docPaths, action: "verify" }
// Missing: amount, date from CSV
```

**Should be**:
```typescript
// Call /api/transactions/verify for each matched row
// Send: { transactionId, posAmount, posDate }
// Let endpoint determine status based on match
```

---

### Issue #2c: Single Transaction Verification
**Current** (`TransactionsClient.tsx` line 90-100):
```typescript
// handleAction calls /api/transactions (PATCH)
// Sends: { docPath, action: "verify"|"reject" }
// Manual decision, no POS data
```

**Should have option for**:
```typescript
// Option 1: Manual (current) - for staff override
// Option 2: POS Verify (new) - requires POS data
//   Send: { transactionId, posAmount, posDate }
//   Let /api/transactions/verify determine status
```

---

## ✅ What's Already Working

| Component | Status | Notes |
|-----------|--------|-------|
| Dashboard Stats | ✅ | Shows pending, verified, rejected counts correctly |
| Status Badge Colors | ✅ | Green (verified), Orange (pending), Red (rejected) |
| Points Disbursement | ✅ | When verified, points released to member |
| Manual Verify/Reject | ✅ | Single action works fine |
| Bulk Verify | ✅ | Can verify multiple by ID match |
| Rejected Transactions | ✅ | Display in dashboard, marked in UI |
| Points History | ✅ | xpHistory track in user document |
| Tier Auto-Upgrade | ✅ | When points exceed threshold |

---

## ❌ What's NOT Working (Gap Analysis)

| Feature | Expected | Current | Gap |
|---------|----------|---------|-----|
| POS Data Match | 3-field verify | 1-field match | Need to parse & send amount, date |
| Auto Status | Based on POS match | Manual decision | Move logic to endpoint |
| Rejected Flag | needsManualReview | Not set | Need to track in transaction doc |
| CSV Amount Parse | Extract from CSV | Not parsed | Need column mapping |
| CSV Date Parse | Extract from CSV | Not parsed | Need column mapping |
| Endpoint Integration | Call /verify | Calls /transactions | Need UI form for POS data |
| Manual Review UI | Show rejected list | In dashboard only | Need dedicated rejected review section |

---

## 🔧 Required Changes

### 1. **Update CSV Parser** (`tx-helpers.tsx`)
```javascript
// Currently parses only: transactionId
// ADD: Parse amount, date columns from CSV
// Return: { transactionId, posAmount, posDate }
```

### 2. **Add POS Verification Form** (New Component)
```typescript
// Show when clicking verify on pending transaction
// Form inputs:
//   - TransactionID (pre-filled)
//   - Amount from POS (manual input)
//   - Date from POS (date picker)
// Submit → Call /api/transactions/verify
```

### 3. **Update Bulk Verify Handler** (`TransactionsClient.tsx`)
```typescript
// When CSV uploaded and matched:
// For each matched row:
//   1. Extract: transactionId, posAmount, posDate
//   2. Call: /api/transactions/verify
//   3. Handle response: verify/reject status
//   4. Show results: X verified, Y rejected, Z manual review
```

### 4. **Add Rejected Review Section** (`TransactionsClient.tsx`)
```typescript
// New tab or section showing:
// - Rejected transactions (needsManualReview = true)
// - Reason for rejection
// - Option to verify anyway (override)
// - Option to reject permanently
```

### 5. **Update Transaction Schema**
```firestore
// Add to transactions when rejected:
{
  ...existing fields...
  status: "rejected",
  needsManualReview: true,
  reason: "Amount mismatch: DB=61000, POS=62000",
  verifiedAt: Timestamp,
  verifiedBy: uid,
  // Awaiting manual review
}
```

---

## 📋 Recommended Implementation Order

1. ✅ **Already done**: Create `/api/transactions/verify` endpoint ✓
2. ⏳ **Next**: Update CSV parser to extract amount & date
3. ⏳ **Then**: Create POS verification modal/form
4. ⏳ **Then**: Update bulk verify to use new endpoint
5. ⏳ **Finally**: Add rejected transaction review section

---

## Example Flow After Fix

```
┌─────────────────────────────────────────────────┐
│  Cashier inputs POS Receipt Data                │
│  TransactionID: TX-101384                       │
│  Amount: Rp 61,000                              │
│  Date: 2026-03-01                               │
└─────────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────────┐
│  POST /api/transactions/verify                  │
│  {                                              │
│    transactionId: "TX-101384",                  │
│    posAmount: 61000,                            │
│    posDate: "2026-03-01"                        │
│  }                                              │
└─────────────────────────────────────────────────┘
              ↓
    Endpoint checks: ID ✓ Amount ✓ Date ✓
              ↓
    ┌──────────────────────┬──────────────────────┐
    ↓                      ↓
  VERIFIED              REJECTED
  All match         Any mismatch
  Status: "verified"   Status: "rejected"
  needsManualReview: false   needsManualReview: true
  Release points:        Await manual review
  ✓ +61 pts for        ⚠ Flagged for staff
    customer            verification
```

---

## Summary

**The issue**: We created a new POS verification endpoint (`/api/transactions/verify`) but the transaction page still uses the old manual verification workflow. They're not integrated.

**Current state**: Transaction page does CSV matching by ID only, then bulk verifies without POS data check.

**Expected state**: Transaction page should extract POS data (amount, date) from CSV and call the new verification endpoint which validates all 3 fields before determining status.

**Impact**: Rejected transactions (mismatches) aren't being properly caught and flagged for manual review as intended.
