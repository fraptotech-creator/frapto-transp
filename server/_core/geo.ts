// Geocodificação + rota usando serviços ABERTOS do OpenStreetMap (grátis, sem
// chave): Nominatim (endereço → coordenada) e OSRM (rota entre 2 pontos).
// Aqui ficam só os PARSERS puros (testáveis); o fetch fica no router (borda).

export type LatLng = { lat: number; lng: number };

// Normaliza o endereço p/ o geocoder: remove "número/nº/nro" (mantém o dígito)
// e arruma espaços/vírgulas. Ex.: "Av São Paulo, numero 92, ..." → "Av São
// Paulo, 92, ...". Melhora o casamento no Nominatim.
export function normalizeAddress(q: string): string {
  return (q ?? "")
    .replace(/\bn[uú]meros?\b/gi, "")
    .replace(/\bnros?\.?\b/gi, "")
    .replace(/n[º°]/gi, "")
    .replace(/\s*,\s*/g, ", ")
    .replace(/(?:,\s*)+/g, ", ")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s,]+|[\s,]+$/g, "")
    .trim();
}

// Gera tentativas de busca da MAIS específica p/ a mais geral, removendo os
// primeiros trechos (rua, número) — ex.: "Av. São Paulo, 92, Perocão, Guarapari-ES"
// → ["Av. São Paulo, 92, Perocão, Guarapari-ES", "92, Perocão, Guarapari-ES",
//    "Perocão, Guarapari-ES", "Guarapari-ES"]. Aumenta a chance de o OSM achar
// ao menos a cidade quando a rua exata não existe na base.
export function candidateQueries(q: string): string[] {
  const full = normalizeAddress(q);
  const parts = full
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
  const out: string[] = [];
  const push = (s: string) => {
    const t = s.trim();
    if (t && !out.includes(t)) out.push(t);
  };
  push(full);
  for (let i = 1; i < parts.length; i++) push(parts.slice(i).join(", "));
  return out;
}

// Resposta do Nominatim: array de resultados com lat/lon (strings).
export function parseNominatim(json: unknown): LatLng | null {
  if (!Array.isArray(json) || json.length === 0) return null;
  const first = json[0] as { lat?: unknown; lon?: unknown };
  const lat = Number(first.lat);
  const lng = Number(first.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

export type ParsedRoute = {
  geometry: [number, number][]; // [lat, lng] para o Leaflet
  distanceKm: number;
  durationMin: number;
};

// Resposta do OSRM: routes[0].geometry.coordinates em [lon, lat]; distance (m),
// duration (s). Convertemos para [lat, lng] (ordem do Leaflet).
export function parseOsrm(json: unknown): ParsedRoute | null {
  const route = (json as { routes?: unknown[] })?.routes?.[0] as
    | {
        geometry?: { coordinates?: unknown };
        distance?: unknown;
        duration?: unknown;
      }
    | undefined;
  const coords = route?.geometry?.coordinates;
  if (!Array.isArray(coords) || coords.length === 0) return null;
  const geometry: [number, number][] = [];
  for (const c of coords) {
    if (Array.isArray(c) && c.length >= 2) {
      const lng = Number(c[0]);
      const lat = Number(c[1]);
      if (Number.isFinite(lat) && Number.isFinite(lng))
        geometry.push([lat, lng]);
    }
  }
  if (geometry.length === 0) return null;
  const distM = Number(route?.distance ?? 0);
  const durS = Number(route?.duration ?? 0);
  return {
    geometry,
    distanceKm: Math.round((Number.isFinite(distM) ? distM : 0) / 100) / 10,
    durationMin: Math.round((Number.isFinite(durS) ? durS : 0) / 60),
  };
}
