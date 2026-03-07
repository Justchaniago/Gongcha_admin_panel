import { Timestamp } from 'firebase/firestore';

// ============================================================================
// 1. NEW CORE SCHEMA (ARSITEKTUR BARU)
// ============================================================================
export type UserRole = 'SUPER_ADMIN' | 'STAFF';

export interface UserStaff {
  uid?: string;
  email: string;
  name: string;
  role: UserRole;
  storeId?: string;
  isActive: boolean;
  createdAt?: Timestamp;
  lastLogin?: Timestamp;
}

export interface User {
  uid?: string;
  phoneNumber: string;
  email?: string;
  fullName: string;
  birthDate?: string;
  tier: 'SILVER' | 'GOLD' | string;
  currentPoints: number;
  lifetimePoints: number;
  fcmTokens?: string[];
  favoriteProductIds?: string[];
  unreadNotifCount?: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  
  // -- Legacy Fields --
  name?: string;
  vouchers?: any[];
  role?: string;
  joinedDate?: string;
}

export interface Store {
  id?: string;
  name: string;
  code: string;
  address: string;
  coordinates?: { latitude: number; longitude: number; };
  isActive: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;

  // -- Legacy Fields --
  latitude?: number;
  longitude?: number;
  openHours?: string;
  statusOverride?: string;
}

export interface Transaction {
  id?: string;
  transactionId: string;
  posTransactionId?: string;
  userId: string;
  storeId: string;
  amount: number;
  pointsEarned: number;
  status: 'COMPLETED' | 'NEEDS_REVIEW' | 'FLAGGED' | 'FRAUD' | 'REFUNDED';
  timestamp: Timestamp;
}

export interface Product {
  id?: string;
  name: string;
  category: string;
  mediumPrice: number;
  availableLarge: boolean;
  availableHot: boolean;
  imageUrl: string;
  isActive: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;

  // -- Legacy UI Fields (Bypass) --
  description?: string;
  image?: string;
  rating?: number;
  isAvailable?: boolean;
}

export interface VoucherMaster {
  id?: string;
  title: string;
  pointsCost: number;
  isActive: boolean;
  terms: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface UserVoucher {
  id?: string;
  userId: string;
  voucherMasterId: string;
  title: string;
  code: string;
  status: 'ACTIVE' | 'USED' | 'EXPIRED';
  claimedAt: Timestamp;
  usedAt?: Timestamp | null;
  
  // -- Legacy Fields (Bypass UI & API Lama) --
  rewardId?: string;
  isUsed?: boolean;
  type?: string;          // <-- Tambahkan ini untuk membungkam error
  createdAt?: any;
  expiresAt?: any;
}

export interface DailyMetrics {
  id?: string; 
  dateString: string;
  totalRevenue: number;
  totalTransactions: number;
  totalVouchersUsed: number;
  storeId?: string; 
  updatedAt?: Timestamp;
}

// ============================================================================
// 2. LEGACY TYPES (Bypass UI Lama)
// ============================================================================
export type AccountStatus = "active" | "suspended" | "pending";
export type AccountRole   = "master" | "admin" | "manager" | "viewer";
export interface Account {
  id?: string; name: string; email: string; phoneNumber: string; role: AccountRole; status: AccountStatus; createdAt: string; lastLogin: string | null; notes: string;
}

export type VoucherType = "discount" | "free_item" | "bogo";
export interface AdminNotificationLog {
  id?: string; 
  type: string; 
  title: string; 
  body: string; 
  targetType: string; 
  targetUid?: string; 
  targetName?: string; // <-- Tambahkan baris ini
  sentAt: string; 
  sentBy: string; 
  recipientCount: number;
}

export interface UserNotification {
  id: string; type: string; title: string; body: string; isRead: boolean; createdAt: string; data?: any;
}

export interface ProductItem {
  id?: string; name: string; category: string; mediumPrice: number; availableLarge: boolean; availableHot: boolean; imageUrl: string; isActive: boolean;
  // Missing UI fields:
  description?: string; image?: string; rating?: number; isAvailable?: boolean;
}

export interface Reward {
  id?: string; title: string; description: string; pointsCost: number; imageURL: string; isActive: boolean;
  // Missing UI fields:
  category?: string;
}

export type StaffRole = "cashier" | "store_manager" | "admin";
export interface Staff {
  uid: string; name: string; email: string; phoneNumber: string; role: StaffRole; isActive: boolean; joinedDate: string; storeLocations?: string[]; accessAllStores?: boolean;
}
export type UserTier = "Silver" | "Gold" | "Platinum";