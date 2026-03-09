export const font = "'Plus Jakarta Sans', system-ui, sans-serif";

export const typography = {
  labelSm: { fontSize: 11, fontWeight: 700, letterSpacing: ".1em" } as const,
  labelMd: { fontSize: 11, fontWeight: 700, letterSpacing: ".06em" } as const,
  bodySm: { fontSize: 12, fontWeight: 400 } as const,
  body: { fontSize: 13, fontWeight: 400 } as const,
  bodySb: { fontSize: 13, fontWeight: 600 } as const,
  bodyBold: { fontSize: 13, fontWeight: 700 } as const,
  headingSm: { fontSize: 16, fontWeight: 700, letterSpacing: "-.015em" } as const,
  heading: { fontSize: 26, fontWeight: 800, letterSpacing: "-.025em" } as const,
  statNum: { fontSize: 28, fontWeight: 800, lineHeight: 1 } as const,
};

export const C = {
  bg: "#F9FAFB",
  white: "#FFFFFF",
  border: "#E5E7EB",
  tx1: "#111827",
  tx2: "#6B7280",
  tx3: "#9CA3AF",
  tx4: "#C2C6D9",
  blue: "#2563EB",
  blueLight: "#EFF6FF",
  blueL: "#EFF6FF",
  blueBorder: "#BFDBFE",
  amber: "#D97706",
  amberBg: "#FEF3C7",
  amberBorder: "#FDE68A",
  green: "#059669",
  greenBg: "#D1FAE5",
  greenBorder: "#6EE7B7",
  red: "#DC2626",
  redBg: "#FEE2E2",
  redBorder: "#FCA5A5",
  orange: "#EA580C",
  orangeBg: "#FFF7ED",
  orangeBorder: "#FED7AA",
  gray: "#6B7280",
  grayBg: "#F3F4F6",
  grayBorder: "#D1D5DB",
  overlay: "rgba(0,0,0,0.45)",
  shadow: "0 1px 3px rgba(0,0,0,.07), 0 1px 2px rgba(0,0,0,.05)",
  shadowMd: "0 4px 12px rgba(0,0,0,.10)",
  shadowLg: "0 8px 32px rgba(0,0,0,.14)",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 28,
  "4xl": 32,
  "5xl": 48,
} as const;

export const radius = {
  sm: 6,
  btn: 7,
  input: 9,
  card: 16,
  table: 18,
  modal: 20,
  pill: 99,
} as const;

export type TxStatus =
  | "NEEDS_REVIEW"
  | "COMPLETED"
  | "FRAUD"
  | "FLAGGED"
  | "REFUNDED"
  | "VERIFIED"
  | "REJECTED"
  | "PENDING"
  | "CANCELLED";

export const statusConfig: Record<
  TxStatus,
  { label: string; bg: string; color: string; border: string; dot?: string }
> = {
  NEEDS_REVIEW: { label: "Needs Review", bg: C.amberBg, color: C.amber, border: C.amberBorder, dot: "⚠" },
  COMPLETED: { label: "Completed", bg: C.greenBg, color: C.green, border: C.greenBorder },
  FRAUD: { label: "Fraud", bg: C.redBg, color: C.red, border: C.redBorder },
  FLAGGED: { label: "Flagged", bg: C.orangeBg, color: C.orange, border: C.orangeBorder },
  REFUNDED: { label: "Refunded", bg: C.grayBg, color: C.gray, border: C.grayBorder },
  VERIFIED: { label: "Verified", bg: C.greenBg, color: C.green, border: C.greenBorder, dot: "🟢" },
  REJECTED: { label: "Rejected", bg: C.redBg, color: C.red, border: C.redBorder, dot: "🔴" },
  PENDING: { label: "Pending", bg: C.grayBg, color: C.gray, border: C.grayBorder },
  CANCELLED: { label: "Cancelled", bg: C.grayBg, color: C.gray, border: C.grayBorder },
};

export type SyncStatus = "connecting" | "live" | "error";

export const syncConfig: Record<
  SyncStatus,
  { bg: string; color: string; dot: string; label: (count?: number) => string }
> = {
  connecting: { bg: C.amberBg, color: C.amber, dot: "🟡", label: () => "Menghubungkan…" },
  live: { bg: C.greenBg, color: C.green, dot: "🟢", label: (n) => `Live${typeof n === "number" ? ` · ${n} docs` : ""}` },
  error: { bg: C.redBg, color: C.red, dot: "🔴", label: () => "Error" },
};
