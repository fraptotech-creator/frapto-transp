import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock do banco: 1 viagem do motorista 5 (com valor) e 1 do motorista 9.
vi.mock("./db", async importOriginal => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getDb: vi.fn().mockResolvedValue(null),
    getOrganization: vi
      .fn()
      .mockResolvedValue({ id: 1, subscriptionStatus: "active" }),
    getTrips: vi.fn().mockResolvedValue([
      { id: 1, orgId: 1, motoristaId: 5, valor: "2000", status: "planejada" },
      { id: 2, orgId: 1, motoristaId: 9, valor: "3000", status: "planejada" },
    ]),
    getTripById: vi.fn(async (_org: number, id: number) =>
      id === 1
        ? { id: 1, motoristaId: 5, valor: "2000", status: "planejada" }
        : id === 2
          ? { id: 2, motoristaId: 9, valor: "3000", status: "planejada" }
          : undefined
    ),
    updateTrip: vi.fn().mockResolvedValue({}),
    accrueTripKm: vi.fn().mockResolvedValue(undefined),
  };
});

const driverCtx = (): TrpcContext => ({
  user: {
    id: 10,
    openId: "drv-openid",
    orgId: 1,
    driverId: 5,
    orgRole: "driver",
    role: "user",
    username: "joao",
    email: null,
    name: "João",
    passwordHash: "x",
    loginMethod: "password",
    mustChangePassword: false,
    sessionVersion: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  },
  req: { protocol: "https", headers: {} } as any,
  res: {} as any,
});

describe("Área do motorista (segurança)", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;
  beforeEach(() => {
    caller = appRouter.createCaller(driverCtx());
  });

  it("myTrips: só as viagens DELE e SEM o valor", async () => {
    const trips = await caller.driverApp.myTrips();
    expect(trips).toHaveLength(1);
    expect(trips[0].id).toBe(1);
    expect("valor" in trips[0]).toBe(false);
  });

  it("nega ver/iniciar viagem de OUTRO motorista", async () => {
    await expect(caller.driverApp.tripDetail({ id: 2 })).rejects.toThrow(
      /não encontrada/i
    );
    await expect(caller.driverApp.startTrip({ id: 2 })).rejects.toThrow(
      /não encontrada/i
    );
  });

  it("SANDBOX: motorista é bloqueado nos endpoints de gestão", async () => {
    await expect(caller.vehicles.list()).rejects.toThrow(/motorista/i);
    await expect(caller.trips.list()).rejects.toThrow(/motorista/i);
    await expect(caller.expenses.list()).rejects.toThrow(/motorista/i);
  });
});
