import { describe, it, expect, vi, beforeEach } from "vitest";
import type Stripe from "stripe";

// Mock da camada de banco: controla claim e observa mark/effect.
const db = vi.hoisted(() => ({
  claimStripeEvent: vi.fn(),
  markStripeEventProcessed: vi.fn(),
  markStripeEventFailed: vi.fn(),
  getOrganization: vi.fn(),
  getOrgByStripeCustomerId: vi.fn(),
  updateOrgSubscriptionIfNewer: vi.fn(),
}));
vi.mock("./db", () => db);

import { processStripeEvent } from "./_core/stripe";

// Assinatura fake devolvida pela re-consulta na API.
const fakeSub = {
  id: "sub_1",
  status: "active",
  metadata: { orgId: "1" },
  items: { data: [{ current_period_end: 1_800_000_000 }] },
} as unknown as Stripe.Subscription;

const stripe = {
  subscriptions: { retrieve: vi.fn().mockResolvedValue(fakeSub) },
} as unknown as Stripe;

const evento = (over: Partial<Stripe.Event> = {}) =>
  ({
    id: "evt_1",
    type: "customer.subscription.updated",
    created: 1_700_000_000,
    data: { object: { id: "sub_1" } },
    ...over,
  }) as unknown as Stripe.Event;

beforeEach(() => {
  vi.clearAllMocks();
  db.updateOrgSubscriptionIfNewer.mockResolvedValue(true);
});

describe("processStripeEvent — lifecycle retry-safe (Lote B)", () => {
  it("claim → efeito ok → marca PROCESSED (nunca failed)", async () => {
    db.claimStripeEvent.mockResolvedValue("claimed");
    await processStripeEvent(evento(), stripe);
    expect(db.updateOrgSubscriptionIfNewer).toHaveBeenCalledOnce();
    expect(db.markStripeEventProcessed).toHaveBeenCalledOnce();
    expect(db.markStripeEventFailed).not.toHaveBeenCalled();
  });

  it("falha DEPOIS do claim (antes do update) → marca FAILED e relança", async () => {
    db.claimStripeEvent.mockResolvedValue("claimed");
    db.updateOrgSubscriptionIfNewer.mockRejectedValueOnce(new Error("db down"));
    await expect(processStripeEvent(evento(), stripe)).rejects.toThrow(
      /db down/
    );
    expect(db.markStripeEventFailed).toHaveBeenCalledOnce();
    expect(db.markStripeEventProcessed).not.toHaveBeenCalled();
  });

  it("RETRY depois da falha aplica o efeito e marca processed", async () => {
    // 1ª tentativa falha
    db.claimStripeEvent.mockResolvedValue("claimed");
    db.updateOrgSubscriptionIfNewer.mockRejectedValueOnce(new Error("x"));
    await expect(processStripeEvent(evento(), stripe)).rejects.toThrow();
    vi.clearAllMocks();
    // retry: claim reivindica o 'failed', efeito ok
    db.claimStripeEvent.mockResolvedValue("claimed");
    db.updateOrgSubscriptionIfNewer.mockResolvedValue(true);
    await processStripeEvent(evento(), stripe);
    expect(db.updateOrgSubscriptionIfNewer).toHaveBeenCalledOnce();
    expect(db.markStripeEventProcessed).toHaveBeenCalledOnce();
  });

  it("evento JÁ processed → não re-executa efeito nem marca de novo", async () => {
    db.claimStripeEvent.mockResolvedValue("processed");
    await processStripeEvent(evento(), stripe);
    expect(stripe.subscriptions.retrieve).not.toHaveBeenCalled();
    expect(db.updateOrgSubscriptionIfNewer).not.toHaveBeenCalled();
    expect(db.markStripeEventProcessed).not.toHaveBeenCalled();
  });

  it("BUSY (worker concorrente) → relança, sem efeito (não retorna sucesso)", async () => {
    db.claimStripeEvent.mockResolvedValue("busy");
    await expect(processStripeEvent(evento(), stripe)).rejects.toThrow(
      /concorrente/i
    );
    expect(db.updateOrgSubscriptionIfNewer).not.toHaveBeenCalled();
    expect(db.markStripeEventProcessed).not.toHaveBeenCalled();
  });

  it("falha no CANCELAMENTO (deleted) não descarta: marca failed p/ retry", async () => {
    db.claimStripeEvent.mockResolvedValue("claimed");
    db.updateOrgSubscriptionIfNewer.mockRejectedValueOnce(new Error("boom"));
    const del = evento({
      type: "customer.subscription.deleted",
      data: { object: fakeSub } as Stripe.Event.Data,
    });
    await expect(processStripeEvent(del, stripe)).rejects.toThrow();
    expect(db.markStripeEventFailed).toHaveBeenCalledOnce();
    expect(db.markStripeEventProcessed).not.toHaveBeenCalled();
  });
});
