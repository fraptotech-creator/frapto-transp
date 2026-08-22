import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { DEFAULT_NOTIFICATION_SETTINGS as DEF } from "./_core/notifications";

vi.mock("./db", async importOriginal => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getDb: vi.fn().mockResolvedValue(null),
    getOrganization: vi
      .fn()
      .mockResolvedValue({ id: 1, subscriptionStatus: "active" }),
    getNotificationSettings: vi.fn().mockResolvedValue(undefined),
    upsertNotificationSettings: vi.fn().mockResolvedValue(undefined),
  };
});

import * as db from "./db";
const upsert = vi.mocked(db.upsertNotificationSettings);

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

const valido = {
  cnhEnabled: true,
  cnhDiasAntes: 30,
  crlvEnabled: true,
  crlvDiasAntes: 30,
  manutencaoEnabled: true,
  manutencaoDiasAntes: 7,
  oleoEnabled: true,
  oleoPercentAntes: 10,
  documentosEnabled: true,
  documentosDiasAntes: 30,
  urgenciaAltaDiasAntes: 7,
};

beforeEach(() => vi.clearAllMocks());

describe("settings.notificationSettings — RBAC (owner-only)", () => {
  it("MEMBER e DRIVER são NEGADOS em get e update", async () => {
    for (const role of ["member", "driver"] as const) {
      const caller = appRouter.createCaller(ctx(role));
      await expect(caller.settings.getNotificationSettings()).rejects.toThrow();
      await expect(
        caller.settings.updateNotificationSettings(valido)
      ).rejects.toThrow();
    }
    expect(upsert).not.toHaveBeenCalled();
  });

  it("OWNER lê os defaults quando não há linha", async () => {
    const caller = appRouter.createCaller(ctx("owner"));
    const s = await caller.settings.getNotificationSettings();
    expect(s).toEqual(DEF);
  });

  it("OWNER salva config válida", async () => {
    const caller = appRouter.createCaller(ctx("owner"));
    await expect(
      caller.settings.updateNotificationSettings({
        ...valido,
        cnhDiasAntes: 45,
      })
    ).resolves.toEqual({ success: true });
    expect(upsert).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ cnhDiasAntes: 45 })
    );
  });
});

describe("settings.notificationSettings — validação (zod)", () => {
  it("rejeita dias fora de 1..365 e óleo fora de 1..50", async () => {
    const caller = appRouter.createCaller(ctx("owner"));
    const casos = [
      { ...valido, cnhDiasAntes: 0 },
      { ...valido, crlvDiasAntes: 400 },
      { ...valido, oleoPercentAntes: 0 },
      { ...valido, oleoPercentAntes: 80 },
      { ...valido, manutencaoDiasAntes: 1.5 },
    ];
    for (const c of casos) {
      await expect(
        caller.settings.updateNotificationSettings(c)
      ).rejects.toThrow();
    }
    expect(upsert).not.toHaveBeenCalled();
  });
});
