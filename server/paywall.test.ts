import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Org SEM assinatura ativa (status "none").
vi.mock("./db", async importOriginal => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getDb: vi.fn().mockResolvedValue(null),
    getOrganization: vi
      .fn()
      .mockResolvedValue({ id: 1, subscriptionStatus: "none" }),
    getVehicles: vi.fn().mockResolvedValue([]),
  };
});

const ctx = (): TrpcContext => ({
  user: {
    id: 1,
    openId: "u",
    orgId: 1,
    orgRole: "owner",
    passwordHash: null,
    email: "a@b.com",
    name: "A",
    loginMethod: "password",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  },
  req: { protocol: "https", headers: {} } as never,
  res: {} as never,
});

describe("Paywall — sem assinatura ativa", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;
  beforeEach(() => {
    caller = appRouter.createCaller(ctx());
  });

  it("bloqueia features do sistema (vehicles.list) com SUBSCRIPTION_REQUIRED", async () => {
    await expect(caller.vehicles.list()).rejects.toThrow(
      /SUBSCRIPTION_REQUIRED/
    );
  });

  it("permite consultar o status de cobrança mesmo sem assinatura", async () => {
    const status = await caller.billing.getStatus();
    expect(status.active).toBe(false);
    expect(status.status).toBe("none");
  });
});
