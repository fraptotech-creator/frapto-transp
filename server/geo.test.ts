import { describe, it, expect } from "vitest";
import { parseNominatim, parseOsrm, candidateQueries } from "./_core/geo";

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
