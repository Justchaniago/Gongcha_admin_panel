import { Timestamp } from 'firebase/firestore';

export type UserRole = 'SUPER_ADMIN' | 'STAFF';

export interface UserStaff {
  uid?: string;
  email: string;
  name: string;
  role: UserRole;
  storeId?: string; // Wajib diisi jika role === 'STAFF'
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
  tier: 'SILVER' | 'GOLD';
  currentPoints: number;
  lifetimePoints: number;
  fcmTokens?: string[];
  favoriteProductIds?: string[];
  unreadNotifCount?: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
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

export interface Store {
  id?: string;
  name: string;
  code: string;
  address: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  isActive: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
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