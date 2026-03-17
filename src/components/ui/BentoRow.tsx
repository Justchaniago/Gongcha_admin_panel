"use client";

/**
 * BentoRow — reusable horizontal scrollable stat cards
 * dengan scroll-hint animation + tooltip overlay.
 *
 * Trigger logic:
 *  1. Pertama mount → jalankan setelah 800ms
 *  2. Berikutnya → hanya jalan jika user tidak scroll bento
 *     DAN tidak ada aktivitas layar ≥ 30 detik
 *
 * Usage:
 *   import BentoRow, { BentoCard } from "@/components/ui/BentoRow";
 *
 *   <BentoRow>
 *     <BentoCard label="Total" value={12} color="#3B82F6" bg="#EFF6FF" icon={Users} />
 *     <BentoCard label="Active" value={8}  color="#059669" bg="#ECFDF5" icon={CheckCircle2} />
 *   </BentoRow>
 */

import React, {
  useState, useEffect, useRef, type ElementType,
} from "react";
import { motion, AnimatePresence } from "framer-motion";

// ── TOKENS ────────────────────────────────────────────────────────
const NAVY2  = "#1C2333";
const TX1    = "#111827";
const TX4    = "#9CA3AF";
const BORDER = "#F3F4F6";
const R16    = 16;

// ── EASING: ease-out-back (bouncy overshoot) ──────────────────────
function easeOutBack(t: number): number {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

// ── RAF SCROLL ────────────────────────────────────────────────────
function animateScroll(
  el: HTMLElement,
  to: number,
  duration: number,
  rafSlot: { id: number },
  onDone?: () => void,
) {
  const from = el.scrollLeft;
  const dist = to - from;
  let t0: number | null = null;

  function tick(now: number) {
    if (!t0) t0 = now;
    const p = Math.min((now - t0) / duration, 1);
    el.scrollLeft = from + dist * easeOutBack(p);
    if (p < 1) {
      rafSlot.id = requestAnimationFrame(tick);
    } else {
      onDone?.();
    }
  }
  rafSlot.id = requestAnimationFrame(tick);
}

// ── BENTO CARD ────────────────────────────────────────────────────
export interface BentoCardProps {
  label:    string;
  value:    string | number;
  color:    string;
  bg:       string;
  icon:     ElementType;
  minWidth?: number;
  delay?:   number;
}

export function BentoCard({
  label, value, color, bg, icon: Icon, minWidth = 120, delay = 0,
}: BentoCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.24 }}
      style={{
        minWidth,
        background: "#fff",
        padding: "14px",
        borderRadius: R16,
        border: `1px solid ${BORDER}`,
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
      }}
    >
      <div style={{ width: 28, height: 28, borderRadius: 8, background: bg, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
        <Icon size={13} color={color} strokeWidth={2.5} />
      </div>
      <p style={{ fontSize: 20, fontWeight: 900, color: TX1, letterSpacing: "-.025em", lineHeight: 1 }}>
        {value}
      </p>
      <p style={{ fontSize: 9, fontWeight: 700, color: TX4, textTransform: "uppercase", letterSpacing: ".12em", marginTop: 4 }}>
        {label}
      </p>
    </motion.div>
  );
}

// ── BENTO ROW ─────────────────────────────────────────────────────
export interface BentoRowProps {
  children:   React.ReactNode;
  peekPx?:    number;   // px to peek right — default 80
  initDelay?: number;   // ms before first hint — default 900
  idleSec?:   number;   // idle seconds before repeat — default 30
}

