import { describe, it, expect } from "vitest";
import { checkReady } from "./_core/health";

describe("checkReady — readiness do banco (item 4)", () => {
  it("banco saudável (SELECT 1 resolve) → pronto", async () => {
    expect(await checkReady(async () => [{ 1: 1 }], 1000)).toBe(true);
  });

  it("banco indisponível (SELECT 1 rejeita) → NÃO pronto", async () => {
    expect(
      await checkReady(async () => {
        throw new Error("ECONNREFUSED");
      }, 1000)
    ).toBe(false);
  });

  it("banco lento além do timeout → NÃO pronto (fail-closed)", async () => {
    // runQuery nunca resolve; o timeout curto vence → false.
    expect(await checkReady(() => new Promise(() => {}), 20)).toBe(false);
  });
});
