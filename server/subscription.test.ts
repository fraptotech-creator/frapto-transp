import { describe, it, expect } from "vitest";
import { assinaturaAtiva, temAcesso } from "./_core/subscription";

describe("assinaturaAtiva (fail-closed)", () => {
  it("libera apenas active e trialing", () => {
    expect(assinaturaAtiva("active")).toBe(true);
    expect(assinaturaAtiva("trialing")).toBe(true);
  });

  it("nega todo estado de inadimplência/ausência", () => {
    for (const s of [
      "none",
      "past_due",
      "canceled",
      "unpaid",
      "incomplete",
      "incomplete_expired",
      "paused",
      "",
    ]) {
      expect(assinaturaAtiva(s), s).toBe(false);
    }
  });

  it("nega null/undefined (org sem registro → porta fechada)", () => {
    expect(assinaturaAtiva(null)).toBe(false);
    expect(assinaturaAtiva(undefined)).toBe(false);
  });
});

describe("temAcesso (override do admin vence o Stripe)", () => {
  it("override 'blocked' NEGA mesmo com Stripe ativo (kill switch)", () => {
    expect(
      temAcesso({ subscriptionStatus: "active", accessOverride: "blocked" })
    ).toBe(false);
    expect(
      temAcesso({ subscriptionStatus: "trialing", accessOverride: "blocked" })
    ).toBe(false);
  });

  it("override 'active' CONCEDE mesmo sem Stripe (cortesia/pgto por fora)", () => {
    expect(
      temAcesso({ subscriptionStatus: "canceled", accessOverride: "active" })
    ).toBe(true);
    expect(
      temAcesso({ subscriptionStatus: "none", accessOverride: "active" })
    ).toBe(true);
  });

  it("sem override, segue o Stripe (fail-closed)", () => {
    expect(temAcesso({ subscriptionStatus: "active" })).toBe(true);
    expect(
      temAcesso({ subscriptionStatus: "active", accessOverride: null })
    ).toBe(true);
    expect(temAcesso({ subscriptionStatus: "canceled" })).toBe(false);
    expect(temAcesso({ subscriptionStatus: "past_due" })).toBe(false);
  });

  it("org null/undefined → porta fechada", () => {
    expect(temAcesso(null)).toBe(false);
    expect(temAcesso(undefined)).toBe(false);
  });
});
