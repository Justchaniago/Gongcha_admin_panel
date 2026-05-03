// Sample test payloads for POST /transactions endpoint
// Usage: Copy payload + curl to test locally or in Postman

export const EARN_TRANSACTION_PAYLOAD = {
  receiptNumber: 'RCP-2026-05-03-001',
  storeId: 'store-001',
  storeName: 'Gongcha Pusat',
  memberId: 'user-123',
  memberName: 'John Doe',
  staffId: 'staff-456',
  totalAmount: 50000, // Rp 50,000
  type: 'earn' as const,
};

export const EARN_RESPONSE = {
  success: true,
  transactionId: 'trx-abc123',
  pointsEarned: 50, // floor(50000 / 1000) * 1.0 = 50 (REGULAR tier)
  newBalance: 550, // Previous 500 + 50
  newTier: 'SILVER', // Now qualified for SILVER (>= 500 points)
};

export const REDEEM_TRANSACTION_PAYLOAD = {
  receiptNumber: 'RCP-2026-05-03-002',
  storeId: 'store-001',
  storeName: 'Gongcha Pusat',
  memberId: 'user-123',
  memberName: 'John Doe',
  staffId: 'staff-456',
  totalAmount: 0,
  type: 'redeem' as const,
  voucherCode: 'VOUCHER-001',
  voucherTitle: 'Free Drink',
};

export const REDEEM_RESPONSE = {
  success: true,
  transactionId: 'trx-def456',
  pointsEarned: 0,
  newBalance: 550,
  newTier: 'SILVER',
};

// Curl examples:
// EARN:
// curl -X POST https://us-central1-gongcha-app-4691f.cloudfunctions.net/transactions \
//   -H "Content-Type: application/json" \
//   -H "Authorization: Bearer <CASHIER_TOKEN>" \
//   -d '{
//     "receiptNumber": "RCP-2026-05-03-001",
//     "storeId": "store-001",
//     "storeName": "Gongcha Pusat",
//     "memberId": "user-123",
//     "memberName": "John Doe",
//     "staffId": "staff-456",
//     "totalAmount": 50000,
//     "type": "earn"
//   }'

// REDEEM:
// curl -X POST https://us-central1-gongcha-app-4691f.cloudfunctions.net/transactions \
//   -H "Content-Type: application/json" \
//   -H "Authorization: Bearer <CASHIER_TOKEN>" \
//   -d '{
//     "receiptNumber": "RCP-2026-05-03-002",
//     "storeId": "store-001",
//     "storeName": "Gongcha Pusat",
//     "memberId": "user-123",
//     "memberName": "John Doe",
//     "staffId": "staff-456",
//     "totalAmount": 0,
//     "type": "redeem",
//     "voucherCode": "VOUCHER-001",
//     "voucherTitle": "Free Drink"
//   }'
