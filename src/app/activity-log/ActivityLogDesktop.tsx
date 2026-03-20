"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ChevronDown, Trash2 } from "lucide-react";
import {
  GcButton, GcFieldLabel, GcInput, GcPage,
  GcPageHeader, GcPanel, GcSelect, GcTextarea,
} from "@/components/ui/gc";
import {
  AccessState, LogItem, ACTION_META, getActionMeta,
  extractChangeEntries, formatExactTime, formatRelativeTime,
  fetchLogs, createNote, deleteLog,
} from "./activityLogShared";

function StatusPill({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", padding: "4px 9px",
      borderRadius: 999, background: bg, color, fontSize: 11, fontWeight: 700,
    }}>
      {label}
    </span>
  );
}

const logFont = "'IBM Plex Sans', 'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

function DesktopLogCard({
  log,
  changes,
  canManage,
  deleting,
  onDelete,
}: {
  log: LogItem;
  changes: ReturnType<typeof extractChangeEntries>;
  canManage: boolean;
  deleting: boolean;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const meta = getActionMeta(log.action);
  const previewChanges = changes.slice(0, 2);

  return (
    <div
      style={{
        border: "1px solid #E7E5E4",
        borderRadius: 18,
        background: "#FFFFFF",
        overflow: "hidden",
        boxShadow: open ? "0 14px 30px rgba(15, 23, 42, 0.05)" : "0 1px 2px rgba(15, 23, 42, 0.03)",
        transition: "box-shadow .16s ease, border-color .16s ease",
      }}
    >
      <div
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 18,
          padding: "16px 18px",
          background: "transparent",
          textAlign: "left",
          fontFamily: logFont,
        }}
      >
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            alignItems: "center",
            gap: 18,
            border: "none",
            padding: 0,
            background: "transparent",
            textAlign: "left",
            cursor: "pointer",
            fontFamily: logFont,
          }}
        >
          <div style={{ width: 110, flexShrink: 0, alignSelf: "stretch", display: "grid", gridTemplateColumns: "14px 1fr", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <div style={{ display: "grid", gridTemplateRows: "12px 1fr", justifyItems: "center", height: "100%" }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: meta.color, marginTop: 3 }} />
                <span style={{ width: 1, height: "100%", background: "#E7E5E4" }} />
              </div>
            </div>
            <div style={{ display: "grid", gap: 8, alignContent: "start" }}>
              <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: "#A8A29E", letterSpacing: ".12em", textTransform: "uppercase" }}>
                {formatRelativeTime(log.createdAt)}
              </p>
              <p style={{ margin: 0, fontSize: 11, lineHeight: 1.45, color: "#78716C" }}>
                {log.actorName}
              </p>
            </div>
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#111827", letterSpacing: "-.02em" }}>
                {log.targetLabel || log.targetId}
              </p>
              <span style={{ fontSize: 11, fontWeight: 700, color: meta.color, letterSpacing: ".08em", textTransform: "uppercase" }}>
                {meta.label}
              </span>
            </div>
            <p
              style={{
                margin: 0,
                fontSize: 13.5,
                color: "#57534E",
                lineHeight: 1.55,
              }}
            >
              {log.summary}
            </p>

            {previewChanges.length > 0 ? (
              <div style={{ display: "grid", gap: 7, marginTop: 12 }}>
                {previewChanges.map((entry) => (
                  <div
                    key={`${log.id}-${entry.label}-preview`}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "minmax(110px, 146px) minmax(0, 1fr)",
                      gap: 12,
                      alignItems: "start",
                    }}
                  >
                    <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: "#A8A29E", textTransform: "uppercase", letterSpacing: ".12em" }}>
                      {entry.label}
                    </p>
                    <p style={{ margin: 0, fontSize: 12.5, color: "#44403C", lineHeight: 1.55, wordBreak: "break-word" }}>
                      <span style={{ color: "#A8A29E" }}>{entry.before}</span>
                      {"  →  "}
                      <span style={{ color: "#111827", fontWeight: 700 }}>{entry.after}</span>
                    </p>
                  </div>
                ))}
                {changes.length > previewChanges.length ? (
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#57534E" }}>
                    +{changes.length - previewChanges.length} perubahan lain
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          <ChevronDown
            size={16}
            color="#98A2B3"
            style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform .16s ease" }}
          />
        </button>

        {canManage ? (
          <button
            type="button"
            onClick={() => onDelete(log.id)}
            disabled={deleting}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              height: 34,
              padding: "0 12px",
              borderRadius: 999,
              border: "1px solid #FECACA",
              background: "#FFF7F7",
              color: "#DC2626",
              fontSize: 12,
              fontWeight: 700,
              cursor: deleting ? "default" : "pointer",
              fontFamily: logFont,
              flexShrink: 0,
            }}
          >
            <Trash2 size={12} strokeWidth={2.5} />
            Delete
          </button>
        ) : null}
      </div>

      {open ? (
        <div style={{ borderTop: "1px solid #F3F4F6", padding: 18, fontFamily: logFont }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            {([
              { label: "Oleh", value: log.actorEmail || log.actorUid },
              { label: "Waktu", value: formatExactTime(log.createdAt) },
              { label: "Target", value: `${log.targetType} · ${log.targetLabel || log.targetId}` },
              { label: "Source", value: log.source },
            ] as const).map(({ label, value }) => (
              <div key={label}>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: "#98A2B3" }}>{label}</p>
                <p style={{ margin: "6px 0 0", fontSize: 13, color: "#344054", wordBreak: "break-word" }}>{value}</p>
              </div>
            ))}
          </div>

          {changes.length > 0 ? (
            <div style={{ marginTop: 14, padding: 14, borderRadius: 14, background: "#FCFCFC", border: "1px solid #ECECEC" }}>
              <p style={{ margin: "0 0 10px", fontSize: 10, fontWeight: 800, letterSpacing: ".12em", textTransform: "uppercase", color: "#A8A29E" }}>Perubahan</p>
              <div style={{ display: "grid", gap: 8 }}>
                {changes.map((entry) => (
                  <div key={`${log.id}-${entry.label}`} style={{ display: "grid", gridTemplateColumns: "minmax(120px, 160px) 1fr", gap: 10, alignItems: "start" }}>
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#57534E", textTransform: "uppercase", letterSpacing: ".08em" }}>{entry.label}</p>
                    <p style={{ margin: 0, fontSize: 13, color: "#44403C", lineHeight: 1.6 }}>
                      <span style={{ color: "#A8A29E" }}>{entry.before}</span>
                      {"  →  "}
                      <span style={{ color: "#101828", fontWeight: 700 }}>{entry.after}</span>
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <details style={{ marginTop: 14 }}>
            <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 700, color: "#344054" }}>
              Lihat raw metadata
            </summary>
            <pre
              style={{
                margin: "10px 0 0",
                padding: 12,
                borderRadius: 12,
                background: "#0F172A",
                color: "#E2E8F0",
                fontSize: 12,
                lineHeight: 1.6,
                overflowX: "auto",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {JSON.stringify(log.metadata ?? {}, null, 2)}
            </pre>
          </details>
        </div>
      ) : null}
    </div>
  );
}

export default function ActivityLogDesktop({
  access: initialAccess,
  onLock,
}: {
  access: AccessState;
  onLock: () => void;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const [access]                           = useState<AccessState>(initialAccess);
  const [logs, setLogs]                   = useState<LogItem[]>([]);
  const [cursor, setCursor]               = useState<string | null>(null);
  const [loading, setLoading]             = useState(true);
  const [loadingMore, setLoadingMore]     = useState(false);
  const [action, setAction]               = useState("");
  const [search, setSearch]               = useState("");
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [noteSummary, setNoteSummary]     = useState("");
  const [noteBody, setNoteBody]           = useState("");
  const [submitting, setSubmitting]       = useState(false);
  const [toast, setToast]                 = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  const loadLogs = useCallback(async (opts: {
    access: AccessState; cursor?: string | null; append?: boolean;
  }) => {
    if (!opts.access.canRead) { setLoading(false); return; }
    opts.append ? setLoadingMore(true) : setLoading(true);
    try {
      const { logs: next, nextCursor } = await fetchLogs({
        action, search, includeDeleted, canManage: opts.access.canManage, cursor: opts.cursor,
      });
      setLogs((prev) => opts.append ? [...prev, ...next] : next);
      setCursor(nextCursor);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Gagal memuat log");
    } finally { setLoading(false); setLoadingMore(false); }
  }, [action, search, includeDeleted, showToast]);

  useEffect(() => {
    loadLogs({ access: initialAccess });
  }, []);

  useEffect(() => {
    if (!access?.canRead) return;
    const t = window.setTimeout(() => { setCursor(null); loadLogs({ access, cursor: null }); }, 250);
    return () => window.clearTimeout(t);
  }, [access, action, search, includeDeleted]);

  const groupedCount = useMemo(() =>
    logs.reduce<Record<string, number>>((acc, l) => { acc[l.action] = (acc[l.action] ?? 0) + 1; return acc; }, {}),
    [logs]);

  const changeMap = useMemo(() =>
    Object.fromEntries(logs.map((l) => [l.id, extractChangeEntries(l)])), [logs]);

  async function handleCreateNote() {
    if (!access?.canManage || !noteSummary.trim()) { showToast("Summary wajib diisi"); return; }
    setSubmitting(true);
    try {
      await createNote(noteSummary.trim(), noteBody.trim());
      setNoteSummary(""); setNoteBody("");
      showToast("Catatan berhasil dibuat");
      await loadLogs({ access, cursor: null });
    } catch (e) { showToast(e instanceof Error ? e.message : "Gagal"); }
    finally { setSubmitting(false); }
  }

  async function handleDelete(id: string) {
    if (!access?.canManage) return;
    const reason = window.prompt("Alasan hapus log ini?");
    if (!reason?.trim()) return;
    setSubmitting(true);
    try {
      await deleteLog(id, reason.trim());
      showToast("Log berhasil dihapus");
      await loadLogs({ access, cursor: null });
    } catch (e) { showToast(e instanceof Error ? e.message : "Gagal"); }
    finally { setSubmitting(false); }
  }

  return (
    <GcPage maxWidth={1320} style={{ fontFamily: logFont }}>
      <GcPageHeader
        eyebrow="Audit Surface"
        title="Activity Log"
        description="Audit trail untuk semua write activity oleh staff dan super admin."
        meta={access ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <StatusPill label={`${logs.length} entries`} color="#065F46" bg="#D1FAE5" />
            {user?.email ? <StatusPill label={user.email} color="#92400E" bg="#FEF3C7" /> : null}
          </div>
        ) : undefined}
        actions={
          <>
            <GcButton variant="secondary" size="lg" onClick={onLock}>
              Lock
            </GcButton>
            <GcButton variant="ghost" size="lg" onClick={() => router.push("/settings")}>
              Back to Settings
            </GcButton>
            <GcButton variant="blue" size="lg"
              onClick={() => access && loadLogs({ access, cursor: null })} disabled={loading}>
              Refresh
            </GcButton>
          </>
        }
      />

      <div style={{ display: "grid", gap: 16 }}>
        {/* Filter */}
        <GcPanel style={{ padding: 18 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, alignItems: "end" }}>
            <div>
              <GcFieldLabel>Action</GcFieldLabel>
              <GcSelect value={action} onChange={(e) => setAction(e.target.value)}>
                <option value="">Semua aksi</option>
                {Object.entries(ACTION_META).map(([key, m]) => (
                  <option key={key} value={key}>{m.emoji} {m.label}</option>
                ))}
              </GcSelect>
            </div>
            <div>
              <GcFieldLabel>Cari</GcFieldLabel>
              <GcInput value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Nama, target, ringkasan…" />
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 42, paddingTop: 20, fontSize: 13.5, color: "#344054" }}>
              <input type="checkbox" checked={includeDeleted}
                onChange={(e) => setIncludeDeleted(e.target.checked)} disabled={!access?.canManage} />
              Tampilkan log dihapus
            </label>
          </div>
        </GcPanel>

        {/* Manual note */}
        {access?.canManage && (
          <GcPanel style={{ padding: 18 }}>
            <h2 style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 800, color: "#101828" }}>Catatan Manual</h2>
            <p style={{ margin: "0 0 14px", fontSize: 13, color: "#667085" }}>
              Tambahkan catatan ke audit stream bila ada konteks operasional yang perlu disimpan.
            </p>
            <div style={{ display: "grid", gap: 12 }}>
              <div>
                <GcFieldLabel required>Summary</GcFieldLabel>
                <GcInput value={noteSummary} onChange={(e) => setNoteSummary(e.target.value)}
                  placeholder="Ringkasan singkat" maxLength={180} />
              </div>
              <div>
                <GcFieldLabel>Catatan</GcFieldLabel>
                <GcTextarea value={noteBody} onChange={(e) => setNoteBody(e.target.value)}
                  placeholder="Detail catatan" />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <GcButton variant="primary" onClick={handleCreateNote} loading={submitting}>
                  Buat Catatan
                </GcButton>
              </div>
            </div>
          </GcPanel>
        )}

        {/* Log stream */}
        <GcPanel style={{ padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#101828" }}>Log Stream</h2>
              <p style={{ margin: "6px 0 0", fontSize: 13, color: "#667085" }}>20 item per load.</p>
            </div>
            {Object.keys(groupedCount).length > 0 && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {Object.entries(groupedCount).slice(0, 6).map(([key, count]) => {
                  const m = getActionMeta(key);
                  return <StatusPill key={key} label={`${m.label} · ${count}`} color={m.color} bg="#FAFAFA" />;
                })}
              </div>
            )}
          </div>

          {loading ? (
            <p style={{ margin: 0, fontSize: 13.5, color: "#667085" }}>Memuat log…</p>
          ) : logs.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13.5, color: "#667085" }}>Tidak ada log untuk filter ini.</p>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {logs.map((log) => {
                const changes = changeMap[log.id] ?? [];
                return (
                  <DesktopLogCard
                    key={log.id}
                    log={log}
                    changes={changes}
                    canManage={access?.canManage ?? false}
                    deleting={submitting}
                    onDelete={handleDelete}
                  />
                );
              })}
            </div>
          )}

          {cursor && !loading && (
            <div style={{ display: "flex", justifyContent: "center", marginTop: 16 }}>
              <GcButton variant="secondary"
                onClick={() => access && loadLogs({ access, cursor, append: true })}
                loading={loadingMore}>
                Muat 20 Berikutnya
              </GcButton>
            </div>
          )}
        </GcPanel>
      </div>

      {toast && (
        <div style={{
          position: "fixed", right: 20, bottom: 20, zIndex: 40,
          padding: "12px 16px", borderRadius: 12, background: "#111827", color: "#F9FAFB",
          fontSize: 13, fontWeight: 700, boxShadow: "0 12px 32px rgba(15,23,42,.22)",
        }}>
          {toast}
        </div>
      )}
    </GcPage>
  );
}
