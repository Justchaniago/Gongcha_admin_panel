import { NextRequest, NextResponse } from "next/server";

type NominatimResult = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
};

type PhotonResponse = {
  features: Array<{
    properties: {
      name?: string;
      street?: string;
      city?: string;
      state?: string;
      country?: string;
    };
    geometry: {
      coordinates: [number, number];
    };
  }>;
};

type BiasPoint = { lat: number; lng: number };

function parseBiasPoint(latRaw: string | null, lngRaw: string | null): BiasPoint | null {
  if (!latRaw || !lngRaw) return null;
  const lat = Number(latRaw);
  const lng = Number(lngRaw);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

async function searchWithNominatim(q: string, bias?: BiasPoint | null): Promise<NominatimResult[]> {
  const params = new URLSearchParams({
    format: "jsonv2",
    limit: "8",
    addressdetails: "1",
    "accept-language": "id,en",
    q,
  });

  if (bias) {
    const deltaLon = 0.4;
    const deltaLat = 0.3;
    const west = bias.lng - deltaLon;
    const east = bias.lng + deltaLon;
    const north = bias.lat + deltaLat;
    const south = bias.lat - deltaLat;
    params.set("viewbox", `${west},${north},${east},${south}`);
    params.set("bounded", "0");
  }

  const url = `https://nominatim.openstreetmap.org/search?${params.toString()}`;

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "gongcha-admin-map-search/1.0 (contact: admin@gongcha.local)",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Nominatim geocoding error: ${response.status}`);
  }

  return (await response.json()) as NominatimResult[];
}

async function searchWithPhoton(q: string, bias?: BiasPoint | null): Promise<NominatimResult[]> {
  const params = new URLSearchParams({ q, lang: "id", limit: "8" });
  if (bias) {
    params.set("lat", String(bias.lat));
    params.set("lon", String(bias.lng));
  }
  const url = `https://photon.komoot.io/api/?${params.toString()}`;
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Photon geocoding error: ${response.status}`);
  }

  const payload = (await response.json()) as PhotonResponse;
  return payload.features.map((feature, idx) => {
    const [lng, lat] = feature.geometry.coordinates;
    const p = feature.properties;
    const display = [p.name, p.street, p.city, p.state, p.country].filter(Boolean).join(", ");
    return {
      place_id: idx + 1,
      display_name: display || `Result ${idx + 1}`,
      lat: String(lat),
      lon: String(lng),
    };
  });
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function distanceKm(a: BiasPoint, b: BiasPoint): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;

  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function scoreResult(query: string, item: NominatimResult, bias?: BiasPoint | null): number {
  const q = normalize(query);
  const name = normalize(item.display_name);

  let score = 0;

  if (name.includes(q)) score += 20;

  const isGongChaQuery = /gong\s*cha/i.test(q);
  if (isGongChaQuery) {
    if (/gong\s*cha/i.test(name)) score += 40;
    if (/indonesia|jakarta|bandung|surabaya|tangerang|bekasi|depok|bogor/i.test(name)) score += 8;
  }

  if (/indonesia/.test(name)) score += 4;
  if (/mall|plaza|center|centre|street|jalan|jl\./i.test(name)) score += 2;

  if (bias) {
    const itemPoint = { lat: Number(item.lat), lng: Number(item.lon) };
    if (Number.isFinite(itemPoint.lat) && Number.isFinite(itemPoint.lng)) {
      const d = distanceKm(bias, itemPoint);
      if (d < 2) score += 18;
      else if (d < 10) score += 12;
      else if (d < 25) score += 8;
      else if (d < 75) score += 4;
    }
  }

  return score;
}

function mergeAndRank(query: string, lists: NominatimResult[][], bias?: BiasPoint | null): NominatimResult[] {
  const merged = lists.flat();
  const seen = new Set<string>();
  const deduped: NominatimResult[] = [];

  for (const item of merged) {
    const key = `${Number(item.lat).toFixed(5)}:${Number(item.lon).toFixed(5)}:${normalize(item.display_name)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }

  deduped.sort((a, b) => scoreResult(query, b, bias) - scoreResult(query, a, bias));
  return deduped.slice(0, 8);
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const biasPoint = parseBiasPoint(
    req.nextUrl.searchParams.get("lat"),
    req.nextUrl.searchParams.get("lng")
  );

  if (!q) {
    return NextResponse.json({ error: "Missing query parameter: q" }, { status: 400 });
  }

  try {
    const enrichedQuery = /indonesia|jakarta|bandung|surabaya/i.test(q) ? q : `${q} Indonesia`;

    const [photonResults, nominatimResults] = await Promise.all([
      searchWithPhoton(enrichedQuery, biasPoint).catch(() => []),
      searchWithNominatim(enrichedQuery, biasPoint).catch(() => []),
    ]);

    const ranked = mergeAndRank(q, [photonResults, nominatimResults], biasPoint);
    return NextResponse.json({ results: ranked, provider: "photon+nominatim", biasApplied: !!biasPoint });
  } catch (error) {
    console.error("[api/geocode]", error);
    return NextResponse.json({ error: "Failed to geocode location" }, { status: 500 });
  }
}
