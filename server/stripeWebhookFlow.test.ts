import { describe, it, expect, vi, beforeEach } from "vitest";
import type Stripe from "stripe";

// Mock da camada de banco: controla claim/commit e observa o lifecycle.
const db = vi.hoisted(() => ({
  claimStripeEvent: vi.fn(),
  markStripeEventFailed: vi.fn(),
  commitStripeEffectUnderLease: vi.fn(),
  getOrgByStripeCustomerId: vi.fn(),
}));
vi.mock("./db", () => db);

import { processStripeEvent } from "./_core/stripe";

// Ordem GLOBAL das chamadas de efeito — prova "rede ANTES do commit".
const order: string[] = [];

const fakeSub = {
  id: "sub_1",
  status: "active",
  metadata: { orgId: "1" },
  items: { data: [{ current_period_end: 1_800_000_000 }] },
} as unknown as Stripe.Subscription;

const stripe = {
  subscriptions: {
    retrieve: vi.fn(async () => {
      order.push("retrieve");
      return fakeSub;
    }),
  },
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
  order.length = 0;
  db.markStripeEventFailed.mockResolvedValue(true);
  db.commitStripeEffectUnderLease.mockImplementation(async () => {
    order.push("commit");
    return "committed";
  });
});

describe("processStripeEvent — commit sob lease (Lote 2)", () => {
  it("claim → resolve(rede) → commit ATÔMICO; rede ANTES do commit; sem failed", async () => {
    db.claimStripeEvent.mockResolvedValue({ claim: "claimed", generation: 1 });
    await processStripeEvent(evento(), stripe);
    expect(stripe.subscriptions.retrieve).toHaveBeenCalledOnce();
    expect(db.commitStripeEffectUnderLease).toHaveBeenCalledOnce();
    // rede (retrieve) acontece FORA da transação, ANTES do commit
    expect(order).toEqual(["retrieve", "commit"]);
    // efeito resolvido + geração corretos
    expect(db.commitStripeEffectUnderLease).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: "evt_1",
        generation: 1,
        orgId: 1,
        effect: expect.objectContaining({
          subscriptionStatus: "active",
          stripeSubscriptionId: "sub_1",
        }),
      })
    );
    expect(db.markStripeEventFailed).not.toHaveBeenCalled();
  });

  it("fecha a transição com a GERAÇÃO conquistada na claim (retry)", async () => {
    db.claimStripeEvent.mockResolvedValue({ claim: "claimed", generation: 2 });
    await processStripeEvent(evento(), stripe);
    expect(db.commitStripeEffectUnderLease).toHaveBeenCalledWith(
      expect.objectContaining({ generation: 2 })
    );
  });

  it("LEASE PERDIDO no commit (worker antigo) → não lança, não marca failed", async () => {
    db.claimStripeEvent.mockResolvedValue({ claim: "claimed", generation: 1 });
    db.commitStripeEffectUnderLease.mockResolvedValue("lease-lost");
    await expect(processStripeEvent(evento(), stripe)).resolves.toBeUndefined();
    expect(db.markStripeEventFailed).not.toHaveBeenCalled();
  });

  it("falha na REDE (antes do commit) → marca failed (fenced) e relança; commit não roda", async () => {
    db.claimStripeEvent.mockResolvedValue({ claim: "claimed", generation: 1 });
    (
      stripe.subscriptions.retrieve as ReturnType<typeof vi.fn>
    ).mockRejectedValueOnce(new Error("stripe down"));
    await expect(processStripeEvent(evento(), stripe)).rejects.toThrow(
      /stripe down/
    );
    expect(db.commitStripeEffectUnderLease).not.toHaveBeenCalled();
    expect(db.markStripeEventFailed).toHaveBeenCalledWith(
      "evt_1",
      1,
      expect.any(String)
    );
  });

  it("falha/inconsistência no commit (rollback) → marca failed com a geração e relança", async () => {
    db.claimStripeEvent.mockResolvedValue({ claim: "claimed", generation: 3 });
    db.commitStripeEffectUnderLease.mockRejectedValueOnce(
      new Error("fencing inconsistente ao concluir evento Stripe")
    );
    await expect(processStripeEvent(evento(), stripe)).rejects.toThrow(
      /fencing/
    );
    expect(db.markStripeEventFailed).toHaveBeenCalledWith(
      "evt_1",
      3,
      expect.any(String)
    );
  });

  it("commit OK → NUNCA marca failed (falha após commit não rebaixa processed)", async () => {
    db.claimStripeEvent.mockResolvedValue({ claim: "claimed", generation: 1 });
    db.commitStripeEffectUnderLease.mockResolvedValue("committed");
    await processStripeEvent(evento(), stripe);
    expect(db.markStripeEventFailed).not.toHaveBeenCalled();
  });

  it("evento JÁ processed → não re-consulta a rede nem faz commit", async () => {
    db.claimStripeEvent.mockResolvedValue({ claim: "processed" });
    await processStripeEvent(evento(), stripe);
    expect(stripe.subscriptions.retrieve).not.toHaveBeenCalled();
    expect(db.commitStripeEffectUnderLease).not.toHaveBeenCalled();
  });

  it("BUSY (worker concorrente) → relança, sem rede nem commit", async () => {
    db.claimStripeEvent.mockResolvedValue({ claim: "busy" });
    await expect(processStripeEvent(evento(), stripe)).rejects.toThrow(
      /concorrente/i
    );
    expect(stripe.subscriptions.retrieve).not.toHaveBeenCalled();
    expect(db.commitStripeEffectUnderLease).not.toHaveBeenCalled();
  });

  it("dois eventos no MESMO segundo: ambos aplicam (não descarta) e o deleted resolve canceled", async () => {
    const created = 1_700_000_000; // mesmo segundo p/ os dois
    // updated(active) no segundo T
    db.claimStripeEvent.mockResolvedValue({ claim: "claimed", generation: 1 });
    await processStripeEvent(evento({ created }), stripe);
    // deleted(canceled) no MESMO segundo T
    const deletedSub = {
      ...fakeSub,
      status: "canceled",
    } as unknown as Stripe.Subscription;
    const del = evento({
      created,
      type: "customer.subscription.deleted",
      data: { object: deletedSub } as Stripe.Event.Data,
    });
    await processStripeEvent(del, stripe);
    // ambos chamaram commit (mesmo segundo NÃO é descartado)
    expect(db.commitStripeEffectUnderLease).toHaveBeenCalledTimes(2);
    const [first, second] = db.commitStripeEffectUnderLease.mock.calls;
    expect(first[0].effect.subscriptionStatus).toBe("active");
    expect(second[0].effect.subscriptionStatus).toBe("canceled");
    // mesmo instante em ambos (ordem por <=, determinística)
    expect(first[0].eventCreatedAt.getTime()).toBe(
      second[0].eventCreatedAt.getTime()
    );
  });
});
