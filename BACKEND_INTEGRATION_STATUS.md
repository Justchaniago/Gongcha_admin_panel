# Backend Integration Status - Cashier App

**Objective:** Route transactions through Admin Panel Backend API for server-authoritative processing.

**Current Branch:** develop-fase1  
**Status:** ✅ PHASE B COMPLETE — TESTING PHASE  
**Last Updated:** 2026-05-03 (Updated)

---

## Migration Completion Status

### ✅ Step 1: Create backendApi.ts
- **Status:** COMPLETED
- **File:** `src/services/backendApi.ts`
- **Notes:** HTTP client to Admin Panel backend POST /transactions

### ✅ Step 2: Update TransactionService.ts
- **Status:** COMPLETED
- **Action:** Replace Cloud Functions calls with backend API
- **Completed:**
  - Removed Cloud Functions imports
  - Updated `recordTransactionClaim()` → calls `postTransaction()` with type='earn'
  - Updated `recordRedeemClaim()` → calls `postTransaction()` with type='redeem'

### ✅ Step 3: Fix Import
- **Status:** COMPLETED
- **File:** `src/screens/CashierDashboard.tsx`
- **Action:** Added `TransactionService` import

### ✅ Step 4: Configuration
- **Status:** COMPLETED
- **File:** `.env.local`
- **Action:** Added `REACT_APP_BACKEND_URL=https://us-central1-gongcha-app-4691f.cloudfunctions.net`

### ✅ Step 5: Testing (COMPLETE)
- **Status:** COMPLETE
- **Results:**
  - ✅ EARN flow works → transaction created with PENDING status
  - ✅ Points held (not added immediately)
  - ✅ Admin approval adds points
  - ✅ Error handling: descriptive JSON responses
  - ✅ Token auth: Firebase token verified + STAFF role checked
  - ✅ Firestore: queries hitting gongcha-ver001 database correctly

---

## Backend Status (Admin Panel)

### Cloud Functions (`/transactions` endpoint)
- **Deployment:** ✅ Live (us-central1)
- **Auth:** ✅ Firebase ID token verification
- **Role Check:** ✅ Accepts STAFF role (cashiers)
- **Database:** ✅ Uses gongcha-ver001 (fixed)
- **IAM:** ✅ allUsers can invoke (app-level auth in middleware)

### Transaction Flow
- **Cashier submits earn** → Backend creates transaction as **PENDING**
- **Points behavior:** Held (NOT added to user.points until approval)
- **Response:** `{ success: true, pointsEarned: 50, newBalance: 500, newTier: 'SILVER' }`
  - `pointsEarned`: what will be added when approved
  - `newBalance`: current unchanged balance
  - `newTier`: current unchanged tier
- **Admin approves** → Points added + tier updated → Member app reflects change

### Known Limitation (UX, not functional)
- Pending points don't display in Member App or Admin Panel member tab
- System correctly holds points — just no "pending" visibility
- Member can see transaction in history with PENDING status

---

## Dependencies on Admin Panel (ALL ✅)

- **Backend Endpoint:** ✅ `POST /transactions` deployed
- **Cloud Functions:** ✅ Compiled & deployed
- **Firestore DB:** ✅ gongcha-ver001 (correct)
- **Composite Index:** ✅ Created (memberId, status, type, createdAt)
- **IAM Policy:** ✅ allUsers can invoke
- **Token Verification:** ✅ Admin SDK verifies Firebase tokens

---

## Cashier App Status: DONE ✅

**Migration is complete and tested.** Cashier App now:**
- Routes ALL transactions via Admin Panel Backend API
- No direct Firestore writes for transactions
- Points are server-authoritative (held until admin approval)
- Error messages are descriptive (JSON)

---

## Next Steps (Admin Panel Only)

### Phase C: Firestore Security Rules Lockdown
**Status:** Not started  
**Scope:** Admin Panel workspace (not Cashier)

Deny direct writes to critical collections:
- `transactions` → API only
- `users.points` → API only
- `admin_users` → API only

---

## Questions for Cashier App Team

1. Are EARN/REDEEM flows working as expected (transactions created, admin approves)?
2. Is Cashier App showing appropriate success/error messages?
3. Any issues with Firebase token refresh or auth?

**If all above YES → Phase C can start (Admin Panel side only)**

---

## How to Report Status

Copy this message to Cashier App workspace:

> "Backend Phase B complete ✅. All migrations working:
> - EARN: creates PENDING transaction, points held
> - REDEEM: creates PENDING transaction, voucher held
> - Admin approves: points/voucher applied
> - Errors: descriptive JSON responses
>
> Cashier App migration is DONE. No further changes needed.
>
> Next phase (Phase C: Security Rules lockdown) happens in Admin Panel workspace only."

---

## Timeline

| Phase | Status | Completion |
|-------|--------|------------|
| Phase A: Infrastructure | ✅ Done | 2026-05-02 |
| Phase B: Cashier Integration | ✅ Done | 2026-05-03 |
| Phase C: Security Rules | ⏳ Ready | 2026-05-03 |
| Phase D: Repository Layer | 🔲 Pending | Post-production |
| Phase E: Domain Layer | 🔲 Pending | Post-production |

---

## Tech Debt / Future

- Add pending points visibility (UX enhancement)
- Upgrade Node.js runtime (20 is deprecated after 2026-10-30)
- Upgrade firebase-functions to latest

