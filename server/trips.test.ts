import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock do banco de dados para evitar conexão real em testes
vi.mock("./db", async importOriginal => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getDb: vi.fn().mockResolvedValue(null),
    getTrips: vi.fn().mockResolvedValue([
      {
        id: 1,
        numeroViagem: "V-20260427-001",
        origem: "São Paulo, SP",
        destino: "Rio de Janeiro, RJ",
        status: "planejada",
        veiculoId: 1,
        motoristaId: 1,
        createdAt: new Date(),
      },
    ]),
    getTripById: vi.fn().mockResolvedValue({
      id: 1,
      numeroViagem: "V-20260427-001",
      origem: "São Paulo, SP",
      destino: "Rio de Janeiro, RJ",
      status: "planejada",
      veiculoId: 1,
      motoristaId: 1,
      createdAt: new Date(),
    }),
  };
});

const createAuthContext = (): TrpcContext => ({
  user: {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  },
  req: { protocol: "https", headers: {} } as any,
  res: {} as any,
});

describe("Trips Router", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeEach(() => {
    caller = appRouter.createCaller(createAuthContext());
  });

  it("should list trips and return an array", async () => {
    const trips = await caller.trips.list();
    expect(Array.isArray(trips)).toBe(true);
  });

  it("should get trip by id", async () => {
    const trip = await caller.trips.getById({ id: 1 });
    expect(trip).toBeDefined();
  });
});
