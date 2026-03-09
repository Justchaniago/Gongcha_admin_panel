/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║           GONG CHA ADMIN — DESIGN TOKENS                    ║
 * ║  Single source of truth untuk semua nilai visual            ║
 * ║  Benchmark: TransactionsClient.tsx                          ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * CARA PAKAI:
 *   import { C, font, radius, shadow, spacing } from "@/lib/design-tokens";
 */

// ─────────────────────────────────────────────
//  TYPOGRAPHY
// ─────────────────────────────────────────────

/** Font utama seluruh aplikasi */
export const font =
  "'Inter', 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

export const typography = {
  /** Label kecil: section header, tag uppercase */
  labelSm: { fontSize: 11, fontWeight: 700, letterSpacing: ".1em" } as const,
  /** Label medium: kolom tabel, toolbar label */
  labelMd: { fontSize: 11, fontWeight: 700, letterSpacing: ".06em" } as const,
  /** Body small: deskripsi, timestamp, meta */
  bodySm:  { fontSize: 12, fontWeight: 400 } as const,
  /** Body regular: konten utama tabel, input */
  body:    { fontSize: 13, fontWeight: 400 } as const,
  /** Body semibold: nama member, nilai penting */
  bodySb:  { fontSize: 13, fontWeight: 600 } as const,
  /** Body bold: nominal, ID transaksi */
  bodyBold:{ fontSize: 13, fontWeight: 700 } as const,
  /** Heading kecil: card subtitle */
  headingSm:{ fontSize: 16, fontWeight: 700, letterSpacing: "-.015em" } as const,
  /** Heading halaman */
  heading:  { fontSize: 26, fontWeight: 800, letterSpacing: "-.025em" } as const,
  /** Angka besar di summary card */
  statNum:  { fontSize: 28, fontWeight: 800, lineHeight: 1 } as const,
};

// ─────────────────────────────────────────────
//  COLORS
// ─────────────────────────────────────────────

export const C = {
  // ── Surface ──────────────────────────────
  /** Latar halaman */
  bg:        "#F9FAFB",
  /** Latar card / table */
  white:     "#FFFFFF",
  /** Border universal */
  border:    "#E5E7EB",

  // ── Text ─────────────────────────────────
  /** Teks utama */
  tx1:       "#111827",
  /** Teks sekunder */
  tx2:       "#6B7280",
  /** Teks tersier / label */
  tx3:       "#9CA3AF",

  // ── Brand / Accent ────────────────────────
  /** Link / ID / poin */
  blue:      "#2563EB",
  blueLight: "#EFF6FF",
  blueBorder:"#BFDBFE",

  // ── Status: Needs Review (amber) ──────────
  amber:      "#D97706",
  amberBg:    "#FEF3C7",
  amberBorder:"#FDE68A",

  // ── Status: Completed (green) ─────────────
  green:      "#059669",
  greenBg:    "#D1FAE5",
  greenBorder:"#6EE7B7",

  // ── Status: Fraud (red) ───────────────────
  red:        "#DC2626",
  redBg:      "#FEE2E2",
  redBorder:  "#FCA5A5",

  // ── Status: Flagged (orange) ──────────────
  orange:     "#EA580C",
  orangeBg:   "#FFF7ED",
  orangeBorder:"#FED7AA",

  // ── Status: Refunded (gray) ───────────────
  gray:       "#6B7280",
  grayBg:     "#F3F4F6",
  grayBorder: "#D1D5DB",

  // ── Overlay & Shadow ─────────────────────
  overlay:    "rgba(0,0,0,0.45)",
  shadow:     "0 1px 3px rgba(0,0,0,.07), 0 1px 2px rgba(0,0,0,.05)",
  shadowMd:   "0 4px 12px rgba(0,0,0,.10)",
  shadowLg:   "0 8px 32px rgba(0,0,0,.14)",
} as const;

// ─────────────────────────────────────────────
//  SPACING  (konsisten 4px grid)
// ─────────────────────────────────────────────

export const spacing = {
  /** 4px  */ xs:  4,
  /** 8px  */ sm:  8,
  /** 12px */ md:  12,
  /** 16px */ lg:  16,
  /** 20px */ xl:  20,
  /** 24px */ "2xl": 24,
  /** 28px */ "3xl": 28,
  /** 32px */ "4xl": 32,
  /** 48px */ "5xl": 48,
} as const;

// ─────────────────────────────────────────────
//  BORDER RADIUS
// ─────────────────────────────────────────────

export const radius = {
  /** 6px  – badge kecil */     sm:   6,
  /** 7px  – button kecil */    btn:  7,
  /** 9px  – input, select */   input:9,
  /** 16px – summary card */    card: 16,
  /** 18px – table card */      table:18,
  /** 20px – modal */           modal:20,
  /** 99px – pill / dot badge */pill: 99,
} as const;

// ─────────────────────────────────────────────
//  STATUS CONFIG  (single source for badge + card)
// ─────────────────────────────────────────────

export type TxStatus = "NEEDS_REVIEW" | "COMPLETED" | "FRAUD" | "FLAGGED" | "REFUNDED";

export const statusConfig: Record<TxStatus, {
  label: string;
  bg: string;
  color: string;
  border: string;
  dot?: string;
}> = {
  NEEDS_REVIEW: { label: "Needs Review", bg: C.amberBg,  color: C.amber,  border: C.amberBorder,  dot: "⚠" },
  COMPLETED:    { label: "Completed",    bg: C.greenBg,  color: C.green,  border: C.greenBorder   },
  FRAUD:        { label: "Fraud",        bg: C.redBg,    color: C.red,    border: C.redBorder     },
  FLAGGED:      { label: "Flagged",      bg: C.orangeBg, color: C.orange, border: C.orangeBorder  },
  REFUNDED:     { label: "Refunded",     bg: C.grayBg,   color: C.gray,   border: C.grayBorder    },
};

// ─────────────────────────────────────────────
//  SYNC STATUS CONFIG
// ─────────────────────────────────────────────

export type SyncStatus = "connecting" | "live" | "error";

export const syncConfig: Record<SyncStatus, {
  bg: string; color: string; dot: string; label: (count?: number) => string;
}> = {
  connecting: { bg: C.amberBg, color: C.amber, dot: "🟡", label: () => "Menghubungkan…"   },
  live:       { bg: C.greenBg, color: C.green, dot: "🟢", label: (n) => `Live · ${n} docs` },
  error:      { bg: C.redBg,   color: C.red,   dot: "🔴", label: () => "Error"              },
};
