"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";

type Point = { lat: number; lng: number };

type SearchResult = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
};

export default function StoreMapPicker({
  initialPoint,
  selectedPoint,
  onPick,
}: {
  initialPoint?: Point | null;
  selectedPoint: Point | null;
  onPick: (point: Point) => void;
}) {
  const mapRootRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.CircleMarker | null>(null);
  const onPickRef = useRef(onPick);

  const defaultPoint = useMemo<Point>(() => initialPoint ?? { lat: -6.200000, lng: 106.816666 }, [initialPoint]);
  const center = selectedPoint ?? defaultPoint;

  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [mapCenter, setMapCenter] = useState<Point>(center);

  useEffect(() => {
    onPickRef.current = onPick;
  }, [onPick]);

  useEffect(() => {
    if (!mapRootRef.current || mapRef.current) return;

    const map = L.map(mapRootRef.current, {
      center: [center.lat, center.lng],
      zoom: 15,
      scrollWheelZoom: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    map.on("click", (e: L.LeafletMouseEvent) => {
      onPickRef.current({ lat: e.latlng.lat, lng: e.latlng.lng });
    });

    map.on("moveend", () => {
      const c = map.getCenter();
      setMapCenter({ lat: c.lat, lng: c.lng });
    });

    mapRef.current = map;

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      markerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    map.setView([center.lat, center.lng], map.getZoom(), { animate: true });
    setMapCenter(center);
  }, [center.lat, center.lng]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!selectedPoint) {
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
      return;
    }

    const markerLatLng = L.latLng(selectedPoint.lat, selectedPoint.lng);
    if (!markerRef.current) {
      markerRef.current = L.circleMarker(markerLatLng, {
        radius: 8,
        color: "#1D4ED8",
        weight: 2,
        fillColor: "#3B82F6",
        fillOpacity: 0.85,
      }).addTo(map);
      return;
    }

    markerRef.current.setLatLng(markerLatLng);
  }, [selectedPoint]);

  const doSearch = useCallback(async () => {
    const q = query.trim();
    if (!q) return;

    setSearching(true);
    setSearchError("");
    setResults([]);
    try {
      const qs = new URLSearchParams({
        q,
        lat: String(mapCenter.lat),
        lng: String(mapCenter.lng),
      });
      const res = await fetch(`/api/geocode?${qs.toString()}`, { cache: "no-store" });
      const payload = (await res.json()) as { results?: SearchResult[]; error?: string };
      if (!res.ok) throw new Error(payload.error || "Failed to search location.");

      const data = payload.results ?? [];
      setResults(data);
      if (data.length === 0) {
        setSearchError("No location found. Try a different keyword.");
      }
    } catch (err: any) {
      setSearchError(err?.message ?? "Search failed.");
    } finally {
      setSearching(false);
    }
  }, [query, mapCenter.lat, mapCenter.lng]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void doSearch();
            }
          }}
          placeholder="Search place or address (e.g. Grand Indonesia)"
          style={{
            flex: 1,
            height: 40,
            borderRadius: 10,
            border: "1.5px solid #EAECF2",
            padding: "0 12px",
            outline: "none",
            fontSize: 13.5,
          }}
        />
        <button
          type="button"
          onClick={() => void doSearch()}
          disabled={searching}
          style={{
            height: 40,
            padding: "0 14px",
            borderRadius: 10,
            border: "1px solid #BFDBFE",
            background: "#EFF6FF",
            color: "#2563EB",
            fontWeight: 700,
            cursor: searching ? "not-allowed" : "pointer",
          }}
        >
          {searching ? "Searching…" : "Search"}
        </button>
      </div>

      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          width: "fit-content",
          padding: "5px 10px",
          borderRadius: 999,
          border: "1px solid #DBEAFE",
          background: "#EFF6FF",
          color: "#1D4ED8",
          fontSize: 11.5,
          fontWeight: 600,
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "#3B82F6",
          }}
        />
        Searching near: {mapCenter.lat.toFixed(4)}, {mapCenter.lng.toFixed(4)}
      </div>

      {searchError && (
        <div style={{ fontSize: 12.5, color: "#B42318", background: "#FEF3F2", border: "1px solid #FECDD3", padding: "8px 10px", borderRadius: 8 }}>
          {searchError}
        </div>
      )}

      {results.length > 0 && (
        <div style={{ maxHeight: 130, overflowY: "auto", border: "1px solid #EAECF2", borderRadius: 10, background: "#fff" }}>
          {results.map((r) => (
            <button
              type="button"
              key={r.place_id}
              onClick={() => onPick({ lat: Number(r.lat), lng: Number(r.lon) })}
              style={{
                width: "100%",
                textAlign: "left",
                border: "none",
                borderBottom: "1px solid #F0F2F7",
                background: "#fff",
                padding: "9px 10px",
                cursor: "pointer",
                fontSize: 12.5,
                color: "#4A5065",
              }}
            >
              {r.display_name}
            </button>
          ))}
        </div>
      )}

      <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid #EAECF2" }}>
        <div ref={mapRootRef} style={{ width: "100%", height: 320 }} />
      </div>

      <p style={{ fontSize: 12, color: "#6B7280", margin: 0 }}>
        Tip: search is prioritized around the current map area. Move the map first for more relevant nearby results.
      </p>
    </div>
  );
}
