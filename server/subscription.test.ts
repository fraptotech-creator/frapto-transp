import { describe, it, expect } from "vitest";
import { assinaturaAtiva } from "./_core/subscription";

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
