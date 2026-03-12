import { useState } from "react";

// ═══════════════════════════════════════════════════════════════
// GONG CHA ADMIN — DESIGN SYSTEM
// Extracted & extended from TransactionsClient.tsx
// ═══════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
// § 1. FOUNDATION TOKENS
// ─────────────────────────────────────────────────────────────

const tokens = {
  // ── Color System ─────────────────────────────────────────
  color: {
    // Brand
    brand: {
      primary:   "#D97706",  // amber-600  — main brand action
      secondary: "#059669",  // emerald-600
    },
    // Neutrals
    neutral: {
      0:   "#FFFFFF",
      50:  "#F9FAFB",
      100: "#F3F4F6",
      200: "#E5E7EB",
      400: "#9CA3AF",
      500: "#6B7280",
      700: "#374151",
      900: "#111827",
    },
    // Semantic
    semantic: {
      success:   { bg: "#D1FAE5", fg: "#059669", border: "#A7F3D0" },
      warning:   { bg: "#FEF3C7", fg: "#D97706", border: "#FDE68A" },
      error:     { bg: "#FEE2E2", fg: "#DC2626", border: "#FECACA" },
      info:      { bg: "#DBEAFE", fg: "#3B82F6", border: "#BFDBFE" },
      neutral:   { bg: "#F3F4F6", fg: "#6B7280", border: "#E5E7EB" },
    },
    // State
    state: {
      hover:    "#F9FAFB",
      active:   "#F3F4F6",
      disabled: "#F3F4F6",
      focus:    "#3B82F6",
    },
    // Accent
    accent: {
      blue: "#3B82F6",  // IDs, links, points
    },
  },

  // ── Typography ────────────────────────────────────────────
  typography: {
    fontFamily: {
      base:    "Inter, system-ui, sans-serif",
      mono:    "ui-monospace, 'Cascadia Code', monospace",
    },
    scale: {
      display: { size: "28px", weight: 800, lineHeight: 1,    letterSpacing: 0,       usage: "Summary card count" },
      h1:      { size: "26px", weight: 800, lineHeight: 1.2,  letterSpacing: "-.025em", usage: "Page title" },
      h2:      { size: "18px", weight: 700, lineHeight: 1.3,  letterSpacing: "-.015em", usage: "Section title / modal title" },
      h3:      { size: "15px", weight: 700, lineHeight: 1.4,  letterSpacing: 0,       usage: "Card title" },
      body:    { size: "13px", weight: 400, lineHeight: 1.5,  letterSpacing: 0,       usage: "Table cells, descriptions" },
      bodyMd:  { size: "13px", weight: 600, lineHeight: 1.5,  letterSpacing: 0,       usage: "Member name, strong values" },
      small:   { size: "12px", weight: 400, lineHeight: 1.4,  letterSpacing: 0,       usage: "Helper text, count labels" },
      caption: { size: "11px", weight: 700, lineHeight: 1.3,  letterSpacing: ".08em", usage: "Card labels, table headers (uppercase)" },
      eyebrow: { size: "11px", weight: 700, lineHeight: 1.2,  letterSpacing: ".10em", usage: "Page section eyebrow (uppercase)" },
      mono:    { size: "12px", weight: 700, lineHeight: 1.4,  letterSpacing: 0,       usage: "Transaction IDs (monospace)" },
    },
  },

  // ── Spacing Scale ─────────────────────────────────────────
  spacing: {
    1:  "4px",
    2:  "8px",
    3:  "12px",
    4:  "14px",   // card gap
    5:  "16px",   // card padding v
    6:  "20px",   // card padding h, toolbar padding h
    7:  "24px",   // section margin
    8:  "28px",   // page padding top/bottom
    9:  "32px",   // page padding left/right
    10: "48px",   // empty state padding
  },

  // ── Border Radius ─────────────────────────────────────────
  radius: {
    sm:   "7px",   // button (review)
    md:   "8px",   // modal buttons
    lg:   "9px",   // input, select
    xl:   "16px",  // summary card
    "2xl":"18px",  // table card container
    pill: "99px",  // badge, sync indicator
  },

  // ── Shadow / Elevation ────────────────────────────────────
  shadow: {
    card:    "0 1px 3px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.04)",
    modal:   "0 20px 60px rgba(0,0,0,.18), 0 4px 16px rgba(0,0,0,.10)",
    dropdown:"0 4px 12px rgba(0,0,0,.10)",
    toast:   "0 4px 12px rgba(0,0,0,.12)",
    hover:   "0 2px 6px rgba(0,0,0,.08)",
  },

  // ── Border ────────────────────────────────────────────────
  border: {
    default: "1px solid #E5E7EB",
    input:   "1.5px solid #E5E7EB",
    focus:   "1.5px solid #3B82F6",
    card:    "1px solid #E5E7EB",
    modal:   "none",
  },

  // ── Motion ────────────────────────────────────────────────
  motion: {
    duration: { fast: "100ms", normal: "150ms", slow: "300ms" },
    easing:   { default: "ease", out: "ease-out", spring: "cubic-bezier(.34,1.56,.64,1)" },
    patterns: {
      cardHover:   "background 150ms ease",
      rowHover:    "background 100ms ease",
      cardFilter:  "all 150ms ease",
      modalIn:     "opacity 150ms ease, transform 150ms ease-out",
      toastIn:     "opacity 200ms ease, transform 200ms cubic-bezier(.34,1.56,.64,1)",
    },
  },

  // ── Z-index Map ───────────────────────────────────────────
  zIndex: {
    base:     0,
    card:     10,
    dropdown: 100,
    header:   200,
    sidebar:  300,
    modal:    400,
    toast:    500,
    tooltip:  600,
  },
};

