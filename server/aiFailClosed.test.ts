import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TrpcContext } from "./_core/context";

// Provedores de IA mockados — para provar que NÃO são chamados quando não há
// config ativa da org.
const llm = vi.hoisted(() => ({
  invokeLLM: vi.fn(async () => "resposta-ia"),
  invokeOpenAIAgent: vi.fn(async () => "resposta-agente"),
}));
vi.mock("./_core/llm", async importOriginal => {
  const actual = await importOriginal<typeof import("./_core/llm")>();
  return { ...actual, ...llm };
});

const db = vi.hoisted(() => ({
  getOrganization: vi.fn(),
  getAiConfig: vi.fn(),
  getVehicles: vi.fn(async () => []),
  getDrivers: vi.fn(async () => []),
  getTrips: vi.fn(async () => []),
  getMaintenances: vi.fn(async () => []),
  getExpenses: vi.fn(async () => []),
  getRevenues: vi.fn(async () => []),
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
const ask = (orgId = 1) =>
  appRouter
    .createCaller(ctx(orgId))
    .ai.chat({ messages: [{ role: "user", content: "oi" }] });

beforeEach(() => {
  vi.clearAllMocks();
  db.getOrganization.mockResolvedValue({ id: 1, subscriptionStatus: "active" });
});

describe("ai.chat — fail-closed sem config ativa (item 4)", () => {
  it("config DESATIVADA → erro controlado, ZERO chamada ao provedor", async () => {
    db.getAiConfig.mockResolvedValue({
      provider: "anthropic",
      apiKey: "sk-x",
      model: "m",
      baseUrl: null,
      enabled: false,
    });
    await expect(ask()).rejects.toThrow(/não configurado|configure/i);
    expect(llm.invokeLLM).not.toHaveBeenCalled();
    expect(llm.invokeOpenAIAgent).not.toHaveBeenCalled();
  });

  it("config AUSENTE → erro controlado, ZERO chamada ao provedor", async () => {
    db.getAiConfig.mockResolvedValue(undefined);
    await expect(ask()).rejects.toThrow(/não configurado|configure/i);
    expect(llm.invokeLLM).not.toHaveBeenCalled();
    expect(llm.invokeOpenAIAgent).not.toHaveBeenCalled();
  });

  it("config ATIVA da própria org → chamada permitida", async () => {
    db.getAiConfig.mockResolvedValue({
      provider: "anthropic",
      apiKey: "sk-org",
      model: "claude-haiku-4-5",
      baseUrl: null,
      enabled: true,
    });
    const r = await ask();
    expect(r.response).toBe("resposta-ia");
    expect(llm.invokeLLM).toHaveBeenCalledOnce();
    // a config é lida da PRÓPRIA org (escopo) — não de outra.
    expect(db.getAiConfig).toHaveBeenCalledWith(1);
  });
});
