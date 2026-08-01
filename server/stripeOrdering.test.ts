import { describe, it, expect } from "vitest";
import { deveAplicarEvento, mapStripeStatus } from "./_core/stripe";

describe("deveAplicarEvento — ordem monotônica (Lote 8.2)", () => {
  const t1 = new Date("2026-08-01T10:00:00Z");
  const t2 = new Date("2026-08-01T10:05:00Z");

  it("sem último aplicado (null) → aplica", () => {
    expect(deveAplicarEvento(null, t1)).toBe(true);
    expect(deveAplicarEvento(undefined, t1)).toBe(true);
  });

  it("evento mais NOVO que o último → aplica", () => {
    expect(deveAplicarEvento(t1, t2)).toBe(true);
  });

  it("evento ATRASADO (mais antigo que o último) → NÃO aplica", () => {
    // Cenário do plano: deleted(t2) já aplicado; updated(t1) chega depois.
    expect(deveAplicarEvento(t2, t1)).toBe(false);
  });

  it("mesmo instante → aplica (idempotente, <=)", () => {
    expect(deveAplicarEvento(t1, t1)).toBe(true);
  });
});

describe("mapStripeStatus", () => {
  it("mapeia estados do Stripe para o enum interno", () => {
    expect(mapStripeStatus("active")).toBe("active");
    expect(mapStripeStatus("trialing")).toBe("trialing");
    expect(mapStripeStatus("past_due")).toBe("past_due");
    expect(mapStripeStatus("unpaid")).toBe("past_due");
    expect(mapStripeStatus("canceled")).toBe("canceled");
    expect(mapStripeStatus("incomplete_expired")).toBe("canceled");
  });
});