// ─────────────────────────────────────────────────────────────
// § 2. LAYOUT SYSTEM
// ─────────────────────────────────────────────────────────────
const layout = {
  container: {
    page:    "max-width: 1400px",
    content: "max-width: 1100px",
    modal:   "max-width: 520px",
  },
  gutter: {
    desktop: "28px 32px",   // padding: "28px 32px"
    tablet:  "20px 20px",
    mobile:  "16px 16px",
  },
  breakpoints: {
    sm:  "640px",
    md:  "768px",
    lg:  "1024px",
    xl:  "1280px",
    "2xl":"1400px",
  },
  grid: {
    summaryCards: "repeat(4, 1fr) · gap 14px",
    formToolbar:  "flex row · gap 12px",
  },
  rhythm: {
    headerToCards:  "24px",
    cardsToTable:   "24px",
    toolbarPadding: "14px 20px",
    tableCellBody:  "12px 16px",
    tableCellHead:  "11px 16px",
  },
};

// ─────────────────────────────────────────────────────────────
// § 3. COMPONENTS
// ─────────────────────────────────────────────────────────────

const FONT = tokens.typography.fontFamily.base;
const C    = tokens.color;
const S    = tokens.shadow;
const R    = tokens.radius;

// ── Button ───────────────────────────────────────────────────
function Button({ variant = "primary", size = "md", disabled = false, loading = false, icon, children, onClick }) {
  const variants = {
    primary:   { bg: "#059669", color: "#fff",     border: "none",                hoverBg: "#047857" },
    secondary: { bg: "#F3F4F6", color: "#374151",  border: "1px solid #E5E7EB",   hoverBg: "#E5E7EB" },
    ghost:     { bg: "transparent", color: "#374151", border: "1px solid #E5E7EB", hoverBg: "#F9FAFB" },
    danger:    { bg: "#DC2626", color: "#fff",     border: "none",                hoverBg: "#B91C1C" },
    warning:   { bg: "#FEF3C7", color: "#D97706",  border: "1px solid #FDE68A",   hoverBg: "#FDE68A" },
  };
  const sizes = {
    sm: { padding: "4px 10px", fontSize: "11px", height: "28px", borderRadius: R.sm },
    md: { padding: "5px 12px", fontSize: "12px", height: "32px", borderRadius: R.sm },
    lg: { padding: "8px 20px", fontSize: "13px", height: "38px", borderRadius: R.md },
  };
  const v = variants[variant];
  const sz = sizes[size];
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: disabled ? C.state.disabled : hovered ? v.hoverBg : v.bg,
        color: disabled ? C.neutral[400] : v.color,
        border: v.border,
        padding: sz.padding,
        height: sz.height,
        borderRadius: sz.borderRadius,
        cursor: disabled || loading ? "not-allowed" : "pointer",
        fontFamily: FONT, fontSize: sz.fontSize, fontWeight: 700,
        display: "inline-flex", alignItems: "center", gap: 5,
        opacity: loading ? .7 : 1,
        transition: "all 150ms ease",
      }}
    >
      {icon && !loading && icon}
      {loading && <span style={{ width: 10, height: 10, borderRadius: "50%", border: "2px solid currentColor", borderTopColor: "transparent", animation: "spin 0.6s linear infinite", display: "inline-block" }} />}
      {loading ? "Memproses…" : children}
    </button>
  );
}

// ── Input ────────────────────────────────────────────────────
function Input({ placeholder, value, onChange, error, disabled }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <input
        value={value} onChange={onChange} placeholder={placeholder}
        disabled={disabled}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          height: 38, padding: "0 14px", borderRadius: R.lg,
          outline: "none",
          border: error ? `1.5px solid ${C.semantic.error.fg}` : focused ? tokens.border.focus : tokens.border.input,
          background: disabled ? C.state.disabled : C.neutral[50],
          fontFamily: FONT, fontSize: 13, color: C.neutral[900],
          width: 280, boxSizing: "border-box",
          transition: "border 150ms ease",
          cursor: disabled ? "not-allowed" : "text",
          opacity: disabled ? .6 : 1,
        }}
      />
      {error && <p style={{ fontSize: 11, color: C.semantic.error.fg, margin: 0, fontFamily: FONT }}>{error}</p>}
    </div>
  );
}

