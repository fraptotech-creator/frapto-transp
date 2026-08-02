import { describe, it, expect } from "vitest";
import {
  isDupError,
  podeReivindicar,
  podeMarcar,
} from "./_core/stripeEventState";

describe("isDupError — duplicata na cadeia de cause (Lote B)", () => {
  it("detecta ER_DUP_ENTRY direto", () => {
    expect(isDupError({ code: "ER_DUP_ENTRY" })).toBe(true);
    expect(isDupError({ errno: 1062 })).toBe(true);
  });

  it("detecta ER_DUP_ENTRY DENTRO de cause (Drizzle embrulha)", () => {
    const wrapped = Object.assign(new Error("Failed query"), {
      name: "DrizzleQueryError",
      cause: Object.assign(new Error("dup"), {
        code: "ER_DUP_ENTRY",
        errno: 1062,
      }),
    });
    expect(isDupError(wrapped)).toBe(true);
  });

  it("detecta em cause aninhado (2 níveis)", () => {
    const e = { cause: { cause: { errno: 1062 } } };
    expect(isDupError(e)).toBe(true);
  });

  it("NÃO confunde outros erros", () => {
    expect(isDupError({ code: "ER_NO_SUCH_TABLE" })).toBe(false);
    expect(isDupError(new Error("timeout"))).toBe(false);
    expect(isDupError(null)).toBe(false);
    expect(isDupError("x")).toBe(false);
  });
});

describe("podeReivindicar — quando reprocessar (Lote B)", () => {
  const now = new Date("2026-08-01T12:00:00Z");
  const STALE = 5 * 60 * 1000;

  it("processed NUNCA é reivindicado", () => {
    expect(
      podeReivindicar({ status: "processed", updatedAt: now }, now, STALE)
    ).toBe(false);
  });
  it("failed SEMPRE pode ser reivindicado (retry)", () => {
    expect(
      podeReivindicar({ status: "failed", updatedAt: now }, now, STALE)
    ).toBe(true);
  });
  it("processing RECENTE (outro worker) NÃO é reivindicado", () => {
    const recente = new Date(now.getTime() - 1000);
    expect(
      podeReivindicar({ status: "processing", updatedAt: recente }, now, STALE)
    ).toBe(false);
  });
  it("processing STALE (worker morto) pode ser reivindicado", () => {
    const velho = new Date(now.getTime() - STALE - 1);
    expect(
      podeReivindicar({ status: "processing", updatedAt: velho }, now, STALE)
    ).toBe(true);
  });
});

describe("podeMarcar — fencing por geração (Lote 2)", () => {
  it("dono da geração atual (processing + mesma attempts) pode marcar", () => {
    expect(podeMarcar({ status: "processing", attempts: 1 }, 1)).toBe(true);
    expect(podeMarcar({ status: "processing", attempts: 2 }, 2)).toBe(true);
  });

  it("cenário do plano: A(gen1) NÃO marca após B reivindicar (gen2)", () => {
    // Depois do reclaim de B, a linha está processing com attempts=2.
    const apos_reclaim_B = { status: "processing", attempts: 2 };
    expect(podeMarcar(apos_reclaim_B, 1)).toBe(false); // A (gen1) fenced out
    expect(podeMarcar(apos_reclaim_B, 2)).toBe(true); // B (gen2) é o dono
  });

  it("linha já processed → nenhuma geração marca (A não vira processed→failed)", () => {
    expect(podeMarcar({ status: "processed", attempts: 2 }, 1)).toBe(false);
    expect(podeMarcar({ status: "processed", attempts: 2 }, 2)).toBe(false);
  });

  it("linha failed não é marcável sem reivindicar antes", () => {
    expect(podeMarcar({ status: "failed", attempts: 1 }, 1)).toBe(false);
  });
});
