import { describe, it, expect, vi } from "vitest";

// Segredo real (>=32) para assinar/verificar o JWT de sessão.
vi.mock("./_core/env", () => ({
  ENV: {
    cookieSecret: "0123456789012345678901234567890123456789",
    appId: "frapto-transp",
  },
}));

import { sdk } from "./_core/sdk";

describe("verifySession", () => {
  it("aceita sessão com name vazio (usuário sem nome) — trava do bug", async () => {
    const token = await sdk.signSession({
      openId: "user_1",
      appId: "frapto-transp",
      name: "",
      sver: 0,
    });
    const session = await sdk.verifySession(token);
    expect(session).not.toBeNull();
    expect(session?.openId).toBe("user_1");
    expect(session?.sver).toBe(0);
  });

  it("rejeita sessão sem openId", async () => {
    const token = await sdk.signSession({
      openId: "",
      appId: "frapto-transp",
      name: "x",
      sver: 0,
    });
    expect(await sdk.verifySession(token)).toBeNull();
  });

  it("REJEITA sessão sem sver (token legado, não-revogável) — Lote 5", async () => {
    const token = await sdk.signSession({
      openId: "user_1",
      appId: "frapto-transp",
      name: "x",
      // sem sver
    });
    expect(await sdk.verifySession(token)).toBeNull();
  });

  it("REJEITA appId de OUTRA app (isolamento) — Lote 5", async () => {
    const token = await sdk.signSession({
      openId: "user_1",
      appId: "outra-app",
      name: "x",
      sver: 0,
    });
    expect(await sdk.verifySession(token)).toBeNull();
  });

  it("rejeita cookie ausente e lixo", async () => {
    expect(await sdk.verifySession(null)).toBeNull();
    expect(await sdk.verifySession("nao-e-um-jwt")).toBeNull();
  });
});
