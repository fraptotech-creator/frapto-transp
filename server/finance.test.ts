import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock do banco: createExpense/createRevenue não tocam DB real.
vi.mock("./db", async importOriginal => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getDb: vi.fn().mockResolvedValue(null),
    getOrganization: vi
      .fn()
      .mockResolvedValue({ id: 1, subscriptionStatus: "active" }),
    createExpense: vi.fn(async (data: unknown) => ({
      id: 1,
      ...(data as object),
    })),
    createRevenue: vi.fn(async (data: unknown) => ({
      id: 1,
      ...(data as object),
    })),
    updateExpense: vi.fn(async () => ({ id: 1 })),
    updateRevenue: vi.fn(async () => ({ id: 1 })),
    // Modela POSSE por org: só o id "próprio" existe; qualquer outro id
    // (de outra empresa) resolve para undefined → assertRefsOwned rejeita.
    getVehicleById: vi.fn(async (_orgId: number, id: number) =>
      id === 10 ? { id: 10 } : undefined
    ),
    getDriverById: vi.fn(async (_orgId: number, id: number) =>
      id === 11 ? { id: 11 } : undefined
    ),
    getTripById: vi.fn(async (_orgId: number, id: number) =>
      id === 20 ? { id: 20 } : undefined
    ),
  };
});

import * as db from "./db";

const createAuthContext = (): TrpcContext => ({
  user: {
    id: 1,
    openId: "test-user",
    orgId: 1,
    orgRole: "owner",
    passwordHash: null,
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

describe("Finance Router — posse cross-tenant na EDIÇÃO (P1 #8)", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeEach(() => {
    vi.clearAllMocks();
    caller = appRouter.createCaller(createAuthContext());
  });

  it("expense.update REJEITA veículo de outra org e NÃO grava", async () => {
    await expect(
      caller.expenses.update({ id: 1, veiculoId: 999 })
    ).rejects.toThrow(/inválido/i);
    expect(db.updateExpense).not.toHaveBeenCalled();
  });

  it("expense.update REJEITA viagem de outra org e NÃO grava", async () => {
    await expect(
      caller.expenses.update({ id: 1, viagemId: 999 })
    ).rejects.toThrow(/inválid/i);
    expect(db.updateExpense).not.toHaveBeenCalled();
  });

  it("expense.update aceita referência da PRÓPRIA org", async () => {
    await caller.expenses.update({ id: 1, veiculoId: 10, motoristId: 11 });
    expect(db.updateExpense).toHaveBeenCalledOnce();
  });

  it("revenue.update REJEITA viagem de outra org e NÃO grava", async () => {
    await expect(
      caller.revenues.update({ id: 1, viagemId: 999 })
    ).rejects.toThrow(/inválid/i);
    expect(db.updateRevenue).not.toHaveBeenCalled();
  });

  it("revenue.update aceita viagem da PRÓPRIA org", async () => {
    await caller.revenues.update({ id: 1, viagemId: 20 });
    expect(db.updateRevenue).toHaveBeenCalledOnce();
  });
});