export default function BentoRow({
  children,
  peekPx    = 80,
  initDelay = 900,
  idleSec   = 30,
}: BentoRowProps) {
  const scrollRef    = useRef<HTMLDivElement>(null);
  const raf          = useRef({ id: 0 });
  const animating    = useRef(false);
  const userScrolled = useRef(false);
  const lastActivity = useRef(Date.now());
  const idleTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didFirst     = useRef(false);

  const [hint, setHint] = useState(false);

  // ── All logic in one stable useEffect, no stale closure issues ──
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    // ── activity trackers ──
    const onBentoScroll = () => {
      userScrolled.current = true;
      lastActivity.current = Date.now();
    };
    const onActivity = () => { lastActivity.current = Date.now(); };

    el.addEventListener("scroll",      onBentoScroll, { passive: true });
    window.addEventListener("touchstart", onActivity, { passive: true });
    window.addEventListener("touchmove",  onActivity, { passive: true });
    window.addEventListener("scroll",     onActivity, { passive: true });

    // ── core hint runner ──
    function runHint() {
      const el = scrollRef.current;
      if (!el || animating.current) return;
      // Skip jika semua cards sudah muat di layar (tidak perlu scroll)
      if (el.scrollWidth <= el.clientWidth) return;
      // Skip jika user sudah scroll sendiri
      if (userScrolled.current && el.scrollLeft > 10) {
        scheduleNext();
        return;
      }
      animating.current = true;

      animateScroll(el, peekPx, 680, raf.current, () => {
        if (!scrollRef.current) return;
        animateScroll(scrollRef.current, 0, 540, raf.current, () => {
          animating.current = false;
          setHint(true);
          setTimeout(() => setHint(false), 2800);
          scheduleNext();
        });
      });
    }

    // ── ResizeObserver: re-attempt hint jika layout berubah
    //    (misal cards selesai render setelah data load) ──
    let resizeAttempted = false;
    const ro = typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(() => {
          const e = scrollRef.current;
          if (!e || resizeAttempted) return;
          if (e.scrollWidth > e.clientWidth) {
            resizeAttempted = true;
            // Sedikit delay agar paint selesai
            setTimeout(runHint, 200);
          }
        })
      : null;
    if (ro && el) ro.observe(el);

    // ── schedule next idle check ──
    function scheduleNext() {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(() => {
        const idle = Date.now() - lastActivity.current;
        if (idle >= idleSec * 1000) {
          runHint();
        } else {
          // not idle enough yet, reschedule for remaining time
          idleTimer.current = setTimeout(
            runHint,
            idleSec * 1000 - idle,
          );
        }
      }, idleSec * 1000);
    }

    // ── first run ──
    if (!didFirst.current) {
      didFirst.current = true;
      const t = setTimeout(runHint, initDelay);
      return () => {
        clearTimeout(t);
        teardown();
      };
    }

    return teardown;

    function teardown() {
      cancelAnimationFrame(raf.current.id);
      if (idleTimer.current) clearTimeout(idleTimer.current);
      ro?.disconnect();
      el?.removeEventListener("scroll",      onBentoScroll);
      window.removeEventListener("touchstart", onActivity);
      window.removeEventListener("touchmove",  onActivity);
      window.removeEventListener("scroll",     onActivity);
    }
  // All captured via closure — no deps needed
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      style={{ position: "relative", marginBottom: 14 }}
      onClick={() => hint && setHint(false)}
    >
      {/* Blur entire row when hint is showing */}
      <motion.div
        animate={{
          filter: hint ? "blur(2.5px)" : "blur(0px)",
          scale:  hint ? 0.985 : 1,
        }}
        transition={{ duration: 0.22 }}
        style={{ position: "relative" }}
      >
        <div
          ref={scrollRef}
          style={{ display: "flex", overflowX: "auto", gap: 10, paddingBottom: 4 }}
          className="scrollbar-hide"
        >
          {children}
        </div>
      </motion.div>

      {/* Floating tooltip centered over row */}
      <AnimatePresence>
        {hint && (
          <motion.div
            initial={{ opacity: 0, scale: 0.86, y: 10 }}
            animate={{ opacity: 1, scale: 1,    y: 0   }}
            exit={{    opacity: 0, scale: 0.92,  y: 5   }}
            transition={{ type: "spring", stiffness: 380, damping: 22 }}
            style={{
              position: "absolute",
              inset: 0,
              margin: "auto",
              zIndex: 20,
              width: "fit-content",
              height: "fit-content",
              background: NAVY2,
              color: "#fff",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: ".01em",
              padding: "10px 20px",
              borderRadius: 99,
              display: "flex",
              alignItems: "center",
              gap: 8,
              boxShadow: "0 8px 32px rgba(0,0,0,.30), 0 2px 8px rgba(0,0,0,.18)",
              whiteSpace: "nowrap",
              pointerEvents: "none",
              userSelect: "none",
            }}
          >
            <motion.span
              animate={{ x: [0, 6, 0, 6, 0] }}
              transition={{ delay: 0.4, duration: 1.1, ease: "easeInOut" }}
              style={{ display: "inline-block", fontSize: 15 }}
            >
              👉
            </motion.span>
            Swipe to see more stats
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`.scrollbar-hide::-webkit-scrollbar{display:none}.scrollbar-hide{-ms-overflow-style:none;scrollbar-width:none}`}</style>
    </div>
  );
}