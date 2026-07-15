import { describe, expect, it } from "vitest";
import { normalizeTrackPayload } from "./_core/trackIngest";

describe("normalizeTrackPayload", () => {
  it("aceita ponto único no corpo", () => {
    const r = normalizeTrackPayload({
      token: "abc",
      tripId: 7,
      lat: -20.38,
      lng: -40.29,
      speed: 62.5,
    });
    expect(r.token).toBe("abc");
    expect(r.points).toEqual([
      { tripId: 7, lat: -20.38, lng: -40.29, speed: 62.5 },
    ]);
  });

  it("aceita lote em locations[] e número como string", () => {
    const r = normalizeTrackPayload({
      token: "t",
      locations: [
        { tripId: "3", lat: "-20.1", lng: "-40.2", speed: "10" },
        { latitude: -21, longitude: -41 },
      ],
    });
    expect(r.points).toHaveLength(2);
    expect(r.points[0]).toEqual({
      tripId: 3,
      lat: -20.1,
      lng: -40.2,
      speed: 10,
    });
    expect(r.points[1]).toEqual({
      tripId: null,
      lat: -21,
      lng: -41,
      speed: null,
    });
  });

  it("descarta pontos sem coordenada ou fora de faixa", () => {
    const r = normalizeTrackPayload({
      token: "t",
      locations: [
        { lat: 200, lng: 0 }, // lat inválida
        { lng: -40 }, // sem lat
        { lat: -20, lng: -40 }, // ok
      ],
    });
    expect(r.points).toEqual([
      { tripId: null, lat: -20, lng: -40, speed: null },
    ]);
  });

  it("aceita o campo 'location' único (transistorsoft)", () => {
    const r = normalizeTrackPayload({
      token: "t",
      location: { lat: -20, lng: -40, speed: 12 },
    });
    expect(r.token).toBe("t");
    expect(r.points).toEqual([{ tripId: null, lat: -20, lng: -40, speed: 12 }]);
  });

  it("aceita 'location' em lote (batchSync)", () => {
    const r = normalizeTrackPayload({
      token: "t",
      location: [
        { lat: -20, lng: -40 },
        { lat: -21, lng: -41 },
      ],
    });
    expect(r.points).toHaveLength(2);
  });

  it("sem token → token null", () => {
    expect(normalizeTrackPayload({ lat: -20, lng: -40 }).token).toBeNull();
  });

  it("limita o número de pontos por requisição (anti-DoS)", () => {
    const locations = Array.from({ length: 600 }, () => ({
      lat: -20,
      lng: -40,
    }));
    const r = normalizeTrackPayload({ token: "t", locations });
    expect(r.points).toHaveLength(500);
  });

  it("corpo inválido → vazio", () => {
    expect(normalizeTrackPayload(null)).toEqual({ token: null, points: [] });
    expect(normalizeTrackPayload("x")).toEqual({ token: null, points: [] });
  });
});
