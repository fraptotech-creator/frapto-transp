import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock do banco de dados para evitar conexão real em testes
vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getDb: vi.fn().mockResolvedValue(null),
    getVehicles: vi.fn().mockResolvedValue([
      { id: 1, placa: "ABC-1234", modelo: "Volvo FH", marca: "Volvo", ano: 2022, status: "ativo", createdAt: new Date() },
    ]),
    getVehicleById: vi.fn().mockResolvedValue(
      { id: 1, placa: "ABC-1234", modelo: "Volvo FH", marca: "Volvo", ano: 2022, status: "ativo", createdAt: new Date() }
    ),
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

describe("Vehicles Router", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeEach(() => {
    caller = appRouter.createCaller(createAuthContext());
  });

  it("should list vehicles and return an array", async () => {
    const vehicles = await caller.vehicles.list();
    expect(Array.isArray(vehicles)).toBe(true);
  });

  it("should get vehicle by id", async () => {
    const vehicle = await caller.vehicles.getById({ id: 1 });
    expect(vehicle).toBeDefined();
  });
});
