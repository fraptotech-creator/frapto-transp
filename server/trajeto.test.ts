import { describe, it, expect } from "vitest";
import {
  MAX_PONTOS_RESUMO,
  corteRetencao,
  montarResumo,
  simplificarTrajeto,
  trajetoParaMapa,
  type PontoTrajeto,
} from "./_core/trajeto";

// Retenção de GPS com resumo do trajeto (decisão do dono, 24/11/2026).
const T0 = Date.UTC(2026, 7, 1, 12, 0, 0);
// n pontos em linha reta (norte), um a cada 15 s.
const reta = (n: number, lat0 = -20.3, lng = -40.3): PontoTrajeto[] =>
  Array.from({ length: n }, (_, i) => ({
    lat: lat0 + i * 0.0002,
    lng,
    t: T0 + i * 15000,
  }));

describe("simplificarTrajeto", () => {
  it("nunca passa do máximo e mantém início e fim", () => {
    // Zigue-zague: todos os pontos são "curvas".
    const zig = Array.from({ length: 5000 }, (_, i) => ({
      lat: -20 + i * 0.0002,
      lng: -40 + (i % 2) * 0.001,
      t: T0 + i * 15000,
    }));
    const r = simplificarTrajeto(zig);
    expect(r.length).toBeLessThanOrEqual(MAX_PONTOS_RESUMO);
    expect(r[0]).toEqual(zig[0]);
    expect(r[r.length - 1]).toEqual(zig[zig.length - 1]);
  });

  it("reta longa vira só 2 pontos (início e fim)", () => {
    const r = simplificarTrajeto(reta(3000));
    expect(r).toHaveLength(2);
  });

  it("NÃO perde uma curva fechada (o formato do caminho)", () => {
    // Vai para o norte e vira para o leste: a esquina tem de ficar.
    const norte = reta(500);
    const esquina = norte[norte.length - 1];
    const leste = Array.from({ length: 500 }, (_, i) => ({
      lat: esquina.lat,
      lng: esquina.lng + (i + 1) * 0.0002,
      t: esquina.t + (i + 1) * 15000,
    }));
    const r = simplificarTrajeto([...norte, ...leste]);
    expect(r.length).toBeLessThanOrEqual(5);
    expect(r).toContainEqual(esquina);
  });

  it("mantém a ordem no tempo e ignora pontos inválidos", () => {
    const pts = [...reta(50), { lat: NaN, lng: -40, t: T0 }];
    const r = simplificarTrajeto(pts, 10);
    for (let i = 1; i < r.length; i++)
      expect(r[i].t).toBeGreaterThan(r[i - 1].t);
    expect(r.every(p => Number.isFinite(p.lat))).toBe(true);
  });

  it("trajeto curto (≤ máximo) fica como está", () => {
    const curto = [
      { lat: -20, lng: -40, t: T0 },
      { lat: -20.01, lng: -40.02, t: T0 + 1 },
      { lat: -20.03, lng: -40.01, t: T0 + 2 },
    ];
    expect(simplificarTrajeto(curto)).toEqual(curto);
  });
});

describe("montarResumo", () => {
  it("junta o resumo já guardado com as posições apagadas agora, em ordem", () => {
    const antigo = montarResumo(null, reta(3));
    const novas = reta(3, -20.2).map(p => ({ ...p, t: p.t + 3_600_000 }));
    const r = montarResumo(antigo, novas);
    expect(r[0][2]).toBe(antigo[0][2]); // começa no ponto mais antigo
    expect(r[r.length - 1][2]).toBe(novas[novas.length - 1].t);
    for (let i = 1; i < r.length; i++)
      expect(r[i][2]).toBeGreaterThan(r[i - 1][2]);
  });

  it("formato [lat, lng, epochMs] com 7 casas (precisão do banco)", () => {
    const [p] = montarResumo(null, [{ lat: -20.123456789, lng: -40.1, t: T0 }]);
    expect(p).toEqual([-20.1234568, -40.1, T0]);
  });

  it("respeita o máximo mesmo somando resumo + novas", () => {
    const zig = (base: number) =>
      Array.from({ length: 300 }, (_, i) => ({
        lat: -20 + i * 0.0002,
        lng: -40 + (i % 2) * 0.001,
        t: base + i * 1000,
      }));
    const r = montarResumo(montarResumo(null, zig(T0)), zig(T0 + 1e9));
    expect(r.length).toBeLessThanOrEqual(MAX_PONTOS_RESUMO);
  });
});

describe("corteRetencao", () => {
  it("90 dias antes de agora", () => {
    const agora = new Date("2026-11-24T12:00:00Z");
    expect(corteRetencao(agora).toISOString()).toBe("2026-08-26T12:00:00.000Z");
  });
});

describe("trajetoParaMapa", () => {
  it("resumo (sem velocidade) vem antes das posições detalhadas", () => {
    const det = [
      {
        lat: "-20.5",
        lng: "-40.5",
        velocidade: "60.00",
        capturedAt: new Date(T0 + 9e9),
      },
    ];
    const r = trajetoParaMapa([[-20.1, -40.1, T0]], det);
    expect(r).toEqual([
      {
        lat: "-20.1",
        lng: "-40.1",
        velocidade: null,
        capturedAt: new Date(T0),
      },
      det[0],
    ]);
  });

  it("sem resumo = só as posições; sem posições = só o resumo", () => {
    expect(trajetoParaMapa(null, [])).toEqual([]);
    expect(trajetoParaMapa([[-20, -40, T0]], [])).toHaveLength(1);
  });
});
