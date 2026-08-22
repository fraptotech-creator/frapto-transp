import { describe, it, expect } from "vitest";
import {
  parseNominatim,
  parseOsrm,
  candidateQueries,
  normalizeAddress,
  parseOrsGeocode,
  parseOrsDirections,
  haversineKm,
  ordenarPorProximidade,
} from "./_core/geo";

describe("parseOrsGeocode", () => {
  it("extrai lat/lng do feature (coords [lon,lat])", () => {
    const r = parseOrsGeocode({
      features: [{ geometry: { coordinates: [-40.4984, -20.6718] } }],
    });
    expect(r).toEqual({ lat: -20.6718, lng: -40.4984 });
  });
  it("vazio → null", () => {
    expect(parseOrsGeocode({ features: [] })).toBeNull();
    expect(parseOrsGeocode({})).toBeNull();
  });
});

describe("parseOrsDirections", () => {
  it("converte geometria e lê summary distance/duration", () => {
    const r = parseOrsDirections({
      features: [
        {
          geometry: {
            coordinates: [
              [-40.3, -20.38],
              [-40.5, -20.6],
            ],
          },
          properties: { summary: { distance: 40200, duration: 2880 } },
        },
      ],
    });
    expect(r?.geometry).toEqual([
      [-20.38, -40.3],
      [-20.6, -40.5],
    ]);
    expect(r?.distanceKm).toBe(40.2);
    expect(r?.durationMin).toBe(48);
  });
  it("sem features → null", () => {
    expect(parseOrsDirections({ features: [] })).toBeNull();
  });
});

describe("normalizeAddress", () => {
  it('remove "numero/nº" mantendo o dígito e arruma vírgulas', () => {
    expect(normalizeAddress("Av São Paulo, numero 92, Marcilio Viana-ES")).toBe(
      "Av São Paulo, 92, Marcilio Viana-ES"
    );
    expect(normalizeAddress("Rua X, nº 79,  Perocão")).toBe(
      "Rua X, 79, Perocão"
    );
  });
});

describe("candidateQueries", () => {
  it("vai do específico ao geral removendo trechos iniciais", () => {
    expect(
      candidateQueries("Av. São Paulo, 92, Perocão, Guarapari-ES")
    ).toEqual([
      "Av. São Paulo, 92, Perocão, Guarapari-ES",
      "92, Perocão, Guarapari-ES",
      "Perocão, Guarapari-ES",
      "Guarapari-ES",
    ]);
  });
  it("sem vírgula → só o texto", () => {
    expect(candidateQueries("Guarapari ES")).toEqual(["Guarapari ES"]);
  });
});

describe("parseNominatim", () => {
  it("extrai lat/lng do primeiro resultado", () => {
    const r = parseNominatim([
      { lat: "-20.3805", lon: "-40.3078", display_name: "Vitória" },
    ]);
    expect(r).toEqual({ lat: -20.3805, lng: -40.3078 });
  });
  it("vazio/ inválido → null", () => {
    expect(parseNominatim([])).toBeNull();
    expect(parseNominatim(null)).toBeNull();
    expect(parseNominatim([{ lat: "x", lon: "y" }])).toBeNull();
  });
});

describe("parseOsrm", () => {
  it("converte geometria [lon,lat]→[lat,lng] e calcula km/min", () => {
    const r = parseOsrm({
      routes: [
        {
          distance: 12345, // 12.345 m → 12.3 km
          duration: 1830, // 30.5 min → 31
          geometry: {
            coordinates: [
              [-40.3, -20.38],
              [-40.5, -20.6],
            ],
          },
        },
      ],
    });
    expect(r?.geometry).toEqual([
      [-20.38, -40.3],
      [-20.6, -40.5],
    ]);
    expect(r?.distanceKm).toBe(12.3);
    expect(r?.durationMin).toBe(31);
  });
  it("sem rota → null", () => {
    expect(parseOsrm({ routes: [] })).toBeNull();
    expect(parseOsrm({})).toBeNull();
    expect(
      parseOsrm({ routes: [{ geometry: { coordinates: [] } }] })
    ).toBeNull();
  });
});

describe("haversineKm", () => {
  it("mesmo ponto → 0", () => {
    expect(haversineKm({ lat: -20, lng: -40 }, { lat: -20, lng: -40 })).toBe(0);
  });
  it("SP→RJ ≈ 360 km (ordem de grandeza)", () => {
    const km = haversineKm(
      { lat: -23.55, lng: -46.63 },
      { lat: -22.91, lng: -43.2 }
    );
    expect(km).toBeGreaterThan(330);
    expect(km).toBeLessThan(390);
  });
});

describe("ordenarPorProximidade (vizinho-mais-próximo)", () => {
  const origem = { lat: 0, lng: 0 };
  it("ordena do mais perto ao mais longe a partir da origem", () => {
    // idx0 longe (0,3), idx1 perto (0,1), idx2 médio (0,2)
    const pontos = [
      { lat: 0, lng: 3 },
      { lat: 0, lng: 1 },
      { lat: 0, lng: 2 },
    ];
    expect(ordenarPorProximidade(origem, pontos)).toEqual([1, 2, 0]);
  });
  it("empate resolve pelo menor índice", () => {
    const pontos = [
      { lat: 0, lng: 1 },
      { lat: 0, lng: -1 }, // mesma distância da origem
    ];
    expect(ordenarPorProximidade(origem, pontos)).toEqual([0, 1]);
  });
  it("lista vazia → []", () => {
    expect(ordenarPorProximidade(origem, [])).toEqual([]);
  });
  it("é uma permutação (não perde nem duplica paradas)", () => {
    const pontos = Array.from({ length: 6 }, (_, i) => ({
      lat: 0,
      lng: (i * 37) % 11,
    }));
    const ordem = ordenarPorProximidade(origem, pontos);
    expect([...ordem].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5]);
  });
});
