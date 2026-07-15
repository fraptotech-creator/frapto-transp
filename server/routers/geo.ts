import { z } from "zod";
import { activeOrgProcedure, router } from "../_core/trpc";
import { ENV } from "../_core/env";
import {
  parseNominatim,
  parseOsrm,
  parseOrsGeocode,
  parseOrsDirections,
  candidateQueries,
  type LatLng,
  type ParsedRoute,
} from "../_core/geo";

// Identifica o app para o Nominatim (exigência da política de uso).
const UA = "FraptoTransp/1.0 (gestao de frota; suporte via app)";
const ORS = "https://api.openrouteservice.org";

// fetch com TIMEOUT (os servidores públicos podem pendurar a conexão → exaustão
// de sockets). Aborta em 5s.
async function fetchTimeout(
  url: string,
  opts: RequestInit = {},
  ms = 5000
): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

// Teto de candidatos por endereço: impede fan-out de dezenas de fetches quando
// o input tem muitas vírgulas (mesmo com .max no tamanho).
const MAX_CANDIDATES = 4;

type RouteResult =
  | { ok: false; reason: "geocode" | "route" }
  | {
      ok: true;
      origin: LatLng;
      destination: LatLng;
      geometry: [number, number][];
      distanceKm: number;
      durationMin: number;
    };

// Cache simples em memória (as consultas de rota repetem muito e os servidores
// públicos pedem uso comedido). Teto pra não crescer sem limite.
const cache = new Map<string, RouteResult>();
const CACHE_MAX = 500;

// ─── OpenRouteService (quando ENV.orsApiKey está setado) ─────────────────────

// Busca o endereço DENTRO de um círculo ao redor do centro da cidade — impede
// o Pelias de casar a rua/número numa cidade errada (ele adora fazer isso).
async function geocodeOrsNear(
  q: string,
  center: LatLng,
  radiusKm: number
): Promise<LatLng | null> {
  const url = `${ORS}/geocode/search?api_key=${ENV.orsApiKey}&size=1&boundary.circle.lat=${center.lat}&boundary.circle.lon=${center.lng}&boundary.circle.radius=${radiusKm}&text=${encodeURIComponent(
    q
  )}`;
  try {
    const res = await fetchTimeout(url);
    if (!res.ok) return null;
    return parseOrsGeocode(await res.json());
  } catch {
    return null;
  }
}

async function routeOrs(o: LatLng, d: LatLng): Promise<ParsedRoute | null> {
  const url = `${ORS}/v2/directions/driving-car?api_key=${ENV.orsApiKey}&start=${o.lng},${o.lat}&end=${d.lng},${d.lat}`;
  try {
    const res = await fetchTimeout(url);
    if (!res.ok) return null;
    return parseOrsDirections(await res.json());
  } catch {
    return null;
  }
}

// ─── OpenStreetMap público (padrão / fallback) ───────────────────────────────

async function geocodeNominatim(q: string): Promise<LatLng | null> {
  // countrycodes=br: app de frota brasileiro — evita casar com cidades
  // homônimas no exterior (ex.: "Viana, ES" achava Viana na Espanha).
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(
    q
  )}`;
  try {
    const res = await fetchTimeout(url, {
      headers: { "User-Agent": UA, "Accept-Language": "pt-BR" },
    });
    if (!res.ok) return null;
    return parseNominatim(await res.json());
  } catch {
    return null;
  }
}

async function routeOsrm(o: LatLng, d: LatLng): Promise<ParsedRoute | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${o.lng},${o.lat};${d.lng},${d.lat}?overview=full&geometries=geojson`;
    const res = await fetchTimeout(url, { headers: { "User-Agent": UA } });
    if (!res.ok) return null;
    return parseOsrm(await res.json());
  } catch {
    return null;
  }
}

// ─── Orquestração (ORS quando há chave; senão OSM; com fallback) ─────────────

// Estratégia em 2 passos:
//   1) acha o CENTRO da cidade (último candidato = "Cidade-UF") via Nominatim,
//      que é confiável para cidade;
//   2) com chave ORS, busca o endereço detalhado DENTRO de um círculo ao redor
//      da cidade (do específico ao geral) — garante a cidade certa e, quando a
//      rua existe, o ponto exato.
// Sem chave ORS (ou se nada casar no círculo), cai no Nominatim normal e, por
// fim, no próprio centro da cidade.
async function geocode(q: string): Promise<LatLng | null> {
  const cands = candidateQueries(q).slice(0, MAX_CANDIDATES);
  if (cands.length === 0) return null;
  const center = await geocodeNominatim(cands[cands.length - 1]);

  if (ENV.orsApiKey && center) {
    for (const cand of cands) {
      const hit = await geocodeOrsNear(cand, center, 25);
      if (hit) return hit;
    }
  }
  for (const cand of cands) {
    const hit = await geocodeNominatim(cand);
    if (hit) return hit;
  }
  return center;
}

async function traceRoute(o: LatLng, d: LatLng): Promise<ParsedRoute | null> {
  if (ENV.orsApiKey) {
    const viaOrs = await routeOrs(o, d);
    if (viaOrs) return viaOrs;
  }
  return routeOsrm(o, d);
}

// Rota (origem→destino). Devolve os pontos, a geometria (para o Leaflet) e
// distância/tempo. Nunca lança — em falha devolve { ok:false } com o motivo.
export const geoRouter = router({
  route: activeOrgProcedure
    .input(
      z.object({
        origem: z.string().min(1).max(120),
        destino: z.string().min(1).max(120),
      })
    )
    .query(async ({ input }): Promise<RouteResult> => {
      const key = `${input.origem}||${input.destino}`.toLowerCase();
      const hit = cache.get(key);
      if (hit) return hit;

      const [o, d] = await Promise.all([
        geocode(input.origem),
        geocode(input.destino),
      ]);
      if (!o || !d) return { ok: false, reason: "geocode" };

      const parsed = await traceRoute(o, d);
      if (!parsed) return { ok: false, reason: "route" };

      const result: RouteResult = {
        ok: true,
        origin: o,
        destination: d,
        geometry: parsed.geometry,
        distanceKm: parsed.distanceKm,
        durationMin: parsed.durationMin,
      };
      if (cache.size > CACHE_MAX) cache.clear();
      cache.set(key, result);
      return result;
    }),
});
