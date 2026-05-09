"use client";

import { useState } from "react";

const font = "Inter, system-ui, sans-serif";
const violet = "#6D28D9";
const violetBg = "#EDE9FE";
const violetBorder = "#C4B5FD";
const red = "#C8102E";
const tx1 = "#0F1117";
const tx3 = "#9299B0";
const border2 = "#F0F2F7";

interface Props {
  /** Entity name — menu name, reward title, etc. */
  entityName: string;
  /** API type sent to /api/ai/suggest */
  type: "menu_description" | "reward_description";
  /** Optional extra context hint shown as placeholder */
  contextPlaceholder?: string;
  onApply: (description: string) => void;
  onClose: () => void;
}

export default function AiDescPanel({ entityName, type, contextPlaceholder, onApply, onClose }: Props) {
  const [context, setContext] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    if (!entityName.trim()) return;
    setLoading(true); setError(null); setSuggestions([]);
    try {
      const res = await fetch("/api/ai/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, entityName: entityName.trim(), context: context.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Gagal generate.");
      setSuggestions(data.suggestions ?? []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ marginTop: 8, padding: "14px 16px", borderRadius: 12, background: violetBg, border: `1.5px solid ${violetBorder}` }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: violet, fontFamily: font }}>✨ AI Bantu — Deskripsi</span>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: tx3, padding: "2px 4px" }}>×</button>
      </div>
      {!entityName.trim() && (
        <p style={{ fontSize: 12, color: red, margin: "0 0 8px", fontFamily: font }}>Isi nama terlebih dahulu.</p>
      )}
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <input
          type="text"
          value={context}
          onChange={(e) => setContext(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && generate()}
          placeholder={contextPlaceholder ?? "Konteks tambahan (opsional)"}
          style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: `1.5px solid ${violetBorder}`, fontSize: 13, fontFamily: font, outline: "none", background: "#fff" }}
        />
        <button
          onClick={generate}
          disabled={loading || !entityName.trim()}
          style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: loading || !entityName.trim() ? border2 : violet, color: loading || !entityName.trim() ? tx3 : "#fff", fontSize: 13, fontWeight: 700, cursor: loading || !entityName.trim() ? "default" : "pointer", fontFamily: font, whiteSpace: "nowrap" }}
        >
          {loading ? "⏳ Generating…" : "Generate"}
        </button>
      </div>
      {error && <p style={{ fontSize: 12, color: red, margin: "0 0 8px", fontFamily: font }}>{error}</p>}
      {suggestions.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => { onApply(s); onClose(); }}
              style={{ textAlign: "left", padding: "9px 12px", borderRadius: 9, border: `1.5px solid ${violetBorder}`, background: "#fff", cursor: "pointer", fontSize: 13, color: tx1, fontFamily: font, transition: "border-color .12s" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = violet; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = violetBorder; }}
            >
              {s}
            </button>
          ))}
          <p style={{ fontSize: 11, color: tx3, margin: 0, fontFamily: font }}>Klik untuk mengisi deskripsi.</p>
        </div>
      )}
    </div>
  );
}
