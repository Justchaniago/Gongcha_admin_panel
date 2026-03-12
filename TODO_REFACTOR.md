# Refactoring Plan: Align Code with Firestore Schema

## Schema (Source of Truth)
- `receiptNumber` (not `transactionId`)
- `storeId`, `storeName` (not `storeLocation`)
- `userId` (not `memberId`)
- `totalAmount` (not `amount`)
- Status: `PENDING`, `COMPLETED`, `CANCELLED`, `REFUNDED` (not lowercase)

## Files to Update

### 1. src/app/transactions/tx-helpers.tsx
- [ ] Tx interface: rename fields
- [ ] extractPosData: use receiptNumber
- [ ] StatusBadge: use uppercase

### 2. src/app/transactions/TransactionsClient.tsx
- [ ] Field mappings
- [ ] Status filters
- [ ] API calls

### 3. src/app/dashboard/DashboardClient.tsx
- [ ] Transaction type
- [ ] Field mappings

### 4. src/app/api/transactions/route.ts
- [ ] GET handler
- [ ] PATCH handler (verify/reject)
- [ ] POST handler

### 5. src/app/api/transactions/verify/route.ts
- [ ] Status handling

