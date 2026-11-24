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

// Formato REAL do token de rastreio: randomBytes(24).toString("hex") = 48 hex.
// Validar o formato (1) impede que uma string arbitrária de 1 MB vire chave de
// rate-limit/consulta e (2) descarta lixo antes de tocar o banco. Fail-closed.
export const TRACK_TOKEN_RE = /^[0-9a-f]{48}$/;

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

// speedEmMs: o plugin nativo do app do motorista (@capgo/background-geolocation,
// corpo com source:"native") manda a velocidade do Android em METROS POR
// SEGUNDO; o resto do sistema grava km/h (igual ao app web, que já converte).
function parsePoint(raw: unknown, speedEmMs: boolean): TrackPoint | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const lat = num(o.lat ?? o.latitude);
  const lng = num(o.lng ?? o.longitude ?? o.lon);
  if (lat == null || lng == null) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  const speed = num(o.speed ?? o.velocidade);
  return {
    tripId: optInt(o.tripId ?? o.trip_id),
    lat,
    lng,
    speed:
      speed != null && speedEmMs ? Math.round(speed * 3.6 * 100) / 100 : speed,
  };
}

// Token de rastreio da requisição: no corpo ({token}, app antigo) ou no
// cabeçalho "Authorization: Bearer <token>" (app novo — o plugin nativo manda
// o token em headers). Os dois passam pelo MESMO formato (48 hex): qualquer
// outra coisa vira null (fail-closed, nunca string gigante adiante).
export function tokenDaRequisicao(
  body: unknown,
  authorization: string | undefined
): string | null {
  const doCorpo =
    body && typeof body === "object"
      ? (body as Record<string, unknown>).token
      : undefined;
  if (typeof doCorpo === "string" && TRACK_TOKEN_RE.test(doCorpo)) {
    return doCorpo;
  }
  const m = /^Bearer ([0-9a-f]{48})$/.exec((authorization ?? "").trim());
  return m ? m[1] : null;
}

// Teto de pontos por requisição: um POST não pode disparar um loop ilimitado
// de INSERTs no banco (DoS de escrita). O app manda lotes pequenos (maxBatchSize
// 50); 500 é folga com sobra.
const MAX_POINTS = 500;

export function normalizeTrackPayload(
  body: unknown,
  authorization?: string
): TrackPayload {
  if (!body || typeof body !== "object") return { token: null, points: [] };
  const o = body as Record<string, unknown>;
  // Só aceita token no formato real (48 hex). Qualquer outra coisa → null, que
  // o handler trata como 401/400 — nunca deixa string gigante seguir adiante.
  const token = tokenDaRequisicao(o, authorization);
  const speedEmMs = o.source === "native";

  // Formatos aceitos: lote em locations[]/points[]; o campo `location` do
  // transistorsoft (objeto único OU array quando batchSync); ou ponto único no
  // próprio corpo.
  const rawPoints: unknown[] = Array.isArray(o.locations)
    ? o.locations
    : Array.isArray(o.points)
      ? o.points
      : Array.isArray(o.location)
        ? o.location
        : o.location && typeof o.location === "object"
          ? [o.location]
          : [o];

  const points: TrackPoint[] = [];
  for (const rp of rawPoints.slice(0, MAX_POINTS)) {
    const p = parsePoint(rp, speedEmMs);
    if (p) points.push(p);
  }
  return { token, points };
}
