"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useMobileSidebar } from "@/components/layout/AdminShell";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  Menu as MenuIcon, Search, X, RefreshCw,
  ChevronDown, ChevronUp, SlidersHorizontal, Trash2,
  PenLine, ArrowLeft, CheckCheck, Lock,
} from "lucide-react";
import {
  AccessState, LogItem, ACTION_META, getActionMeta,
  extractChangeEntries, formatRelativeTime, formatExactTime,
  fetchLogs, createNote, deleteLog,
} from "./activityLogShared";

// ─── Design system ────────────────────────────────────────────────────────────
const C = {
  // Base
  bg:        "#F7F7F5",
  surface:   "#FFFFFF",
  elevated:  "#FAFAF9",
  // Ink
  ink1:      "#0A0A0A",
  ink2:      "#3D3D3D",
  ink3:      "#737373",
  ink4:      "#A3A3A3",
  // Stroke
  line:      "#E8E8E6",
  line2:     "#F0F0EE",
  // Accent — deep navy
  accent:    "#0F172A",
  accentL:   "#F1F5F9",
  // Semantic
  green:     "#16A34A",
  greenL:    "#F0FDF4",
  greenLine: "#BBF7D0",
  red:       "#DC2626",
  redL:      "#FEF2F2",
  redLine:   "#FECACA",
  amber:     "#CA8A04",
  amberL:    "#FEFCE8",
  amberLine: "#FEF08A",
  blue:      "#2563EB",
  blueL:     "#EFF6FF",
  purple:    "#7C3AED",
  purpleL:   "#F5F3FF",
} as const;

const logFont = "'IBM Plex Sans', 'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

// ─── Shared bottom sheet ──────────────────────────────────────────────────────
function Sheet({ open, onClose, title, children, tall }: {
  open: boolean; onClose: () => void;
  title: string; children: React.ReactNode; tall?: boolean;
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div key="bg"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            style={{ position: "fixed", inset: 0, background: "rgba(10,10,10,0.46)", zIndex: 9000 }}
          />
          <motion.div key="panel"
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 400, damping: 38 }}
            style={{
              position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 9001,
              background: C.surface,
              borderRadius: "18px 18px 0 0",
              maxHeight: tall ? "90dvh" : "78dvh",
              display: "flex", flexDirection: "column",
              boxShadow: "0 -8px 40px rgba(0,0,0,0.12)",
            }}
          >
            {/* Handle */}
            <div style={{ width: 32, height: 3, borderRadius: 99, background: C.line, margin: "12px auto 0", flexShrink: 0 }} />
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px 12px", borderBottom: `1px solid ${C.line2}`, flexShrink: 0 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: C.ink1, letterSpacing: "-.01em" }}>{title}</span>
              <button onClick={onClose}
                style={{ width: 26, height: 26, borderRadius: 8, background: C.bg, border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                <X size={12} color={C.ink3} strokeWidth={2.5} />
              </button>
            </div>
            {/* Body */}
            <div style={{ flex: 1, overflowY: "auto", padding: "14px 20px 36px" }}>
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ─── Filter sheet ─────────────────────────────────────────────────────────────
function FilterSheet({ open, action, setAction, includeDeleted, setIncludeDeleted, canManage, onClose }: {
  open: boolean; action: string; setAction: (v: string) => void;
  includeDeleted: boolean; setIncludeDeleted: (v: boolean) => void;
  canManage: boolean; onClose: () => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title="Filter" tall>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {/* All */}
        <Row
          active={!action}
          label="Semua aktivitas"
          color={C.blue}
          bg={C.blueL}
          icon={<CheckCheck size={14} />}
          onClick={() => { setAction(""); onClose(); }}
        />
        <div style={{ height: 1, background: C.line2, margin: "4px 0" }} />
        {Object.entries(ACTION_META).map(([key, m]) => (
          <Row key={key}
            active={action === key}
            label={m.label}
            color={m.color}
            bg={m.bg}
            icon={<span style={{ fontSize: 14, lineHeight: 1 }}>{m.emoji}</span>}
            onClick={() => { setAction(action === key ? "" : key); onClose(); }}
          />
        ))}
        {canManage && (
          <>
            <div style={{ height: 1, background: C.line2, margin: "4px 0" }} />
            <button
              onClick={() => setIncludeDeleted(!includeDeleted)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "12px 14px", borderRadius: 10,
                background: includeDeleted ? C.redL : C.elevated,
                border: `1px solid ${includeDeleted ? C.redLine : C.line}`,
                cursor: "pointer",
              }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: includeDeleted ? C.red : C.ink2 }}>Tampilkan yang dihapus</span>
              <div style={{
                width: 40, height: 22, borderRadius: 99, position: "relative", flexShrink: 0,
                background: includeDeleted ? C.red : C.line,
                transition: "background .18s",
              }}>
                <motion.div
                  animate={{ left: includeDeleted ? 20 : 2 }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  style={{
                    position: "absolute", top: 2, width: 18, height: 18,
                    borderRadius: "50%", background: "#fff",
                    boxShadow: "0 1px 4px rgba(0,0,0,.18)",
                  }}
                />
              </div>
            </button>
          </>
        )}
      </div>
    </Sheet>
  );
}

function Row({ active, label, color, bg, icon, onClick }: {
  active: boolean; label: string; color: string; bg: string;
  icon: React.ReactNode; onClick: () => void;
}) {
  return (
    <button onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 10, padding: "11px 14px",
        borderRadius: 10, border: `1px solid ${active ? color : C.line2}`,
        background: active ? bg : C.elevated,
        cursor: "pointer", textAlign: "left", transition: "all .12s",
      }}>
      <div style={{
        width: 28, height: 28, borderRadius: 7, flexShrink: 0,
        background: active ? color : C.line2,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: active ? "#fff" : C.ink3,
      }}>
        {icon}
      </div>
      <span style={{ fontSize: 13, fontWeight: active ? 700 : 500, color: active ? color : C.ink2, flex: 1 }}>{label}</span>
      {active && (
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />
      )}
    </button>
  );
}

