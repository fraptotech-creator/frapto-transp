import { z } from "zod";
import { activeOrgProcedure, router } from "../_core/trpc";
import { parseNominatim, parseOsrm, type LatLng } from "../_core/geo";

// Identifica o app para o Nominatim (exigência da política de uso).
const UA = "FraptoTransp/1.0 (gestao de frota; suporte via app)";

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

async function geocode(q: string): Promise<LatLng | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(
    q
  )}`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, "Accept-Language": "pt-BR" },
    });
    if (!res.ok) return null;
    return parseNominatim(await res.json());
  } catch {
    return null;
  }
}

// Rota (origem→destino) via OpenStreetMap. Devolve os pontos, a geometria da
// rota (para desenhar no Leaflet) e distância/tempo estimados. Nunca lança —
// em falha devolve { ok:false } com o motivo, e o cliente mostra um aviso.
export const geoRouter = router({
  route: activeOrgProcedure
    .input(z.object({ origem: z.string().min(1), destino: z.string().min(1) }))
    .query(async ({ input }): Promise<RouteResult> => {
      const key = `${input.origem}||${input.destino}`.toLowerCase();
      const hit = cache.get(key);
      if (hit) return hit;

      const [o, d] = await Promise.all([
        geocode(input.origem),
        geocode(input.destino),
      ]);
      if (!o || !d) {
        return { ok: false as const, reason: "geocode" as const };
      }

      let parsed = null;
      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${o.lng},${o.lat};${d.lng},${d.lat}?overview=full&geometries=geojson`;
        const res = await fetch(url, { headers: { "User-Agent": UA } });
        if (res.ok) parsed = parseOsrm(await res.json());
      } catch {
        parsed = null;
      }
      if (!parsed) {
        return { ok: false as const, reason: "route" as const };
      }

      const result = {
        ok: true as const,
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
