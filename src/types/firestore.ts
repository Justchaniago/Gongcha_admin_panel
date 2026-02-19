// ─── stores/{storeId} ───────────────────────────────────────────────────────
export interface Store {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  openHours: string;
  isActive: boolean;
  statusOverride: "open" | "closed" | "almost_close";
}

// ─── stores/{storeId}/transactions/{YYYYMMDD-POSID} ─────────────────────────
export interface Transaction {
  transactionId: string;       // POS ID only, e.g. "100866"
  amount: number;              // in Rupiah
  potentialPoints: number;
  memberId: string;            // Firestore UID of the user
  memberName: string;
  staffId: string;             // Firestore UID of the staff
  storeLocation: string;       // ref to stores.id, e.g. "SBY-TP6"
  status: "pending" | "verified" | "rejected";
  createdAt: string;           // ISO or "serverTimestamp" placeholder
  verifiedAt: string | null;
}

// ─── users/{UID} ────────────────────────────────────────────────────────────
export interface XpHistoryEntry {
  id: string;                  // "YYYYMMDD-POSID"
  date: string;                // ISO timestamp
  amount: number;
  type: "earn" | "redeem";
  status: "pending" | "verified" | "rejected";
  context: string;             // e.g. "Pembelian di Gong Cha TP6"
  location: string;            // e.g. "SBY-TP6"
  transactionId: string;       // matches Transaction.transactionId
}

export interface UserVoucher {
  id: string;                  // "v_{timestamp}"
  rewardId: string;            // ref to rewards_catalog.id
  title: string;
  code: string;                // "GC-XXXXX"
  isUsed: boolean;
  expiresAt: string;           // ISO timestamp
}

export type UserRole = "master" | "trial" | "admin" | "member";
export type UserTier = "Silver" | "Gold" | "Platinum";

export interface User {
  name: string;
  phoneNumber: string;
  email: string;
  photoURL: string;
  role: UserRole;
  tier: UserTier;
  currentPoints: number;
  lifetimePoints: number;
  joinedDate: string;          // ISO timestamp
  xpHistory: XpHistoryEntry[];
  vouchers: UserVoucher[];
}

// ─── staff/{UID} ─────────────────────────────────────────────────────────────
export type StaffRole = "cashier" | "store_manager" | "admin";

export interface Staff {
  name: string;
  email: string;
  role: StaffRole;
  storeLocation: string;       // ref to stores.id
  isActive: boolean;
}

// ─── rewards_catalog/{rewardId} ──────────────────────────────────────────────
export type RewardCategory = "Drink" | "Topping" | "Discount";

export interface Reward {
  title: string;
  description: string;
  pointsCost: number;
  imageURL: string;
  category: RewardCategory;
  isActive: boolean;
}
