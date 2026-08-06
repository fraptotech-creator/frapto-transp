import { describe, expect, it } from "vitest";
import { decidirMudancaAcesso } from "./_core/superAdminAccess";

const ORG = { id: 1 };

describe("decidirMudancaAcesso", () => {
  it("bloquear grava override 'blocked' (kill switch, vence o Stripe)", () => {
    expect(decidirMudancaAcesso(ORG, "bloquear")).toEqual({
      ok: true,
      patch: { accessOverride: "blocked" },
    });
  });

  it("liberar grava override 'active' (acesso sem Stripe)", () => {
    expect(decidirMudancaAcesso(ORG, "liberar")).toEqual({
      ok: true,
      patch: { accessOverride: "active" },
    });
  });

  it("desbloquear limpa o override (volta a seguir o Stripe)", () => {
    expect(decidirMudancaAcesso(ORG, "desbloquear")).toEqual({
      ok: true,
      patch: { accessOverride: null },
    });
  });

  it("funciona para QUALQUER empresa, inclusive assinante do Stripe", () => {
    // O override é coluna SEPARADA — o webhook não o desfaz —, então não há mais
    // motivo para recusar orgs com assinatura no Stripe.
    for (const acao of ["liberar", "bloquear", "desbloquear"] as const) {
      expect(decidirMudancaAcesso(ORG, acao).ok).toBe(true);
    }
  });

  it("empresa inexistente é recusada, não gera patch", () => {
    expect(decidirMudancaAcesso(null, "liberar").ok).toBe(false);
    expect(decidirMudancaAcesso(undefined, "bloquear").ok).toBe(false);
  });

  it("é idempotente (repetir dá o mesmo resultado)", () => {
    expect(decidirMudancaAcesso(ORG, "bloquear")).toEqual(
      decidirMudancaAcesso(ORG, "bloquear")
    );
  });
});
