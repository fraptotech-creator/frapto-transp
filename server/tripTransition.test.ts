import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Estado atual da viagem que o mock de getTripById devolve — cada teste ajusta.
const state = { status: "planejada" as string };

vi.mock("./db", async importOriginal => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getDb: vi.fn().mockResolvedValue(null),
    getOrganization: vi
      .fn()
      .mockResolvedValue({ id: 1, subscriptionStatus: "active" }),
    getTripById: vi.fn(async (_orgId: number, id: number) => ({
      id,
      orgId: 1,
      status: state.status,
      veiculoId: 10,
      motoristaId: 11,
    })),
    updateTrip: vi.fn(async (_o: number, id: number) => ({ id })),
    accrueTripKm: vi.fn(async () => undefined),
  };
});

import * as db from "./db";

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

describe("trips.updateStatus — máquina de estados (P1 #9)", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;
  beforeEach(() => {
    vi.clearAllMocks();
    caller = appRouter.createCaller(ctx());
  });

  it("REJEITA reabrir concluída e NÃO grava nem soma odômetro", async () => {
    state.status = "concluida";
    await expect(
      caller.trips.updateStatus({ id: 1, status: "em_andamento" })
    ).rejects.toThrow(/inválida/i);
    expect(db.updateTrip).not.toHaveBeenCalled();
    expect(db.accrueTripKm).not.toHaveBeenCalled();
  });

  it("REJEITA pular planejada → concluida", async () => {
    state.status = "planejada";
    await expect(
      caller.trips.updateStatus({ id: 1, status: "concluida" })
    ).rejects.toThrow(/inválida/i);
    expect(db.updateTrip).not.toHaveBeenCalled();
  });

  it("ACEITA planejada → em_andamento", async () => {
    state.status = "planejada";
    await caller.trips.updateStatus({ id: 1, status: "em_andamento" });
    expect(db.updateTrip).toHaveBeenCalledOnce();
  });

  it("ACEITA em_andamento → concluida e soma odômetro uma vez", async () => {
    state.status = "em_andamento";
    await caller.trips.updateStatus({ id: 1, status: "concluida" });
    expect(db.updateTrip).toHaveBeenCalledOnce();
    expect(db.accrueTripKm).toHaveBeenCalledOnce();
  });
});
