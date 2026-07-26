import axios from "axios";
import { auth } from "../firebaseClient";
import { DashboardStats, MemberItem, TransactionItem, StoreItem, MenuItem, PromotionItem } from "./types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api/v1";

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use(async (config) => {
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
    };
    const res = await apiClient.post<MenuItem>("/admin/menus", payload);
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
};
