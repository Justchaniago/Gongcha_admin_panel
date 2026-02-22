// ─── accounts/{id} ──────────────────────────────────────────────────────────
export type AccountStatus = "active" | "suspended" | "pending";
export type AccountRole   = "master" | "admin" | "manager" | "viewer";

export interface Account {
  id?:         string;           // Firestore doc ID
  name:        string;
  email:       string;
  phoneNumber: string;
  role:        AccountRole;
  status:      AccountStatus;
  createdAt:   string;           // ISO timestamp
  lastLogin:   string | null;
  notes:       string;
}

// ─── stores/{storeId} ───────────────────────────────────────────────────────
export interface Store {
  id:             string;
  name:           string;
  address:        string;
  latitude:       number;
  longitude:      number;
  openHours:      string;
  isActive:       boolean;
  statusOverride: "open" | "closed" | "almost_close";
}

// ─── stores/{storeId}/transactions/{YYYYMMDD-POSID} ─────────────────────────
export interface Transaction {
  transactionId:   string;
  amount:          number;
  potentialPoints: number;
  memberId:        string;
  memberName:      string;
  staffId:         string;
  storeLocation:   string;
  status:          "pending" | "verified" | "rejected";
  createdAt:       string;
  verifiedAt:      string | null;
}

// ─── users/{UID} ────────────────────────────────────────────────────────────
export interface XpHistoryEntry {
  id:            string;
  date:          string;
  amount:        number;
  type:          "earn" | "redeem";
  status:        "pending" | "verified" | "rejected";
  context:       string;
  location:      string;
  transactionId: string;
}

export interface UserVoucher {
  id:        string;
  rewardId:  string;
  title:     string;
  code:      string;
  isUsed:    boolean;
  expiresAt: string;
}

export type UserRole = "master" | "trial" | "admin" | "member";
export type UserTier = "Silver" | "Gold" | "Platinum";

export interface User {
  name:           string;
  phoneNumber:    string;
  email:          string;
  photoURL:       string;
  role:           UserRole;
  tier:           UserTier;
  currentPoints:  number;
  lifetimePoints: number;
  joinedDate:     string;
  xpHistory:      XpHistoryEntry[];
  vouchers:       UserVoucher[];
}

// ─── staff/{UID} ─────────────────────────────────────────────────────────────
export type StaffRole = "cashier" | "store_manager" | "admin";

export interface Staff {
  name:            string;
  email:           string;
  role:            StaffRole;
  isActive:        boolean;

  // Lama (tetap ada untuk compat)
  storeLocation?:  string;

  // Baru (multi-store)
  storeLocations?: string[];
  accessAllStores?: boolean;
}

// ─── rewards_catalog/{rewardId} ──────────────────────────────────────────────
export type RewardCategory = "Drink" | "Topping" | "Discount";

export interface Reward {
  title:       string;
  description: string;
  pointsCost:  number;
  imageURL:    string;
  category:    RewardCategory;
  isActive:    boolean;
}