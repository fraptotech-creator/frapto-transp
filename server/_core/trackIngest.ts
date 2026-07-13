// Normalização PURA do corpo do /api/track. O app nativo (plugin de GPS em
// background) posta a posição direto — aqui aceitamos tanto um ponto único
// quanto um lote, tolerando número como string. Pontos inválidos são
// descartados; a decisão de gravar (dono/estado da viagem) fica em
// canRecordPosition, na borda.

export interface TrackPoint {
  tripId: number | null;
  lat: number;
  lng: number;
  speed: number | null; // km/h
}

export interface TrackPayload {
  token: string | null;
  points: TrackPoint[];
}

function num(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && v.trim() !== "") {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function optInt(v: unknown): number | null {
  const n = num(v);
  return n == null ? null : Math.trunc(n);
}

function parsePoint(raw: unknown): TrackPoint | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const lat = num(o.lat ?? o.latitude);
  const lng = num(o.lng ?? o.longitude ?? o.lon);
  if (lat == null || lng == null) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return {
    tripId: optInt(o.tripId ?? o.trip_id),
    lat,
    lng,
    speed: num(o.speed ?? o.velocidade),
  };
}

export function normalizeTrackPayload(body: unknown): TrackPayload {
  if (!body || typeof body !== "object") return { token: null, points: [] };
  const o = body as Record<string, unknown>;
  const token = typeof o.token === "string" && o.token ? o.token : null;

  const rawPoints: unknown[] = Array.isArray(o.locations)
    ? o.locations
    : Array.isArray(o.points)
      ? o.points
      : [o]; // ponto único no próprio corpo

  const points: TrackPoint[] = [];
  for (const rp of rawPoints) {
    const p = parsePoint(rp);
    if (p) points.push(p);
  }
  return { token, points };
}
