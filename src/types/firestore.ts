import { 
  Timestamp, 
  GeoPoint, 
  DocumentData, 
  FirestoreDataConverter, 
  QueryDocumentSnapshot, 
  SnapshotOptions, 
  PartialWithFieldValue 
} from "firebase/firestore";

// ============================================================================
// 1. ADMIN USERS (Akses Panel & Kasir) - Collection: 'admin_users'
// ============================================================================
export type AdminRole = "SUPER_ADMIN" | "STAFF" | "admin" | "master" | "manager";

export interface AdminUser {
  uid: string;
  name: string;
  email: string;
  role: AdminRole;
  assignedStoreId: string | null;
  isActive: boolean;
}

export const adminUserConverter: FirestoreDataConverter<AdminUser> = {
  toFirestore(admin: PartialWithFieldValue<AdminUser>): DocumentData {
    return admin;
  },
  fromFirestore(snapshot: QueryDocumentSnapshot, options: SnapshotOptions): AdminUser {
    const data = snapshot.data(options)!;
    return {
      uid: snapshot.id, // Ambil dari Doc ID
      name: data.name,
      email: data.email,
      role: data.role as AdminRole,
      assignedStoreId: data.assignedStoreId ?? null,
      isActive: data.isActive,
    };
  }
};

// ============================================================================
// 2. USERS & NOTIFICATIONS (Ekosistem Customer) - Collection: 'users'
// ============================================================================
export type UserTier = "BRONZE" | "SILVER" | "GOLD" | "Silver" | "Gold" | "Platinum";
export type UserRole = "member" | "admin";
export type StaffRole = "cashier" | "store_manager" | "admin";

export interface Staff {
  uid: string;
  name: string;
  email?: string;
  role: StaffRole;
  storeLocations?: string[];
  accessAllStores?: boolean;
  isActive?: boolean;
}

export interface UserVoucher {
  id: string;
  code: string;
  title: string;
  expiry: Timestamp;
  rewardId?: string;
  expiresAt?: string;
  isUsed?: boolean;
  type?: VoucherType;
}

export type VoucherType = "personal" | "catalog";

export interface User {
  uid: string;
  name: string;
  phone?: string;
  dob?: string; // YYYY-MM-DD
  points?: number;
  xp?: number;
  tier: UserTier;
  activeVouchers?: UserVoucher[];
  fcmTokens?: string[];
  email?: string;
  phoneNumber?: string;
  role?: UserRole | string;
  currentPoints?: number;
  lifetimePoints?: number;
  joinedDate?: string;
  vouchers?: UserVoucher[];
  xpHistory?: any[];
  photoURL?: string;
}

export const userConverter: FirestoreDataConverter<User> = {
  toFirestore(user: PartialWithFieldValue<User>): DocumentData {
    return user;
  },
  fromFirestore(snapshot: QueryDocumentSnapshot, options: SnapshotOptions): User {
    const data = snapshot.data(options)!;
    return {
      uid: snapshot.id,
      name: data.name,
      phone: data.phone,
      dob: data.dob,
      points: data.points || 0,
      xp: data.xp || 0,
      tier: data.tier as UserTier,
      activeVouchers: data.activeVouchers || [],
      fcmTokens: data.fcmTokens || [],
    };
  }
};

// Sub-Collection Notifications: 'users/{uid}/notifications'
export interface Notification {
  id: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: Timestamp;
  expireAt: Timestamp;
}

export type NotificationType = "voucher_injected" | "tx_verified" | "tx_rejected" | "broadcast" | "targeted";

export interface UserNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  data?: Record<string, unknown>;
}

export interface AdminNotificationLog {
  type: NotificationType;
  title: string;
  body: string;
  targetType: "all" | "user";
  targetUid?: string;
  targetName?: string;
  sentAt: string;
  sentBy: string;
  recipientCount: number;
}

export const notificationConverter: FirestoreDataConverter<Notification> = {
  toFirestore(notif: PartialWithFieldValue<Notification>): DocumentData {
    return notif;
  },
  fromFirestore(snapshot: QueryDocumentSnapshot, options: SnapshotOptions): Notification {
    const data = snapshot.data(options)!;
    return {
      id: snapshot.id,
      title: data.title,
      body: data.body,
      isRead: data.isRead,
      createdAt: data.createdAt,
      expireAt: data.expireAt,
    };
  }
};

// ============================================================================
// 3. MASTER DATA (Stores & Products) - Collection: 'stores', 'products'
// ============================================================================
export interface Store {
  id: string;
  name: string;
  address: string;
  location: GeoPoint;
  operationalHours: { open: string; close: string };
  isForceClosed: boolean;
  isActive: boolean;
}

export const storeConverter: FirestoreDataConverter<Store> = {
  toFirestore(store: PartialWithFieldValue<Store>): DocumentData {
    return store;
  },
  fromFirestore(snapshot: QueryDocumentSnapshot, options: SnapshotOptions): Store {
    const data = snapshot.data(options)!;
    return {
      id: snapshot.id,
      name: data.name,
      address: data.address,
      location: data.location,
      operationalHours: data.operationalHours,
      isForceClosed: data.isForceClosed,
      isActive: data.isActive,
    };
  }
};

export interface Product {
  id: string;
  name: string;
  category: string;
  basePrice: number;
  imageUrl: string;
  description?: string;
  isLargeAvailable: boolean;
  isHotAvailable: boolean;
  isAvailable: boolean;
}

