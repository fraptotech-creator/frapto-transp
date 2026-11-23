import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TrpcContext } from "./_core/context";
import { decidirExclusaoVeiculo } from "./_core/veiculoExclusao";

// Trava do teste pré-venda 23/11/2026: excluir veículo com histórico deixava
// viagens/manutenções/despesas órfãs somando no financeiro. Decisão do dono:
// BLOQUEAR (o caminho é o status Inativo).
const db = vi.hoisted(() => ({
  getOrganization: vi.fn(),
  contarHistoricoVeiculo: vi.fn(),
  deleteVehicle: vi.fn(),
}));
vi.mock("./db", async importOriginal => {
  const actual = await importOriginal<typeof import("./db")>();
  return { ...actual, ...db };
});

import { appRouter } from "./routers";

const VAZIO = { viagens: 0, manutencoes: 0, despesas: 0, documentos: 0 };

function ctx(orgId = 1): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "user_owner",
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

describe("decidirExclusaoVeiculo", () => {
  it("sem histórico → pode excluir", () => {
    expect(decidirExclusaoVeiculo(VAZIO)).toEqual({ ok: true });
  });

  it("qualquer vínculo bloqueia", () => {
    for (const campo of Object.keys(VAZIO)) {
      const r = decidirExclusaoVeiculo({ ...VAZIO, [campo]: 1 });
      expect(r.ok).toBe(false);
    }
  });

  it("mensagem lista o que existe, com plural, e indica o Inativo", () => {
    const r = decidirExclusaoVeiculo({
      viagens: 3,
      manutencoes: 1,
      despesas: 0,
      documentos: 2,
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.mensagem).toContain("3 viagens, 1 manutenção e 2 documentos");
    expect(r.mensagem).not.toContain("despesa");
    expect(r.mensagem).toContain("Inativo");
  });
});

describe("vehicles.delete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.getOrganization.mockImplementation(async (id: number) => ({
      id,
      subscriptionStatus: "active",
      accessOverride: null,
    }));
    db.deleteVehicle.mockResolvedValue({ success: true });
  });

  it("veículo sem histórico é excluído, escopado pela org do contexto", async () => {
    db.contarHistoricoVeiculo.mockResolvedValue(VAZIO);
    await appRouter.createCaller(ctx(7)).vehicles.delete({ id: 42 });
    expect(db.contarHistoricoVeiculo).toHaveBeenCalledWith(7, 42);
    expect(db.deleteVehicle).toHaveBeenCalledWith(7, 42);
  });

  it("veículo com histórico NÃO é excluído", async () => {
    db.contarHistoricoVeiculo.mockResolvedValue({ ...VAZIO, manutencoes: 2 });
    await expect(
      appRouter.createCaller(ctx(7)).vehicles.delete({ id: 42 })
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(db.deleteVehicle).not.toHaveBeenCalled();
  });
});
