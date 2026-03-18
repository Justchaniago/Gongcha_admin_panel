// ─── Shared types, constants, dan pure helpers ───────────────────────────────
// Tidak ada React import — murni types dan logic yang dipakai Desktop + Mobile.

export type AccessState = {
  authenticated: boolean;
  canRead: boolean;
  canManage: boolean;
  level: "none" | "read" | "manage";
  message?: string;
};

export type LogItem = {
  id: string;
  dayId: string;
  eventId: string;
  actorUid: string;
  actorName: string;
  actorEmail?: string | null;
  actorRole: "SUPER_ADMIN" | "STAFF";
  action: string;
  targetType: string;
  targetId: string;
  targetLabel?: string | null;
  summary: string;
  status: "success" | "failed";
  source: string;
  metadata?: Record<string, unknown>;
  createdAt: string | null;
  isManual?: boolean;
  isDeleted?: boolean;
  deletedAt?: string | null;
  deletedBy?: string;
  deleteReason?: string;
};

export type ChangeEntry = { label: string; before: string; after: string };

// ── Action visual identity ────────────────────────────────────────────────────
export const ACTION_META: Record<string, { emoji: string; label: string; color: string; bg: string }> = {
  TRANSACTION_APPROVED:      { emoji: "✅", label: "Transaksi Disetujui", color: "#059669", bg: "#ECFDF5" },
  TRANSACTION_REJECTED:      { emoji: "❌", label: "Transaksi Ditolak",   color: "#DC2626", bg: "#FEF2F2" },
  POINTS_UPDATED:            { emoji: "⭐", label: "Poin Diubah",         color: "#D97706", bg: "#FFFBEB" },
  VOUCHER_INJECTED:          { emoji: "🎁", label: "Voucher Dikirim",     color: "#7C3AED", bg: "#F5F3FF" },
  MEMBER_CREATED:            { emoji: "👤", label: "Member Dibuat",       color: "#2563EB", bg: "#EFF6FF" },
  MEMBER_UPDATED:            { emoji: "✏️", label: "Member Diupdate",     color: "#2563EB", bg: "#EFF6FF" },
  MEMBER_DELETED:            { emoji: "🗑️", label: "Member Dihapus",      color: "#DC2626", bg: "#FEF2F2" },
  STAFF_CREATED:             { emoji: "🧑‍💼", label: "Staff Dibuat",       color: "#2563EB", bg: "#EFF6FF" },
  STAFF_UPDATED:             { emoji: "✏️", label: "Staff Diupdate",      color: "#2563EB", bg: "#EFF6FF" },
  STAFF_DELETED:             { emoji: "🗑️", label: "Staff Dihapus",       color: "#DC2626", bg: "#FEF2F2" },
  MENU_CREATED:              { emoji: "🍵", label: "Menu Ditambah",       color: "#059669", bg: "#ECFDF5" },
  MENU_UPDATED:              { emoji: "✏️", label: "Menu Diupdate",       color: "#2563EB", bg: "#EFF6FF" },
  MENU_DELETED:              { emoji: "🗑️", label: "Menu Dihapus",        color: "#D97706", bg: "#FFFBEB" },
  REWARD_CREATED:            { emoji: "🎫", label: "Reward Ditambah",     color: "#059669", bg: "#ECFDF5" },
  REWARD_UPDATED:            { emoji: "✏️", label: "Reward Diupdate",     color: "#2563EB", bg: "#EFF6FF" },
  REWARD_DELETED:            { emoji: "🗑️", label: "Reward Dihapus",      color: "#D97706", bg: "#FFFBEB" },
  STORE_CREATED:             { emoji: "🏪", label: "Outlet Dibuat",       color: "#059669", bg: "#ECFDF5" },
  STORE_UPDATED:             { emoji: "✏️", label: "Outlet Diupdate",     color: "#2563EB", bg: "#EFF6FF" },
  STORE_DELETED:             { emoji: "🗑️", label: "Outlet Dihapus",      color: "#D97706", bg: "#FFFBEB" },
  SETTINGS_UPDATED:          { emoji: "⚙️", label: "Settings Diubah",     color: "#7C3AED", bg: "#F5F3FF" },
  NOTIFICATION_SENT:         { emoji: "📣", label: "Notif Dikirim",       color: "#2563EB", bg: "#EFF6FF" },
  ACTIVITY_LOG_NOTE_CREATED: { emoji: "📝", label: "Catatan Manual",      color: "#6B7280", bg: "#F3F4F6" },
  ACTIVITY_LOG_DELETED:      { emoji: "🚫", label: "Log Dihapus",         color: "#DC2626", bg: "#FEF2F2" },
};

export function getActionMeta(action: string) {
  return ACTION_META[action] ?? { emoji: "🔹", label: action, color: "#6B7280", bg: "#F3F4F6" };
}