export const productConverter: FirestoreDataConverter<Product> = {
  toFirestore(product: PartialWithFieldValue<Product>): DocumentData {
    return product;
  },
  fromFirestore(snapshot: QueryDocumentSnapshot, options: SnapshotOptions): Product {
    const data = snapshot.data(options)!;
    return {
      id: snapshot.id,
      name: data.name,
      category: data.category,
      basePrice: data.basePrice,
      imageUrl: data.imageUrl,
      isLargeAvailable: data.isLargeAvailable,
      isHotAvailable: data.isHotAvailable,
      isAvailable: data.isAvailable,
    };
  }
};

// ============================================================================
// 4. TRANSACTIONS - Collection: 'transactions'
// ============================================================================
export type TransactionStatus = "PENDING" | "COMPLETED" | "CANCELLED" | "REFUNDED";

export interface Transaction {
  id: string;
  receiptNumber: string;
  storeId: string;
  storeName: string;
  userId: string | null;
  totalAmount: number;
  status: TransactionStatus;
  createdAt: Timestamp;
  // Additional fields for loyalty program
  memberId?: string;
  memberName?: string;
  staffId?: string;
  potentialPoints?: number;
  type?: "earn" | "redeem";
  verifiedAt?: Timestamp;
  verifiedBy?: string;
}

export const transactionConverter: FirestoreDataConverter<Transaction> = {
  toFirestore(trx: PartialWithFieldValue<Transaction>): DocumentData {
    return trx;
  },
  fromFirestore(snapshot: QueryDocumentSnapshot, options: SnapshotOptions): Transaction {
    const data = snapshot.data(options)!;
    return {
      id: snapshot.id,
      receiptNumber: data.receiptNumber,
      storeId: data.storeId,
      storeName: data.storeName,
      userId: data.userId || null,
      totalAmount: data.totalAmount,
      status: data.status as TransactionStatus,
      createdAt: data.createdAt,
      // Additional loyalty fields
      memberId: data.memberId,
      memberName: data.memberName,
      staffId: data.staffId,
      potentialPoints: data.potentialPoints,
      type: data.type,
      verifiedAt: data.verifiedAt,
      verifiedBy: data.verifiedBy,
    };
  }
};

// ============================================================================
// 5. DAILY STATS (The God Document) - Collection: 'daily_stats'
// ============================================================================
export interface DailyStat {
  id: string;
  date: string;
  type: "GLOBAL" | "STORE";
  storeId: string;
  totalRevenue: number;
  totalTransactions: number;
  updatedAt: Timestamp;
}

export const dailyStatConverter: FirestoreDataConverter<DailyStat> = {
  toFirestore(stat: PartialWithFieldValue<DailyStat>): DocumentData {
    return stat;
  },
  fromFirestore(snapshot: QueryDocumentSnapshot, options: SnapshotOptions): DailyStat {
    const data = snapshot.data(options)!;
    return {
      id: snapshot.id,
      date: data.date,
      type: data.type as "GLOBAL" | "STORE",
      storeId: data.storeId,
      totalRevenue: data.totalRevenue || 0,
      totalTransactions: data.totalTransactions || 0,
      updatedAt: data.updatedAt,
    };
  }
};

// ============================================================================
// 6. MARKETING (Rewards & Promos) - Collection: 'rewards_catalog'
// ============================================================================

export interface Reward {
  id: string;
  title: string;
  description: string;
  pointsrequired: number;
  imageUrl: string;
  isActive: boolean;
  isRedeemable: boolean; // 🔥 WAJIB ADA: Untuk status "Show in Catalog"
  category?: "Drink" | "Topping" | "Discount";
  pointsCost?: number;
  imageURL?: string;
}

export const rewardConverter: FirestoreDataConverter<Reward> = {
  toFirestore(reward: PartialWithFieldValue<Reward>): DocumentData {
    return reward;
  },
  fromFirestore(snapshot: QueryDocumentSnapshot, options: SnapshotOptions): Reward {
    const data = snapshot.data(options)!;

    // 🔥 FIX: Mapping fleksibel untuk support pointsrequired (lowercase) dari database
    const pointsValue = Number(data.pointsrequired ?? data.pointsRequired ?? data.pointsCost ?? 0);
    const imageUrl = String(data.imageUrl ?? data.imageURL ?? "");

    return {
      id: snapshot.id,
      title: data.title,
      description: data.description,
      pointsrequired: pointsValue,
      imageUrl,
      isActive: data.isActive,
      // 🔥 FIX: Sertakan isRedeemable di sini agar TS tidak error dan data terbaca
      isRedeemable: data.isRedeemable !== false, 
      category: data.category,
      pointsCost: pointsValue,
      imageURL: imageUrl,
    };
  }
};

export interface GlobalPromo {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  isActive: boolean;
}

export const globalPromoConverter: FirestoreDataConverter<GlobalPromo> = {
  toFirestore(promo: PartialWithFieldValue<GlobalPromo>): DocumentData {
    return promo;
  },
  fromFirestore(snapshot: QueryDocumentSnapshot, options: SnapshotOptions): GlobalPromo {
    const data = snapshot.data(options)!;
    return {
      id: snapshot.id,
      title: data.title,
      description: data.description,
      imageUrl: data.imageUrl,
      isActive: data.isActive,
    };
  }
};

// ============================================================================
// 7. LEGACY ADMIN ACCOUNTS (compatibility layer)
// ============================================================================
export type AccountRole = "master" | "admin" | "manager" | "viewer";
export type AccountStatus = "active" | "suspended" | "pending";

export interface Account {
  id: string;
  name: string;
  email: string;
  phoneNumber?: string;
  role: AccountRole;
  status: AccountStatus;
  notes?: string;
  createdAt?: string;
  lastLogin?: string;
}

// Legacy alias used by old menus page
export type ProductItem = Product;