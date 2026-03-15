"use client";

import React, { useEffect, useState } from "react";
import { C, font } from "@/lib/design-tokens";

type ButtonVariant = "primary" | "blue" | "ghost" | "danger" | "warning" | "secondary";
type ButtonSize = "sm" | "md" | "lg";

const buttonVariants: Record<ButtonVariant, { bg: string; color: string; border: string; hoverBg: string; shadow?: string }> = {
  primary: {
    bg: "#059669",
    color: "#fff",
    border: "none",
    hoverBg: "#047857",
    shadow: "0 10px 24px rgba(5,150,105,.18)",
  },
  blue: {
    bg: "#3B82F6",
    color: "#fff",
    border: "none",
    hoverBg: "#2563EB",
    shadow: "0 10px 24px rgba(59,130,246,.22)",
  },
  ghost: {
    bg: "#FFFFFF",
    color: C.tx2,
    border: `1.5px solid ${C.border}`,
    hoverBg: "#F8FAFC",
  },
  secondary: {
    bg: "#F3F4F6",
    color: C.tx2,
    border: `1px solid ${C.border}`,
    hoverBg: "#E5E7EB",
  },
  danger: {
    bg: "#C8102E",
    color: "#fff",
    border: "none",
    hoverBg: "#9F1239",
    shadow: "0 10px 24px rgba(200,16,46,.18)",
  },
  warning: {
    bg: "#FEF3C7",
    color: "#B45309",
    border: "1px solid #FCD34D",
    hoverBg: "#FDE68A",
  },
};

const buttonSizes: Record<ButtonSize, { height: number; padding: string; fontSize: number; borderRadius: number }> = {
  sm: { height: 32, padding: "0 12px", fontSize: 12, borderRadius: 9 },
  md: { height: 38, padding: "0 16px", fontSize: 13, borderRadius: 10 },
  lg: { height: 42, padding: "0 22px", fontSize: 13.5, borderRadius: 11 },
};

export function GcPage({
  children,
  maxWidth = 1400,
  style,
}: {
  children: React.ReactNode;
  maxWidth?: number;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        padding: "clamp(16px, 3vw, 28px) clamp(16px, 3.2vw, 32px) 48px",
        maxWidth,
        minHeight: "100vh",
        fontFamily: font,
        WebkitFontSmoothing: "antialiased",
        position: "relative",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function GcPageHeader({
  eyebrow = "Gong Cha Admin",
  title,
  description,
  meta,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: React.ReactNode;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
      <div style={{ maxWidth: 720 }}>
        <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".12em", textTransform: "uppercase", color: C.tx3, marginBottom: 6 }}>
          {eyebrow}
        </p>
        <h1 style={{ fontSize: "clamp(24px, 4vw, 28px)", fontWeight: 800, letterSpacing: "-.03em", lineHeight: 1.05, color: C.tx1, margin: 0 }}>
          {title}
        </h1>
        {description && (
          <p style={{ fontSize: 13.5, color: C.tx2, lineHeight: 1.6, marginTop: 8, marginBottom: 0 }}>
            {description}
          </p>
        )}
        {meta && (
          <div style={{ marginTop: 8 }}>
            {meta}
          </div>
        )}
      </div>
      {actions && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {actions}
        </div>
      )}
    </div>
  );
}

export function GcPanel({
  children,
  style,
  className,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}) {
  return (
    <div
      className={className}
      style={{
        background: "#FFFFFF",
        borderRadius: 18,
        border: `1px solid ${C.border}`,
        boxShadow: "0 1px 3px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.04)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function GcButton({
  variant = "primary",
  size = "md",
  children,
  loading = false,
  disabled = false,
  style,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const variantCfg = buttonVariants[variant];
  const sizeCfg = buttonSizes[size];
  const isDisabled = disabled || loading;

  return (
    <button
      {...props}
      disabled={isDisabled}
      onMouseEnter={(e) => {
        setHovered(true);
        props.onMouseEnter?.(e);
      }}
      onMouseLeave={(e) => {
        setHovered(false);
        props.onMouseLeave?.(e);
      }}
      style={{
        height: sizeCfg.height,
        padding: sizeCfg.padding,
        borderRadius: sizeCfg.borderRadius,
        border: variantCfg.border,
        background: isDisabled ? "#D1D5DB" : hovered ? variantCfg.hoverBg : variantCfg.bg,
        color: isDisabled ? "#fff" : variantCfg.color,
        fontFamily: font,
        fontSize: sizeCfg.fontSize,
        fontWeight: 700,
        cursor: isDisabled ? "not-allowed" : "pointer",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        transition: "all .16s ease",
        boxShadow: !isDisabled && hovered && variantCfg.shadow ? variantCfg.shadow : "none",
        transform: !isDisabled && hovered ? "translateY(-1px)" : "none",
        ...style,
      }}
    >
      {loading ? "Memproses…" : children}
    </button>
  );
}

export function GcFieldLabel({
  children,
  required,
}: {
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label style={{ display: "block", marginBottom: 6, fontSize: 11, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: C.tx3 }}>
      {children}
      {required && <span style={{ color: "#C8102E", marginLeft: 4 }}>*</span>}
    </label>
  );
}

function useFieldFocus() {
  const [focused, setFocused] = useState(false);
  return {
    focused,
    bind: {
      onFocus: () => setFocused(true),
      onBlur: () => setFocused(false),
    },
  };
}

export function GcInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { focused, bind } = useFieldFocus();
  return (
    <input
      {...props}
      {...bind}
      style={{
        width: "100%",
        height: 42,
        borderRadius: 10,
        outline: "none",
        border: `1.5px solid ${focused ? "#3B82F6" : C.border}`,
        background: focused ? "#FFFFFF" : "#F8FAFC",
        boxShadow: focused ? "0 0 0 3px rgba(59,130,246,.10)" : "none",
        padding: "0 14px",
        fontFamily: font,
        fontSize: 13.5,
        color: C.tx1,
        transition: "all .16s ease",
        boxSizing: "border-box",
        ...(props.style || {}),
      }}
    />
  );
}

export function GcSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const { focused, bind } = useFieldFocus();
  return (
    <select
      {...props}
      {...bind}
      style={{
        width: "100%",
        height: 42,
        borderRadius: 10,
        outline: "none",
        border: `1.5px solid ${focused ? "#3B82F6" : C.border}`,
        background: focused ? "#FFFFFF" : "#F8FAFC",
        boxShadow: focused ? "0 0 0 3px rgba(59,130,246,.10)" : "none",
        padding: "0 14px",
        fontFamily: font,
        fontSize: 13.5,
        color: C.tx1,
        transition: "all .16s ease",
        boxSizing: "border-box",
        cursor: "pointer",
        ...(props.style || {}),
      }}
    />
  );
}

export function GcTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { focused, bind } = useFieldFocus();
  return (
    <textarea
      {...props}
      {...bind}
      style={{
        width: "100%",
        minHeight: 108,
        borderRadius: 12,
        outline: "none",
        resize: "vertical",
        border: `1.5px solid ${focused ? "#3B82F6" : C.border}`,
        background: focused ? "#FFFFFF" : "#F8FAFC",
        boxShadow: focused ? "0 0 0 3px rgba(59,130,246,.10)" : "none",
        padding: "12px 14px",
        fontFamily: font,
        fontSize: 13.5,
        lineHeight: 1.55,
        color: C.tx1,
        transition: "all .16s ease",
        boxSizing: "border-box",
        ...(props.style || {}),
      }}
    />
  );
}

