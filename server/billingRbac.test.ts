import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", async importOriginal => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getDb: vi.fn().mockResolvedValue(null),
    getOrganization: vi
      .fn()
      .mockResolvedValue({ id: 1, subscriptionStatus: "active" }),
  };
});

vi.mock("./_core/stripe", () => ({
  createCheckoutSession: vi.fn().mockResolvedValue("https://checkout"),
  createPortalSession: vi.fn().mockResolvedValue("https://portal"),
  isStripeConfigured: () => true,
}));

const ctx = (orgRole: "owner" | "member" | "driver"): TrpcContext => ({
  user: {
    id: 1,
    openId: "u",
    orgId: 1,
    driverId: orgRole === "driver" ? 5 : null,
    orgRole,
    passwordHash: null,
    email: "a@b.com",
    name: "A",
    loginMethod: "password",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  } as TrpcContext["user"],
  req: { protocol: "https", headers: {} } as never,
  res: {} as never,
});

describe("Billing RBAC — só o dono paga/gerencia (Lote 8.1)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("OWNER pode createCheckout e createPortal", async () => {
    const caller = appRouter.createCaller(ctx("owner"));
    expect(await caller.billing.createCheckout()).toEqual({
      url: "https://checkout",
    });
    expect(await caller.billing.createPortal()).toEqual({
      url: "https://portal",
    });
  });

  it("MEMBER é NEGADO em createCheckout e createPortal", async () => {
    const caller = appRouter.createCaller(ctx("member"));
    await expect(caller.billing.createCheckout()).rejects.toThrow(/dono/i);
    await expect(caller.billing.createPortal()).rejects.toThrow(/dono/i);
  });

  it("DRIVER é NEGADO (sandbox) em createCheckout e createPortal", async () => {
    const caller = appRouter.createCaller(ctx("driver"));
    await expect(caller.billing.createCheckout()).rejects.toThrow();
    await expect(caller.billing.createPortal()).rejects.toThrow();
  });

  it("MEMBER ainda consegue ver getStatus (paywall do app não quebra)", async () => {
    const caller = appRouter.createCaller(ctx("member"));
    const s = await caller.billing.getStatus();
    expect(s.active).toBe(true);
  });
});
