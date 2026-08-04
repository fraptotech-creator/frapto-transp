import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TrpcContext } from "./_core/context";

const driverRow = {
  id: 10,
  orgId: 1,
  nome: "Mot",
  status: "disponivel",
  disponibilidade: true,
  cnhCategoria: "E",
  cnhVencimento: new Date("2027-01-01"),
  dataAdmissao: new Date("2026-01-01"),
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  cpf: "x",
  cnh: "y",
  email: null,
  telefone: null,
  endereco: null,
  observacoes: null,
  trackingToken: null,
  trackingTokenHash: null,
  trackingTokenExpiresAt: null,
  trackingTokenRotatedAt: null,
  trackingTokenRevokedAt: null,
};

const db = vi.hoisted(() => ({
  getOrganization: vi.fn(),
  updateDriver: vi.fn(),
  deleteDriver: vi.fn(),
  deleteDriverUser: vi.fn(),
  getDriverUser: vi.fn(),
  setUserPassword: vi.fn(),
  incrementSessionVersion: vi.fn(),
  revokeTrackingToken: vi.fn(),
  setResetToken: vi.fn(),
  createDriver: vi.fn(),
  getUserByUsername: vi.fn(),
  createDriverUser: vi.fn(),
}));
vi.mock("./db", async importOriginal => {
  const actual = await importOriginal<typeof import("./db")>();
  return { ...actual, ...db };
});

import { appRouter } from "./routers";

function ctx(orgRole: "owner" | "member", orgId = 1): TrpcContext {
  return {
    user: {
      id: 1,
      openId: `user_${orgRole}`,
      orgId,
      orgRole,
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
const caller = (role: "owner" | "member", orgId = 1) =>
  appRouter.createCaller(ctx(role, orgId));

beforeEach(() => {
  vi.clearAllMocks();
  db.getOrganization.mockResolvedValue({ id: 1, subscriptionStatus: "active" });
  db.updateDriver.mockResolvedValue(driverRow);
  db.getDriverUser.mockResolvedValue({ openId: "drv_open", username: "mot" });
  db.setUserPassword.mockResolvedValue(undefined);
  db.incrementSessionVersion.mockResolvedValue(undefined);
  db.revokeTrackingToken.mockResolvedValue(undefined);
  db.setResetToken.mockResolvedValue(undefined);
  db.deleteDriver.mockResolvedValue(undefined);
  db.deleteDriverUser.mockResolvedValue(undefined);
});

describe("drivers — escalada intraempresa fechada (item 2)", () => {
  it("member → 403 em create / update(PII) / setLogin / resetPassword / delete", async () => {
    const c = caller("member");
    await expect(
      c.drivers.create({
        nome: "N",
        cpf: "12345678901",
        cnh: "9",
        cnhCategoria: "B",
        cnhVencimento: new Date(),
        username: "novo",
      })
    ).rejects.toThrow();
    await expect(
      c.drivers.update({ id: 10, cpf: "00000000000" })
    ).rejects.toThrow();
    await expect(
      c.drivers.setLogin({ driverId: 10, username: "x" })
    ).rejects.toThrow();
    await expect(c.drivers.resetPassword({ driverId: 10 })).rejects.toThrow();
    await expect(c.drivers.delete({ id: 10 })).rejects.toThrow();
    // Nenhuma credencial emitida nem sessão invalidada para o member.
    expect(db.setResetToken).not.toHaveBeenCalled();
    expect(db.incrementSessionVersion).not.toHaveBeenCalled();
    expect(db.updateDriver).not.toHaveBeenCalled();
    expect(db.deleteDriver).not.toHaveBeenCalled();
  });

  it("member: setOperational (frota) só grava status/disponibilidade — PII é ignorada", async () => {
    // Campos de PII/credencial passados de má-fé são ignorados pelo zod (fora do
    // schema) e nunca chegam ao updateDriver.
    const input = {
      id: 10,
      status: "viagem" as const,
      disponibilidade: false,
      cpf: "00000000000",
      cnh: "111",
      email: "hack@x.com",
      driverId: 999,
    } as unknown as { id: number; status: "viagem"; disponibilidade: boolean };
    await caller("member").drivers.setOperational(input);
    expect(db.updateDriver).toHaveBeenCalledOnce();
    const [orgId, id, patch] = db.updateDriver.mock.calls[0];
    expect(orgId).toBe(1);
    expect(id).toBe(10);
    expect(patch).toEqual({ status: "viagem", disponibilidade: false });
    for (const k of [
      "cpf",
      "cnh",
      "email",
      "driverId",
      "telefone",
      "endereco",
    ]) {
      expect(patch).not.toHaveProperty(k);
    }
  });

  it("owner: resetPassword emite activationToken e invalida sessão (fluxo legítimo)", async () => {
    const r = await caller("owner").drivers.resetPassword({ driverId: 10 });
    expect(typeof r.activationToken).toBe("string");
    expect(r.activationToken.length).toBeGreaterThan(0);
    expect(db.incrementSessionVersion).toHaveBeenCalledWith("drv_open");
    expect(db.setResetToken).toHaveBeenCalled();
  });

  it("owner: update com PII é permitido e escopado à própria org", async () => {
    await caller("owner", 1).drivers.update({ id: 10, cpf: "12345678901" });
    const [orgId] = db.updateDriver.mock.calls[0];
    expect(orgId).toBe(1);
  });

  it("cross-tenant: owner da org 2 opera escopado por orgId=2 (não a org 1)", async () => {
    await caller("owner", 2).drivers.setOperational({
      id: 10,
      status: "inativo",
    });
    const [orgId] = db.updateDriver.mock.calls[0];
    expect(orgId).toBe(2);
  });
});
