import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TrpcContext } from "./_core/context";

// maintenance.delete não existia: lançamento errado ficava para sempre e
// seguia somando no financeiro (teste pré-venda 23/11/2026). Trava: só o
// DONO exclui, e sempre escopado pela org do contexto (nunca do input).
const db = vi.hoisted(() => ({
  getOrganization: vi.fn(),
  deleteMaintenance: vi.fn(),
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
  db.getOrganization.mockImplementation(async (id: number) => ({
    id,
    subscriptionStatus: "active",
    accessOverride: null,
  }));
  db.deleteMaintenance.mockResolvedValue({ success: true });
});

describe("maintenance.delete", () => {
  it("dono exclui, escopado pela org do CONTEXTO", async () => {
    await caller("owner", 7).maintenance.delete({ id: 42 });
    expect(db.deleteMaintenance).toHaveBeenCalledWith(7, 42);
  });

  it("membro NÃO exclui", async () => {
    await expect(
      caller("member").maintenance.delete({ id: 42 })
    ).rejects.toThrow();
    expect(db.deleteMaintenance).not.toHaveBeenCalled();
  });

  it("orgId no input é ignorado (zod descarta)", async () => {
    await caller("owner", 7).maintenance.delete({
      id: 42,
      orgId: 999,
    } as never);
    expect(db.deleteMaintenance).toHaveBeenCalledWith(7, 42);
  });
});
