import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TrpcContext } from "./_core/context";

// Banco e storage mockados. getDriverById/getDocumentById escopados por orgId
// (para provar isolamento cross-tenant).
const driverOrg1 = {
  id: 10,
  orgId: 1,
  nome: "Mot",
  cpf: "12345678901",
  email: "m@x.com",
  telefone: "27999990000",
  cnh: "99999999999",
  cnhCategoria: "E",
  cnhVencimento: new Date("2027-01-01"),
  status: "disponivel",
  disponibilidade: true,
  endereco: "Rua X",
  dataAdmissao: new Date("2026-01-01"),
  observacoes: null,
  trackingToken: "tok_secreto",
  trackingTokenHash: "hash_secreto",
  trackingTokenExpiresAt: null,
  trackingTokenRotatedAt: null,
  trackingTokenRevokedAt: null,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

const db = vi.hoisted(() => ({
  getOrganization: vi.fn(),
  getDrivers: vi.fn(),
  getDriverById: vi.fn(),
  getDocuments: vi.fn(),
  getDocumentById: vi.fn(),
  recordPiiExport: vi.fn(),
}));
vi.mock("./db", async importOriginal => {
  const actual = await importOriginal<typeof import("./db")>();
  return { ...actual, ...db };
});
const storage = vi.hoisted(() => ({
  getDownloadUrl: vi.fn(async () => "https://r2/download"),
  getViewUrl: vi.fn(async () => "https://r2/view"),
  isStorageConfigured: vi.fn(() => true),
}));
vi.mock("./_core/storage", async importOriginal => {
  const actual = await importOriginal<typeof import("./_core/storage")>();
  return { ...actual, ...storage };
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
  db.getDrivers.mockResolvedValue([driverOrg1]);
  db.getDriverById.mockImplementation(async (orgId: number, id: number) =>
    orgId === driverOrg1.orgId && id === driverOrg1.id ? driverOrg1 : undefined
  );
  db.getDocuments.mockResolvedValue([{ id: 1, orgId: 1, tipo: "cnh" }]);
  db.getDocumentById.mockImplementation(async (orgId: number) =>
    orgId === 1
      ? { id: 1, orgId: 1, arquivoKey: "k", descricao: "d" }
      : undefined
  );
  db.recordPiiExport.mockResolvedValue(undefined);
});

describe("PII/documentos — autorização server-side (item 2)", () => {
  it("member → 403 em drivers.pii / piiById / exportPii", async () => {
    const c = caller("member");
    await expect(c.drivers.pii()).rejects.toThrow(/dono|FORBIDDEN|pessoais/i);
    await expect(c.drivers.piiById({ id: 10 })).rejects.toThrow();
    await expect(c.drivers.exportPii()).rejects.toThrow();
    expect(db.recordPiiExport).not.toHaveBeenCalled();
  });

  it("member → 403 em documents.list / downloadUrl / viewUrl", async () => {
    const c = caller("member");
    await expect(c.documents.list()).rejects.toThrow();
    await expect(c.documents.downloadUrl({ id: 1 })).rejects.toThrow();
    await expect(c.documents.viewUrl({ id: 1 })).rejects.toThrow();
  });

  it("owner: drivers.pii retorna PII mas SEM token/hash", async () => {
    const rows = (await caller("owner").drivers.pii()) as Record<
      string,
      unknown
    >[];
    expect(rows[0].cpf).toBe("12345678901");
    expect(rows[0]).not.toHaveProperty("trackingToken");
    expect(rows[0]).not.toHaveProperty("trackingTokenHash");
  });

  it("owner: exportPii registra auditoria SEM PII (ator/org/tipo/quantidade)", async () => {
    await caller("owner").drivers.exportPii();
    expect(db.recordPiiExport).toHaveBeenCalledOnce();
    const arg = db.recordPiiExport.mock.calls[0][0] as Record<string, unknown>;
    expect(arg).toEqual({
      orgId: 1,
      actorOpenId: "user_owner",
      exportType: "drivers",
      recordCount: 1,
    });
    // trilha não carrega PII/segredo
    const s = JSON.stringify(arg);
    for (const leak of [
      "12345678901",
      "99999999999",
      "m@x.com",
      "tok_secreto",
    ]) {
      expect(s).not.toContain(leak);
    }
  });

  it("owner: documents.downloadUrl da própria org funciona", async () => {
    const r = await caller("owner").documents.downloadUrl({ id: 1 });
    expect(r.url).toBe("https://r2/download");
  });

  it("cross-tenant: owner da org 2 NÃO obtém o motorista da org 1", async () => {
    // getDriverById escopa por orgId=2 → undefined (não vaza a PII da org 1).
    const r = await caller("owner", 2).drivers.piiById({ id: 10 });
    expect(r).toBeUndefined();
  });
});
