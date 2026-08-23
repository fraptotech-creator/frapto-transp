import { describe, it, expect } from "vitest";
import { cnhSituacao } from "./cnh";

const HOJE = new Date("2026-08-23T12:00:00Z");

describe("cnhSituacao — decisão pura de vencimento", () => {
  it("data no passado → vencida, dias negativo", () => {
    const r = cnhSituacao("2026-06-01", HOJE);
    expect(r.vencida).toBe(true);
    expect(r.diasParaVencer).toBeLessThan(0);
  });

  it("data bem no futuro → não vencida, dias positivo", () => {
    const r = cnhSituacao("2034-10-04", HOJE);
    expect(r.vencida).toBe(false);
    expect(r.diasParaVencer).toBeGreaterThan(0);
  });

  it("vence amanhã → não vencida", () => {
    const r = cnhSituacao("2026-08-24T12:00:00Z", HOJE);
    expect(r.vencida).toBe(false);
    expect(r.diasParaVencer).toBe(1);
  });

  it("venceu ontem → vencida", () => {
    const r = cnhSituacao("2026-08-22T12:00:00Z", HOJE);
    expect(r.vencida).toBe(true);
  });

  it("sem data → não vencida, dias null (fail-safe)", () => {
    expect(cnhSituacao(null, HOJE)).toEqual({
      vencida: false,
      diasParaVencer: null,
    });
    expect(cnhSituacao(undefined, HOJE)).toEqual({
      vencida: false,
      diasParaVencer: null,
    });
  });

  it("data inválida → não vencida, dias null (não quebra)", () => {
    expect(cnhSituacao("xxxx", HOJE)).toEqual({
      vencida: false,
      diasParaVencer: null,
    });
  });
});
