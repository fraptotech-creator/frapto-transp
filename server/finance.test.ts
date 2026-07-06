import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock do banco: createExpense/createRevenue não tocam DB real.
vi.mock("./db", async importOriginal => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getDb: vi.fn().mockResolvedValue(null),
    createExpense: vi.fn(async (data: unknown) => ({
      id: 1,
      ...(data as object),
    })),
    createRevenue: vi.fn(async (data: unknown) => ({
      id: 1,
      ...(data as object),
    })),
  };
});

const createAuthContext = (): TrpcContext => ({
  user: {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "google",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  },
  req: { protocol: "https", headers: {} } as never,
  res: {} as never,
});

describe("Finance Router — valor obrigatório", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeEach(() => {
    caller = appRouter.createCaller(createAuthContext());
  });

  it("rejeita despesa com valor não-numérico (fail-closed, não vira null no DB)", async () => {
    await expect(
      caller.expenses.create({
        tipo: "outros",
        descricao: "Teste",
        valor: "abc",
        data: new Date(),
      })
    ).rejects.toThrow(/Valor numérico inválido/);
  });

  it("aceita despesa com valor numérico válido", async () => {
    const result = await caller.expenses.create({
      tipo: "outros",
      descricao: "Teste",
      valor: "10.50",
      data: new Date(),
    });
    expect(result).toBeDefined();
  });

  it("rejeita receita com valor não-numérico", async () => {
    await expect(
      caller.revenues.create({
        tipo: "outros",
        descricao: "Teste",
        valor: "xyz",
        data: new Date(),
      })
    ).rejects.toThrow(/Valor numérico inválido/);
  });
});
