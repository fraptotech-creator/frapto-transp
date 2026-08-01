import { describe, it, expect } from "vitest";
import { decideBoot, type BootEnv } from "./_core/bootGuard";

// Produção completa e válida.
const prodOk: BootEnv = {
  nodeEnv: "production",
  onRailway: true,
  jwtSecretLen: 44,
  hasDatabaseUrl: true,
  hasAppBaseUrl: true,
  aiKeyBytes: 32,
};

describe("decideBoot — fail-closed (Lote D)", () => {
  it("Railway + NODE_ENV ausente → boot NEGADO", () => {
    const d = decideBoot({ ...prodOk, nodeEnv: undefined });
    expect(d.ok).toBe(false);
    if (!d.ok) expect(d.problems.join(" ")).toMatch(/NODE_ENV/);
  });

  it("Railway + NODE_ENV inválido → boot NEGADO", () => {
    const d = decideBoot({ ...prodOk, nodeEnv: "prod" });
    expect(d.ok).toBe(false);
    if (!d.ok) expect(d.problems.join(" ")).toMatch(/NODE_ENV/);
  });

  it("Railway + production + segredo ausente → boot NEGADO", () => {
    expect(decideBoot({ ...prodOk, jwtSecretLen: 10 }).ok).toBe(false);
    expect(decideBoot({ ...prodOk, hasDatabaseUrl: false }).ok).toBe(false);
    expect(decideBoot({ ...prodOk, hasAppBaseUrl: false }).ok).toBe(false);
    expect(decideBoot({ ...prodOk, aiKeyBytes: 0 }).ok).toBe(false);
    expect(decideBoot({ ...prodOk, aiKeyBytes: 16 }).ok).toBe(false);
  });

  it("produção válida → boot PERMITIDO (mode production)", () => {
    const d = decideBoot(prodOk);
    expect(d).toEqual({ ok: true, mode: "production" });
  });

  it("NODE_ENV=production fora do Railway + segredos → permitido", () => {
    const d = decideBoot({ ...prodOk, onRailway: false });
    expect(d).toEqual({ ok: true, mode: "production" });
  });

  it("NODE_ENV=production fora do Railway SEM segredo → NEGADO", () => {
    const d = decideBoot({
      ...prodOk,
      onRailway: false,
      hasDatabaseUrl: false,
    });
    expect(d.ok).toBe(false);
  });

  it("dev local explícito (development, sem Railway) → permitido, sem exigir segredo", () => {
    const d = decideBoot({
      nodeEnv: "development",
      onRailway: false,
      jwtSecretLen: 0,
      hasDatabaseUrl: false,
      hasAppBaseUrl: false,
      aiKeyBytes: 0,
    });
    expect(d).toEqual({ ok: true, mode: "development" });
  });

  it("ambiente desconhecido (NODE_ENV ausente, sem Railway) → dev seguro (sobe local, sem produção)", () => {
    const d = decideBoot({
      nodeEnv: undefined,
      onRailway: false,
      jwtSecretLen: 0,
      hasDatabaseUrl: false,
      hasAppBaseUrl: false,
      aiKeyBytes: 0,
    });
    expect(d).toEqual({ ok: true, mode: "development" });
  });
});