// ── Select ────────────────────────────────────────────────────
function Select({ value, onChange, options }) {
  return (
    <select
      value={value} onChange={onChange}
      style={{
        height: 38, padding: "0 12px", borderRadius: R.lg,
        outline: "none", border: tokens.border.input,
        background: C.neutral[50], fontFamily: FONT,
        fontSize: 13, color: C.neutral[900],
      }}
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

// ── Badge / StatusBadge ───────────────────────────────────────
const STATUS_MAP = {
  NEEDS_REVIEW: { ...C.semantic.warning, label: "Needs Review", dot: "⚠" },
  COMPLETED:    { ...C.semantic.success, label: "Completed",    dot: "✓" },
  FRAUD:        { ...C.semantic.error,   label: "Fraud",        dot: "✕" },
  FLAGGED:      { ...C.semantic.warning, label: "Flagged",      dot: "⚑" },
  REFUNDED:     { ...C.semantic.neutral, label: "Refunded",     dot: "↩" },
  INFO:         { ...C.semantic.info,    label: "Info",         dot: "ℹ" },
};

function Badge({ status, size = "md" }) {
  const s = STATUS_MAP[status] ?? STATUS_MAP.INFO;
  const sz = size === "sm"
    ? { padding: "2px 7px", fontSize: 10 }
    : { padding: "3px 10px", fontSize: 11 };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      ...sz, borderRadius: R.pill,
      background: s.bg, color: s.fg,
      fontFamily: FONT, fontWeight: 700,
    }}>
      {s.dot} {s.label}
    </span>
  );
}

// ── Card ─────────────────────────────────────────────────────
function Card({ title, subtitle, active, accentColor, accentBg, count, onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: active ? accentBg : C.neutral[0],
        border: `1px solid ${active ? accentColor : hovered ? C.neutral[200] : C.neutral[200]}`,
        borderRadius: R.xl, padding: "16px 20px",
        cursor: onClick ? "pointer" : "default",
        boxShadow: hovered ? S.hover : S.card,
        transition: tokens.motion.patterns.cardFilter,
        fontFamily: FONT,
      }}
    >
      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: C.neutral[400], margin: "0 0 6px" }}>
        {title}
      </p>
      {count !== undefined && (
        <p style={{ fontSize: 28, fontWeight: 800, color: accentColor, margin: 0, lineHeight: 1 }}>
          {count}
        </p>
      )}
      {subtitle && <p style={{ fontSize: 12, color: C.neutral[500], margin: "4px 0 0" }}>{subtitle}</p>}
    </div>
  );
}