// ─── Note sheet ───────────────────────────────────────────────────────────────
function NoteSheet({ open, onClose, onSaved, showToast }: {
  open: boolean; onClose: () => void; onSaved: () => void; showToast: (m: string, ok?: boolean) => void;
}) {
  const [summary, setSummary] = useState("");
  const [body, setBody]       = useState("");
  const [saving, setSaving]   = useState(false);

  useEffect(() => { if (!open) { setSummary(""); setBody(""); } }, [open]);

  async function submit() {
    if (!summary.trim()) return;
    setSaving(true);
    try {
      await createNote(summary.trim(), body.trim());
      showToast("Catatan tersimpan");
      onSaved(); onClose();
    } catch (e) { showToast(e instanceof Error ? e.message : "Gagal", false); }
    finally { setSaving(false); }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Catatan Manual" tall>
      <div style={{ display: "grid", gap: 12 }}>
        <Field label="Ringkasan *">
          <input value={summary} onChange={(e) => setSummary(e.target.value)}
            placeholder="Deskripsikan kejadian…" maxLength={180}
            style={{ width: "100%", borderRadius: 10, border: `1px solid ${C.line}`, padding: "11px 13px", fontSize: 13, outline: "none", background: C.elevated, color: C.ink1, boxSizing: "border-box", fontFamily: "inherit" }} />
        </Field>
        <Field label="Detail">
          <textarea value={body} onChange={(e) => setBody(e.target.value)}
            rows={4} placeholder="Konteks tambahan…"
            style={{ width: "100%", borderRadius: 10, border: `1px solid ${C.line}`, padding: "11px 13px", fontSize: 13, outline: "none", background: C.elevated, color: C.ink1, resize: "none", boxSizing: "border-box", fontFamily: "inherit" }} />
        </Field>
        <button onClick={submit} disabled={saving || !summary.trim()}
          style={{
            padding: "14px", borderRadius: 12, border: "none",
            background: summary.trim() ? C.accent : C.line,
            color: summary.trim() ? "#fff" : C.ink4,
            fontSize: 14, fontWeight: 700, cursor: summary.trim() && !saving ? "pointer" : "default",
            letterSpacing: "-.01em", opacity: saving ? .7 : 1, fontFamily: "inherit",
          }}>
          {saving ? "Menyimpan…" : "Simpan Catatan"}
        </button>
      </div>
    </Sheet>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p style={{ margin: "0 0 5px", fontSize: 11, fontWeight: 600, color: C.ink3, letterSpacing: ".04em", textTransform: "uppercase" }}>{label}</p>
      {children}
    </div>
  );
}

