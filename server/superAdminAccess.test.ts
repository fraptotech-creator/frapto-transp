import { describe, expect, it } from "vitest";
import { decidirMudancaAcesso, PLANO_MANUAL } from "./_core/superAdminAccess";

const SEM_STRIPE = { stripeSubscriptionId: null };

describe("decidirMudancaAcesso", () => {
  it("liberar deixa a empresa ativa e marcada como manual", () => {
    const d = decidirMudancaAcesso(SEM_STRIPE, "liberar");
    expect(d).toEqual({
      ok: true,
      patch: { subscriptionStatus: "active", planName: PLANO_MANUAL },
    });
  });

  it("bloquear encerra o acesso e limpa o plano", () => {
    const d = decidirMudancaAcesso(SEM_STRIPE, "bloquear");
    expect(d).toEqual({
      ok: true,
      patch: { subscriptionStatus: "canceled", planName: null },
    });
  });

  it("RECUSA mexer em quem assina pelo Stripe (weblook desfaria / cobrança seguiria)", () => {
    const comStripe = { stripeSubscriptionId: "sub_123" };
    for (const acao of ["liberar", "bloquear"] as const) {
      const d = decidirMudancaAcesso(comStripe, acao);
      expect(d.ok).toBe(false);
      if (!d.ok) expect(d.motivo).toMatch(/Stripe/);
    }
  });

  it("empresa inexistente é recusada, não gera patch", () => {
    expect(decidirMudancaAcesso(null, "liberar").ok).toBe(false);
    expect(decidirMudancaAcesso(undefined, "bloquear").ok).toBe(false);
  });

  it("stripeSubscriptionId vazio NÃO conta como assinante do Stripe", () => {
    // Empresa que só abriu checkout e desistiu continua liberável na mão.
    expect(
      decidirMudancaAcesso({ stripeSubscriptionId: "" }, "liberar").ok
    ).toBe(true);
  });

  it("liberar é idempotente (repetir dá o mesmo resultado)", () => {
    const a = decidirMudancaAcesso(SEM_STRIPE, "liberar");
    const b = decidirMudancaAcesso(SEM_STRIPE, "liberar");
    expect(a).toEqual(b);
  });
});
