import { describe, it, expect } from "vitest";
import { deveAplicarEfeito } from "./_core/stripeEventState";
import { mapStripeStatus, bloqueiaNovoCheckout } from "./_core/stripe";

const T1 = new Date("2026-08-01T10:00:00Z");
const T2 = new Date("2026-08-01T10:05:00Z");

describe("deveAplicarEfeito — ordem determinística por org/assinatura (item 3)", () => {
  it("sem efeito anterior (at null) → aplica", () => {
    expect(
      deveAplicarEfeito(
        { status: "none", at: null },
        { status: "active", at: T1 }
      )
    ).toBe(true);
  });

  it("evento mais NOVO → aplica", () => {
    expect(
      deveAplicarEfeito(
        { status: "active", at: T1 },
        { status: "canceled", at: T2 }
      )
    ).toBe(true);
  });

  it("evento ATRASADO (created menor) → NÃO aplica (não reabre estado recente)", () => {
    // canceled(T2) já aplicado; updated(T1) chega atrasado → ignora.
    expect(
      deveAplicarEfeito(
        { status: "canceled", at: T2 },
        { status: "active", at: T1 }
      )
    ).toBe(false);
  });

  it("EMPATE de timestamp: cancelamento VENCE ativação (fail-closed)", () => {
    // deleted(T) e updated(T) no mesmo segundo — qualquer ordem de chegada
    // converge para canceled.
    expect(
      deveAplicarEfeito(
        { status: "active", at: T1 },
        { status: "canceled", at: T1 }
      )
    ).toBe(true); // aplica canceled sobre active
    expect(
      deveAplicarEfeito(
        { status: "canceled", at: T1 },
        { status: "active", at: T1 }
      )
    ).toBe(false); // NÃO reabre canceled com active do mesmo segundo
  });

  it("EMPATE com mesmo status (retry/duplicado) → aplica (idempotente)", () => {
    expect(
      deveAplicarEfeito(
        { status: "active", at: T1 },
        { status: "active", at: T1 }
      )
    ).toBe(true);
  });

  it("EMPATE: past_due (pendente) vence active, mas não vence canceled", () => {
    expect(
      deveAplicarEfeito(
        { status: "active", at: T1 },
        { status: "past_due", at: T1 }
      )
    ).toBe(true);
    expect(
      deveAplicarEfeito(
        { status: "canceled", at: T1 },
        { status: "past_due", at: T1 }
      )
    ).toBe(false);
  });
});

describe("bloqueiaNovoCheckout — anti assinatura duplicada (item 3)", () => {
  it("bloqueia quando já ativa/trial/pendente", () => {
    expect(bloqueiaNovoCheckout("active")).toBe(true);
    expect(bloqueiaNovoCheckout("trialing")).toBe(true);
    expect(bloqueiaNovoCheckout("past_due")).toBe(true);
  });
  it("permite quando none/canceled (pode (re)assinar)", () => {
    expect(bloqueiaNovoCheckout("none")).toBe(false);
    expect(bloqueiaNovoCheckout("canceled")).toBe(false);
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