// ─── Delete confirm sheet ─────────────────────────────────────────────────────
function DeleteSheet({ log, onConfirm, onClose }: {
  log: LogItem | null; onConfirm: (r: string) => void; onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  useEffect(() => { if (!log) setReason(""); }, [log]);

  return (
    <Sheet open={!!log} onClose={onClose} title="Delete Log">
      {log && (
        <div style={{ display: "grid", gap: 14 }}>
          <div style={{ padding: "12px 14px", borderRadius: 10, background: C.redL, border: `1px solid ${C.redLine}` }}>
            <p style={{ margin: 0, fontSize: 12, color: C.red, fontWeight: 600, lineHeight: 1.5 }}>
              "{log.summary}" akan dihapus permanen dari database dan tidak bisa dikembalikan.
            </p>
          </div>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)}
            autoFocus rows={3} placeholder="Alasan (wajib)…"
            style={{ width: "100%", borderRadius: 10, border: `1px solid ${C.line}`, padding: "11px 13px", fontSize: 13, outline: "none", background: C.elevated, resize: "none", boxSizing: "border-box", fontFamily: "inherit", color: C.ink1 }} />
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={onClose}
              style={{ flex: 1, padding: 13, borderRadius: 10, border: `1px solid ${C.line}`, background: "transparent", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", color: C.ink2 }}>
              Batal
            </button>
            <button onClick={() => reason.trim() && onConfirm(reason.trim())} disabled={!reason.trim()}
              style={{
                flex: 2, padding: 13, borderRadius: 10, border: "none",
                background: reason.trim() ? C.red : C.line,
                color: reason.trim() ? "#fff" : C.ink4,
                fontSize: 13, fontWeight: 700, cursor: reason.trim() ? "pointer" : "default", fontFamily: "inherit",
              }}>
              Hapus Log
            </button>
          </div>
        </div>
      )}
    </Sheet>
  );
}

// ─── Log entry card ───────────────────────────────────────────────────────────
function LogCard({ log, canManage, onDelete }: {
  log: LogItem; canManage: boolean; onDelete: (l: LogItem) => void;
}) {
  const [open, setOpen] = useState(false);
  const meta    = getActionMeta(log.action);
  const changes = useMemo(() => extractChangeEntries(log), [log]);
  const previewChanges = changes.slice(0, 2);

  return (
    <div style={{
      borderRadius: 14,
      border: `1px solid ${C.line}`,
      background: C.surface,
      overflow: "hidden",
      transition: "box-shadow .15s",
      boxShadow: open ? "0 12px 24px rgba(15,23,42,.05)" : "0 1px 2px rgba(15,23,42,.03)",
      fontFamily: logFont,
    }}>
      {/* ── Summary row ── */}
      <button onClick={() => setOpen((v) => !v)}
        style={{ width: "100%", display: "flex", alignItems: "stretch", gap: 12, padding: "14px 16px", background: "transparent", border: "none", cursor: "pointer", textAlign: "left" }}>

        <div style={{ width: 76, flexShrink: 0, display: "grid", gridTemplateColumns: "12px 1fr", gap: 9 }}>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <div style={{ display: "grid", gridTemplateRows: "11px 1fr", justifyItems: "center", height: "100%" }}>
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: meta.color, marginTop: 3 }} />
              <span style={{ width: 1, height: "100%", background: C.line }} />
            </div>
          </div>
          <div style={{ display: "grid", gap: 7, alignContent: "start" }}>
            <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: C.ink4, letterSpacing: ".12em", textTransform: "uppercase" }}>
              {formatRelativeTime(log.createdAt)}
            </p>
            <p style={{ margin: 0, fontSize: 11, lineHeight: 1.45, color: C.ink3 }}>
              {log.actorName}
            </p>
          </div>
        </div>

        {/* Center */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 5, flexWrap: "wrap" }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.ink1, letterSpacing: "-.02em" }}>
              {log.targetLabel || log.targetId}
            </p>
            <span style={{ fontSize: 10, fontWeight: 800, color: meta.color, letterSpacing: ".08em", textTransform: "uppercase" }}>{meta.label}</span>
          </div>
          <p style={{ margin: 0, fontSize: 12.5, color: C.ink2, lineHeight: 1.5 }}>
            {log.summary}
          </p>
          {previewChanges.length > 0 && (
            <div style={{ display: "grid", gap: 6, marginTop: 10 }}>
              {previewChanges.map((entry) => (
                <div key={`${log.id}-${entry.label}-preview`} style={{ display: "grid", gridTemplateColumns: "78px minmax(0, 1fr)", gap: 8 }}>
                  <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: C.ink4, letterSpacing: ".12em", textTransform: "uppercase" }}>
                    {entry.label}
                  </p>
                  <p style={{ margin: 0, fontSize: 11.5, color: C.ink2, lineHeight: 1.45, wordBreak: "break-word" }}>
                    <span style={{ color: C.ink4 }}>{entry.before}</span>
                    {"  →  "}
                    <span style={{ color: C.ink1, fontWeight: 700 }}>{entry.after}</span>
                  </p>
                </div>
              ))}
              {changes.length > previewChanges.length ? (
                <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: C.ink3 }}>
                  +{changes.length - previewChanges.length} perubahan lain
                </p>
              ) : null}
            </div>
          )}
        </div>

        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.18 }}>
          <ChevronDown size={14} color={C.ink4} strokeWidth={2} />
        </motion.div>
      </button>

      {/* ── Expanded detail ── */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 34 }}
            style={{ overflow: "hidden" }}
          >
            <div style={{ borderTop: `1px solid ${C.line2}`, padding: "14px 16px 16px" }}>

              {/* Meta grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                {([
                  { k: "Oleh",   v: log.actorEmail || log.actorUid },
                  { k: "Waktu",  v: formatExactTime(log.createdAt) },
                  { k: "Target", v: `${log.targetType} · ${log.targetLabel || log.targetId}` },
                  { k: "Source", v: log.source },
                ] as const).map(({ k, v }) => (
                  <div key={k}>
                    <p style={{ margin: 0, fontSize: 9, fontWeight: 700, color: C.ink4, textTransform: "uppercase", letterSpacing: ".1em" }}>{k}</p>
                    <p style={{ margin: "4px 0 0", fontSize: 11, color: C.ink2, lineHeight: 1.4, wordBreak: "break-all" }}>{v}</p>
                  </div>
                ))}
              </div>

              {/* Diff */}
              {changes.length > 0 && (
                <div style={{ borderRadius: 12, background: "#FCFCFC", border: `1px solid ${C.line2}`, padding: "10px 12px", marginBottom: 12 }}>
                  <p style={{ margin: "0 0 10px", fontSize: 9, fontWeight: 700, color: C.ink4, textTransform: "uppercase", letterSpacing: ".14em" }}>Perubahan</p>
                  <div style={{ display: "grid", gap: 8 }}>
                    {changes.map((e) => (
                      <div key={e.label} style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: C.ink3, flexShrink: 0, minWidth: 64 }}>{e.label}</span>
                        <span style={{ fontSize: 11, color: C.ink4 }}>{e.before}</span>
                        <span style={{ fontSize: 10, color: C.ink4 }}>→</span>
                        <span style={{ fontSize: 11, color: C.ink1, fontWeight: 700 }}>{e.after}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Raw metadata */}
              <details style={{ marginBottom: canManage && !log.isDeleted ? 12 : 0 }}>
                <summary style={{ fontSize: 11, fontWeight: 600, color: C.ink4, cursor: "pointer", userSelect: "none" }}>
                  Raw metadata
                </summary>
                <pre style={{
                  margin: "8px 0 0", padding: "10px 12px", borderRadius: 10,
                  background: C.accent, color: "#94A3B8", fontSize: 10,
                  lineHeight: 1.6, overflowX: "auto", whiteSpace: "pre-wrap", wordBreak: "break-all",
                }}>
                  {JSON.stringify(log.metadata ?? {}, null, 2)}
                </pre>
              </details>

              {/* Delete action */}
              {canManage && !log.isDeleted && (
                <button onClick={() => onDelete(log)}
                  style={{
                    display: "flex", alignItems: "center", gap: 6, padding: "9px 13px",
                    borderRadius: 8, border: `1px solid ${C.redLine}`, background: C.redL,
                    color: C.red, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                  }}>
                  <Trash2 size={12} strokeWidth={2.5} /> Delete
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ msg, ok }: { msg: string; ok: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: .95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 6, scale: .97 }}
      style={{
        position: "fixed", bottom: 88, left: "50%", transform: "translateX(-50%)",
        zIndex: 9999, display: "flex", alignItems: "center", gap: 8,
        padding: "11px 18px", borderRadius: 12,
        background: ok ? C.accent : C.red, color: "#fff",
        fontSize: 13, fontWeight: 600, whiteSpace: "nowrap",
        boxShadow: "0 8px 28px rgba(0,0,0,.22)",
        fontFamily: "inherit",
      }}>
      <span>{ok ? "✓" : "✕"}</span> {msg}
    </motion.div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function ActivityLogMobile({
  access: initialAccess,
  onLock,
}: {
  access: AccessState;
  onLock: () => void;
}) {
  const router     = useRouter();
  const { openDrawer } = useMobileSidebar();

  const [access]                               = useState<AccessState>(initialAccess);
  const [logs, setLogs]                       = useState<LogItem[]>([]);
  const [cursor, setCursor]                   = useState<string | null>(null);
  const [loading, setLoading]                 = useState(true);
  const [loadingMore, setLoadingMore]         = useState(false);
  const [action, setAction]                   = useState("");
  const [search, setSearch]                   = useState("");
  const [searchOpen, setSearchOpen]           = useState(false);
  const [includeDeleted, setIncludeDeleted]   = useState(false);
  const [filterOpen, setFilterOpen]           = useState(false);
  const [noteOpen, setNoteOpen]               = useState(false);
  const [deleteTarget, setDeleteTarget]       = useState<LogItem | null>(null);
  const [toast, setToast]                     = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = useCallback((msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 2800);
  }, []);

  const loadLogs = useCallback(async (opts: { access: AccessState; cursor?: string | null; append?: boolean }) => {
    if (!opts.access.canRead) { setLoading(false); return; }
    opts.append ? setLoadingMore(true) : setLoading(true);
    try {
      const { logs: next, nextCursor } = await fetchLogs({
        action, search, includeDeleted, canManage: opts.access.canManage, cursor: opts.cursor,
      });
      setLogs((prev) => opts.append ? [...prev, ...next] : next);
      setCursor(nextCursor);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Gagal memuat", false);
    } finally { setLoading(false); setLoadingMore(false); }
  }, [action, search, includeDeleted, showToast]);

  useEffect(() => {
    loadLogs({ access: initialAccess });
  }, []);

  useEffect(() => {
    if (!access?.canRead) return;
    const t = setTimeout(() => { setCursor(null); loadLogs({ access, cursor: null }); }, 280);
    return () => clearTimeout(t);
  }, [access, action, search, includeDeleted]);

  const handleDelete = async (reason: string) => {
    if (!deleteTarget) return;
    try {
      await deleteLog(deleteTarget.id, reason);
      showToast("Log dihapus");
      setDeleteTarget(null);
      if (access) await loadLogs({ access, cursor: null });
    } catch (e) { showToast(e instanceof Error ? e.message : "Gagal", false); }
  };

  const activeFilters = (action ? 1 : 0) + (includeDeleted ? 1 : 0);
  const failedCount   = logs.filter((l) => l.status === "failed").length;
  const deletedCount  = logs.filter((l) => l.isDeleted).length;

  // ── Access denied ──
  if (!loading && access && !access.canRead) {
    return (
      <div style={{ height: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: C.bg, gap: 10, fontFamily: "system-ui, sans-serif" }}>
        <span style={{ fontSize: 36 }}>🔒</span>
        <p style={{ fontSize: 15, fontWeight: 700, color: C.ink1, margin: 0 }}>Akses Dibatasi</p>
        <p style={{ fontSize: 13, color: C.ink4, margin: 0 }}>Tidak ada izin untuk halaman ini.</p>
        <button onClick={() => router.push("/settings")}
          style={{ marginTop: 12, padding: "10px 20px", borderRadius: 10, border: `1px solid ${C.line}`, background: C.surface, fontSize: 13, fontWeight: 600, color: C.ink2, cursor: "pointer" }}>
          Kembali ke Settings
        </button>
      </div>
    );
  }

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100dvh",
      background: C.bg, overflowX: "hidden",
      fontFamily: "'SF Pro Text', -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
      WebkitFontSmoothing: "antialiased",
    }}>

      {/* ── Top bar ── */}
      <div style={{
        flexShrink: 0, background: C.surface, borderBottom: `1px solid ${C.line2}`,
        padding: `calc(env(safe-area-inset-top, 0px) + 14px) 16px 12px`,
        display: "flex", alignItems: "center", gap: 10,
      }}>
        {/* Hamburger */}
        <button onClick={openDrawer}
          style={{ width: 34, height: 34, borderRadius: 9, border: `1px solid ${C.line}`, background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
          <MenuIcon size={16} color={C.ink2} strokeWidth={2} />
        </button>

        {/* Title */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: C.ink1, letterSpacing: "-.02em" }}>Activity Log</p>
          <p style={{ margin: 0, fontSize: 10, color: C.ink4, marginTop: 1 }}>
            {loading ? "Memuat…" : `${logs.length} entri`}
          </p>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 7, flexShrink: 0 }}>
          <IconBtn active={false} onClick={onLock}>
            <Lock size={15} strokeWidth={2} />
          </IconBtn>
          <IconBtn active={searchOpen} onClick={() => setSearchOpen((v) => !v)}>
            {searchOpen ? <X size={15} strokeWidth={2.5} /> : <Search size={15} strokeWidth={2} />}
          </IconBtn>
          <IconBtn active={activeFilters > 0} onClick={() => setFilterOpen(true)} badge={activeFilters}>
            <SlidersHorizontal size={15} strokeWidth={2} />
          </IconBtn>
          <IconBtn active={false} onClick={() => access && loadLogs({ access, cursor: null })} disabled={loading}>
            <motion.div animate={{ rotate: loading ? 360 : 0 }} transition={{ duration: .7, repeat: loading ? Infinity : 0, ease: "linear" }}>
              <RefreshCw size={15} strokeWidth={2} />
            </motion.div>
          </IconBtn>
        </div>
      </div>

      {/* ── Back to settings bar ── */}
      <button onClick={() => router.push("/settings")}
        style={{
          flexShrink: 0, display: "flex", alignItems: "center", gap: 8,
          padding: "9px 16px", background: C.accentL,
          borderBottom: `1px solid ${C.line2}`, cursor: "pointer", border: "none",
          width: "100%", textAlign: "left",
        }}>
        <ArrowLeft size={13} color={C.blue} strokeWidth={2.5} />
        <span style={{ fontSize: 12, fontWeight: 600, color: C.blue }}>Kembali ke Settings</span>
      </button>

      {/* ── Search bar ── */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div key="search"
            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={{ flexShrink: 0, background: C.surface, borderBottom: `1px solid ${C.line2}`, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 16px" }}>
              <Search size={13} color={C.ink4} style={{ flexShrink: 0 }} />
              <input autoFocus value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari nama, target, ringkasan…"
                style={{ flex: 1, border: "none", background: "transparent", outline: "none", fontSize: 13, color: C.ink1, fontFamily: "inherit" }} />
              {search && (
                <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}>
                  <X size={13} color={C.ink4} />
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Active filter chip ── */}
      {(action || includeDeleted) && (
        <div style={{ flexShrink: 0, display: "flex", gap: 7, padding: "8px 16px", background: C.surface, borderBottom: `1px solid ${C.line2}` }}>
          {action && (() => {
            const m = getActionMeta(action);
            return (
              <Chip label={m.label} color={m.color} bg={m.bg} onRemove={() => setAction("")} />
            );
          })()}
          {includeDeleted && (
            <Chip label="Tampilkan dihapus" color={C.red} bg={C.redL} onRemove={() => setIncludeDeleted(false)} />
          )}
        </div>
      )}

      {/* ── Stat row ── */}
      <div style={{ flexShrink: 0, display: "flex", gap: 0, borderBottom: `1px solid ${C.line2}`, background: C.surface }}>
        {[
          { label: "Total",   value: logs.length,  color: C.ink1  },
          { label: "Gagal",   value: failedCount,  color: C.red   },
          { label: "Dihapus", value: deletedCount, color: C.amber },
        ].map(({ label, value, color }, i) => (
          <div key={label} style={{
            flex: 1, padding: "10px 0", textAlign: "center",
            borderLeft: i > 0 ? `1px solid ${C.line2}` : "none",
          }}>
            <p style={{ margin: 0, fontSize: 17, fontWeight: 800, color, lineHeight: 1, letterSpacing: "-.02em" }}>{value}</p>
            <p style={{ margin: "3px 0 0", fontSize: 9, fontWeight: 600, color: C.ink4, textTransform: "uppercase", letterSpacing: ".08em" }}>{label}</p>
          </div>
        ))}
      </div>

      {/* ── Log list ── */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        <div style={{ padding: "12px 14px 96px", display: "flex", flexDirection: "column", gap: 8 }}>
          {loading ? (
            <div style={{ padding: "56px 0", textAlign: "center" }}>
              <p style={{ fontSize: 13, color: C.ink4, margin: 0 }}>Memuat log…</p>
            </div>
          ) : logs.length === 0 ? (
            <div style={{ padding: "56px 0", textAlign: "center" }}>
              <p style={{ fontSize: 28, margin: "0 0 8px" }}>📋</p>
              <p style={{ fontSize: 13, color: C.ink4, margin: 0 }}>Tidak ada log untuk filter ini.</p>
            </div>
          ) : logs.map((log) => (
            <LogCard key={log.id} log={log} canManage={access?.canManage ?? false} onDelete={setDeleteTarget} />
          ))}

          {cursor && !loading && (
            <button onClick={() => access && loadLogs({ access, cursor, append: true })} disabled={loadingMore}
              style={{
                padding: "13px", borderRadius: 12, border: `1px solid ${C.line}`,
                background: C.surface, fontSize: 13, fontWeight: 600, color: C.ink2,
                cursor: loadingMore ? "default" : "pointer", opacity: loadingMore ? .6 : 1, fontFamily: "inherit",
              }}>
              {loadingMore ? "Memuat…" : "Muat 20 Berikutnya"}
            </button>
          )}
          {!cursor && logs.length > 0 && (
            <p style={{ textAlign: "center", fontSize: 11, color: C.ink4, margin: "4px 0 0" }}>
              — Semua log ditampilkan —
            </p>
          )}
        </div>
      </div>

      {/* ── FAB: catatan manual ── */}
      {access?.canManage && (
        <motion.button
          whileTap={{ scale: .93 }}
          onClick={() => setNoteOpen(true)}
          style={{
            position: "fixed", bottom: 24, right: 18, zIndex: 500,
            width: 48, height: 48, borderRadius: 14,
            background: C.accent, border: "none", color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", boxShadow: "0 6px 20px rgba(0,0,0,.28)",
          }}>
          <PenLine size={18} strokeWidth={2} />
        </motion.button>
      )}

      {/* ── Sheets ── */}
      <FilterSheet
        open={filterOpen} onClose={() => setFilterOpen(false)}
        action={action} setAction={setAction}
        includeDeleted={includeDeleted} setIncludeDeleted={setIncludeDeleted}
        canManage={access?.canManage ?? false}
      />
      <NoteSheet
        open={noteOpen} onClose={() => setNoteOpen(false)}
        onSaved={() => access && loadLogs({ access, cursor: null })}
        showToast={showToast}
      />
      <DeleteSheet log={deleteTarget} onConfirm={handleDelete} onClose={() => setDeleteTarget(null)} />

      {/* ── Toast ── */}
      <AnimatePresence>
        {toast && <Toast key="toast" msg={toast.msg} ok={toast.ok} />}
      </AnimatePresence>
    </div>
  );
}

// ─── Small helpers ────────────────────────────────────────────────────────────
function IconBtn({ children, active, onClick, badge, disabled }: {
  children: React.ReactNode; active: boolean;
  onClick: () => void; badge?: number; disabled?: boolean;
}) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{
        width: 34, height: 34, borderRadius: 9, flexShrink: 0,
        border: `1px solid ${active ? C.accent : C.line}`,
        background: active ? C.accent : "transparent",
        color: active ? "#fff" : C.ink3,
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: disabled ? "default" : "pointer", position: "relative",
        opacity: disabled ? .45 : 1,
      }}>
      {children}
      {!!badge && (
        <span style={{
          position: "absolute", top: -5, right: -5, width: 15, height: 15,
          borderRadius: "50%", background: C.red, color: "#fff",
          fontSize: 8, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center",
        }}>{badge}</span>
      )}
    </button>
  );
}

function Chip({ label, color, bg, onRemove }: { label: string; color: string; bg: string; onRemove: () => void }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 99, background: bg, border: `1px solid ${color}20` }}>
      <span style={{ fontSize: 11, fontWeight: 700, color }}>{label}</span>
      <button onClick={onRemove} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center" }}>
        <X size={10} color={color} strokeWidth={3} />
      </button>
    </div>
  );
}
