import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { activeOrgProcedure, router } from "../_core/trpc";
import { ENV } from "../_core/env";
import { allowRequest } from "../_core/rateLimit";
import {
  parseNominatim,
  parseOsrm,
  parseOrsGeocode,
  parseOrsDirections,
  candidateQueries,
  ordenarPorProximidade,
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
      stops: LatLng[];
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

// OSRM aceita N coordenadas no path (o1;p1;p2;…;d) — é assim que a rota passa
// pelas paradas na ordem dada. Com 2 pontos, idêntico ao comportamento antigo.
async function routeOsrm(coords: LatLng[]): Promise<ParsedRoute | null> {
  try {
    const path = coords.map(c => `${c.lng},${c.lat}`).join(";");
    const url = `https://router.project-osrm.org/route/v1/driving/${path}?overview=full&geometries=geojson`;
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

// Traça a rota passando por TODAS as coordenadas na ordem (mín. 2: origem/
// destino). ORS só cobre o caso de 2 pontos (start/end) — com paradas, usa OSRM.
async function traceRoute(coords: LatLng[]): Promise<ParsedRoute | null> {
  if (coords.length === 2 && ENV.orsApiKey) {
    const viaOrs = await routeOrs(coords[0], coords[1]);
    if (viaOrs) return viaOrs;
  }
  return routeOsrm(coords);
}

// Cota POR EMPRESA de endereços geocodificados (só conta o que NÃO veio do
// cache). Cada endereço vira até ~9 consultas aos servidores públicos do
// OpenStreetMap, que pedem no máximo 1/s: sem teto, uma conta abusando (rota
// com 25 paradas em loop) fazia o servidor ser bloqueado lá — e o cálculo de
// rota parava para TODOS os clientes (auditoria pré-venda 23/11/2026).
// 200 endereços / 10 min cobre com folga o uso normal (~100 rotas simples).
export const COTA_GEO_ENDERECOS = 200;
const COTA_GEO_JANELA_MS = 10 * 60 * 1000;
export const COTA_GEO_MSG =
  "Muitos cálculos de rota em pouco tempo. Aguarde alguns minutos e tente de novo.";

export function assertCotaGeo(orgId: number, enderecos: number): void {
  if (
    !allowRequest(
      `geo:org:${orgId}`,
      COTA_GEO_ENDERECOS,
      COTA_GEO_JANELA_MS,
      Date.now(),
      enderecos
    )
  ) {
    throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: COTA_GEO_MSG });
  }
}

// Rota (origem→destino). Devolve os pontos, a geometria (para o Leaflet) e
// distância/tempo. Em falha de geocode/rota devolve { ok:false } com o motivo;
// só LANÇA quando a empresa estoura a cota acima.
export const geoRouter = router({
  route: activeOrgProcedure
    .input(
      z.object({
        origem: z.string().min(1).max(120),
        destino: z.string().min(1).max(120),
        // Paradas ORDENADas entre origem e destino (opcional). Sem elas, a rota
        // é direta origem→destino — idêntica ao comportamento anterior.
        paradas: z.array(z.string().min(1).max(120)).max(25).optional(),
      })
    )
    .query(async ({ ctx, input }): Promise<RouteResult> => {
      const paradas = input.paradas ?? [];
      const key =
        `${input.origem}||${paradas.join("|")}||${input.destino}`.toLowerCase();
      const hit = cache.get(key);
      if (hit) return hit;
      assertCotaGeo(ctx.orgId, 2 + paradas.length);

      const [o, d, ...stopsGeo] = await Promise.all([
        geocode(input.origem),
        geocode(input.destino),
        ...paradas.map(p => geocode(p)),
      ]);
      if (!o || !d || stopsGeo.some(s => !s)) {
        return { ok: false, reason: "geocode" };
      }
      const stops = stopsGeo as LatLng[];

      // Ordem do path: origem → paradas (na ordem dada) → destino.
      const parsed = await traceRoute([o, ...stops, d]);
      if (!parsed) return { ok: false, reason: "route" };

      const result: RouteResult = {
        ok: true,
        origin: o,
        destination: d,
        stops,
        geometry: parsed.geometry,
        distanceKm: parsed.distanceKm,
        durationMin: parsed.durationMin,
      };
      if (cache.size > CACHE_MAX) cache.clear();
      cache.set(key, result);
      return result;
    }),

  // Sugere a ORDEM das paradas por proximidade (vizinho-mais-próximo a partir
  // da origem). Não persiste — devolve a lista reordenada; a UI mostra e o
  // usuário confirma/ajusta antes de salvar. Falha de geocode → ok:false.
  optimizeStops: activeOrgProcedure
    .input(
      z.object({
        origem: z.string().min(1).max(120),
        paradas: z.array(z.string().min(1).max(120)).min(2).max(25),
      })
    )
    .query(
      async ({
        ctx,
        input,
      }): Promise<
        { ok: true; paradas: string[] } | { ok: false; reason: "geocode" }
      > => {
        assertCotaGeo(ctx.orgId, 1 + input.paradas.length);
        const [o, ...stopsGeo] = await Promise.all([
          geocode(input.origem),
          ...input.paradas.map(p => geocode(p)),
        ]);
        if (!o || stopsGeo.some(s => !s)) {
          return { ok: false, reason: "geocode" };
        }
        const ordem = ordenarPorProximidade(o, stopsGeo as LatLng[]);
        return { ok: true, paradas: ordem.map(i => input.paradas[i]) };
      }
    ),
});
