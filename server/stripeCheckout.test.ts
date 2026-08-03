import { describe, it, expect, vi, beforeEach } from "vitest";

// ENV com os 3 segredos → isStripeConfigured() true. Banco e Stripe mockados.
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
  claimCheckoutIntent: vi.fn(),
  finalizeCheckoutIntent: vi.fn(),
}));
vi.mock("./db", () => db);

// Stripe mockado: customers.create e checkout.sessions.create observáveis.
const stripeInstance = vi.hoisted(() => ({
  customers: { create: vi.fn(async () => ({ id: "cus_new" })) },
  checkout: {
    sessions: {
      create: vi.fn(async () => ({
        url: "https://checkout.stripe/sess",
        expires_at: 1_900_000_000,
      })),
    },
  },
}));
vi.mock("stripe", () => ({ default: vi.fn(() => stripeInstance) }));

import { createCheckoutSession } from "./_core/stripe";

const orgNone = {
  id: 1,
  name: "Org",
  subscriptionStatus: "none",
  stripeCustomerId: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  db.finalizeCheckoutIntent.mockResolvedValue(undefined);
  db.updateOrganization.mockResolvedValue(undefined);
});

describe("createCheckoutSession — anti assinatura duplicada (item 3)", () => {
  it("RECUSA abrir checkout quando a org já tem assinatura ativa", async () => {
    db.getOrganization.mockResolvedValue({
      ...orgNone,
      subscriptionStatus: "active",
      stripeCustomerId: "cus_1",
    });
    await expect(
      createCheckoutSession({ orgId: 1, email: "a@b.com" })
    ).rejects.toThrow(/assinatura ativa/i);
    expect(db.claimCheckoutIntent).not.toHaveBeenCalled();
    expect(stripeInstance.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it("RECUSA quando pendente (past_due) — evita 2ª cobrança", async () => {
    db.getOrganization.mockResolvedValue({
      ...orgNone,
      subscriptionStatus: "past_due",
    });
    await expect(
      createCheckoutSession({ orgId: 1, email: "a@b.com" })
    ).rejects.toThrow(/assinatura ativa/i);
  });
});

describe("createCheckoutSession — exatamente-uma-vez (item 1)", () => {
  it("cria: usa a idempotency key da intenção no customer E na sessão; persiste", async () => {
    db.getOrganization.mockResolvedValue(orgNone);
    db.claimCheckoutIntent.mockResolvedValue({ key: "co_1_abc", url: null });
    const url = await createCheckoutSession({ orgId: 1, email: "a@b.com" });
    expect(url).toBe("https://checkout.stripe/sess");
    // no máximo UM customer e UMA sessão
    expect(stripeInstance.customers.create).toHaveBeenCalledOnce();
    expect(stripeInstance.checkout.sessions.create).toHaveBeenCalledOnce();
    // idempotency keys derivadas da chave da intenção
    expect(stripeInstance.customers.create.mock.calls[0][1]).toEqual({
      idempotencyKey: "co_1_abc-cust",
    });
    expect(stripeInstance.checkout.sessions.create.mock.calls[0][1]).toEqual({
      idempotencyKey: "co_1_abc",
    });
    // persistiu a url/expiração na intenção (para reuso)
    expect(db.finalizeCheckoutIntent).toHaveBeenCalledWith(
      1,
      "co_1_abc",
      "https://checkout.stripe/sess",
      expect.any(Date)
    );
  });

  it("concorrente/retry com sessão válida: REUSA a url, sem tocar o Stripe", async () => {
    db.getOrganization.mockResolvedValue(orgNone);
    db.claimCheckoutIntent.mockResolvedValue({
      key: "co_1_abc",
      url: "https://checkout.stripe/existing",
    });
    const url = await createCheckoutSession({ orgId: 1, email: "a@b.com" });
    expect(url).toBe("https://checkout.stripe/existing");
    expect(stripeInstance.customers.create).not.toHaveBeenCalled();
    expect(stripeInstance.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it("retry após falha reusa a MESMA chave (Stripe dedupe → sem cobrança dupla)", async () => {
    db.getOrganization.mockResolvedValue(orgNone);
    // duas tentativas devolvem a MESMA chave da intenção (sem url) → mesma
    // idempotency key ao Stripe nas duas.
    db.claimCheckoutIntent.mockResolvedValue({ key: "co_1_xyz", url: null });
    await createCheckoutSession({ orgId: 1, email: "a@b.com" });
    await createCheckoutSession({ orgId: 1, email: "a@b.com" });
    const keys = stripeInstance.checkout.sessions.create.mock.calls.map(
      c => (c[1] as { idempotencyKey: string }).idempotencyKey
    );
    expect(keys).toEqual(["co_1_xyz", "co_1_xyz"]); // mesma chave → dedup
  });
});