// ── Table ─────────────────────────────────────────────────────
function TableDemo() {
  const rows = [
    { id: "TXN-001", date: "10 Mar 2024", member: "Budi Santoso",  outlet: "Grand Indonesia", amount: "Rp 125.000", pts: "125",  status: "NEEDS_REVIEW" },
    { id: "TXN-002", date: "10 Mar 2024", member: "Siti Rahayu",   outlet: "Pondok Indah",    amount: "Rp 87.500",  pts: "87",   status: "COMPLETED"    },
    { id: "TXN-003", date: "09 Mar 2024", member: "Agus Wijaya",   outlet: "Taman Anggrek",   amount: "Rp 350.000", pts: "350",  status: "FRAUD"        },
    { id: "TXN-004", date: "09 Mar 2024", member: "Dewi Lestari",  outlet: "Pacific Place",   amount: "Rp 55.000",  pts: "55",   status: "REFUNDED"     },
  ];
  return (
    <div style={{ background: C.neutral[0], borderRadius: R["2xl"], border: tokens.border.card, boxShadow: S.card, overflow: "hidden" }}>
      {/* Toolbar */}
      <div style={{ padding: "14px 20px", borderBottom: tokens.border.default, display: "flex", gap: 12, alignItems: "center" }}>
        <Input placeholder="Cari ID / nama member / outlet…" value="" onChange={() => {}} />
        <Select value="all" onChange={() => {}} options={[
          { value: "all", label: "Semua Status" },
          { value: "NEEDS_REVIEW", label: "⚠ Needs Review" },
          { value: "COMPLETED",    label: "✓ Completed" },
        ]} />
        <span style={{ marginLeft: "auto", fontSize: 12, color: C.neutral[400], fontFamily: FONT }}>4 transaksi</span>
      </div>
      {/* Table */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, fontFamily: FONT }}>
          <thead>
            <tr style={{ background: C.neutral[50] }}>
              {["ID Transaksi","Tanggal","Member","Outlet","Nominal","Poin","Status","Aksi"].map(h => (
                <th key={h} style={{ padding: "11px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: C.neutral[400], borderBottom: tokens.border.default }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const [hov, setHov] = useState(false);
              return (
                <tr key={r.id} style={{ borderBottom: tokens.border.default, background: hov ? C.neutral[50] : "" }}
                  onMouseEnter={() => setHov(true)}
                  onMouseLeave={() => setHov(false)}
                >
                  <td style={{ padding: "12px 16px", fontWeight: 700, color: C.accent.blue, fontFamily: tokens.typography.fontFamily.mono, fontSize: 12 }}>{r.id}</td>
                  <td style={{ padding: "12px 16px", color: C.neutral[500] }}>{r.date}</td>
                  <td style={{ padding: "12px 16px", color: C.neutral[900], fontWeight: 600 }}>{r.member}</td>
                  <td style={{ padding: "12px 16px", color: C.neutral[500] }}>{r.outlet}</td>
                  <td style={{ padding: "12px 16px", fontWeight: 700, color: C.neutral[900] }}>{r.amount}</td>
                  <td style={{ padding: "12px 16px", color: C.accent.blue, fontWeight: 600 }}>{r.pts}</td>
                  <td style={{ padding: "12px 16px" }}><Badge status={r.status} /></td>
                  <td style={{ padding: "12px 16px", textAlign: "center" }}>
                    {r.status === "NEEDS_REVIEW" && <Button variant="warning" size="sm">👁 Tinjau</Button>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────
function Modal({ onClose, loading }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: tokens.zIndex.modal }}>
      <div style={{ background: C.neutral[0], borderRadius: R["2xl"], boxShadow: S.modal, width: "100%", maxWidth: 480, fontFamily: FONT, overflow: "hidden" }}>
        {/* Head */}
        <div style={{ padding: "20px 24px", borderBottom: tokens.border.default }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: C.neutral[400], margin: "0 0 4px" }}>Verifikasi Transaksi</p>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: C.neutral[900], margin: 0 }}>TXN-20240310-001</h2>
        </div>
        {/* Body */}
        <div style={{ padding: "20px 24px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {[["Member","Budi Santoso"],["Outlet","Grand Indonesia"],["Nominal","Rp 125.000"],["Poin","125 pts"]].map(([k,v]) => (
              <div key={k} style={{ background: C.neutral[50], borderRadius: R.lg, padding: "10px 14px" }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: C.neutral[400], letterSpacing: ".06em", textTransform: "uppercase", margin: "0 0 2px" }}>{k}</p>
                <p style={{ fontSize: 14, fontWeight: 700, color: C.neutral[900], margin: 0 }}>{v}</p>
              </div>
            ))}
          </div>
        </div>
        {/* Footer */}
        <div style={{ padding: "16px 24px", borderTop: tokens.border.default, display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <Button variant="ghost" size="lg" onClick={onClose} disabled={loading}>Batal</Button>
          <Button variant="danger" size="lg" loading={loading}>✕ Tolak</Button>
          <Button variant="primary" size="lg" loading={loading}>✓ Setujui</Button>
        </div>
      </div>
    </div>
  );
}

// ── Toast ─────────────────────────────────────────────────────
function Toast({ msg, type }) {
  const s = type === "error" ? C.semantic.error : C.semantic.success;
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 8,
      background: s.bg, color: s.fg,
      border: `1px solid ${s.border}`,
      padding: "12px 18px", borderRadius: R.xl,
      fontFamily: FONT, fontSize: 13, fontWeight: 700,
      boxShadow: S.toast,
    }}>
      {type === "error" ? "✕" : "✓"} {msg}
    </div>
  );
}

// ── SyncIndicator ─────────────────────────────────────────────
function SyncIndicator({ status }) {
  const map = {
    connecting: { ...C.semantic.warning, dot: "🟡", label: "Menghubungkan…" },
    live:       { ...C.semantic.success, dot: "🟢", label: "Live · 42 docs" },
    error:      { ...C.semantic.error,   dot: "🔴", label: "Error" },
  };
  const s = map[status];
  return (
    <span style={{ padding: "6px 14px", borderRadius: R.pill, background: s.bg, color: s.fg, fontSize: 12, fontWeight: 700, fontFamily: FONT }}>
      {s.dot} {s.label}
    </span>
  );
}

// ── EmptyState ────────────────────────────────────────────────
function EmptyState({ msg = "Tidak ada transaksi.", loading = false }) {
  return (
    <div style={{ textAlign: "center", padding: "48px 16px", color: C.neutral[400], fontFamily: FONT, fontSize: 13 }}>
      {loading
        ? <><span style={{ fontSize: 24 }}>⏳</span><p style={{ margin: "8px 0 0" }}>Memuat data…</p></>
        : <><span style={{ fontSize: 24 }}>📭</span><p style={{ margin: "8px 0 0" }}>{msg}</p></>
      }
    </div>
  );
}

