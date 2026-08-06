import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import {
  commitStripeEffectCore,
  type LeaseExecutor,
  type OrgSubscriptionEffect,
} from "./db/organizations";

// ./db mockado: getOrganization/updateOrganization/getDriverByTrackingToken
// controlados por teste; getDb null (nenhuma query real).
vi.mock("./db", async importOriginal => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getDb: vi.fn().mockResolvedValue(null),
    getOrganization: vi.fn(),
    updateOrganization: vi.fn().mockResolvedValue(undefined),
    getDriverByTrackingToken: vi.fn(),
    migrateTrackingTokenToHash: vi.fn().mockResolvedValue(undefined),
  };
});
// Payload de rastreio válido e token não-bloqueado, para chegar ao gate de acesso.
vi.mock("./_core/trackIngest", async importOriginal => {
  const actual = await importOriginal<typeof import("./_core/trackIngest")>();
  return {
    ...actual,
    normalizeTrackPayload: () => ({
      token: "tok",
      points: [{ lat: -20, lng: -40 }],
    }),
  };
});
vi.mock("./_core/tracking", async importOriginal => {
  const actual = await importOriginal<typeof import("./_core/tracking")>();
  return { ...actual, trackingTokenBloqueado: () => false };
});

import * as db from "./db";
import { handleTrackIngest } from "./routers/trackHttp";

const getOrganization = vi.mocked(db.getOrganization);
const updateOrganization = vi.mocked(db.updateOrganization);
const getDriverByTrackingToken = vi.mocked(db.getDriverByTrackingToken);

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

function fakeRes() {
  const r = { statusCode: 0, body: null as unknown } as Response & {
    statusCode: number;
    body: unknown;
  };
  r.status = ((c: number) => {
    r.statusCode = c;
    return r;
  }) as Response["status"];
  r.json = ((b: unknown) => {
    r.body = b;
    return r;
  }) as Response["json"];
  return r;
}

beforeEach(() => vi.clearAllMocks());

describe("override de acesso — RBAC do setAccess (só super-admin)", () => {
  it("OWNER e MEMBER comuns NÃO executam superAdmin.setAccess", async () => {
    getOrganization.mockResolvedValue({
      id: 1,
      subscriptionStatus: "active",
    } as never);
    for (const role of ["owner", "member"] as const) {
      const caller = appRouter.createCaller(ctx(role));
      await expect(
        caller.superAdmin.setAccess({ orgId: 1, acao: "bloquear" })
      ).rejects.toThrow();
    }
    expect(updateOrganization).not.toHaveBeenCalled();
  });
});

describe("override de acesso — gate tRPC (activeOrgProcedure)", () => {
  it("'blocked' NEGA mesmo com Stripe ativo", async () => {
    getOrganization.mockResolvedValue({
      id: 1,
      subscriptionStatus: "active",
      accessOverride: "blocked",
    } as never);
    const caller = appRouter.createCaller(ctx("member"));
    await expect(caller.documents.status()).rejects.toThrow();
  });

  it("'active' LIBERA mesmo com Stripe inativo", async () => {
    getOrganization.mockResolvedValue({
      id: 1,
      subscriptionStatus: "canceled",
      accessOverride: "active",
    } as never);
    const caller = appRouter.createCaller(ctx("member"));
    await expect(caller.documents.status()).resolves.toBeDefined();
  });
});

describe("override de acesso — gate /api/track (REST nativo)", () => {
  it("'blocked' NEGA a ingestão (402) mesmo com Stripe ativo", async () => {
    getDriverByTrackingToken.mockResolvedValue({
      orgId: 1,
      id: 5,
      trackingTokenHash: "h",
    } as never);
    getOrganization.mockResolvedValue({
      id: 1,
      subscriptionStatus: "active",
      accessOverride: "blocked",
    } as never);
    const res = fakeRes();
    await handleTrackIngest({ body: {} } as Request, res);
    expect(res.statusCode).toBe(402);
  });
});

describe("override de acesso — webhook Stripe NÃO toca accessOverride", () => {
  it("o efeito aplicado à org não contém a chave accessOverride", async () => {
    let applied: Record<string, unknown> | null = null;
    const effect: OrgSubscriptionEffect = {
      subscriptionStatus: "active",
      stripeSubscriptionId: "sub_1",
      currentPeriodEnd: null,
    };
    const exec: LeaseExecutor = {
      lockEvent: async () => ({ status: "processing", attempts: 0 }),
      lockOrgState: async () => ({
        subscriptionStatus: "none",
        lastStripeEventAt: null,
      }),
      applyOrgEffect: async (_orgId, eff) => {
        applied = eff as Record<string, unknown>;
      },
      markProcessed: async () => 1,
    };
    const out = await commitStripeEffectCore(exec, {
      eventId: "e",
      generation: 0,
      orgId: 1,
      effect,
      eventCreatedAt: new Date(1),
    });
    expect(out).toBe("committed");
    expect(applied).not.toBeNull();
    expect(Object.keys(applied ?? {})).not.toContain("accessOverride");
  });
});
