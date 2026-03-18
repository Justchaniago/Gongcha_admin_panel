"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  GcButton, GcFieldLabel, GcInput, GcPage,
  GcPageHeader, GcPanel, GcSelect, GcTextarea,
} from "@/components/ui/gc";
import {
  AccessState, LogItem, ACTION_META, getActionMeta,
  extractChangeEntries, formatExactTime, formatRelativeTime,
  fetchLogs, createNote, softDeleteLog,
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
      await softDeleteLog(id, reason.trim());
      showToast("Log berhasil di-soft delete");
      await loadLogs({ access, cursor: null });
    } catch (e) { showToast(e instanceof Error ? e.message : "Gagal"); }
    finally { setSubmitting(false); }
  }

  return (
    <GcPage maxWidth={1320}>
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
                  return <StatusPill key={key} label={`${m.emoji} ${m.label} · ${count}`} color={m.color} bg={m.bg} />;
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
                const meta = getActionMeta(log.action);
                const changes = changeMap[log.id] ?? [];
                return (
                  <div key={log.id} style={{
                    border: "1px solid #EAECF0", borderRadius: 14, padding: 16,
                    background: log.isDeleted ? "#FFF7ED" : "#FFFFFF",
                  }}>
                    {/* Header row */}
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                      <div style={{ display: "grid", gap: 8 }}>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                          <span style={{ fontSize: 18 }}>{meta.emoji}</span>
                          <StatusPill label={meta.label} color={meta.color} bg={meta.bg} />
                          <StatusPill
                            label={log.status === "failed" ? "Gagal" : "Sukses"}
                            color={log.status === "failed" ? "#B42318" : "#027A48"}
                            bg={log.status === "failed" ? "#FEE4E2" : "#ECFDF3"}
                          />
                          {log.isManual && <StatusPill label="manual" color="#92400E" bg="#FEF3C7" />}
                          {log.isDeleted && <StatusPill label="dihapus" color="#B54708" bg="#FFEDD5" />}
                        </div>
                        <div>
                          <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#101828" }}>{log.summary}</p>
                          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#667085" }}>
                            {log.actorName} ({log.actorRole === "SUPER_ADMIN" ? "Super Admin" : "Staff"})
                            {" · "}{formatRelativeTime(log.createdAt)}
                            {" · "}<span style={{ fontSize: 11, color: "#9CA3AF" }}>{formatExactTime(log.createdAt)}</span>
                          </p>
                        </div>
                      </div>
                      {access?.canManage && !log.isDeleted && (
                        <GcButton variant="danger" size="sm" onClick={() => handleDelete(log.id)} disabled={submitting}>
                          Hapus
                        </GcButton>
                      )}
                    </div>

                    {/* Meta grid */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginTop: 14 }}>
                      {([
                        { label: "Oleh",   value: log.actorEmail || log.actorUid },
                        { label: "Target", value: `${log.targetType} · ${log.targetLabel || log.targetId}` },
                        { label: "Source", value: log.source },
                      ] as const).map(({ label, value }) => (
                        <div key={label}>
                          <p style={{ margin: 0, fontSize: 11, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: "#98A2B3" }}>{label}</p>
                          <p style={{ margin: "6px 0 0", fontSize: 13, color: "#344054", wordBreak: "break-word" }}>{value}</p>
                        </div>
                      ))}
                    </div>

                    {/* Diff */}
                    {changes.length > 0 && (
                      <div style={{ marginTop: 14, padding: 12, borderRadius: 12, background: "#F8FAFC", border: "1px solid #E2E8F0" }}>
                        <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: "#98A2B3" }}>Perubahan</p>
                        <div style={{ display: "grid", gap: 8 }}>
                          {changes.map((entry) => (
                            <div key={`${log.id}-${entry.label}`} style={{ display: "grid", gridTemplateColumns: "minmax(120px, 160px) 1fr", gap: 10, alignItems: "start" }}>
                              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#344054" }}>{entry.label}</p>
                              <p style={{ margin: 0, fontSize: 13, color: "#475467", lineHeight: 1.6 }}>
                                <span style={{ color: "#98A2B3" }}>{entry.before}</span>
                                {" → "}
                                <span style={{ color: "#101828", fontWeight: 700 }}>{entry.after}</span>
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Deleted info */}
                    {log.isDeleted && (
                      <div style={{ marginTop: 14, padding: 12, borderRadius: 12, background: "#FFF7ED", border: "1px solid #FED7AA" }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#9A3412" }}>
                          Dihapus oleh {log.deletedBy || "—"} — {formatExactTime(log.deletedAt ?? null)}
                        </p>
                        {log.deleteReason && (
                          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#9A3412" }}>Alasan: {log.deleteReason}</p>
                        )}
                      </div>
                    )}

                    {/* Raw metadata */}
                    <details style={{ marginTop: 14 }}>
                      <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 700, color: "#344054" }}>
                        Lihat raw metadata
                      </summary>
                      <pre style={{
                        margin: "10px 0 0", padding: 12, borderRadius: 12,
                        background: "#0F172A", color: "#E2E8F0", fontSize: 12,
                        lineHeight: 1.6, overflowX: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word",
                      }}>
                        {JSON.stringify(log.metadata ?? {}, null, 2)}
                      </pre>
                    </details>
                  </div>
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
