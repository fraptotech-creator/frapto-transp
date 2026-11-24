import { describe, expect, it } from "vitest";
import { normalizeTrackPayload, tokenDaRequisicao } from "./_core/trackIngest";

// Token no formato real (48 hex): a normalização passou a exigi-lo.
const TOKEN = "a".repeat(48);

describe("normalizeTrackPayload", () => {
  it("aceita ponto único no corpo", () => {
    const r = normalizeTrackPayload({
      token: TOKEN,
      tripId: 7,
      lat: -20.38,
      lng: -40.29,
      speed: 62.5,
    });
    expect(r.token).toBe(TOKEN);
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
      token: TOKEN,
      location: { lat: -20, lng: -40, speed: 12 },
    });
    expect(r.token).toBe(TOKEN);
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

  // App novo do motorista (24/11/2026): plugin @capgo/background-geolocation
  // posta um Location solto, token no cabeçalho e velocidade em m/s.
  it("formato do plugin novo: token no Bearer, velocidade m/s → km/h", () => {
    const tk = "a".repeat(48);
    const r = normalizeTrackPayload(
      { latitude: -20.3, longitude: -40.3, speed: 10, source: "native" },
      `Bearer ${tk}`
    );
    expect(r.token).toBe(tk);
    expect(r.points).toEqual([
      { tripId: null, lat: -20.3, lng: -40.3, speed: 36 },
    ]);
  });

  it("app antigo (sem source:native) NÃO tem a velocidade convertida", () => {
    const r = normalizeTrackPayload({
      token: "b".repeat(48),
      location: { lat: -20, lng: -40, speed: 10 },
    });
    expect(r.points[0].speed).toBe(10);
  });
});

describe("tokenDaRequisicao", () => {
  const tk = "c".repeat(48);

  it("aceita o token do corpo (app antigo) ou do Bearer (app novo)", () => {
    expect(tokenDaRequisicao({ token: tk }, undefined)).toBe(tk);
    expect(tokenDaRequisicao(undefined, `Bearer ${tk}`)).toBe(tk);
  });

  it("corpo vence o cabeçalho quando os dois vêm", () => {
    const outro = "d".repeat(48);
    expect(tokenDaRequisicao({ token: tk }, `Bearer ${outro}`)).toBe(tk);
  });

  it("fail-closed: formato errado em qualquer lugar → null", () => {
    expect(tokenDaRequisicao({ token: "curto" }, undefined)).toBeNull();
    expect(tokenDaRequisicao(undefined, `Bearer ${"x".repeat(48)}`)).toBeNull();
    expect(tokenDaRequisicao(undefined, tk)).toBeNull(); // sem "Bearer "
    expect(
      tokenDaRequisicao(undefined, `Bearer ${tk}${"0".repeat(1000)}`)
    ).toBeNull();
    expect(tokenDaRequisicao(undefined, undefined)).toBeNull();
  });
});
