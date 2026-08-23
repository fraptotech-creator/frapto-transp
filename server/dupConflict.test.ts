import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";
import type { TrpcContext } from "./_core/context";

// Erro de chave DUPLICADA deve virar 409 CONFLICT (não 500). O middleware
// dbErrorMiddleware (trpc.ts) converte a violação de índice único, usando a
// mensagem amigável do dbErrors. Aqui provamos ponta a ponta via createCaller.

const db = vi.hoisted(() => ({
  getOrganization: vi.fn(),
  createVehicle: vi.fn(),
}));
vi.mock("./db", async importOriginal => {
  const actual = await importOriginal<typeof import("./db")>();
  return { ...actual, ...db };
});

import { appRouter } from "./routers";

function ctx(orgId = 1): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "u",
      orgId,
      orgRole: "owner",
      driverId: null,
      username: null,
      passwordHash: null,
      mustChangePassword: false,
      email: "a@b.com",
      name: "A",
      loginMethod: "password",
      role: "user",
      sessionVersion: 0,
      resetTokenHash: null,
      resetTokenExpiraEm: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    } as unknown as TrpcContext["user"],
    req: { headers: {} } as never,
    res: { locals: {} } as never,
  };
}

// Erro cru do mysql2 embrulhado pelo drizzle (cadeia .cause), com ER_DUP_ENTRY.
function dupErr(keyName: string): Error {
  const inner = Object.assign(
    new Error(`Duplicate entry 'x' for key '${keyName}'`),
    { code: "ER_DUP_ENTRY", errno: 1062 }
  );
  return Object.assign(new Error("insert failed"), { cause: inner });
}

const criar = () =>
  appRouter.createCaller(ctx()).vehicles.create({
    placa: "ABC1D23",
    marca: "M",
    modelo: "X",
    ano: 2020,
    tipo: "carro",
  });

describe("mutation com chave duplicada → 409 CONFLICT", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.getOrganization.mockResolvedValue({
      id: 1,
      subscriptionStatus: "active",
    });
  });

  it("placa duplicada → TRPCError CONFLICT com mensagem amigável", async () => {
    db.createVehicle.mockRejectedValue(dupErr("vehicles.placa_org_unique"));
    try {
      await criar();
      throw new Error("deveria ter lançado");
    } catch (e) {
      expect(e).toBeInstanceOf(TRPCError);
      expect((e as TRPCError).code).toBe("CONFLICT");
      expect((e as TRPCError).message).toMatch(/placa/i);
    }
  });

  it("erro NÃO-duplicado continua INTERNAL (não vira CONFLICT)", async () => {
    db.createVehicle.mockRejectedValue(new Error("connection timeout"));
    try {
      await criar();
      throw new Error("deveria ter lançado");
    } catch (e) {
      expect((e as TRPCError).code).toBe("INTERNAL_SERVER_ERROR");
    }
  });
});
