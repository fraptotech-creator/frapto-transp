// Geocodificação + rota usando serviços ABERTOS do OpenStreetMap (grátis, sem
// chave): Nominatim (endereço → coordenada) e OSRM (rota entre 2 pontos).
// Aqui ficam só os PARSERS puros (testáveis); o fetch fica no router (borda).

export type LatLng = { lat: number; lng: number };

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