export function GcEmptyState({
  title,
  description,
  icon = "📭",
  style,
}: {
  title: string;
  description: string;
  icon?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div style={{ padding: "56px 24px", textAlign: "center", ...style }}>
      <p style={{ fontSize: 28, marginBottom: 10 }}>{icon}</p>
      <p style={{ fontSize: 15, fontWeight: 700, color: C.tx1, marginBottom: 6 }}>{title}</p>
      <p style={{ fontSize: 13, color: C.tx3, margin: 0 }}>{description}</p>
    </div>
  );
}

export function GcToast({
  msg,
  type,
}: {
  msg: string;
  type: "success" | "error";
}) {
  const bg = type === "success" ? "#ECFDF3" : "#FEF3F2";
  const fg = type === "success" ? "#027A48" : "#B42318";
  const border = type === "success" ? "#A7F3D0" : "#FECACA";
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "12px 18px",
        borderRadius: 16,
        background: bg,
        color: fg,
        border: `1px solid ${border}`,
        fontFamily: font,
        fontSize: 13,
        fontWeight: 700,
        boxShadow: "0 8px 28px rgba(15,17,23,.10)",
      }}
    >
      <span>{type === "success" ? "✓" : "✕"}</span>
      <span>{msg}</span>
    </div>
  );
}

export function GcModalShell({
  onClose,
  title,
  eyebrow,
  description,
  icon,
  maxWidth = 520,
  footer,
  children,
  closeOnEscape = true,
}: {
  onClose: () => void;
  title: string;
  eyebrow?: string;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  maxWidth?: number;
  footer?: React.ReactNode;
  children: React.ReactNode;
  closeOnEscape?: boolean;
}) {
  useEffect(() => {
    if (!closeOnEscape) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [closeOnEscape, onClose]);

  return (
    <div
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 400,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        background: "rgba(10,12,20,.52)",
        backdropFilter: "blur(10px)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth,
          maxHeight: "92vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          background: "#FFFFFF",
          borderRadius: 18,
          border: "1px solid rgba(255,255,255,.72)",
          boxShadow: "0 20px 60px rgba(0,0,0,.18), 0 4px 16px rgba(0,0,0,.10)",
          fontFamily: font,
        }}
      >
        <div style={{ padding: "clamp(18px, 3vw, 24px) clamp(18px, 3.2vw, 28px) 18px", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
              {icon ? (
                <div style={{ width: 48, height: 48, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", background: "#FFF7ED", color: "#C2410C", flexShrink: 0 }}>
                  {icon}
                </div>
              ) : null}
              <div>
                {eyebrow ? (
                  <p style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: ".14em", textTransform: "uppercase", color: "#3B82F6", marginBottom: 4 }}>
                    {eyebrow}
                  </p>
                ) : null}
                <h2 style={{ fontSize: "clamp(19px, 3vw, 22px)", fontWeight: 800, letterSpacing: "-.025em", lineHeight: 1.1, color: C.tx1, margin: 0 }}>
                  {title}
                </h2>
                {description ? (
                  <div style={{ fontSize: 13, color: C.tx2, lineHeight: 1.55, marginTop: 8 }}>
                    {description}
                  </div>
                ) : null}
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                width: 36,
                height: 36,
                borderRadius: 11,
                border: `1.5px solid ${C.border}`,
                background: "#FFFFFF",
                color: C.tx3,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>
        <div style={{ padding: "clamp(18px, 3vw, 22px) clamp(18px, 3.2vw, 28px)", overflowY: "auto", flex: 1 }}>
          {children}
        </div>
        {footer ? (
          <div style={{ padding: "16px clamp(18px, 3.2vw, 28px) clamp(18px, 3vw, 24px)", borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
