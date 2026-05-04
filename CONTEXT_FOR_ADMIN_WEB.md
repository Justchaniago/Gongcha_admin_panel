# GONGCHA CASHIER APP - CONTEXT FOR ADMIN WEB WORKSPACE

**Copy-paste this entire document to your admin web agent for full context.**

## 🚀 Project Overview
- **App Name**: Gongcha Cashier (React Native Expo app)
- **Current Directory**: `/Users/f/gongcha_cashierapp`
- **Purpose**: Mobile POS/cashier terminal for Gongcha stores with loyalty points, QR scanning, transaction recording, and voucher redemption.
- **Backend**: Firebase (Firestore `gongcha-ver001` DB, Cloud Functions)
- **Key Features**:
  - Staff login (email/password → loads store + cashiers)
  - Blind PIN unlock (4-digit passcode per cashier)
  - QR scanning (member profiles/vouchers)
  - Record transactions (earn pending points)
  - Redeem vouchers (mark as used)
  - Real-time dashboard (revenue, members, tiers, history)
  - Auto-lock after 5min idle

## 🔐 Authentication & Passcode Flow
```
LoginScreen.tsx → StaffAuth (Zustand) → CashierDashboard.tsx
    ↓ (email/pass)
Admin_users doc → staff {cashiers: [{staffId, name, passcode}]}
    ↓ (select cashier or PIN unlock)
BlindPinUnlockScreen.tsx → setActiveCashier(cashier, locked=false)
```
- **Passcodes**: 4-digit per cashier, stored in `admin_users/{staffUid}/cashiers[]`
- **PIN Screen**: `BlindPinUnlockScreen.tsx` - animated dots, shake on wrong PIN
- **Idle Lock**: 5min inactivity → requires PIN re-entry
- **Active Cashier**: Tracked in `useCashierStore.activeCashier`

**New Features Needed**:
- Admin web must **CRUD cashiers** (add/edit/delete per store, generate passcodes)
- **Passcode reset** (force regenerate 4-digit PIN)
- **Cashier sessions** (track active/locked status realtime)

## 📱 Core Screens & Flows
| Screen | Path | Purpose |
|--------|------|---------|
| `LoginScreen.tsx` | Login w/ glassmorphism | Email/password → staff doc |
| `BlindPinUnlockScreen.tsx` | PIN entry | 4-digit blind input, anim dots |
| `CashierDashboard.tsx` | **MAIN** (500+ lines) | Tabs: Home/History/Profile + modals/charts |
| `ScannerScreen.tsx` | QR scan | Member profile/voucher decode |
- **Dashboard Modals**: Revenue chart, member visits, tier distrib, promo stats
- **MemberDetailPage**: Transaction input + history
- **PopModal**: Voucher redeem confirm

## 🛒 Transaction & Loyalty Flow
```
1. Scan QR → load user doc → show MemberDetailPage
2. Input: POS Receipt ID + Amount → check duplicate → processTransaction()
3. Backend: Cloud Function `recordCashierEarnTransaction()` → pending points
4. Points: floor(amount/1000), status: PENDING → admin approve → AVAILABLE
```
- **Redeem**: Scan voucher QR → `recordCashierRedeemTransaction()` → mark used
- **Duplicate Check**: `hasTodayReceipt(storeId, receiptId)`

## 💾 Key Files & Data Models
```
src/store/useCashierStore.ts          # Zustand: staff, activeCashier, auth, transactions
src/services/TransactionService.ts     # recordTransactionClaim(), recordRedeemClaim()
src/screens/CashierDashboard.tsx       # Main UI (charts, scanner, modals)
src/screens/BlindPinUnlockScreen.tsx   # PIN logic (useCashierStore.cashiers)
src/types/types.ts                     # StaffProfile, CashierProfile {staffId, name, passcode}
functions/src/index.ts                 # Cloud Functions: recordCashierEarnTransaction, recordCashierRedeemTransaction
```

**Firestore Structure**:
```
admin_users/{staffUid}
  - name, email, role, assignedStoreId
  - cashiers[]: {staffId, name, passcode: 1234}

users/{memberUid} (loyalty members)
  - name, phoneNumber, points, tier: 'Silver'|'Gold'|'Platinum'
  - vouchers[]: {id, title, code, expiresAt, isUsed}

transactions/{trxId}
  - storeId, receiptNumber, totalAmount, type: 'EARN'|'REDEEM'
  - cashierName, staffId, passcode, uid/memberId, pointsEarned, pointsState: 'PENDING'|'AVAILABLE'
```

## ⚙️ Admin Web Dependencies (What Admin Must Support)
1. **CRUD Staff/Cashiers**:
   ```
   POST /stores/{storeId}/cashiers → {name: \"Budi\", passcode: generate4digit()}
   PUT /admin_users/{staffUid}/cashiers/{index} → update passcode/name
   DELETE /admin_users/{staffUid}/cashiers/{index}
   ```
2. **Approve Pending Points**:
   ```
   transactions?filter=pointsState:PENDING&storeId=... → admin approve → pointsState=AVAILABLE + add to user.points
   ```
3. **Realtime Sessions**:
   - Track `activeCashier.staffId` per device/store
   - Force lock remotely
4. **Reports**:
   - Revenue/points per cashier/store/day
   - Failed PIN attempts (security)

## 🚀 Quick Admin Tasks (Priority)
```
1. List stores → CRUD staff → assign cashiers w/ auto-generated PINs
2. Dashboard: Pending points queue → bulk approve/reject
3. Cashier management: Sessions, lockouts, passcode reset
4. Analytics: Revenue breakdown per cashier/store
```

## 📋 Current TODO (from TODO.md)
```
✅ Firebase Firestore 404 fixed (uses named DB gongcha-ver001)
✅ Functions deployed successfully
```

**Ready for admin web integration!** Cashier app is production-ready, waiting for backend CRUD endpoints.

---

**Paste this to admin web agent. It needs to expose APIs for cashier CRUD + points approval.**
