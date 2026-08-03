import { describe, it, expect, vi, beforeEach } from "vitest";

// ENV com os 3 segredos → isStripeConfigured() true (o guard de duplicidade roda
// depois disso). Banco mockado para controlar o status da org.
vi.mock("./_core/env", () => ({
  ENV: {
    stripeSecretKey: "sk_test_x",
    stripePriceId: "price_x",
    stripeWebhookSecret: "whsec_x",
    appBaseUrl: "https://www.fraptotransp.com.br",
  },
}));
const db = vi.hoisted(() => ({
  getOrganization: vi.fn(),
  getOrgByStripeCustomerId: vi.fn(),
  updateOrganization: vi.fn(),
  claimStripeEvent: vi.fn(),
  markStripeEventFailed: vi.fn(),
  commitStripeEffectUnderLease: vi.fn(),
}));
vi.mock("./db", () => db);

import { createCheckoutSession } from "./_core/stripe";

beforeEach(() => vi.clearAllMocks());

describe("createCheckoutSession — anti assinatura duplicada (item 3)", () => {
  it("RECUSA abrir checkout quando a org já tem assinatura ativa", async () => {
    db.getOrganization.mockResolvedValue({
      id: 1,
      name: "Org",
      subscriptionStatus: "active",
      stripeCustomerId: "cus_1",
    });
    await expect(
      createCheckoutSession({ orgId: 1, email: "a@b.com" })
    ).rejects.toThrow(/assinatura ativa/i);
    // nem tentou criar cliente/sessão no Stripe
    expect(db.updateOrganization).not.toHaveBeenCalled();
  });

  it("RECUSA quando pendente (past_due) — evita 2ª cobrança", async () => {
    db.getOrganization.mockResolvedValue({
      id: 1,
      name: "Org",
      subscriptionStatus: "past_due",
      stripeCustomerId: "cus_1",
    });
    await expect(
      createCheckoutSession({ orgId: 1, email: "a@b.com" })
    ).rejects.toThrow(/assinatura ativa/i);
  });
});
