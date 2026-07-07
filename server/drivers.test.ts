import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock do banco de dados para evitar conexão real em testes
vi.mock("./db", async importOriginal => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getDb: vi.fn().mockResolvedValue(null),
    getDrivers: vi.fn().mockResolvedValue([
      {
        id: 1,
        nome: "João Silva",
        cpf: "123.456.789-00",
        cnh: "12345678901",
        status: "disponivel",
        createdAt: new Date(),
      },
    ]),
    getDriverById: vi.fn().mockResolvedValue({
      id: 1,
      nome: "João Silva",
      cpf: "123.456.789-00",
      cnh: "12345678901",
      status: "disponivel",
      createdAt: new Date(),
    }),
  };
});

const createAuthContext = (): TrpcContext => ({
  user: {
    id: 1,
    openId: "test-user",
    orgId: 1,
    orgRole: "owner",
    passwordHash: null,
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

describe("Drivers Router", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeEach(() => {
    caller = appRouter.createCaller(createAuthContext());
  });

  it("should list drivers and return an array", async () => {
    const drivers = await caller.drivers.list();
    expect(Array.isArray(drivers)).toBe(true);
  });

  it("should get driver by id", async () => {
    const driver = await caller.drivers.getById({ id: 1 });
    expect(driver).toBeDefined();
  });
});
