/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║         GONG CHA ADMIN — UI COMPONENT LIBRARY               ║
 * ║  Semua komponen reusable sudah sesuai design system         ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * CARA PAKAI:
 *   import {
 *     PageHeader, SummaryCard, TableCard, StatusBadge,
 *     ActionButton, SyncBadge, Toast, Modal,
 *     SearchInput, FilterSelect,
 *   } from "@/components/ui";
 */

"use client";

import { useEffect, useState, CSSProperties, ReactNode } from "react";
import {
  C, font, radius, spacing, typography,
  TxStatus, statusConfig, SyncStatus, syncConfig,
} from "@/lib/design-tokens";

// ─────────────────────────────────────────────────────────────────
//  1. PAGE HEADER
//     Dipakai di atas setiap halaman admin
// ─────────────────────────────────────────────────────────────────

interface PageHeaderProps {
  /** "Gong Cha Admin" */
  eyebrow?: string;
  /** Judul halaman, e.g. "Transaksi" */
  title: string;
  /** Subtitle kecil di bawah judul */
  subtitle?: string;
  /** Slot kanan: SyncBadge, tombol, dsb */
  right?: ReactNode;
}

export function PageHeader({ eyebrow = "Gong Cha Admin", title, subtitle, right }: PageHeaderProps) {
  return (
    <div style={{
      display: "flex", alignItems: "flex-end", justifyContent: "space-between",
      marginBottom: spacing["2xl"],
    }}>
      <div>
        <p style={{ ...typography.labelSm, color: C.tx3, textTransform: "uppercase", marginBottom: 4 }}>
          {eyebrow}
        </p>
        <h1 style={{ ...typography.heading, color: C.tx1, margin: 0 }}>{title}</h1>
        {subtitle && (
          <p style={{ ...typography.body, color: C.tx2, marginTop: 4 }}>{subtitle}</p>
        )}
      </div>
      {right && <div>{right}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
//  2. SYNC BADGE
//     Live indicator realtime (top-right PageHeader)
// ─────────────────────────────────────────────────────────────────

interface SyncBadgeProps {
  status: SyncStatus;
  /** Jumlah dokumen, tampil saat status = "live" */
  count?: number;
}

export function SyncBadge({ status, count }: SyncBadgeProps) {
  const cfg = syncConfig[status];
  return (
    <span style={{
      padding: "6px 14px", borderRadius: radius.pill,
      background: cfg.bg, color: cfg.color,
      ...typography.bodySm, fontWeight: 700,
    }}>
      {cfg.dot} {cfg.label(count)}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────
//  3. SUMMARY CARD
//     Clickable stat card (e.g. Needs Review: 12)
// ─────────────────────────────────────────────────────────────────

interface SummaryCardProps {
  label: string;
  count: number;
  bg: string;
  color: string;
  border: string;
  active?: boolean;
  onClick?: () => void;
}

export function SummaryCard({ label, count, bg, color, border, active, onClick }: SummaryCardProps) {
  return (
    <div
      onClick={onClick}
      style={{
        background: active ? bg : C.white,
        border: `1px solid ${active ? border : C.border}`,
        borderRadius: radius.card,
        padding: `${spacing.lg}px ${spacing.xl}px`,
        cursor: "pointer",
        boxShadow: C.shadow,
        transition: "all .15s",
      }}
    >
      <p style={{
        ...typography.labelMd, textTransform: "uppercase",
        color: C.tx3, marginBottom: spacing.sm,
      }}>
        {label}
      </p>
      <p style={{ ...typography.statNum, color, margin: 0 }}>{count}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
//  4. STATUS BADGE
//     Inline chip untuk kolom Status di tabel
// ─────────────────────────────────────────────────────────────────

interface StatusBadgeProps {
  status: TxStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const cfg = statusConfig[status] ?? statusConfig["NEEDS_REVIEW"];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: spacing.xs,
      padding: "3px 10px", borderRadius: radius.pill,
      background: cfg.bg, color: cfg.color,
      border: `1px solid ${cfg.border}`,
      ...typography.bodySm, fontWeight: 700,
    }}>
      {cfg.dot && <span>{cfg.dot}</span>}
      {cfg.label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────
//  5. TABLE CARD  (shell container)
//     Wrapper card untuk semua tabel halaman
// ─────────────────────────────────────────────────────────────────

interface TableCardProps {
  toolbar?: ReactNode;
  children: ReactNode;
}

export function TableCard({ toolbar, children }: TableCardProps) {
  return (
    <div style={{
      background: C.white,
      borderRadius: radius.table,
      border: `1px solid ${C.border}`,
      boxShadow: C.shadow,
      overflow: "hidden",
    }}>
      {toolbar && (
        <div style={{
          padding: `14px ${spacing.xl}px`,
          borderBottom: `1px solid ${C.border}`,
          display: "flex", gap: spacing.md, alignItems: "center",
        }}>
          {toolbar}
        </div>
      )}
      <div style={{ overflowX: "auto" }}>{children}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
//  6. TABLE PRIMITIVES  (Th, Td, Tr)
// ─────────────────────────────────────────────────────────────────

export function Th({ children }: { children: ReactNode }) {
  return (
    <th style={{
      padding: `11px ${spacing.lg}px`, textAlign: "left",
      ...typography.labelMd, textTransform: "uppercase",
      color: C.tx3, borderBottom: `1px solid ${C.border}`,
      background: C.bg,
    }}>
      {children}
    </th>
  );
}

interface TdProps {
  children: ReactNode;
  style?: CSSProperties;
}
export function Td({ children, style }: TdProps) {
  return (
    <td style={{ padding: `12px ${spacing.lg}px`, ...style }}>
      {children}
    </td>
  );
}

interface TrProps {
  children: ReactNode;
  onClick?: () => void;
}
export function Tr({ children, onClick }: TrProps) {
  const [hover, setHover] = useState(false);
  return (
    <tr
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        borderBottom: `1px solid ${C.border}`,
        background: hover ? C.bg : "transparent",
        transition: "background .1s",
        cursor: onClick ? "pointer" : "default",
      }}
    >
      {children}
    </tr>
  );
}

// ─────────────────────────────────────────────────────────────────
//  7. TABLE EMPTY STATE
// ─────────────────────────────────────────────────────────────────

interface TableEmptyProps {
  colSpan?: number;
  loading?: boolean;
  message?: string;
}
export function TableEmpty({ colSpan = 8, loading, message = "Tidak ada data." }: TableEmptyProps) {
  return (
    <tr>
      <td colSpan={colSpan} style={{
        textAlign: "center",
        padding: `${spacing["5xl"]}px ${spacing.lg}px`,
        color: C.tx3,
        ...typography.body,
      }}>
        {loading ? "Memuat data…" : message}
      </td>
    </tr>
  );
}

// ─────────────────────────────────────────────────────────────────
//  8. SEARCH INPUT
// ─────────────────────────────────────────────────────────────────

interface SearchInputProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  width?: number;
}

export function SearchInput({ value, onChange, placeholder = "Cari…", width = 280 }: SearchInputProps) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        height: 38, padding: "0 14px",
        borderRadius: radius.input, outline: "none",
        border: `1.5px solid ${C.border}`,
        background: C.bg, fontFamily: font,
        ...typography.body, color: C.tx1,
        width, boxSizing: "border-box",
      }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────
//  9. FILTER SELECT
// ─────────────────────────────────────────────────────────────────

interface FilterSelectProps<T extends string> {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}

export function FilterSelect<T extends string>({ value, onChange, options }: FilterSelectProps<T>) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      style={{
        height: 38, padding: "0 12px",
        borderRadius: radius.input, outline: "none",
        border: `1.5px solid ${C.border}`,
        background: C.bg, fontFamily: font,
        ...typography.body, color: C.tx1,
      }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

// ─────────────────────────────────────────────────────────────────
//  10. ACTION BUTTON  (variant: primary | warning | danger | ghost)
// ─────────────────────────────────────────────────────────────────

type ButtonVariant = "primary" | "warning" | "danger" | "ghost";

const buttonStyles: Record<ButtonVariant, CSSProperties> = {
  primary: { background: C.blue,    color: "#fff",      border: `1px solid ${C.blue}`        },
  warning: { background: C.amberBg, color: C.amber,     border: `1px solid ${C.amberBorder}` },
  danger:  { background: C.redBg,   color: C.red,       border: `1px solid ${C.redBorder}`   },
  ghost:   { background: "transparent", color: C.tx2,   border: `1px solid ${C.border}`      },
};

interface ActionButtonProps {
  variant?: ButtonVariant;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  children: ReactNode;
  icon?: ReactNode;
  /** sm = compact (tabel), md = default */
  size?: "sm" | "md";
}

export function ActionButton({
  variant = "primary", onClick, disabled, loading, children, icon, size = "sm",
}: ActionButtonProps) {
  const isDisabled = disabled || loading;
  const pad = size === "sm" ? "5px 12px" : "9px 20px";
  const fs  = size === "sm" ? 12 : 13;
  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      style={{
        ...buttonStyles[variant],
        padding: pad, borderRadius: radius.btn,
        cursor: isDisabled ? "not-allowed" : "pointer",
        fontFamily: font, fontSize: fs, fontWeight: 700,
        display: "inline-flex", alignItems: "center", gap: spacing.xs,
        opacity: isDisabled ? 0.6 : 1,
        transition: "opacity .15s",
      }}
    >
      {icon && <span>{icon}</span>}
      {loading ? "Memproses…" : children}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────
//  11. MODAL  (generic shell)
//      Pakai sebagai wrapper, isi konten via children
// ─────────────────────────────────────────────────────────────────

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Lebar modal dalam px, default 480 */
  width?: number;
}

export function Modal({ open, onClose, title, children, width = 480 }: ModalProps) {
  // Tutup dengan ESC
  useEffect(() => {
    if (!open) return;
    const handle = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0,
        background: C.overlay,
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 1000, padding: spacing.lg,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: C.white, borderRadius: radius.modal,
          boxShadow: C.shadowLg, width: "100%", maxWidth: width,
          overflow: "hidden",
        }}
      >
        {/* Modal header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: `${spacing.xl}px ${spacing.xl}px ${spacing.lg}px`,
          borderBottom: `1px solid ${C.border}`,
        }}>
          <h2 style={{ ...typography.headingSm, color: C.tx1, margin: 0 }}>{title}</h2>
          <button
            onClick={onClose}
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: C.tx3, fontSize: 20, lineHeight: 1, padding: spacing.xs,
            }}
          >
            ×
          </button>
        </div>

        {/* Modal body */}
        <div style={{ padding: spacing.xl }}>{children}</div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
//  12. MODAL DETAIL ROW  (label + value)
//      Dipakai di dalam Modal untuk tampilkan detail record
// ─────────────────────────────────────────────────────────────────

interface DetailRowProps {
  label: string;
  value: ReactNode;
}
export function DetailRow({ label, value }: DetailRowProps) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between",
      padding: `${spacing.sm}px 0`,
      borderBottom: `1px solid ${C.border}`,
    }}>
      <span style={{ ...typography.body, color: C.tx3 }}>{label}</span>
      <span style={{ ...typography.bodySb, color: C.tx1, textAlign: "right", maxWidth: "60%" }}>{value}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
//  13. MODAL ACTION ROW  (row tombol di bawah modal)
// ─────────────────────────────────────────────────────────────────

interface ModalActionsProps {
  children: ReactNode;
}
export function ModalActions({ children }: ModalActionsProps) {
  return (
    <div style={{
      display: "flex", gap: spacing.md, justifyContent: "flex-end",
      marginTop: spacing.xl, paddingTop: spacing.lg,
      borderTop: `1px solid ${C.border}`,
    }}>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
//  14. TOAST NOTIFICATION
// ─────────────────────────────────────────────────────────────────

interface ToastProps {
  msg: string;
  type?: "success" | "error";
  /** ms sebelum auto-dismiss, default 3000 */
  duration?: number;
  onDone: () => void;
}

export function Toast({ msg, type = "success", duration = 3000, onDone }: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onDone, duration);
    return () => clearTimeout(t);
  }, [duration, onDone]);

  const isError = type === "error";
  return (
    <div style={{
      position: "fixed", bottom: 28, right: 28, zIndex: 2000,
      background: isError ? C.redBg   : C.greenBg,
      color:      isError ? C.red     : C.green,
      border:     `1px solid ${isError ? C.redBorder : C.greenBorder}`,
      padding: "12px 18px", borderRadius: radius.btn,
      boxShadow: C.shadowMd,
      ...typography.bodySb,
      display: "flex", alignItems: "center", gap: spacing.sm,
      maxWidth: 360,
    }}>
      <span>{isError ? "✕" : "✓"}</span>
      <span>{msg}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
//  15. PAGE WRAPPER  (layout shell)
//      Bungkus seluruh konten halaman
// ─────────────────────────────────────────────────────────────────

interface PageWrapperProps {
  children: ReactNode;
  maxWidth?: number;
}
export function PageWrapper({ children, maxWidth = 1400 }: PageWrapperProps) {
  return (
    <div style={{
      fontFamily: font,
      padding: `${spacing["3xl"]}px ${spacing["4xl"]}px`,
      maxWidth,
      WebkitFontSmoothing: "antialiased" as any,
    }}>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
//  16. SUMMARY GRID WRAPPER  (4-col grid untuk summary cards)
// ─────────────────────────────────────────────────────────────────

export function SummaryGrid({ children }: { children: ReactNode }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(4, 1fr)",
      gap: 14,
      marginBottom: spacing["2xl"],
    }}>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
//  17. TOOLBAR COUNT LABEL  (misal: "24 transaksi")
// ─────────────────────────────────────────────────────────────────

export function ToolbarCount({ count, label = "item" }: { count: number; label?: string }) {
  return (
    <span style={{ marginLeft: "auto", ...typography.bodySm, color: C.tx3 }}>
      {count} {label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────
//  18. MONOSPACE CELL  (ID transaksi, kode unik)
// ─────────────────────────────────────────────────────────────────

export function MonoCell({ children }: { children: ReactNode }) {
  return (
    <span style={{
      fontFamily: "monospace",
      fontSize: 12, fontWeight: 700,
      color: C.blue,
    }}>
      {children}
    </span>
  );
}