// ── Field labels untuk diff display ──────────────────────────────────────────
const FIELD_LABELS: Record<string, string> = {
  name: "Nama", title: "Judul", description: "Deskripsi", category: "Kategori",
  basePrice: "Harga dasar", pointsCost: "Biaya poin", pointsrequired: "Biaya poin",
  imageUrl: "Gambar", isAvailable: "Tersedia", isActive: "Aktif",
  isRedeemable: "Bisa ditukar", isForceClosed: "Force closed",
  status: "Status", previousStatus: "Status sebelum", nextStatus: "Status baru",
  currentPoints: "Poin aktif", lifetimePoints: "Total poin", points: "Poin", xp: "XP",
  tier: "Tier", phone: "No. HP", phoneNumber: "No. HP", email: "Email",
  role: "Role", assignedStoreId: "Store assignment", targetUid: "Target UID",
  open: "Jam buka", close: "Jam tutup", operationalHours: "Jam operasional",
  minimumTransaction: "Min. transaksi", pointsPerThousand: "Poin/seribu",
  pointsExpiry: "Masa berlaku poin", notifications: "Notifikasi",
  rewardTitle: "Voucher", voucherCode: "Kode voucher", reason: "Alasan",
};

const IGNORED_DIFF_FIELDS = new Set([
  "updatedAt", "createdAt", "updatedBy", "requestedBy",
  "pointsLastEditedBy", "pointsLastEditedAt", "pointsLastUpdatedBy", "pointsLastUpdatedAt",
  "verifiedAt", "verifiedBy", "deletedAt", "deletedBy", "deleteReason", "id", "uid",
]);

function toPlainRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function valueToDisplay(value: unknown): string {
  if (value == null) return "-";
  if (typeof value === "boolean") return value ? "Ya" : "Tidak";
  if (typeof value === "number") return Number.isInteger(value) ? value.toLocaleString("id-ID") : String(value);
  if (typeof value === "string") return value.trim() || "-";
  if (Array.isArray(value)) return value.length ? value.map(valueToDisplay).join(", ") : "-";
  const rec = toPlainRecord(value);
  if (rec) {
    if (typeof rec.latitude === "number" && typeof rec.longitude === "number") return `${rec.latitude}, ${rec.longitude}`;
    if (typeof rec.lat === "number" && typeof rec.lng === "number") return `${rec.lat}, ${rec.lng}`;
    if (typeof rec.open === "string" && typeof rec.close === "string") return `${rec.open} – ${rec.close}`;
    return JSON.stringify(rec);
  }
  return String(value);
}

function getFieldLabel(key: string) {
  return FIELD_LABELS[key] ?? key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());
}

function collectDiffEntries(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): ChangeEntry[] {
  if (!before && !after) return [];
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  const entries: ChangeEntry[] = [];
  for (const key of keys) {
    if (IGNORED_DIFF_FIELDS.has(key)) continue;
    const b = valueToDisplay(before?.[key]);
    const a = valueToDisplay(after?.[key]);
    if (b === a) continue;
    entries.push({ label: getFieldLabel(key), before: b, after: a });
  }
  return entries;
}

export function extractChangeEntries(log: LogItem): ChangeEntry[] {
  const meta = toPlainRecord(log.metadata) ?? {};
  const before = toPlainRecord(meta.before);
  const after = toPlainRecord(meta.after);
  const changes = toPlainRecord(meta.changes);
  const diff = collectDiffEntries(before, after ?? (changes ? { ...(before ?? {}), ...changes } : null));
  if (diff.length > 0) return diff.slice(0, 8);
  if (typeof meta.previousStatus === "string" || typeof meta.nextStatus === "string") {
    return [{ label: "Status", before: valueToDisplay(meta.previousStatus), after: valueToDisplay(meta.nextStatus) }];
  }
  if (log.action === "VOUCHER_INJECTED") {
    return [{ label: "Voucher", before: "-", after: `${valueToDisplay(meta.rewardTitle)} (${valueToDisplay(meta.voucherCode)})` }];
  }
  if (log.action === "ACTIVITY_LOG_DELETED") {
    return [{ label: "Log status", before: "Aktif", after: "Dihapus" }];
  }
  return [];
}

// ── Date helpers ──────────────────────────────────────────────────────────────
export function formatRelativeTime(value: string | null): string {
  if (!value) return "—";
  const diff = Date.now() - new Date(value).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1) return "baru saja";
  if (m < 60) return `${m} mnt lalu`;
  if (h < 24) return `${h} jam lalu`;
  if (d < 7) return `${d} hari lalu`;
  return new Date(value).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

export function formatExactTime(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("id-ID", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

// ── API helpers ───────────────────────────────────────────────────────────────
// fetchAccess tidak lagi dipakai dari Desktop/Mobile — access sudah di-pass sebagai prop
// dari ActivityLogClient setelah keylog gate.

export async function fetchLogs(opts: {
  action?: string; search?: string; includeDeleted?: boolean;
  cursor?: string | null; canManage?: boolean;
}): Promise<{ logs: LogItem[]; nextCursor: string | null }> {
  const params = new URLSearchParams();
  if (opts.action) params.set("action", opts.action);
  if (opts.search?.trim()) params.set("search", opts.search.trim());
  if (opts.includeDeleted && opts.canManage) params.set("includeDeleted", "1");
  if (opts.cursor) params.set("cursor", opts.cursor);
  const res = await fetch(`/api/activity-logs?${params}`, { cache: "no-store" });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? "Gagal memuat log");
  return { logs: data.logs ?? [], nextCursor: data.nextCursor ?? null };
}

export async function createNote(summary: string, note: string): Promise<void> {
  const res = await fetch("/api/activity-logs", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ summary, note }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? "Gagal membuat catatan");
}

export async function softDeleteLog(id: string, reason: string): Promise<void> {
  const res = await fetch(`/api/activity-logs/${id}`, {
    method: "DELETE", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? "Gagal menghapus log");
}
