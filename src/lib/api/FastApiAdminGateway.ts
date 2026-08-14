import axios from "axios";
import { auth } from "../firebaseClient";
import { DashboardStats, MemberItem, TransactionItem, StoreItem, MenuItem, PromotionItem } from "./types";

const getBaseUrl = () => {
  if (typeof window !== "undefined") {
    return "/api/backend-gateway";
  }
  return process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api/v1";
};

const apiClient = axios.create({
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use(async (config) => {
  config.baseURL = getBaseUrl();
  try {
    const currentUser = auth.currentUser;
    if (currentUser) {
      const token = await currentUser.getIdToken();
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (error) {
    console.error("Failed to append auth token in gateway client:", error);
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const serverMessage = error.response?.data?.detail || error.response?.data?.message;
    if (serverMessage) {
      return Promise.reject(new Error(typeof serverMessage === "string" ? serverMessage : JSON.stringify(serverMessage)));
    }
    return Promise.reject(error);
  }
);

export const FastApiAdminGateway = {
  async getDashboardStats(): Promise<DashboardStats> {
    const res = await apiClient.get<DashboardStats>("/admin/dashboard/stats");
    return res.data;
  },

  async getMembers(query?: string, page: number = 1, limit: number = 20): Promise<MemberItem[]> {
    const res = await apiClient.get<MemberItem[]>("/admin/members", {
      params: {
        search: query,
        page,
        size: limit,
      },
    });
    return res.data;
  },

  async getMemberDetail(memberId: string): Promise<any> {
    const res = await apiClient.get(`/admin/members/${memberId}`);
    return res.data;
  },

  async adjustMemberPoints(memberId: string, pointsDelta: number, reason: string): Promise<any> {
    const res = await apiClient.post(`/admin/members/${memberId}/adjust-points`, {
      points_delta: pointsDelta,
      reason,
    });
    return res.data;
  },

  async getTransactions(startDate?: string, endDate?: string): Promise<TransactionItem[]> {
    const res = await apiClient.get<TransactionItem[]>("/admin/transactions", {
      params: {
        start_date: startDate,
        end_date: endDate,
        limit: 100,
      },
    });
    return res.data;
  },

  async getStores(): Promise<StoreItem[]> {
    const res = await apiClient.get<StoreItem[]>("/admin/stores");
    return res.data;
  },

  async createStore(data: Partial<StoreItem>): Promise<StoreItem> {
    const payload = {
      code: data.store_id || (data as any).code || "store-" + Date.now(),
      name: data.name || "",
      address: data.address || "",
      phone: data.phone || null,
      operating_hours: (data as any).operating_hours || null,
      is_active: data.is_open !== undefined ? data.is_open : true,
    };
    const res = await apiClient.post<StoreItem>("/admin/stores", payload);
    return res.data;
  },

  async deleteStore(storeId: string): Promise<any> {
    const res = await apiClient.delete(`/admin/stores/${storeId}`);
    return res.data;
  },

  async getMenus(): Promise<MenuItem[]> {
    const res = await apiClient.get<MenuItem[]>("/admin/menus");
    return res.data;
  },

  async createMenu(data: Partial<MenuItem>): Promise<MenuItem> {
    const payload = {
      category_id: (data as any).category_id || "00000000-0000-0000-0000-000000000000",
      code: data.item_id || (data as any).code || "item-" + Date.now(),
      name: data.name || "",
      description: data.description || null,
      price_minor: Math.round((data.price || 0) * 100) || (data as any).price_minor || 0,
      is_popular: data.is_popular !== undefined ? data.is_popular : false,
      is_new: data.is_new !== undefined ? data.is_new : false,
      is_active: (data as any).is_active !== undefined ? (data as any).is_active : true,
      image_url: data.image_url || (data as any).imageUrl || null,
    };
    const res = await apiClient.post<MenuItem>("/admin/menus", payload);
    return res.data;
  },

  async updateMenu(itemId: string, data: Partial<MenuItem>): Promise<MenuItem> {
    return this.createMenu({ ...data, item_id: itemId });
  },

  async deleteMenu(itemId: string): Promise<any> {
    const res = await apiClient.delete(`/admin/menus/${itemId}`);
    return res.data;
  },

  async getPromotions(): Promise<PromotionItem[]> {
    const res = await apiClient.get<PromotionItem[]>("/admin/promotions");
    return res.data;
  },

  async createPromotion(data: Partial<PromotionItem>): Promise<PromotionItem> {
    const payload = {
      code: (data as any).code || "promo-" + Date.now(),
      title: data.title || "",
      subtitle: data.subtitle || null,
      banner_type: data.banner_type || "HERO",
      action_url: (data as any).action_url || null,
      image_url: data.image_url || "",
      start_at: (data as any).start_at || new Date().toISOString(),
      end_at: (data as any).end_at || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      is_active: data.active !== undefined ? data.active : true,
    };
    const res = await apiClient.post<PromotionItem>("/admin/promotions", payload);
    return res.data;
  },

  async deletePromotion(promoId: string): Promise<any> {
    const res = await apiClient.delete(`/admin/promotions/${promoId}`);
    return res.data;
  },

  async getRewards(): Promise<any[]> {
    const res = await apiClient.get<any[]>("/admin/rewards");
    return res.data;
  },

  async createReward(data: any): Promise<any> {
    const payload = {
      code: data.rewardId || data.code || ("rw_" + (data.title || "reward").toLowerCase().replace(/[^a-z0-9]/g, "_")),
      title: data.title || "",
      description: data.description || "",
      discount_type: "FREE_DRINK",
      discount_value: 0,
      points_required: Number(data.pointsrequired || data.points_required || 0),
      expiry_days: 30,
      is_active: data.isActive !== undefined ? data.isActive : true,
      image_url: data.imageUrl || data.image_url || "",
    };
    const res = await apiClient.post<any>("/admin/rewards", payload);
    return res.data;
  },

  async deleteReward(rewardId: string): Promise<any> {
    const res = await apiClient.delete<any>(`/admin/rewards/${rewardId}`);
    return res.data;
  },

  async getNotifications(): Promise<any[]> {
    const res = await apiClient.get<any[]>("/admin/notifications");
    return res.data.map((n: any) => ({
      id: n.id,
      type: n.target_topic === "all" ? "broadcast" : "targeted",
      title: n.title,
      body: n.message,
      targetType: n.target_topic || "all",
      sentAt: n.sent_at,
      sentBy: n.sent_by || "admin",
      recipientCount: n.recipient_count || 100,
    }));
  },

  async createNotification(data: any): Promise<any> {
    const payload = {
      title: data.title,
      message: data.message || data.body || "",
      target_topic: data.targetType || data.target_topic || "all",
      target_segment: data.targetUid || data.target_segment || "all",
    };
    const res = await apiClient.post<any>("/admin/notifications", payload);
    return {
      ...res.data,
      recipientCount: res.data.recipient_count || 100,
    };
  },

  async getSettings(): Promise<any> {
    const res = await apiClient.get<any>("/admin/settings");
    const data = res.data;
    return {
      spendingPerLeaf: data.spending_per_leaf ?? data.spendingPerLeaf ?? 10000,
      minimumTransaction: data.minimum_transaction ?? data.minimumTransaction ?? 10000,
      pointsExpiry: data.points_expiry ?? data.pointsExpiry ?? "12_months",
      tiers: data.tiers ?? {
        lover: { minLeaves: 0, bonus: "0%", label: "Gong cha Lover" },
        master: { minLeaves: 100, bonus: "10%", label: "Gong cha Master" },
        ambassador: { minLeaves: 800, bonus: "20%", label: "Gong cha Ambassador" },
        legend: { minLeaves: 1600, bonus: "30%", label: "Gong cha Legend" },
      },
      notifications: data.notifications ?? { email: true, push: true, weekly: false },
      updatedAt: data.updated_at ?? data.updatedAt ?? null,
      updatedBy: data.updated_by ?? data.updatedBy ?? null,
    };
  },

  async updateSettings(data: any): Promise<any> {
    const payload = {
      spending_per_leaf: data.spendingPerLeaf ?? data.spending_per_leaf,
      minimum_transaction: data.minimumTransaction ?? data.minimum_transaction,
      points_expiry: data.pointsExpiry ?? data.points_expiry,
    };
    const res = await apiClient.patch<any>("/admin/settings", payload);
    const updated = res.data;
    return {
      spendingPerLeaf: updated.spending_per_leaf ?? data.spendingPerLeaf ?? 10000,
      minimumTransaction: updated.minimum_transaction ?? data.minimumTransaction ?? 10000,
      pointsExpiry: updated.points_expiry ?? data.pointsExpiry ?? "12_months",
      tiers: data.tiers ?? updated.tiers,
      notifications: data.notifications ?? updated.notifications,
      updatedAt: updated.updated_at ?? new Date().toISOString(),
      updatedBy: updated.updated_by ?? "admin",
    };
  },

  async getActivityLogs(): Promise<any[]> {
    const res = await apiClient.get<any[]>("/admin/activity-logs");
    return res.data.map((item: any) => ({
      id: item.id,
      dayId: item.timestamp ? item.timestamp.split("T")[0] : "",
      eventId: item.id,
      actorUid: item.actor || "admin",
      actorName: item.actor || "Admin",
      actorEmail: item.actor,
      actorRole: "SUPER_ADMIN",
      action: item.action || "LOG",
      targetType: item.target_type || "system",
      targetId: item.target_id || "",
      targetLabel: item.target_id || "",
      summary: item.summary || "",
      status: "success",
      source: "fastapi",
      metadata: item.details || {},
      createdAt: item.timestamp,
    }));
  },

  async getAdminUsers(): Promise<any[]> {
    const res = await apiClient.get<any[]>("/admin/users");
    return res.data.map((u: any) => ({
      uid: u.id,
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role || "STAFF",
      isActive: u.is_active,
      createdAt: u.created_at,
    }));
  },

  async createAdminUser(data: any): Promise<any> {
    const payload = {
      email: data.email || "",
      name: data.name || "",
      role: data.role || "STAFF",
    };
    const res = await apiClient.post<any>("/admin/users", payload);
    const u = res.data;
    return {
      uid: u.id,
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      isActive: u.is_active,
      createdAt: u.created_at,
    };
  },
};

