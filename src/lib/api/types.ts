export interface DashboardStats {
  total_members: number;
  active_vouchers: number;
  total_transactions_today: number;
  total_revenue_today: number;
  total_points_issued: number;
}

export interface MemberItem {
  id: string;
  member_id: string;
  display_name: string;
  email: string;
  phone_number: string;
  tier: string;
  points_balance: number;
  created_at: string;
}

export interface TransactionItem {
  id: string;
  order_number: string;
  member_id: string;
  total_amount: number;
  payment_method: string;
  status: string;
  created_at: string;
}

export interface StoreItem {
  id: string;
  store_id: string;
  name: string;
  address: string;
  is_open: boolean;
  phone: string;
  latitude: number;
  longitude: number;
}

export interface MenuItem {
  id: string;
  item_id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  is_popular: boolean;
  is_new: boolean;
}

export interface PromotionItem {
  id: string;
  title: string;
  subtitle: string;
  image_url: string;
  banner_type: string;
  active: boolean;
}
