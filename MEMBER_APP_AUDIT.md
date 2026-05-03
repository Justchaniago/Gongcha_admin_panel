# Member App Audit: Direct Firestore Writes & Reads

**Objective:** Identify all direct Firestore access in Member App for Stage 3 compliance.

**Current State:** Member App likely makes direct reads + writes. Need to audit scope.

**Deadline:** Before Stage 3 implementation can start.

---

## Audit Questions

### Q1: Direct Firestore Writes

**Search for:**
```typescript
addDoc(collection(...))
setDoc(doc(...))
updateDoc(doc(...))
deleteDoc(doc(...))
writeBatch.set/update/delete
transaction.set/update/delete
```

**For each found:**
- File + line number
- Collection name
- What data is being written
- Is it member's own data or shared data?

**Expected findings:**
- Voucher redemption (should be routed to backend API)
- Points updates (should be blocked by rules)
- Profile updates (phoneNumber, photoURL — acceptable)
- Any "claim reward" flows (should route to API)

**Report:**
```
DIRECT WRITES FOUND:
1. src/screens/RedeemVoucher.tsx:145
   - Collection: users/{uid}/vouchers
   - Action: updateDoc() marking voucher isUsed: true
   - Classification: [MUST MIGRATE TO API]

2. src/hooks/usePointsLedger.ts:89
   - Collection: users/{uid}
   - Action: updateDoc({ points: newBalance })
   - Classification: [MUST BLOCK - SENSITIVE]

... (list all)
```

---

### Q2: Direct Firestore Reads

**Search for:**
```typescript
getDocs(collection(...))
getDoc(doc(...))
onSnapshot(collection/doc)
query(collection(...))
collection(db, '...')
  .where(...)
  .orderBy(...)
  .get()
```

**For each read, answer:**
- File + line number
- Collection name
- What data is read (all fields or specific)?
- Used for display or logic?

**Expected collections (acceptable):**
- `/stores` — POS location reference
- `/products` — menu items
- `/rewards_catalog` — available rewards display
- `/users/{uid}` — own profile (points, vouchers, tier)
- `/transactions` — own transaction history

**Expected collections (problematic):**
- Anything reading `/admin_users`
- Reading other members' data
- Reading activity logs

**Report:**
```
DIRECT READS:
1. src/screens/MemberProfile.tsx:42
   - Collection: users/{uid}
   - Fields: points, tier, vouchers, totalEarned
   - Purpose: Display loyalty dashboard
   - Classification: [ACCEPTABLE - OWN DATA]

2. src/screens/StoreLocator.tsx:89
   - Collection: stores
   - Fields: name, address, phoneNumber
   - Purpose: Show nearby stores map
   - Classification: [ACCEPTABLE - REFERENCE DATA]

3. src/hooks/useRewardCatalog.ts:120
   - Collection: rewards_catalog
   - Purpose: Display reward browsing
   - Classification: [ACCEPTABLE - REFERENCE DATA]

... (list all)
```

---

### Q3: Sensitive Data Access Check

**Check for:**
- Any writes to `/admin_users` (should be zero)
- Any reads of other members' data (should be zero)
- Any writes to `/activity_logs` (should be zero)
- Any deletes (data deletion without admin)
- Any batch operations on critical collections

**Report:**
```
SENSITIVE DATA:
☐ No writes to /admin_users
☐ No reads of other members' data (except own uid)
☐ No writes to /activity_logs
☐ No unauthorized deletes
```

---

### Q4: Current API Usage

**Search for:**
```typescript
fetch('/api/...')
POST /members/me
GET /members/me/vouchers
POST /vouchers/redeem
GET /rewards
```

**What endpoints is Member App already using?**

**Report:**
```
CURRENT API USAGE:
☐ GET /members/me (profile + points)
☐ GET /members/me/vouchers (active vouchers)
☐ POST /vouchers/redeem (redemption)
☐ GET /rewards (catalog)
```

---

## Response Template

**Send this format back to Admin Panel:**

```markdown
# Member App Firestore Audit Results

## Q1: Direct Firestore Writes
- [ ] None found (app uses APIs only)
- [ ] Found: (list with file:line, collection, action)

### Risk Assessment:
- [ ] LOW: Only self-profile updates (phoneNumber, photoURL)
- [ ] MEDIUM: Writes to vouchers or temporary data
- [ ] HIGH: Writes to sensitive collections (points, transactions)

---

## Q2: Direct Firestore Reads
**Acceptable (read-only reference data):**
- [ ] /stores
- [ ] /products
- [ ] /rewards_catalog
- [ ] /users/{uid} (own profile)

**Other reads found:**
- (list with file:line, collection, purpose)

---

## Q3: Sensitive Data Check
- [ ] ✅ PASS: No sensitive access detected
- [ ] ⚠️  FAIL: Found at (location + description)

---

## Q4: Current API Usage
- [ ] Already using GET /members/me
- [ ] Already using POST /vouchers/redeem
- [ ] Already using GET /rewards
- [ ] Not using API — all direct Firestore

---

## Stage 3 Migration Scope

**New API endpoints needed:**
- [ ] None (app already uses APIs)
- [ ] List here (describe what endpoint + purpose)

**Direct writes to migrate:**
- [ ] None (already via API)
- [ ] List here (file + action + target API)

**Security risk level:**
- [ ] LOW: Minimal changes needed
- [ ] MEDIUM: Some writes need routing to API
- [ ] HIGH: Many sensitive writes to lock down
```

---

## Timeline

**Duration:** 1–2 hours (depends on codebase size)

**Deliverables:**
- Audit results (checklist filled)
- Risk assessment
- List of files to modify

**Blocker:** Cannot start Stage 3 implementation without audit results.

---

## Notes

- Focus on **writes** (reads are mostly safe)
- Sensitive collections: points, transactions, vouchers, activity_logs, admin_users
- Safe collections: stores, products, rewards_catalog, own user profile (display)
- Report file paths + line numbers (we'll need them for migration)