// ── Checkbox ─────────────────────────────────────────────────
function Checkbox({ label, checked, onChange }) {
  return (
    <label style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer", fontFamily: FONT, fontSize: 13, color: C.neutral[700] }}>
      <div
        onClick={onChange}
        style={{
          width: 16, height: 16, borderRadius: 4,
          border: checked ? "none" : `2px solid ${C.neutral[400]}`,
          background: checked ? C.semantic.success.fg : C.neutral[0],
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "all 150ms ease", cursor: "pointer",
        }}
      >
        {checked && <span style={{ color: "#fff", fontSize: 10, lineHeight: 1 }}>✓</span>}
      </div>
      {label}
    </label>
  );
}

// ─────────────────────────────────────────────────────────────
// § 4. PATTERN SNIPPETS (prose specs)
// ─────────────────────────────────────────────────────────────
const patterns = {
  dashboardCard: "Hierarki: label 11px uppercase → angka 28px bold → (subtitle 12px optional). Clickable = filter toggle. Active state: background tinted + border colored.",
  dataTable:     "Toolbar: search 280px + select filter + count label auto-right. Header: 11px uppercase. Row: hover bg neutral-50. Action col: centered. ID col: monospace blue.",
  formPattern:   "Label uppercase 11px above field. Helper text 11px below. Error: border red + message red 11px below. Field height 38px. Group gap 16px.",
  modalPattern:  "Head: eyebrow + title. Body: data grid 2-col neutral-50 cards. Footer: cancel-ghost left, danger+primary right. Backdrop 45% black. No scroll if content fits.",
  loadingState:  "Connecting = yellow sync badge. Loading row = 'Memuat data…' 13px centered neutral-400 with padding-top 48px.",
  errorBoundary: "Row 'Tidak ada transaksi.' centered neutral-400 colSpan full. Toast error variant.",
  noDataState:   "Icon 24px + label 13px. Padding 48px top.",
  permGating:    "Button disabled: bg neutral-100, color neutral-400, cursor not-allowed. No reason tooltip in current codebase — extend with Popover.",
};

// ─────────────────────────────────────────────────────────────
// § 5. CONTENT GUIDELINES
// ─────────────────────────────────────────────────────────────
const content = {
  tone:         "Semi-formal Bahasa Indonesia. Admin-facing. Direct, efficient.",
  buttonLabels: { confirm: "Setujui", reject: "Tolak", review: "Tinjau", cancel: "Batal", loading: "Memproses…" },
  dateFormat:   "id-ID → 10 Mar 2024 (no leading zero, short month)",
  currency:     "id-ID → Rp 125.000 (dot thousand separator, no decimal for integers)",
  iconStyle:    "Outline / stroke (strokeWidth 2-2.5). Size 12px inline buttons, 16px standalone.",
  a11y: {
    contrastTarget:  "WCAG AA — text on colored badge: check fg/bg ratio ≥ 4.5:1",
    focusRing:       "outline: 2px solid #3B82F6; outline-offset: 2px",
    modalKeyboard:   "Trap focus inside modal. Escape = close (if !loading). First focusable on open.",
    ariaLabels:      "button[aria-label='Tinjau transaksi {id}'], select[aria-label='Filter status'], input[aria-label='Cari transaksi']",
  },
};

// ─────────────────────────────────────────────────────────────
// SHOWCASE RENDERER
// ─────────────────────────────────────────────────────────────

const NAV = ["Tokens","Typography","Components","Patterns","Content"];

