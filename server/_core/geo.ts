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
// Siglas das UFs: um trecho que é SÓ a UF ("ES") não pode virar candidato
// sozinho — o geocoder devolve o centro do ESTADO e a busca seguinte (raio de
// 25 km) casa uma rua homônima ali ("Vitória, ES" ia parar perto de Linhares).
const UFS = new Set(
  "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(
    " "
  )
);
const PAIS = /^(brasil|brazil|br)$/i;

export function candidateQueries(q: string): string[] {
  const full = normalizeAddress(q);
  const parts = full
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
  // "…, Brasil" no fim: o país sozinho seria o centro do Brasil.
  while (parts.length > 1 && PAIS.test(parts[parts.length - 1])) parts.pop();
  // "…, Cidade, UF": a UF fica GRUDADA na cidade ("Cidade, UF") — o trecho mais
  // geral passa a ser a cidade, nunca o estado.
  if (parts.length >= 2 && UFS.has(parts[parts.length - 1].toUpperCase())) {
    const uf = parts.pop() as string;
    parts[parts.length - 1] = `${parts[parts.length - 1]}, ${uf.toUpperCase()}`;
  }
  const out: string[] = [];
  const push = (s: string) => {
    const t = s.trim();
    if (t && !out.includes(t)) out.push(t);
  };
  push(full);
  push(parts.join(", ")); // sem o país (se havia)
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

// ─── OpenRouteService (geocoder Pelias + rotas) — quando há chave ─────────────

// Geocode ORS: features[0].geometry.coordinates = [lon, lat].
export function parseOrsGeocode(json: unknown): LatLng | null {
  const feat = (json as { features?: unknown[] })?.features?.[0] as
    | { geometry?: { coordinates?: unknown } }
    | undefined;
  const c = feat?.geometry?.coordinates;
  if (!Array.isArray(c) || c.length < 2) return null;
  const lng = Number(c[0]);
  const lat = Number(c[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

// Directions ORS (GeoJSON): features[0].geometry.coordinates [lon,lat] +
// properties.summary.{distance(m),duration(s)}.
export function parseOrsDirections(json: unknown): ParsedRoute | null {
  const feat = (json as { features?: unknown[] })?.features?.[0] as
    | {
        geometry?: { coordinates?: unknown };
        properties?: { summary?: { distance?: unknown; duration?: unknown } };
      }
    | undefined;
  const coords = feat?.geometry?.coordinates;
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
  const distM = Number(feat?.properties?.summary?.distance ?? 0);
  const durS = Number(feat?.properties?.summary?.duration ?? 0);
  return {
    geometry,
    distanceKm: Math.round((Number.isFinite(distM) ? distM : 0) / 100) / 10,
    durationMin: Math.round((Number.isFinite(durS) ? durS : 0) / 60),
  };
}

// ─── Paradas (waypoints) ─────────────────────────────────────────────────────

// Distância em linha reta (km) entre dois pontos — base do "por aproximação".
export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const rad = (x: number) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

// Ordena os pontos por PROXIMIDADE (vizinho-mais-próximo): começa na origem,
// escolhe sempre o ponto não-visitado mais próximo. Retorna os índices na nova
// ordem (o destino é fixo no fim da rota e não entra aqui). Determinístico:
// empate de distância resolve pelo menor índice.
export function ordenarPorProximidade(
  origem: LatLng,
  pontos: LatLng[]
): number[] {
  const restantes = pontos.map((_, i) => i);
  const ordem: number[] = [];
  let atual = origem;
  while (restantes.length > 0) {
    let melhorK = 0;
    let melhorD = Infinity;
    for (let k = 0; k < restantes.length; k++) {
      const d = haversineKm(atual, pontos[restantes[k]]);
      if (d < melhorD) {
        melhorD = d;
        melhorK = k;
      }
    }
    const idx = restantes.splice(melhorK, 1)[0];
    ordem.push(idx);
    atual = pontos[idx];
  }
  return ordem;
}
