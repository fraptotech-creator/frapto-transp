import { describe, it, expect } from "vitest";
import {
  parseNominatim,
  parseOsrm,
  candidateQueries,
  normalizeAddress,
  parseOrsGeocode,
  parseOrsDirections,
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