export default function DesignSystem() {
  const [tab, setTab] = useState("Tokens");
  const [showModal, setShowModal] = useState(false);
  const [cbChecked, setCbChecked] = useState(false);
  const [activeCard, setActiveCard] = useState(null);

  const Section = ({ title, children }) => (
    <div style={{ marginBottom: 40 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: C.neutral[400], margin: 0, fontFamily: FONT }}>
          {title}
        </p>
        <div style={{ flex: 1, height: 1, background: C.neutral[200] }} />
      </div>
      {children}
    </div>
  );

  const Code = ({ children }) => (
    <code style={{ background: C.neutral[100], color: C.accent.blue, padding: "2px 6px", borderRadius: 4, fontFamily: tokens.typography.fontFamily.mono, fontSize: 11 }}>
      {children}
    </code>
  );

  const Row = ({ label, value, children }) => (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 16, padding: "8px 0", borderBottom: `1px solid ${C.neutral[100]}`, fontFamily: FONT }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: C.neutral[500], minWidth: 160, flexShrink: 0 }}>{label}</span>
      <div style={{ fontSize: 12, color: C.neutral[700], flex: 1 }}>{children || value}</div>
    </div>
  );

  return (
    <div style={{ fontFamily: FONT, background: C.neutral[50], minHeight: "100vh", WebkitFontSmoothing: "antialiased" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <div style={{ background: C.neutral[0], borderBottom: `1px solid ${C.neutral[200]}`, padding: "0 32px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ padding: "20px 0 0" }}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: C.neutral[400], margin: "0 0 2px" }}>Gong Cha Admin</p>
            <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-.025em", color: C.neutral[900], margin: 0 }}>Design System</h1>
          </div>
          {/* Nav */}
          <div style={{ display: "flex", gap: 0, marginTop: 20 }}>
            {NAV.map(n => (
              <button key={n} onClick={() => setTab(n)} style={{
                padding: "10px 16px", background: "none", border: "none",
                borderBottom: `2px solid ${tab === n ? C.color.brand.primary : "transparent"}`,
                color: tab === n ? C.color.brand.primary : C.neutral[500],
                fontFamily: FONT, fontSize: 13, fontWeight: 700, cursor: "pointer",
                transition: "all 150ms",
              }}>
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 32px" }}>

        {/* ── TAB: TOKENS ── */}
        {tab === "Tokens" && (
          <>
            <Section title="Color System">
              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                {/* Semantic */}
                <div>
                  <p style={{ fontSize: 12, fontWeight: 700, color: C.neutral[500], margin: "0 0 10px", fontFamily: FONT }}>Semantic Colors</p>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {Object.entries(tokens.color.semantic).map(([name, s]) => (
                      <div key={name} style={{ minWidth: 120 }}>
                        <div style={{ height: 40, borderRadius: R.md, background: s.bg, border: `1px solid ${s.border}`, marginBottom: 4, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: s.fg }}>{name}</span>
                        </div>
                        <p style={{ fontSize: 10, color: C.neutral[400], margin: 0, fontFamily: tokens.typography.fontFamily.mono }}>bg {s.bg}</p>
                        <p style={{ fontSize: 10, color: C.neutral[400], margin: 0, fontFamily: tokens.typography.fontFamily.mono }}>fg {s.fg}</p>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Neutrals */}
                <div>
                  <p style={{ fontSize: 12, fontWeight: 700, color: C.neutral[500], margin: "0 0 10px", fontFamily: FONT }}>Neutral Scale</p>
                  <div style={{ display: "flex", gap: 8 }}>
                    {Object.entries(tokens.color.neutral).map(([k, v]) => (
                      <div key={k} style={{ textAlign: "center" }}>
                        <div style={{ width: 52, height: 52, borderRadius: R.md, background: v, border: `1px solid ${C.neutral[200]}` }} />
                        <p style={{ fontSize: 10, color: C.neutral[400], margin: "4px 0 0", fontFamily: tokens.typography.fontFamily.mono }}>{k}</p>
                        <p style={{ fontSize: 9, color: C.neutral[400], margin: 0, fontFamily: tokens.typography.fontFamily.mono }}>{v}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Section>

            <Section title="Spacing Scale">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {Object.entries(tokens.spacing).map(([k, v]) => (
                  <div key={k} style={{ background: C.neutral[0], border: tokens.border.card, borderRadius: R.md, padding: "10px 14px", textAlign: "center", minWidth: 70, fontFamily: FONT }}>
                    <div style={{ height: 4, background: C.color.brand.primary, borderRadius: 2, width: v, maxWidth: 60, margin: "0 auto 6px" }} />
                    <p style={{ fontSize: 11, fontWeight: 700, color: C.neutral[700], margin: 0 }}>sp-{k}</p>
                    <p style={{ fontSize: 10, color: C.neutral[400], margin: 0 }}>{v}</p>
                  </div>
                ))}
              </div>
            </Section>

            <Section title="Radius">
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {Object.entries(tokens.radius).map(([k, v]) => (
                  <div key={k} style={{ background: C.neutral[0], border: tokens.border.card, padding: "14px 18px", borderRadius: v, textAlign: "center", boxShadow: S.card, fontFamily: FONT }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: C.neutral[700], margin: 0 }}>{k}</p>
                    <p style={{ fontSize: 10, color: C.neutral[400], margin: "2px 0 0" }}>{v}</p>
                  </div>
                ))}
              </div>
            </Section>

            <Section title="Shadow / Elevation">
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                {Object.entries(tokens.shadow).map(([k, v]) => (
                  <div key={k} style={{ background: C.neutral[0], padding: "16px 20px", borderRadius: R.xl, boxShadow: v, fontFamily: FONT }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: C.neutral[700], margin: 0 }}>shadow/{k}</p>
                    <p style={{ fontSize: 10, color: C.neutral[400], margin: "4px 0 0", maxWidth: 200 }}>{v}</p>
                  </div>
                ))}
              </div>
            </Section>

            <Section title="Motion Tokens">
              <div style={{ background: C.neutral[0], borderRadius: R.xl, border: tokens.border.card, padding: "16px 20px" }}>
                <Row label="duration.fast">{<Code>100ms</Code>}</Row>
                <Row label="duration.normal">{<Code>150ms</Code>}</Row>
                <Row label="duration.slow">{<Code>300ms</Code>}</Row>
                <Row label="card hover">{<Code>background 150ms ease</Code>}</Row>
                <Row label="row hover">{<Code>background 100ms ease</Code>}</Row>
                <Row label="modal">{<Code>opacity + transform 150ms ease-out</Code>}</Row>
                <Row label="toast in">{<Code>opacity + transform 200ms cubic-bezier(.34,1.56,.64,1)</Code>}</Row>
              </div>
            </Section>

            <Section title="Z-Index Map">
              <div style={{ background: C.neutral[0], borderRadius: R.xl, border: tokens.border.card, padding: "16px 20px" }}>
                {Object.entries(tokens.zIndex).map(([k, v]) => (
                  <Row key={k} label={`z-${k}`}><Code>{v}</Code></Row>
                ))}
              </div>
            </Section>
          </>
        )}

        {/* ── TAB: TYPOGRAPHY ── */}
        {tab === "Typography" && (
          <Section title="Type Scale">
            <div style={{ background: C.neutral[0], borderRadius: R["2xl"], border: tokens.border.card, padding: "24px 28px", display: "flex", flexDirection: "column", gap: 20 }}>
              {Object.entries(tokens.typography.scale).map(([level, spec]) => (
                <div key={level} style={{ display: "flex", alignItems: "baseline", gap: 20, paddingBottom: 16, borderBottom: `1px solid ${C.neutral[100]}` }}>
                  <div style={{ minWidth: 80 }}>
                    <Code>{level}</Code>
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{
                      fontSize: spec.size,
                      fontWeight: spec.weight,
                      lineHeight: spec.lineHeight,
                      letterSpacing: spec.letterSpacing,
                      textTransform: ["caption","eyebrow"].includes(level) ? "uppercase" : "none",
                      fontFamily: level === "mono" ? tokens.typography.fontFamily.mono : FONT,
                      color: C.neutral[900], margin: 0,
                    }}>
                      {level === "display" ? "42" : level === "mono" ? "TXN-20240310-001" : `${level} — ${spec.usage}`}
                    </p>
                  </div>
                  <div style={{ minWidth: 220, fontSize: 11, color: C.neutral[400], fontFamily: tokens.typography.fontFamily.mono, lineHeight: 1.6 }}>
                    {spec.size} · w{spec.weight} · lh{spec.lineHeight}{spec.letterSpacing ? ` · ls${spec.letterSpacing}` : ""}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* ── TAB: COMPONENTS ── */}
        {tab === "Components" && (
          <>
            <Section title="Buttons">
              <div style={{ background: C.neutral[0], borderRadius: R["2xl"], border: tokens.border.card, padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: C.neutral[400], textTransform: "uppercase", letterSpacing: ".08em", margin: "0 0 10px", fontFamily: FONT }}>Variants (size md)</p>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {["primary","secondary","ghost","danger","warning"].map(v => (
                      <Button key={v} variant={v} size="md">{v}</Button>
                    ))}
                    <Button variant="primary" size="md" disabled>disabled</Button>
                    <Button variant="primary" size="md" loading>loading</Button>
                  </div>
                </div>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: C.neutral[400], textTransform: "uppercase", letterSpacing: ".08em", margin: "0 0 10px", fontFamily: FONT }}>Sizes (primary)</p>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <Button variant="primary" size="sm">Small</Button>
                    <Button variant="primary" size="md">Medium</Button>
                    <Button variant="primary" size="lg">Large</Button>
                  </div>
                </div>
              </div>
            </Section>

            <Section title="Badges">
              <div style={{ background: C.neutral[0], borderRadius: R["2xl"], border: tokens.border.card, padding: "20px 24px", display: "flex", gap: 10, flexWrap: "wrap" }}>
                {Object.keys(STATUS_MAP).map(s => (
                  <div key={s} style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start" }}>
                    <Badge status={s} size="md" />
                    <Badge status={s} size="sm" />
                  </div>
                ))}
              </div>
            </Section>

            <Section title="Sync Indicators">
              <div style={{ background: C.neutral[0], borderRadius: R["2xl"], border: tokens.border.card, padding: "20px 24px", display: "flex", gap: 10 }}>
                {["connecting","live","error"].map(s => <SyncIndicator key={s} status={s} />)}
              </div>
            </Section>

            <Section title="Summary Cards">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
                {[
                  { key: "NEEDS_REVIEW", label: "Needs Review", count: 7,  color: C.semantic.warning.fg, bg: C.semantic.warning.bg },
                  { key: "COMPLETED",    label: "Completed",    count: 41, color: C.semantic.success.fg, bg: C.semantic.success.bg },
                  { key: "FRAUD",        label: "Fraud",        count: 3,  color: C.semantic.error.fg,   bg: C.semantic.error.bg   },
                  { key: "REFUNDED",     label: "Refunded",     count: 9,  color: C.semantic.neutral.fg, bg: C.semantic.neutral.bg },
                ].map(c => (
                  <Card key={c.key} title={c.label} count={c.count}
                    accentColor={c.color} accentBg={c.bg}
                    active={activeCard === c.key}
                    onClick={() => setActiveCard(activeCard === c.key ? null : c.key)}
                  />
                ))}
              </div>
            </Section>

            <Section title="Form Controls">
              <div style={{ background: C.neutral[0], borderRadius: R["2xl"], border: tokens.border.card, padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
                  <Input placeholder="Default input" value="" onChange={() => {}} />
                  <Input placeholder="Error state" value="bad@value" onChange={() => {}} error="Format tidak valid" />
                  <Input placeholder="Disabled" value="" onChange={() => {}} disabled />
                </div>
                <div style={{ display: "flex", gap: 12 }}>
                  <Select value="all" onChange={() => {}} options={[
                    { value: "all", label: "Semua Status" },
                    { value: "NEEDS_REVIEW", label: "⚠ Needs Review" },
                    { value: "COMPLETED", label: "✓ Completed" },
                  ]} />
                  <Checkbox label="Centang ini" checked={cbChecked} onChange={() => setCbChecked(!cbChecked)} />
                </div>
              </div>
            </Section>

            <Section title="Modal">
              <div style={{ background: C.neutral[0], borderRadius: R["2xl"], border: tokens.border.card, padding: "20px 24px" }}>
                <Button variant="primary" onClick={() => setShowModal(true)}>Buka Modal</Button>
                <p style={{ fontSize: 12, color: C.neutral[400], margin: "10px 0 0", fontFamily: FONT }}>Head / Body / Footer pattern. Destructive: danger button kanan. Escape closes (if !loading).</p>
              </div>
            </Section>

            <Section title="Toast">
              <div style={{ background: C.neutral[0], borderRadius: R["2xl"], border: tokens.border.card, padding: "20px 24px", display: "flex", gap: 12, flexWrap: "wrap" }}>
                <Toast msg="Transaksi berhasil disetujui" type="success" />
                <Toast msg="Gagal memuat transaksi realtime" type="error" />
              </div>
            </Section>

            <Section title="Empty State">
              <div style={{ background: C.neutral[0], borderRadius: R["2xl"], border: tokens.border.card }}>
                <EmptyState />
                <div style={{ borderTop: tokens.border.default }} />
                <EmptyState loading />
              </div>
            </Section>

            <Section title="Data Table">
              <TableDemo />
            </Section>
          </>
        )}

        {/* ── TAB: PATTERNS ── */}
        {tab === "Patterns" && (
          <Section title="Page & Component Patterns">
            <div style={{ background: C.neutral[0], borderRadius: R["2xl"], border: tokens.border.card, padding: "4px 0" }}>
              {Object.entries(patterns).map(([k, v]) => (
                <Row key={k} label={k.replace(/([A-Z])/g, " $1").trim()}>{v}</Row>
              ))}
            </div>
          </Section>
        )}

        {/* ── TAB: CONTENT ── */}
        {tab === "Content" && (
          <>
            <Section title="Copy & Microcopy">
              <div style={{ background: C.neutral[0], borderRadius: R["2xl"], border: tokens.border.card, padding: "4px 0" }}>
                <Row label="Tone">{content.tone}</Row>
                <Row label="Date format"><Code>{content.dateFormat}</Code></Row>
                <Row label="Currency"><Code>{content.currency}</Code></Row>
                <Row label="Icon style">{content.iconStyle}</Row>
                {Object.entries(content.buttonLabels).map(([k, v]) => (
                  <Row key={k} label={`button.${k}`}><Code>"{v}"</Code></Row>
                ))}
              </div>
            </Section>

            <Section title="Accessibility">
              <div style={{ background: C.neutral[0], borderRadius: R["2xl"], border: tokens.border.card, padding: "4px 0" }}>
                <Row label="Contrast target">{content.a11y.contrastTarget}</Row>
                <Row label="Focus ring"><Code>{content.a11y.focusRing}</Code></Row>
                <Row label="Modal keyboard">{content.a11y.modalKeyboard}</Row>
                <Row label="ARIA labels"><span style={{ fontSize: 11, fontFamily: tokens.typography.fontFamily.mono, color: C.neutral[700] }}>{content.a11y.ariaLabels}</span></Row>
              </div>
            </Section>
          </>
        )}

      </div>

      {/* Modal overlay */}
      {showModal && <Modal onClose={() => setShowModal(false)} loading={false} />}
    </div>
  );
}